var _wd_attempts = 0;
function _wd_init() {
  var windBox   = document.getElementById("wd-wind-box");
  var indoorBox = document.getElementById("wd-indoor-box");
  var condBox   = document.getElementById("wd-condition-box");
  var modal     = document.getElementById("wd-modal");
  var modalBody = document.getElementById("wd-modal-body");
  var modalHead = document.getElementById("wd-modal-head");
  var modalTitle= document.getElementById("wd-modal-title");
  var modalOk   = document.getElementById("wd-modal-ok");
  var hero      = document.getElementById("wd-hero");

  if (!windBox || !indoorBox || !modal || !hero) {
    _wd_attempts++;
    if (_wd_attempts < 60) { setTimeout(_wd_init, 100); }
    return;
  }

  var API_URL     = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/live";
  var PIEZO_URL   = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/piezo";
  var OW_URL      = "https://api.openweathermap.org/data/2.5/weather?lat=10.9081&lon=76.2296&appid=ca13a2cbdc07e7613b6af82cff262295&units=metric";
  var NOWCAST_URL = "https://elwoic-nowcast-engine.bold-waterfall-0d01.workers.dev/";

  var latestWind          = null;
  var latestCondition     = "";
  var latestNowcastFull   = "";
  var latestNowcastIndoor = "";
  var latestNowcastWind   = "";
  var latestMain          = {};

  /* ══════════════════════════════════════════
     RAIN MEMORY BUFFER (rate-based, ~5 min window)
     (Kept for background color engine)
  ══════════════════════════════════════════ */
  var rainBuf      = [];
  var RAIN_BUF_MAX = 10;
  var lastDailyMm  = 0;

  function pushRain(rate, daily) {
    rainBuf.push({ rate: rate || 0, daily: daily || 0 });
    if (rainBuf.length > RAIN_BUF_MAX) rainBuf.shift();
    if (daily > lastDailyMm) lastDailyMm = daily;
  }

  function rainJustStopped() {
    if (rainBuf.length < 2) return false;
    var last = rainBuf[rainBuf.length - 1];
    if (last.rate > 0) return false;
    for (var i = 0; i < rainBuf.length - 1; i++) {
      if (rainBuf[i].rate > 0) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════
     PIEZO RAIN-SENSOR LOGIC
     (Kept for background color engine)
  ══════════════════════════════════════════ */
  var PIEZO_GRACE_MINUTES = 4;

  function countTrailingOnes(arr) {
    var c = 0;
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === 1) c++; else break;
    }
    return c;
  }

  /* ══════════════════════════════════════════
     BEAUFORT SCALE
  ══════════════════════════════════════════ */
  function beaufort(kmh) {
    var scale = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    var desc  = ["Calm","Light air","Light breeze","Gentle breeze","Moderate breeze",
                 "Fresh breeze","Strong breeze","Near gale","Gale","Strong gale","Storm","Violent storm","Hurricane"];
    var b = scale.findIndex(function(v){ return kmh < v; });
    return { force: b === -1 ? 12 : b, description: desc[b === -1 ? 12 : b] };
  }

  /* ══════════════════════════════════════════
     COLOR ENGINE
  ══════════════════════════════════════════ */
  var HERO_PALETTES = {
    "sunny":         { dim:[[192,85,10],[218,110,10],[235,175,50]],     bright:[[214,100,10],[240,150,15],[250,210,90]] },
    "partial":       { dim:[[40,95,140],[60,130,175],[110,175,205]],    bright:[[26,111,168],[45,156,219],[126,200,227]] },
    "cloudy":        { dim:[[50,62,76],[78,92,106],[118,132,146]],      bright:[[75,95,113],[112,130,148],[163,178,190]] },
    "overcast":      { dim:[[38,46,58],[58,68,80],[92,104,116]],        bright:[[55,65,78],[82,95,108],[122,135,148]] },
    "fog":           { dim:[[104,112,120],[140,148,154],[176,182,186]], bright:[[130,138,145],[165,172,177],[198,203,206]] },
    "rain":          { dim:[[10,26,42],[18,46,74],[28,68,102]],         bright:[[46,90,128],[70,124,163],[108,160,190]] },
    "storm":         { dim:[[8,10,16],[20,18,32],[34,28,48]],           bright:[[18,20,30],[35,32,50],[52,46,68]] },
    "night-clear":   { dim:[[6,13,22],[13,22,35],[21,35,53]],           bright:[[16,28,44],[28,45,68],[44,68,98]] },
    "night-cloud":   { dim:[[18,21,30],[32,37,48],[50,57,70]],          bright:[[36,41,54],[55,62,78],[80,88,104]] }
  };

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function lerpRGB(c1,c2,t){
    return [ Math.round(lerp(c1[0],c2[0],t)), Math.round(lerp(c1[1],c2[1],t)), Math.round(lerp(c1[2],c2[2],t)) ];
  }
  function rgbCss(c){ return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  function paletteFor(familyKey, t) {
    var p = HERO_PALETTES[familyKey] || HERO_PALETTES.partial;
    var tt = clamp01(t);
    return [
      rgbCss(lerpRGB(p.dim[0], p.bright[0], tt)),
      rgbCss(lerpRGB(p.dim[1], p.bright[1], tt)),
      rgbCss(lerpRGB(p.dim[2], p.bright[2], tt))
    ];
  }

  function computeFamilyAndIntensity(rain, solar, uvi, humidity, piezoArr, cloudPct, isDayFlag) {
    if (rain > 0) {
      if (rain >= 50) {
        var extreme = clamp01((rain - 50) / 100);
        return { family: "storm", t: clamp01(1 - extreme) };
      }
      var solarNorm = solar != null ? clamp01(solar / 500) : (uvi != null ? clamp01(uvi / 6) : 0);
      var rateNorm  = clamp01(rain / 50);
      var t = solarNorm * (1 - rateNorm * 0.6);
      return { family: "rain", t: t };
    }

    if (rainJustStopped()) {
      var sunAlreadyOut = (solar != null && solar > 150) || (uvi != null && uvi >= 3);
      if (!sunAlreadyOut) {
        var clearFrac = cloudPct != null ? clamp01(1 - cloudPct / 100) : 0.3;
        return { family: "rain", t: clamp01(0.3 + clearFrac * 0.4) };
      }
    } else if (piezoArr && piezoArr.length) {
      var piezoNow = piezoArr[piezoArr.length - 1];
      if (piezoNow === 1) {
        var wetStreak = countTrailingOnes(piezoArr);
        if (wetStreak <= PIEZO_GRACE_MINUTES) {
          return { family: "rain", t: 0.25 };
        }
      }
    }

    if (isDayFlag) {
      if (humidity != null && humidity >= 95 && (solar == null || solar < 80)) {
        return { family: "fog", t: cloudPct != null ? clamp01(1 - cloudPct / 100) : 0.4 };
      }
      if (solar != null) {
        if (solar >= 700)              return { family: "sunny",    t: clamp01((solar - 700) / 300) + 0.5 };
        if (solar >= 350 && uvi >= 4) return { family: "sunny",    t: clamp01((solar - 350) / 350) };
        if (solar >= 120)              return { family: "partial", t: clamp01((solar - 120) / 230) };

        var cloudLow = cloudPct != null ? cloudPct : 70;
        if (cloudLow >= 85) return { family: "overcast", t: clamp01(solar / 120) };
        if (solar >= 20)    return { family: "cloudy",   t: clamp01(solar / 20) };
        return                                { family: "cloudy",   t: 0.1 };
      }
      if (uvi != null) {
        if (uvi >= 7) return { family: "sunny",    t: clamp01((uvi - 7) / 5) + 0.5 };
        if (uvi >= 4) return { family: "partial", t: clamp01((uvi - 4) / 3) };
        if (uvi >= 1) {
          var cloudMid = cloudPct != null ? cloudPct : 60;
          if (cloudMid >= 85) return { family: "overcast", t: clamp01(uvi / 4) };
          return { family: "cloudy", t: clamp01(uvi / 4) };
        }
        return { family: "cloudy", t: 0.05 };
      }

      var cloud = cloudPct != null ? cloudPct : 50;
      if (cloud >= 85) return { family: "overcast", t: 0.2 };
      if (cloud >= 45) return { family: "cloudy",  t: clamp01(1 - cloud / 100) };
      if (cloud >= 15) return { family: "partial", t: clamp01(1 - cloud / 100) };
      return { family: "sunny", t: 0.6 };
    }

    if (humidity != null) {
      if (humidity >= 95) return { family: "fog", t: 0.15 };
      if (humidity >= 88) return { family: "fog", t: 0.3 };
    }
    var nCloud = cloudPct != null ? cloudPct : 50;
    if (nCloud >= 45) return { family: "night-cloud", t: clamp01(1 - nCloud / 100) };
    return { family: "night-clear", t: clamp01(1 - nCloud / 100) };
  }

  var heroAnim = { raf: null };

  function parseRgb(str) {
    var m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(str || "");
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function animateHeroBackground(targetCss) {
    var cs = getComputedStyle(hero);
    var fromCss = [
      cs.getPropertyValue("--hc1").trim(),
      cs.getPropertyValue("--hc2").trim(),
      cs.getPropertyValue("--hc3").trim()
    ];
    var from = [
      parseRgb(fromCss[0]) || parseRgb(targetCss[0]),
      parseRgb(fromCss[1]) || parseRgb(targetCss[1]),
      parseRgb(fromCss[2]) || parseRgb(targetCss[2])
    ];
    var to = targetCss.map(parseRgb);

    if (heroAnim.raf) cancelAnimationFrame(heroAnim.raf);

    var start = null;
    var DURATION = 1200;

    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / DURATION);
      var eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; 
      for (var i = 0; i < 3; i++) {
        hero.style.setProperty("--hc" + (i + 1), rgbCss(lerpRGB(from[i], to[i], eased)));
      }
      if (p < 1) heroAnim.raf = requestAnimationFrame(step);
    }
    heroAnim.raf = requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════════
     STAR / CLOUD FX LAYER
  ══════════════════════════════════════════ */
  function buildFxLayerOnce() {
    if (document.getElementById("wd-fx-layer")) return;

    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("id", "wd-fx-stars");
    svg.setAttribute("viewBox", "0 0 400 220");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("wx-stars");

    var STAR_COUNT = 46;
    for (var i = 0; i < STAR_COUNT; i++) {
      var cx    = (Math.random() * 400).toFixed(1);
      var cy    = (Math.random() * 140).toFixed(1); 
      var r     = (Math.random() * 1.1 + 0.3).toFixed(2);
      var op    = (Math.random() * 0.6 + 0.35).toFixed(2);
      var dur   = (Math.random() * 3 + 2.5).toFixed(2);
      var delay = (Math.random() * 4).toFixed(2);
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", cx);
      c.setAttribute("cy", cy);
      c.setAttribute("r", r);
      c.setAttribute("fill", "#fff");
      c.style.opacity = op;
      c.style.animation = "wxTwinkle " + dur + "s ease-in-out " + delay + "s infinite";
      svg.appendChild(c);
    }

    var cloudWrap = document.createElement("div");
    cloudWrap.className = "wx-clouds";
    cloudWrap.id = "wd-fx-clouds";
    ["c1", "c2", "c3", "c4"].forEach(function (cls) {
      var span = document.createElement("span");
      span.className = "wx-cloud " + cls;
      cloudWrap.appendChild(span);
    });

    var layer = document.createElement("div");
    layer.id = "wd-fx-layer";
    layer.className = "wx-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.appendChild(svg);
    layer.appendChild(cloudWrap);

    hero.insertBefore(layer, hero.firstChild);
  }

  function updateFxLayer(family, cloudPct, isDayFlag) {
    var starsEl  = document.getElementById("wd-fx-stars");
    var cloudsEl = document.getElementById("wd-fx-clouds");
    if (!starsEl || !cloudsEl) return;

    var cloud = cloudPct != null ? cloudPct : 50;
    var starOpacity = 0;
    if (!isDayFlag && family !== "rain" && family !== "storm" && family !== "fog") {
      starOpacity = clamp01(1 - cloud / 85);
    }
    starsEl.style.opacity = starOpacity.toFixed(2);

    var cloudBaseOpacity = 0;
    if (family !== "rain" && family !== "storm") {
      cloudBaseOpacity = clamp01((cloud - 15) / 70);
    }
    var thresholds = [15, 40, 60, 80]; 
    var kids = cloudsEl.children;
    for (var i = 0; i < kids.length; i++) {
      var visible = cloud >= thresholds[i];
      kids[i].style.opacity = visible ? Math.min(0.85, cloudBaseOpacity + 0.15).toFixed(2) : 0;
    }
  }

  /* ══════════════════════════════════════════
     HERO VIDEO LAYER  (NEW)
     Only 4 clips exist so far — all "dry daytime sky" conditions.
     Everything else (rain, storm, fog, night) keeps using the
     existing CSS gradient/FX layer untouched. When more clips are
     ready, just add entries to SKY_VIDEOS and extend the family
     gate below — no other logic needs to change.
  ══════════════════════════════════════════ */
  var SKY_VIDEOS = {
    "clear":         "videos/clear-sky.mp4",
    "mostly-clear":  "videos/mostly-clear.mp4",
    "partly-cloudy": "videos/partly-cloudy.mp4",
    "mostly-cloudy": "videos/mostly-cloudy.mp4"
  };

  // Families for which we currently have (or plan to have) video coverage.
  // Everything not in this list falls straight back to the gradient.
  var DRY_DAYTIME_FAMILIES = ["sunny", "partial", "cloudy", "overcast"];

  var lastVideoKey = null;

  // Prefer the nowcast engine's clear-sky index (kc): it's this station's
  // own measured solar output vs. the theoretical max for our exact
  // coordinates/time, so it reflects real local sky conditions rather than
  // a third-party model's cloud-cover guess. OWM cloudPct is only a fallback
  // for when the nowcast call fails or hasn't got enough records yet.
  function skyConditionFromSignals(kc, cloudPct) {
    if (kc != null) {
      if (kc > 0.75) return "clear";
      if (kc > 0.50) return "mostly-clear";
      if (kc > 0.25) return "partly-cloudy";
      return "mostly-cloudy";
    }
    if (cloudPct != null) {
      if (cloudPct <= 10) return "clear";
      if (cloudPct <= 35) return "mostly-clear";
      if (cloudPct <= 65) return "partly-cloudy";
      return "mostly-cloudy";
    }
    return null;
  }

  function updateHeroVideo(key) {
    var videoEl  = document.getElementById("wd-video-bg");
    var sourceEl = document.getElementById("wd-video-src");
    if (!videoEl || !sourceEl) return; // HTML not updated yet — silently skip

    if (!key || !SKY_VIDEOS[key]) {
      // No clip for the current condition (rain/storm/fog/night, or a
      // signal we couldn't read) — hide video, gradient shows through.
      if (lastVideoKey !== null) {
        videoEl.pause();
        videoEl.style.opacity = "0";
        lastVideoKey = null;
      }
      return;
    }

    if (key === lastVideoKey) return; // already showing the right clip

    sourceEl.src = SKY_VIDEOS[key];
    videoEl.load();
    videoEl.play().catch(function () {}); // ignore autoplay rejections
    videoEl.style.opacity = "1";
    lastVideoKey = key;
  }

  /* ══════════════════════════════════════════
     MODAL
  ══════════════════════════════════════════ */
  modalOk.onclick = function() { modal.classList.remove("open"); };
  modal.onclick   = function(e) { if (e.target === modal) modal.classList.remove("open"); };

  function showModal(title, bodyHtml, headClass) {
    modalTitle.textContent = title;
    modalHead.className    = "wx-modal-head " + (headClass || "");
    modalBody.innerHTML    = bodyHtml;
    modal.classList.add("open");
  }

  function mrow(icon, label, val) {
    return "<div class='wx-modal-row'>" +
      "<span class='lbl'>" + icon + " " + label + "</span>" +
      "<span class='val'>" + val + "</span></div>";
  }

  function dirML(deg) {
    var d = ((deg % 360) + 360) % 360;
    if (d >= 337 || d < 23)  return "വടക്ക്";
    if (d < 68)              return "വടക്കുകിഴക്ക്";
    if (d < 113)             return "കിഴക്ക്";
    if (d < 158)             return "തെക്കുകിഴക്ക്";
    if (d < 203)             return "തെക്ക്";
    if (d < 248)             return "തെക്കുപടിഞ്ഞാറ്";
    if (d < 293)             return "പടിഞ്ഞാറ്";
    return "വടക്കുപടിഞ്ഞാറ്";
  }

  /* ══════════════════════════════════════════
     CLICK HANDLERS
  ══════════════════════════════════════════ */
  windBox.onclick = function() {
    if (!latestWind) {
      showModal("കാറ്റ്", "<div class='wx-modal-note'>ഡേറ്റ ലോഡ് ആകുന്നു...</div>", "wind");
      return;
    }
    var lw  = latestWind;
    var bft = beaufort(lw.speed);
    var gbft= beaufort(lw.gust);
    showModal(
      "💨 കാറ്റ് — വിശദ വിവരങ്ങൾ",
      mrow("🌬","ഇപ്പോഴത്തെ വേഗത",             lw.speed + " km/h") +
      mrow("🧭","ദിശ",                        lw.mlDir + " (" + lw.dirComp + ", " +
