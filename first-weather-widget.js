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

  var API_URL  = "https://elwoi-dashboar-parameters.bold-waterfall-0d01.workers.dev/";
  var WIND_URL = "https://wind-fetcher.bold-waterfall-0d01.workers.dev/";
  var OW_URL   = "https://api.openweathermap.org/data/2.5/weather?lat=10.9081&lon=76.2296&appid=ca13a2cbdc07e7613b6af82cff262295&units=metric";

  var latestWind      = null;
  var latestCondition = "";
  var latestMain      = {};

  /* ══════════════════════════════════════════
     RAIN MEMORY BUFFER
     Stores last 10 readings (= ~5 min at 30s)
     Remembers rain even if one reading misses
  ══════════════════════════════════════════ */
  var rainBuf     = [];   /* { rate, daily } */
  var RAIN_BUF_MAX = 10;
  var lastDailyMm  = 0;   /* daily accumulation anchor */

  function pushRain(rate, daily) {
    rainBuf.push({ rate: rate || 0, daily: daily || 0 });
    if (rainBuf.length > RAIN_BUF_MAX) rainBuf.shift();
    if (daily > lastDailyMm) lastDailyMm = daily;
  }

  /* any rain in buffer window? */
  function bufHasRain() {
    for (var i = 0; i < rainBuf.length; i++) {
      if (rainBuf[i].rate > 0) return true;
    }
    return false;
  }

  /* max rate seen in buffer */
  function bufMaxRate() {
    var mx = 0;
    for (var i = 0; i < rainBuf.length; i++) {
      if (rainBuf[i].rate > mx) mx = rainBuf[i].rate;
    }
    return mx;
  }

  /* rain just stopped? (last reading = 0, but earlier readings had rain) */
  function rainJustStopped() {
    if (rainBuf.length < 2) return false;
    var last = rainBuf[rainBuf.length - 1];
    if (last.rate > 0) return false;
    for (var i = 0; i < rainBuf.length - 1; i++) {
      if (rainBuf[i].rate > 0) return true;
    }
    return false;
  }

  /* rain intensity from rate (mm/hr) */
  function rainLabel(rate) {
    if (rate < 0.3)  return { text:"🌦 ചാറ്റൽ മഴ",        key:"rain" };  /* trace/drizzle   */
    if (rate < 2.5)  return { text:"🌦 നേർത്ത ചാറ്റൽ",    key:"rain" };  /* light drizzle   */
    if (rate < 7.6)  return { text:"🌧 നേരിയ മഴ",          key:"rain" };  /* light rain      */
    if (rate < 25)   return { text:"🌧 മഴ പെയ്യുന്നു",     key:"rain" };  /* moderate rain   */
    if (rate < 50)   return { text:"🌧 ശക്തമായ മഴ",        key:"rain" };  /* heavy rain      */
    return                  { text:"⛈ കനത്ത മഴ",           key:"storm"};  /* very heavy/storm*/
  }

  /* ══════════════════════════════════════════
     INTELLIGENT CONDITION ENGINE
     Priority order:
       1. Active rain (buffer)
       2. Rain just stopped
       3. Daytime → solar irradiance tiers
       4. Night   → humidity fog check
  ══════════════════════════════════════════ */
  function getCondition(rain, rainDaily, solar, uvi, humidity, hour) {
    var isDay = (hour >= 6 && hour < 19);

    /* ── 1. RAIN ACTIVE ── */
    if (bufHasRain() || rain > 0) {
      var activeRate = (rain > 0) ? rain : bufMaxRate();
      return rainLabel(activeRate);
    }

    /* ── 2. RAIN JUST STOPPED ──
       Only from buffer evidence — daily total is NOT used (it persists all day).
       Also skip if solar/UVI already shows sun is clearly out. */
    if (rainJustStopped()) {
      var sunAlreadyOut = (solar != null && solar > 150) || (uvi != null && uvi >= 3);
      if (!sunAlreadyOut) {
        return { text:"🌦 മഴ ശമിച്ചു", key:"partial" };
      }
      /* sun is out — fall through to sky condition */
    }

    /* ── 3. DAYTIME — solar primary ── */
    if (isDay) {
      if (solar != null) {
        /* Kerala summer peak ~1000+ W/m², classify in tiers */
        if (solar >= 700)              return { text:"☀️ തെളിഞ്ഞ ആകാശം",          key:"sunny"   };
        if (solar >= 350 && uvi >= 4)  return { text:"🌤 ഭാഗികമായി തെളിഞ്ഞ",      key:"partial" };
        if (solar >= 120)              return { text:"⛅ ഭാഗികമായി മേഘാവൃതം",     key:"partial" };
        if (solar >= 20)               return { text:"🌥 മേഘാവൃതം",               key:"cloudy"  };
        /* solar < 20 during daylight = very heavy overcast or pre-rain */
        if (uvi != null && uvi <= 1)   return { text:"☁️ കനത്ത മേഘം",             key:"cloudy"  };
        return                                { text:"🌥 മേഘാവൃതം",               key:"cloudy"  };
      }
      /* solar sensor unavailable → use uvi only */
      if (uvi != null) {
        if (uvi >= 7) return { text:"☀️ തെളിഞ്ഞ ആകാശം",          key:"sunny"   };
        if (uvi >= 4) return { text:"🌤 ഭാഗികമായി മേഘാവൃതം",     key:"partial" };
        if (uvi >= 1) return { text:"🌥 മേഘാവൃതം",               key:"cloudy"  };
        return              { text:"☁️ കനത്ത മേഘം",               key:"cloudy"  };
      }
      return { text:"🌤 പകൽ", key:"partial" };
    }

    /* ── 4. NIGHT ── */
    /* fog: outdoor humidity very high at night */
    if (humidity != null) {
      if (humidity >= 95) return { text:"🌫 കനത്ത മൂടൽ",     key:"night" };
      if (humidity >= 88) return { text:"🌫 മൂടൽ മഞ്ഞ്",     key:"night" };
    }
    /* clear night: if earlier in the day we saw high solar it was clear */
    return { text:"🌙 രാത്രി ആകാശം", key:"night" };
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
    var lw = latestWind;
    showModal(
      "💨 കാറ്റ് — വിശദ വിവരങ്ങൾ",
      mrow("🌬","ഇപ്പോഴത്തെ വേഗത",             lw.speed + " " + lw.speedUnit) +
      mrow("🧭","ദിശ",                          lw.mlDir + " (" + lw.dirComp + ", " + lw.dirDeg + "°)") +
      mrow("💨","ഇപ്പോഴത്തെ ഗസ്റ്റ്",           lw.gust + " " + lw.gustUnit) +
      mrow("📈","ഇന്ന് ഏറ്റവും ഉയർന്ന ഗസ്റ്റ്", lw.dayGust + " " + lw.dayGustU) +
      "<div class='wx-modal-note'>⏰ " + lw.dayGustAt + "</div>" +
      mrow("🌀","Beaufort " + lw.bftForce,      lw.bftDesc) +
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
    var m   = latestMain;
    var buf = rainBuf.map(function(r){ return r.rate; }).join(", ") || "--";
    showModal(
      "🌤 കാലാവസ്ഥ വിശദീകരണം",
      mrow("☀️","UVI",                m.uvi         != null ? m.uvi         : "--") +
      mrow("🔆","Solar",              (m.solar      != null ? m.solar       : "--") + " W/m²") +
      mrow("🌧","Rain rate (now)",    (m.rain       || 0)                   + " mm/hr") +
      mrow("🌧","Rain today",         (m.rainDaily  || 0)                   + " mm") +
      mrow("💧","Outdoor humidity",   (m.humidity   != null ? m.humidity    : "--") + "%") +
      mrow("📊","Pressure (Abs)",     (m.pressureAbs|| "--")                + " hPa") +
      mrow("📊","Pressure (Rel)",     (m.pressureRel|| "--")                + " hPa") +
      "<div style='margin:12px 0 4px;padding:10px;background:#f0f7ff;border-radius:8px;text-align:center;font-size:14px;font-weight:700;color:#1a2233;'>" + latestCondition + "</div>" +
      "<div class='wx-modal-note' style='font-size:10px;color:#bbb;'>Rain buffer (mm/hr): [" + buf + "]<br>Sensor fusion · 30s refresh</div>",
      "condition"
    );
  };

  /* ══════════════════════════════════════════
     FETCH WIND
  ══════════════════════════════════════════ */
  function updateWind() {
    fetch(WIND_URL, { cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.wind) return;
        var w         = data.wind;
        var speed     = (w.speed     && w.speed.value     != null) ? w.speed.value                  : 0;
        var speedUnit = (w.speed     && w.speed.unit)               ? w.speed.unit                   : "km/h";
        var gust      = (w.gust      && w.gust.value      != null) ? w.gust.value                   : 0;
        var gustUnit  = (w.gust      && w.gust.unit)                ? w.gust.unit                    : "km/h";
        var dirDeg    = (w.direction && w.direction.degrees != null)? w.direction.degrees            : 0;
        var dirComp   = (w.direction && w.direction.compass)        ? w.direction.compass            : "N";
        var bftForce  = (w.speed     && w.speed.beaufort)           ? w.speed.beaufort.force         : 0;
        var bftDesc   = (w.speed     && w.speed.beaufort)           ? w.speed.beaufort.description   : "Calm";
        var avg10Comp = (w.avg_10min && w.avg_10min.direction_compass)         ? w.avg_10min.direction_compass   : "--";
        var avg10Deg  = (w.avg_10min && w.avg_10min.direction_degrees != null) ? w.avg_10min.direction_degrees   : "--";
        var dayGust   = (w.daily_max_gust && w.daily_max_gust.value != null)   ? w.daily_max_gust.value         : "--";
        var dayGustU  = (w.daily_max_gust && w.daily_max_gust.unit)            ? w.daily_max_gust.unit          : "km/h";
        var dayGustAt = (w.daily_max_gust && w.daily_max_gust.observed_at)     ? w.daily_max_gust.observed_at   : "--";
        var ml        = dirML(dirDeg);

        document.getElementById("wd-wind").textContent        = speed + " " + speedUnit;
        document.getElementById("wd-wind-detail").textContent = "Gust " + gust + " " + gustUnit + " · " + ml;

        latestWind = { speed:speed, speedUnit:speedUnit, gust:gust, gustUnit:gustUnit,
                       dirDeg:dirDeg, dirComp:dirComp, mlDir:ml,
                       bftForce:bftForce, bftDesc:bftDesc,
                       avg10Comp:avg10Comp, avg10Deg:avg10Deg,
                       dayGust:dayGust, dayGustU:dayGustU, dayGustAt:dayGustAt };
      })
      .catch(function(e) { console.error("Wind fetch failed:", e); });
  }

  /* ══════════════════════════════════════════
     FETCH MAIN
  ══════════════════════════════════════════ */
  function updateMain() {
    Promise.all([
      fetch(API_URL, { cache:"no-store" }).then(function(r){return r.json();}).catch(function(){return null;}),
      fetch(OW_URL,  { cache:"no-store" }).then(function(r){return r.json();}).catch(function(){return null;})
    ]).then(function(res) {
      var w = res[0], o = res[1];
      if (!w) return;

      var t           = w.temperature ? w.temperature.outdoor            : null;
      var h           = w.humidity    ? w.humidity.outdoor               : null;
      var feels       = w.temperature ? w.temperature.feels_like_outdoor : null;
      var indoorT     = w.temperature ? w.temperature.indoor             : null;
      var indoorH     = w.humidity    ? w.humidity.indoor                : null;
      var indoorFeels = w.temperature ? w.temperature.feels_like_indoor  : null;
      var pressureAbs = w.pressure    ? w.pressure.absolute_hpa          : null;
      var pressureRel = w.pressure    ? w.pressure.relative_hpa          : null;
      var uvi         = w.uvi   != null ? w.uvi   : null;
      var solar       = w.solar != null ? w.solar : null;
      var rain        = (w.rain && w.rain.rate_mm_hr != null) ? w.rain.rate_mm_hr : 0;
      var rainDaily   = (w.rain && w.rain.daily_mm   != null) ? w.rain.daily_mm   : 0;
      var vis         = (o && o.visibility) ? (o.visibility / 1000).toFixed(1) : "--";

      /* feed rain buffer every cycle */
      pushRain(rain, rainDaily);

      var now  = new Date();
      var cond = getCondition(rain, rainDaily, solar, uvi, h, now.getHours());
      latestCondition = cond.text;
      latestMain = { indoorT:indoorT, indoorH:indoorH, indoorFeels:indoorFeels,
                     pressureAbs:pressureAbs, pressureRel:pressureRel,
                     uvi:uvi, solar:solar,
                     rain:rain, rainDaily:rainDaily,
                     humidity:h };

      document.getElementById("wd-temp").textContent            = t           != null ? t           : "--";
      document.getElementById("wd-humidity").textContent        = h           != null ? h           : "--";
      document.getElementById("wd-feels").textContent           = feels       != null ? feels       : "--";
      document.getElementById("wd-visibility").textContent      = vis;
      document.getElementById("wd-pressure").textContent        = pressureAbs != null ? pressureAbs : "--";
      document.getElementById("wd-uvi").textContent             = uvi         != null ? uvi         : "--";
      document.getElementById("wd-solar").textContent           = solar       != null ? solar       : "--";
      document.getElementById("wd-condition").textContent       = cond.text;
      document.getElementById("wd-indoor-temp").textContent     = indoorT     != null ? indoorT     : "--";
      document.getElementById("wd-indoor-humidity").textContent = indoorH     != null ? indoorH     : "--";
      document.getElementById("wd-indoor-feels").textContent    = indoorFeels != null ? indoorFeels : "--";
      document.getElementById("wd-last-updated").textContent    =
        now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });

      hero.className = "wx-hero " + cond.key;

    }).catch(function(e){ console.error("Main fetch failed:", e); });
  }

  /* ── INIT — 30 second refresh ── */
  updateWind();
  updateMain();
  setInterval(updateWind, 30000);
  setInterval(updateMain, 30000);
}
_wd_init();
