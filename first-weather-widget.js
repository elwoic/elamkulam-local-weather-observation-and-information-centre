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

  var API_URL   = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/live";
  var PIEZO_URL = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/piezo";
  var OW_URL    = "https://api.openweathermap.org/data/2.5/weather?lat=10.9081&lon=76.2296&appid=ca13a2cbdc07e7613b6af82cff262295&units=metric";

  var latestWind      = null;
  var latestCondition = "";
  var latestMain      = {};

  /* ══════════════════════════════════════════
     RAIN MEMORY BUFFER (rate-based, ~5 min window)
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

  function rainLabel(rate) {
    if (rate < 0.3)  return { text:"🌦 ചാറ്റൽ മഴ",        key:"rain" };
    if (rate < 2.5)  return { text:"🌦 നേർത്ത ചാറ്റൽ",    key:"rain" };
    if (rate < 7.6)  return { text:"🌧 നേരിയ മഴ",          key:"rain" };
    if (rate < 25)   return { text:"🌧 മഴ പെയ്യുന്നു",     key:"rain" };
    if (rate < 50)   return { text:"🌧 ശക്തമായ മഴ",        key:"rain" };
    return                  { text:"⛈ കനത്ത മഴ",           key:"storm"};
  }

  /* ══════════════════════════════════════════
     PIEZO RAIN-SENSOR LOGIC
     srain_piezo (elwoic_live_weather, 1 row/min, last 30 min)
     flips to 1 the instant the sensor gets wet, but stays at 1
     for a while after rain actually stops (residual water on the
     piezo disc doesn't dry instantly). So it can never be trusted
     by itself — it's only used to bridge the gap before the real
     rain-rate (mm/hr) measurement catches up, and only for a short
     grace window.
  ══════════════════════════════════════════ */
  var PIEZO_GRACE_MINUTES = 4; // how long we trust a piezo-only "മഴ" before calling it stale

  function countTrailingOnes(arr) {
    var c = 0;
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === 1) c++; else break;
    }
    return c;
  }

  /* ══════════════════════════════════════════
     BEAUFORT SCALE (client-side)
  ══════════════════════════════════════════ */
  function beaufort(kmh) {
    var scale = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    var desc  = ["Calm","Light air","Light breeze","Gentle breeze","Moderate breeze",
                 "Fresh breeze","Strong breeze","Near gale","Gale","Strong gale","Storm","Violent storm","Hurricane"];
    var b = scale.findIndex(function(v){ return kmh < v; });
    return { force: b === -1 ? 12 : b, description: desc[b === -1 ? 12 : b] };
  }

  /* ══════════════════════════════════════════
     CONDITION ENGINE  (icon + Malayalam label — UNCHANGED)
     Priority order (highest first):
       1) rain rate > 0 right now              → intensity label, always wins
       2) rate just dropped to 0 (rate buffer)  → "rain settling" / normal
       3) piezo=1 but rate never confirmed it   → generic "മഴ" for ≤4 min, then ignored
       4) normal solar/uvi/humidity sky read
  ══════════════════════════════════════════ */
  function getCondition(rain, rainDaily, solar, uvi, humidity, hour, piezoArr) {
    var isDay = (hour >= 6 && hour < 19);

    /* PRIORITY 1 — a real measured rate always wins, overrides piezo entirely */
    if (rain > 0) {
      return rainLabel(rain);
    }

    /* PRIORITY 2 — rate just dropped back to 0 after being active: rain is ending.
       This takes precedence over the piezo signal even if the piezo is still wet. */
    if (rainJustStopped()) {
      var sunAlreadyOut = (solar != null && solar > 150) || (uvi != null && uvi >= 3);
      if (!sunAlreadyOut) {
        return { text:"🌦 മഴ ശമിച്ചു", key:"partial" };
      }
      // sun already out → fall through to normal day condition below
    } else if (piezoArr && piezoArr.length) {
      /* PRIORITY 3 — piezo says wet, rate has never confirmed it.
         Trust it only for a short grace window (fresh rain, rate
         hasn't caught up yet). Beyond that window it's almost
         certainly residual moisture, not active rain — ignore it. */
      var piezoNow = piezoArr[piezoArr.length - 1];
      if (piezoNow === 1) {
        var wetStreak = countTrailingOnes(piezoArr);
        if (wetStreak <= PIEZO_GRACE_MINUTES) {
          return { text:"🌧 മഴ", key:"rain" };
        }
        // wetStreak too long without a real rate → fall through, ignore piezo
      }
    }

    if (isDay) {
      if (solar != null) {
        if (solar >= 700)              return { text:"☀️ തെളിഞ്ഞ ആകാശം",          key:"sunny"   };
        if (solar >= 350 && uvi >= 4)  return { text:"🌤 ഭാഗികമായി തെളിഞ്ഞ",      key:"partial" };
        if (solar >= 120)              return { text:"⛅ ഭാഗികമായി മേഘാവൃതം",     key:"partial" };
        if (solar >= 20)               return { text:"🌥 മേഘാവൃതം",               key:"cloudy"  };
        if (uvi != null && uvi <= 1)   return { text:"☁️ കനത്ത മേഘം",             key:"cloudy"  };
        return                                { text:"🌥 മേഘാവൃതം",               key:"cloudy"  };
      }
      if (uvi != null) {
        if (uvi >= 7) return { text:"☀️ തെളിഞ്ഞ ആകാശം",      key:"sunny"   };
        if (uvi >= 4) return { text:"🌤 ഭാഗികമായി മേഘാവൃതം", key:"partial" };
        if (uvi >= 1) return { text:"🌥 മേഘാവൃതം",           key:"cloudy"  };
        return              { text:"☁️ കനത്ത മേഘം",           key:"cloudy"  };
      }
      return { text:"🌤 പകൽ", key:"partial" };
    }

    if (humidity != null) {
      if (humidity >= 95) return { text:"🌫 കനത്ത മൂടൽ",  key:"night" };
      if (humidity >= 88) return { text:"🌫 മൂടൽ മഞ്ഞ്",  key:"night" };
    }
    return { text:"🌙 രാത്രി ആകാശം", key:"night" };
  }

  /* ══════════════════════════════════════════
     COLOR ENGINE
     Separate from the label engine above on purpose — the label
     text/icon logic stays untouched, this only decides the hero
     BACKGROUND. Every family has a "dim" and "bright" color-stop
     triplet; t (0–1) picks a point between them each refresh, so
     the dashboard shades continuously with rain intensity / solar
     / UVI / cloud cover instead of jumping between fixed presets.
  ══════════════════════════════════════════ */
  var HERO_PALETTES = {
    "sunny":       { dim:[[192,85,10],[218,110,10],[235,175,50]],     bright:[[214,100,10],[240,150,15],[250,210,90]] },
    "partial":     { dim:[[40,95,140],[60,130,175],[110,175,205]],    bright:[[26,111,168],[45,156,219],[126,200,227]] },
    "cloudy":      { dim:[[50,62,76],[78,92,106],[118,132,146]],      bright:[[75,95,113],[112,130,148],[163,178,190]] },
    "overcast":    { dim:[[38,46,58],[58,68,80],[92,104,116]],        bright:[[55,65,78],[82,95,108],[122,135,148]] },
    "fog":         { dim:[[104,112,120],[140,148,154],[176,182,186]], bright:[[130,138,145],[165,172,177],[198,203,206]] },
    "rain":        { dim:[[10,26,42],[18,46,74],[28,68,102]],         bright:[[46,90,128],[70,124,163],[108,160,190]] },
    "storm":       { dim:[[8,10,16],[20,18,32],[34,28,48]],           bright:[[18,20,30],[35,32,50],[52,46,68]] },
    "night-clear": { dim:[[6,13,22],[13,22,35],[21,35,53]],           bright:[[16,28,44],[28,45,68],[44,68,98]] },
    "night-cloud": { dim:[[18,21,30],[32,37,48],[50,57,70]],          bright:[[36,41,54],[55,62,78],[80,88,104]] }
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

  /* Decide which color FAMILY applies + how "bright" within it (t).
     Mirrors getCondition's priority order but folds in cloud cover
     (from OpenWeatherMap) which the label engine doesn't use. */
  function computeFamilyAndIntensity(rain, solar, uvi, humidity, piezoArr, cloudPct, isDayFlag) {
    /* 1) active measured rain always wins */
    if (rain > 0) {
      if (rain >= 50) {
        // heavier than storm threshold → darker as it intensifies further, up to 150mm/hr
        var extreme = clamp01((rain - 50) / 100);
        return { family: "storm", t: clamp01(1 - extreme) };
      }
      var solarNorm = solar != null ? clamp01(solar / 500) : (uvi != null ? clamp01(uvi / 6) : 0);
      var rateNorm  = clamp01(rain / 50);
      // sunshower brightening, suppressed as rate climbs toward storm threshold
      var t = solarNorm * (1 - rateNorm * 0.6);
      return { family: "rain", t: t };
    }

    /* 2) rain just stopped — lingering damp-sky family, brightens as cloud clears */
    if (rainJustStopped()) {
      var sunAlreadyOut = (solar != null && solar > 150) || (uvi != null && uvi >= 3);
      if (!sunAlreadyOut) {
        var clearFrac = cloudPct != null ? clamp01(1 - cloudPct / 100) : 0.3;
        return { family: "rain", t: clamp01(0.3 + clearFrac * 0.4) };
      }
      // sun already out → fall through to normal sky read below
    } else if (piezoArr && piezoArr.length) {
      /* 3) piezo wet, rate unconfirmed — same short grace window as the label engine */
      var piezoNow = piezoArr[piezoArr.length - 1];
      if (piezoNow === 1) {
        var wetStreak = countTrailingOnes(piezoArr);
        if (wetStreak <= PIEZO_GRACE_MINUTES) {
          return { family: "rain", t: 0.25 };
        }
      }
    }

    if (isDayFlag) {
      /* daytime haze/fog: very high humidity + weak/no solar reading */
      if (humidity != null && humidity >= 95 && (solar == null || solar < 80)) {
        return { family: "fog", t: cloudPct != null ? clamp01(1 - cloudPct / 100) : 0.4 };
      }

      var cloud = cloudPct != null ? cloudPct : (solar != null ? clamp01(1 - solar / 700) * 100 : 50);

      if (cloud >= 85) {
        // fully overcast but dry — still let a little solar bleed brighten it
        var brightBit = solar != null ? clamp01(solar / 300) : (uvi != null ? clamp01(uvi / 4) : 0.2);
        return { family: "overcast", t: brightBit };
      }

      if (solar != null) {
        if (solar >= 700)             return { family: "sunny",   t: clamp01((solar - 700) / 300) + 0.5 };
        if (solar >= 350 && uvi >= 4) return { family: "sunny",   t: clamp01((solar - 350) / 350) };
        if (solar >= 120)             return { family: "partial", t: clamp01((solar - 120) / 230) };
        if (solar >= 20)              return { family: "cloudy",  t: clamp01(solar / 20) };
        return                              { family: "cloudy",  t: 0.1 };
      }
      if (uvi != null) {
        if (uvi >= 7) return { family: "sunny",   t: clamp01((uvi - 7) / 5) + 0.5 };
        if (uvi >= 4) return { family: "partial", t: clamp01((uvi - 4) / 3) };
        if (uvi >= 1) return { family: "cloudy",  t: clamp01(uvi / 4) };
        return              { family: "cloudy",  t: 0.05 };
      }
      return { family: "partial", t: 0.5 };
    }

    /* NIGHT */
    if (humidity != null) {
      if (humidity >= 95) return { family: "fog", t: 0.15 };
      if (humidity >= 88) return { family: "fog", t: 0.3 };
    }
    var nCloud = cloudPct != null ? cloudPct : 50;
    if (nCloud >= 45) return { family: "night-cloud", t: clamp01(1 - nCloud / 100) };
    return { family: "night-clear", t: clamp01(1 - nCloud / 100) };
  }

  /* Smoothly crossfades the hero gradient's CSS custom properties
     over ~1.2s using rAF — CSS transitions don't reliably animate
     gradient stops across browsers, so this is done by hand. */
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
      var eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; // easeInOutQuad
      for (var i = 0; i < 3; i++) {
        hero.style.setProperty("--hc" + (i + 1), rgbCss(lerpRGB(from[i], to[i], eased)));
      }
      if (p < 1) heroAnim.raf = requestAnimationFrame(step);
    }
    heroAnim.raf = requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════════
     STAR / CLOUD FX LAYER
     Built once (fixed star positions so they don't jump every
     30s refresh), then only opacity/visibility is toggled based
     on cloud cover %, time of day, and current weather family.
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
      var cy    = (Math.random() * 140).toFixed(1); // keep stars in upper portion of hero
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

    /* stars only at night, on clear-ish family, fading with cloud cover */
    var starOpacity = 0;
    if (!isDayFlag && family !== "rain" && family !== "storm" && family !== "fog") {
      starOpacity = clamp01(1 - cloud / 85);
    }
    starsEl.style.opacity = starOpacity.toFixed(2);

    /* drifting cloud shapes — skip while actively raining, the rain gradient already reads as overcast */
    var cloudBaseOpacity = 0;
    if (family !== "rain" && family !== "storm") {
      cloudBaseOpacity = clamp01((cloud - 15) / 70);
    }
    var thresholds = [15, 40, 60, 80]; // more cloud shapes appear as cover increases
    var kids = cloudsEl.children;
    for (var i = 0; i < kids.length; i++) {
      var visible = cloud >= thresholds[i];
      kids[i].style.opacity = visible ? Math.min(0.85, cloudBaseOpacity + 0.15).toFixed(2) : 0;
    }
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

  /* ══════════════════════════════════════════
     DIRECTION → MALAYALAM
  ══════════════════════════════════════════ */
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
    var dgbft = beaufort(lw.dayGust);
    showModal(
      "💨 കാറ്റ് — വിശദ വിവരങ്ങൾ",
      mrow("🌬","ഇപ്പോഴത്തെ വേഗത",             lw.speed + " km/h") +
      mrow("🧭","ദിശ",                          lw.mlDir + " (" + lw.dirComp + ", " + lw.dirDeg + "°)") +
      mrow("💨","ഇപ്പോഴത്തെ ഗസ്റ്റ്",           lw.gust + " km/h") +
      mrow("📈","ഇന്ന് ഏറ്റവും ഉയർന്ന ഗസ്റ്റ്", lw.dayGust + " km/h") +
      mrow("🌀","Beaufort (speed)",             bft.force + " — " + bft.description) +
      mrow("🌀","Beaufort (gust)",              gbft.force + " — " + gbft.description) +
      mrow("📊","10 മിനിറ്റ് ശരാശരി ദിശ",       lw.avg10Comp + " (" + lw.avg10Deg + "°)"),
      "wind"
    );
  };

  indoorBox.onclick = function() {
    var m = latestMain;
    showModal(
      "🏠 Indoor Climate",
      "<div class='wx-modal-note' style='text-align:left;padding-top:10px;color:#888;font-size:12px;'>കോൺക്രീറ്റ് കെട്ടിടത്തിനകത്ത് ഉള്ള അന്തരീക്ഷം</div>" +
      mrow("🌡","Temperature", (m.indoorT     != null ? m.indoorT     : "--") + "°C") +
      mrow("🌫","Feels like",  (m.indoorFeels != null ? m.indoorFeels : "--") + "°C") +
      mrow("💧","Humidity",    (m.indoorH     != null ? m.indoorH     : "--") + "%"),
      "indoor"
    );
  };

  condBox.onclick = function() {
    var m        = latestMain;
    var buf       = rainBuf.map(function(r){ return r.rate; }).join(", ") || "--";
    var piezoBuf  = (m.piezoArr || []).join("") || "--";
    showModal(
      "🌤 കാലാവസ്ഥ വിശദീകരണം",
      mrow("☀️","UVI",                m.uvi         != null ? m.uvi         : "--") +
      mrow("🔆","Solar",              (m.solar      != null ? m.solar       : "--") + " W/m²") +
      mrow("☁️","Cloud cover (OWM)",  (m.cloudPct   != null ? m.cloudPct    : "--") + " %") +
      mrow("🌱","VPD",                (m.vpd        != null ? m.vpd         : "--") + " kPa") +
      mrow("🌡","Dew Point (Out)",    (m.dewOut     != null ? m.dewOut      : "--") + "°C") +
      mrow("🌧","Rain rate (now)",    (m.rain       || 0)                   + " mm/hr") +
      mrow("🌧","Rain today",         (m.rainDaily  || 0)                   + " mm") +
      mrow("💧","Outdoor humidity",   (m.humidity   != null ? m.humidity    : "--") + "%") +
      mrow("📊","Pressure (Abs)",     (m.pressureAbs|| "--")                + " hPa") +
      mrow("📊","Pressure (Rel)",     (m.pressureRel|| "--")                + " hPa") +
      mrow("💦","Piezo സെൻസർ",        (m.piezoNow === 1 ? "നനവ് (1)" : "ഉണക്കം (0)")) +
      mrow("⏱","നനഞ്ഞ ദൈർഘ്യം",       (m.piezoWetStreak || 0) + " മിനിറ്റ്") +
      "<div style='margin:12px 0 4px;padding:10px;background:#f0f7ff;border-radius:8px;text-align:center;font-size:14px;font-weight:700;color:#1a2233;'>" + latestCondition + "</div>" +
      "<div class='wx-modal-note' style='font-size:10px;color:#bbb;'>Rain buffer (mm/hr): [" + buf + "]<br>Piezo buffer (30 min): [" + piezoBuf + "]<br>Sensor fusion · 30s refresh</div>",
      "condition"
    );
  };

  /* ══════════════════════════════════════════
     SINGLE FETCH — unified worker + piezo history + OWM
  ══════════════════════════════════════════ */
  function updateAll() {
    Promise.all([
      fetch(API_URL,   { cache:"no-store" }).then(function(r){ return r.json(); }).catch(function(){ return null; }),
      fetch(OW_URL,    { cache:"no-store" }).then(function(r){ return r.json(); }).catch(function(){ return null; }),
      fetch(PIEZO_URL, { cache:"no-store" }).then(function(r){ return r.json(); }).catch(function(){ return null; })
    ]).then(function(res) {
      var payload  = res[0];
      var owm      = res[1];
      var piezoRes = res[2];
      if (!payload) return;

      var ld  = payload.live_data || {};
      var tmp = ld.temperature  || {};
      var hum = ld.humidity     || {};
      var wnd = ld.wind         || {};
      var prs = ld.pressure     || {};
      var rn  = ld.rain         || {};

      /* ── temperatures ── */
      var t           = tmp.outdoor            != null ? tmp.outdoor            : null;
      var feels       = tmp.feels_like_outdoor != null ? tmp.feels_like_outdoor : null;
      var indoorT     = tmp.indoor             != null ? tmp.indoor             : null;
      var indoorFeels = tmp.feels_like_indoor  != null ? tmp.feels_like_indoor  : null;
      var dewOut      = tmp.dew_point_outdoor  != null ? tmp.dew_point_outdoor  : null;
      var dewIn       = tmp.dew_point_indoor   != null ? tmp.dew_point_indoor   : null;

      /* ── humidity ── */
      var h       = hum.outdoor != null ? hum.outdoor : null;
      var indoorH = hum.indoor  != null ? hum.indoor  : null;

      /* ── wind ── */
      var windSpeed    = wnd.speed_kmh             != null ? wnd.speed_kmh             : 0;
      var windGust     = wnd.gust_kmh              != null ? wnd.gust_kmh              : 0;
      var windDirDeg   = wnd.direction_degrees     != null ? wnd.direction_degrees     : 0;
      var windDirComp  = wnd.direction_compass     || "N";
      var avg10Deg     = wnd.avg_10min_dir_deg     != null ? wnd.avg_10min_dir_deg     : "--";
      var avg10Comp    = wnd.avg_10min_dir_compass || "--";
      var dayMaxGust   = payload.daily_max_gust_kmh != null ? payload.daily_max_gust_kmh : "--";
      var mlDir        = dirML(windDirDeg);

      /* ── pressure ── */
      var pressureAbs = prs.absolute_hpa != null ? prs.absolute_hpa : null;
      var pressureRel = prs.relative_hpa != null ? prs.relative_hpa : null;

      /* ── solar / uvi / vpd ── */
      var uvi   = ld.uvi     != null ? ld.uvi     : null;
      var solar = ld.solar_wm2 != null ? ld.solar_wm2 : null;
      var vpd   = ld.vpd_kpa != null ? ld.vpd_kpa : null;

      /* ── rain ── */
      var rain      = rn.rate_mm_hr != null ? rn.rate_mm_hr : 0;
      var rainDaily = rn.daily_mm   != null ? rn.daily_mm   : 0;

      /* ── visibility + cloud cover from OWM ── */
      var vis      = (owm && owm.visibility) ? (owm.visibility / 1000).toFixed(1) : "--";
      var cloudPct = (owm && owm.clouds && owm.clouds.all != null) ? owm.clouds.all : null;

      /* ── piezo (rain sensor) history: chronological array of 0/1, last 30 min ── */
      var piezoArr       = Array.isArray(piezoRes) ? piezoRes.map(function(p){ return p.v; }) : [];
      var piezoNow       = piezoArr.length ? piezoArr[piezoArr.length - 1] : 0;
      var piezoWetStreak = countTrailingOnes(piezoArr);

      /* ── rain buffer (rate-based, ~5 min) ── */
      pushRain(rain, rainDaily);

      /* ── condition label (unchanged engine) ── */
      var now  = new Date();
      var isDayFlag = (now.getHours() >= 6 && now.getHours() < 19);
      var cond = getCondition(rain, rainDaily, solar, uvi, h, now.getHours(), piezoArr);
      latestCondition = cond.text;

      /* ── hero color + fx layer (new engine) ── */
      var theme = computeFamilyAndIntensity(rain, solar, uvi, h, piezoArr, cloudPct, isDayFlag);
      animateHeroBackground(paletteFor(theme.family, theme.t));
      updateFxLayer(theme.family, cloudPct, isDayFlag);
      hero.className = "wx-hero " + theme.family;

      /* ── store for modals ── */
      latestWind = {
        speed: windSpeed, gust: windGust,
        dirDeg: windDirDeg, dirComp: windDirComp, mlDir: mlDir,
        avg10Deg: avg10Deg, avg10Comp: avg10Comp,
        dayGust: dayMaxGust
      };

      latestMain = {
        indoorT: indoorT, indoorH: indoorH, indoorFeels: indoorFeels,
        pressureAbs: pressureAbs, pressureRel: pressureRel,
        uvi: uvi, solar: solar, vpd: vpd,
        dewOut: dewOut, dewIn: dewIn,
        rain: rain, rainDaily: rainDaily,
        humidity: h, cloudPct: cloudPct,
        piezoNow: piezoNow, piezoWetStreak: piezoWetStreak, piezoArr: piezoArr
      };

      /* ── DOM updates ── */
      document.getElementById("wd-temp").textContent            = t           != null ? t           : "--";
      document.getElementById("wd-humidity").textContent        = h           != null ? h           : "--";
      document.getElementById("wd-feels").textContent           = feels       != null ? feels       : "--";
      document.getElementById("wd-visibility").textContent      = vis;
      document.getElementById("wd-pressure").textContent        = pressureAbs != null ? pressureAbs : "--";
      document.getElementById("wd-uvi").textContent             = uvi         != null ? uvi         : "--";
      document.getElementById("wd-solar").textContent           = solar       != null ? solar       : "--";
      document.getElementById("wd-condition").textContent       = cond.text;
      document.getElementById("wd-wind").textContent            = windSpeed + " km/h";
      document.getElementById("wd-wind-detail").textContent     = "Gust " + windGust + " km/h · " + mlDir;
      document.getElementById("wd-indoor-temp").textContent     = indoorT     != null ? indoorT     : "--";
      document.getElementById("wd-indoor-humidity").textContent = indoorH     != null ? indoorH     : "--";
      document.getElementById("wd-indoor-feels").textContent    = indoorFeels != null ? indoorFeels : "--";
      var updatedAt = payload.updated_at
        ? new Date(payload.updated_at).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })
        : now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
      document.getElementById("wd-last-updated").textContent = updatedAt;

    }).catch(function(e){ console.error("Weather fetch failed:", e); });
  }

  /* ── INIT — build fx layer once, then 30 second refresh ── */
  buildFxLayerOnce();
  updateAll();
  setInterval(updateAll, 30000);
}
_wd_init();
