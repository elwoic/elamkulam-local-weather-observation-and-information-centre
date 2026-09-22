/**
 * ELWOIC Weather Engine V0.9 — Advanced Piezo Fusion & Rain State Machine
 *
 * Core Logic:
 * - Piezo Onset: '1's trigger 'മഴ' + drizzle for up to 4 minutes.
 * - 5th '1' with 0 mm/h expires drizzle to prevent false positives.
 * - Verified Rain: Categorized strictly per intensity bracket.
 * - Trend Evaluation: Appends 'മഴ കുറയുന്നു' on downward trends.
 * - Cessation Gate: Shows 'മഴ ശമിച്ചു' for 5 minutes when mm/h reaches 0,
 *   ignoring wet surface sensor residuals.
 */

(function () {
  "use strict";

  // Endpoints
  const API_URL = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/live";
  const PIEZO_URL = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/piezo";
  const OW_URL = "https://api.openweathermap.org/data/2.5/weather?lat=10.9081&lon=76.2296&appid=ca13a2cbdc07e7613b6af82cff262295&units=metric";
  const NOWCAST_URL = "https://elwoic-nowcast-engine.bold-waterfall-0d01.workers.dev/";

  // Reactive Physical State
  const EngineState = {
    time: 0,
    solarElevation: 35.0,
    solarWm2: 250,
    uvi: 2,
    humidity: 75,
    pm25: 20,
    windSpeed: 0,
    windGust: 0,
    windDirDeg: 245,
    windSign: 1,
    cloudCoverPct: 50,
    rainRateMmHr: 0,
    isDrizzle: false,
    isRaining: false,
    isStorm: false,
    stormReportedNearby: false,
    visibilityMeters: 10000
  };

  // Rain State Machine Persistence
  const RainTracker = {
    previousRate: 0,
    wasActivelyRaining: false,
    rainStoppedTimestamp: 0,
    STOP_GRACE_DURATION_MS: 5 * 60 * 1000 // 5 minutes
  };

  // Cached Telemetry for Modals
  let latestWind = null;
  let latestMain = {};
  let latestCondition = "";
  let latestNowcastFull = "";
  let latestNowcastIndoor = "";
  let latestNowcastWind = "";

  /* -------------------------------------------------------------
   * A. GRAPHICS SUBSYSTEMS
   * ------------------------------------------------------------- */
  const canvas = document.getElementById("wx-particle-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
  window.addEventListener("resize", resizeCanvas);

  const CelestialEngine = {
    skyRect: document.getElementById("wx-sky-rect"),
    sunGroup: document.getElementById("wx-sun-group"),
    sunAura: document.getElementById("wx-sun-aura"),
    sunCore: document.getElementById("wx-sun-core"),
    moonGroup: document.getElementById("wx-moon-group"),
    starField: document.getElementById("wx-star-field"),
    groundPath: document.getElementById("wx-ground-path"),
    hillsDistant: document.getElementById("wx-hills-distant"),
    hazeRect: document.getElementById("wx-haze-rect"),

    initStars() {
      if (!this.starField) return;
      this.starField.innerHTML = "";
      for (let i = 0; i < 120; i++) {
        const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        star.setAttribute("cx", Math.random() * 1600);
        star.setAttribute("cy", Math.random() * 450);
        star.setAttribute("r", (Math.random() * 1.4 + 0.3).toFixed(2));
        star.dataset.phase = Math.random() * Math.PI * 2;
        star.dataset.base = Math.random() * 0.5 + 0.3;
        this.starField.appendChild(star);
      }
    },

    update(solarDeg, cloudCover) {
      if (!this.skyRect) return;

      const sunY = 560 - (Math.max(-10, Math.min(85, solarDeg)) / 85) * 240;
      this.sunAura.setAttribute("cy", sunY);
      this.sunCore.setAttribute("cy", sunY);

      const intenseSun = Math.max(0, Math.min(1, (EngineState.solarWm2 - 500) / 450));
      const intenseUvi = Math.max(0, Math.min(1, (EngineState.uvi - 5) / 6));
      const brightFactor = Math.max(intenseSun, intenseUvi);

      const auraRadius = 140 + brightFactor * 90;
      this.sunAura.setAttribute("r", auraRadius.toFixed(0));

      if (EngineState.isStorm) {
        this.skyRect.setAttribute("fill", "url(#skyOvercast)");
        this.groundPath.setAttribute("fill", "url(#groundNight)");
        this.sunGroup.style.opacity = "0";
        this.moonGroup.style.opacity = "0";
        this.starField.style.opacity = "0";
      } else if (EngineState.isRaining && EngineState.rainRateMmHr >= 15) {
        // Heavy rain darkens the sky
        this.skyRect.setAttribute("fill", "url(#skyOvercast)");
        this.groundPath.setAttribute("fill", "url(#groundNight)");
        this.sunGroup.style.opacity = "0";
      } else if (solarDeg > 12) {
        this.skyRect.setAttribute("fill", brightFactor > 0.4 ? "url(#skyDay)" : "url(#skyDay)");
        this.groundPath.setAttribute("fill", "url(#groundDay)");

        const sunVisibility = (1 - cloudCover * 0.007) * (0.85 + brightFactor * 0.15);
        this.sunGroup.style.opacity = Math.max(0, Math.min(1, sunVisibility)).toFixed(2);
        this.moonGroup.style.opacity = "0";
        this.starField.style.opacity = "0";

        const humidHaze = Math.max(0, (EngineState.humidity - 70) / 30) * 0.25;
        const dustHaze = Math.min(0.2, (EngineState.pm25 / 100) * 0.2);
        const totalHaze = (0.08 + humidHaze + dustHaze + brightFactor * 0.1).toFixed(2);

        this.hazeRect.setAttribute("fill", brightFactor > 0.5 ? "#f1f8ff" : "#cae5d9");
        this.hazeRect.style.opacity = totalHaze;
      } else if (solarDeg > 0 && solarDeg <= 12) {
        this.skyRect.setAttribute("fill", "url(#skyGolden)");
        this.groundPath.setAttribute("fill", "url(#groundGolden)");
        this.sunGroup.style.opacity = "0.85";
        this.moonGroup.style.opacity = "0";
        this.starField.style.opacity = "0";
        this.hazeRect.setAttribute("fill", "#fcd082");
        this.hazeRect.style.opacity = "0.22";
      } else if (solarDeg > -12 && solarDeg <= 0) {
        this.skyRect.setAttribute("fill", "url(#skyTwilight)");
        this.groundPath.setAttribute("fill", "url(#groundNight)");
        this.sunGroup.style.opacity = "0";
        this.moonGroup.style.opacity = "0.6";
        this.moonGroup.setAttribute("transform", `translate(0, ${Math.min(100, Math.abs(solarDeg) * 2)})`);
        this.starField.style.opacity = "0.3";
        this.hazeRect.style.opacity = "0.05";
      } else {
        this.skyRect.setAttribute("fill", "url(#skyNight)");
        this.groundPath.setAttribute("fill", "url(#groundNight)");
        this.sunGroup.style.opacity = "0";
        this.moonGroup.style.opacity = "0.95";
        this.moonGroup.setAttribute("transform", `translate(0, ${Math.min(150, Math.abs(solarDeg) * 1.5)})`);
        this.starField.style.opacity = (1 - cloudCover * 0.01).toFixed(2);
        this.hazeRect.style.opacity = "0";
      }

      const visFactor = Math.min(1, EngineState.visibilityMeters / 10000);
      if (this.hillsDistant) {
        this.hillsDistant.style.opacity = (0.45 * visFactor).toFixed(2);
      }
    }
  };

  const CloudEngine = {
    container: document.getElementById("wx-clouds-container"),
    cloudPool: [],

    init() {
      if (!this.container) return;
      this.container.innerHTML = "";
      this.cloudPool = [];

      const cloudDefs = [
        { type: "#cloudCumulus", y: 380, scale: 1.1, speedMult: 1.0, baseOpacity: 0.85 },
        { type: "#cloudStratocumulus", y: 340, scale: 1.3, speedMult: 0.7, baseOpacity: 0.75 },
        { type: "#cloudCirrus", y: 280, scale: 1.0, speedMult: 0.4, baseOpacity: 0.5 },
        { type: "#cloudCumulus", y: 440, scale: 0.9, speedMult: 1.25, baseOpacity: 0.9 }
      ];

      cloudDefs.forEach((def, index) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", def.type);
        use.setAttribute("fill", "#f8fafc");
        g.appendChild(use);
        this.container.appendChild(g);

        this.cloudPool.push({
          el: g,
          use: use,
          x: index * 420 + Math.random() * 50,
          y: def.y,
          scale: def.scale,
          speedMult: def.speedMult,
          baseOpacity: def.baseOpacity
        });
      });
    },

    update(windSpeed, windSign, cloudPct) {
      const activeCount = Math.ceil((cloudPct / 100) * this.cloudPool.length);
      const effectiveDriftBase = Math.max(0.5, windSpeed);

      this.cloudPool.forEach((c, idx) => {
        if (idx >= activeCount) {
          c.el.style.opacity = "0";
          return;
        }
        const drift = (1.0 + effectiveDriftBase * 0.3) * c.speedMult * windSign;
        c.x += drift * 0.04;
        if (c.x > 1800) c.x = -250;
        if (c.x < -300) c.x = 1750;

        c.el.setAttribute("transform", `translate(${c.x.toFixed(1)}, ${c.y}) scale(${c.scale})`);

        let tint = "#f8fafc";
        if (EngineState.isStorm || (EngineState.isRaining && EngineState.rainRateMmHr >= 15)) {
          tint = "#475569";
        } else if (EngineState.solarElevation <= 0) {
          tint = "#94a3b8";
        } else if (EngineState.solarElevation <= 12) {
          tint = "#fed7aa";
        } else if (EngineState.solarWm2 > 650) {
          tint = "#ffffff";
        }

        c.use.setAttribute("fill", tint);
        c.el.style.opacity = (c.baseOpacity * Math.min(1, cloudPct / 40)).toFixed(2);
      });
    }
  };

  const VegetationEngine = {
    trees: [
      { id: "wx-tree-left", base: [290, 630], scale: 0.95 },
      { id: "wx-tree-center", base: [740, 620], scale: 0.8 },
      { id: "wx-tree-right", base: [1410, 632], scale: 1.08 }
    ],
    palms: [
      { id: "wx-palm-left", base: [140, 645], scale: 1.02 },
      { id: "wx-palm-right", base: [1220, 640], scale: 0.92 }
    ],
    grassTufts: [...document.querySelectorAll(".tuft")],

    update(time, windSpeed, gustSpeed, windSign) {
      const effectiveWind = windSpeed + (gustSpeed * 0.6);
      const baseFreq = time * (1.5 + effectiveWind * 0.15);
      const windIntensity = effectiveWind * windSign * 0.8;

      this.trees.forEach((t, i) => {
        const el = document.getElementById(t.id);
        if (!el) return;
        const trunkFlex = Math.sin(baseFreq + i * 1.5) * (windIntensity * 0.15);
        el.setAttribute("transform", `translate(${t.base[0]}, ${t.base[1]}) scale(${t.scale}) skewX(${-trunkFlex.toFixed(2)})`);

        el.querySelectorAll(".branch").forEach((br, bi) => {
          const brSway = Math.sin(baseFreq * 1.4 + i + bi) * (windIntensity * 0.35);
          const baseRot = bi === 0 ? -12 : bi === 1 ? 14 : 0;
          br.setAttribute("transform", `rotate(${(baseRot + brSway).toFixed(2)})`);
        });

        el.querySelectorAll(".canopy-cluster").forEach((lf, li) => {
          const flutter = Math.sin(time * 4.5 + li * 0.8) * (windIntensity * 0.2);
          lf.setAttribute("transform", `translate(${flutter.toFixed(1)}, ${(flutter * 0.5).toFixed(1)})`);
        });
      });

      this.palms.forEach((p, i) => {
        const el = document.getElementById(p.id);
        if (!el) return;
        const palmLean = Math.sin(baseFreq * 0.9 + i * 2.2) * (windIntensity * 0.25);
        el.setAttribute("transform", `translate(${p.base[0]}, ${p.base[1]}) scale(${p.scale}) skewX(${-palmLean.toFixed(2)})`);

        el.querySelectorAll(".frond").forEach((fr, fi) => {
          const frondBend = Math.sin(baseFreq * 1.8 + fi * 0.7) * (windIntensity * 0.6);
          fr.setAttribute("transform", `rotate(${frondBend.toFixed(2)})`);
        });
      });

      this.grassTufts.forEach((tuft, i) => {
        const bx = tuft.dataset.x;
        const by = tuft.dataset.y;
        const grassSway = (Math.sin(baseFreq * 2.5 + i * 0.8) * 0.6 + 0.4) * (windIntensity * 1.5);
        tuft.setAttribute("transform", `translate(${bx}, ${by}) rotate(${grassSway.toFixed(1)} 0 0)`);
      });
    }
  };

  const RainEngine = {
    drops: [],
    lightningTimer: 0,
    flashScreen: document.getElementById("wx-flash-screen"),
    fogLayer: document.getElementById("wx-fog-layer"),

    init() {
      this.drops = [];
      for (let i = 0; i < 350; i++) {
        this.drops.push({
          x: Math.random() * 1200 - 200,
          y: Math.random() * 400,
          len: Math.random() * 16 + 10,
          speed: Math.random() * 6 + 14
        });
      }
    },

    update(windSpeed, windSign) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (this.fogLayer) {
        this.fogLayer.style.opacity = EngineState.visibilityMeters < 3000 ? "0.6" : "0";
      }

      if (EngineState.isRaining || EngineState.isDrizzle) {
        const windLean = ((windSpeed + 5) / 10) * 4.5 * windSign;
        const dropCount = EngineState.isDrizzle ? 70 : Math.min(350, 100 + EngineState.rainRateMmHr * 45);

        ctx.lineWidth = EngineState.isDrizzle ? 0.9 : 1.4;
        ctx.strokeStyle = EngineState.isDrizzle ? "rgba(215, 230, 245, 0.35)" : "rgba(190, 220, 250, 0.65)";
        ctx.beginPath();

        for (let i = 0; i < dropCount; i++) {
          const d = this.drops[i];
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + windLean, d.y + (EngineState.isDrizzle ? d.len * 0.6 : d.len));

          d.y += EngineState.isDrizzle ? d.speed * 0.45 : d.speed;
          d.x += windLean * 0.7;

          if (d.y > canvas.height) {
            d.y = -20;
            d.x = Math.random() * (canvas.width + 600) - 300;
          }
        }
        ctx.stroke();
      }

      if (EngineState.isStorm && Date.now() > this.lightningTimer) {
        if (this.flashScreen) {
          this.flashScreen.style.opacity = "0.85";
          setTimeout(() => { this.flashScreen.style.opacity = "0"; }, 50);
          setTimeout(() => { this.flashScreen.style.opacity = "0.4"; }, 120);
          setTimeout(() => { this.flashScreen.style.opacity = "0.17"; }, 170);
        }
        this.lightningTimer = Date.now() + Math.random() * 8000 + 4000;
      }
    }
  };

  /* -------------------------------------------------------------
   * B. MASTER FRAME TICK
   * ------------------------------------------------------------- */
  let lastTime = performance.now();
  function animate(currentTime) {
    const dt = (currentTime - lastTime) * 0.001;
    lastTime = currentTime;
    EngineState.time += dt;

    CloudEngine.update(EngineState.windSpeed, EngineState.windSign, EngineState.cloudCoverPct);
    VegetationEngine.update(EngineState.time, EngineState.windSpeed, EngineState.windGust, EngineState.windSign);
    RainEngine.update(EngineState.windSpeed, EngineState.windSign);

    requestAnimationFrame(animate);
  }

  /* -------------------------------------------------------------
   * C. MODALS & UTILITY FUNCTIONS
   * ------------------------------------------------------------- */
  const modal = document.getElementById("wd-modal");
  const modalBody = document.getElementById("wd-modal-body");
  const modalHead = document.getElementById("wd-modal-head");
  const modalTitle = document.getElementById("wd-modal-title");
  const modalOk = document.getElementById("wd-modal-ok");

  if (modalOk) modalOk.onclick = () => modal.classList.remove("open");
  if (modal) modal.onclick = (e) => { if (e.target === modal) modal.classList.remove("open"); };

  function showModal(title, bodyHtml, headClass) {
    if (!modal) return;
    modalTitle.textContent = title;
    modalHead.className = "wx-modal-head " + (headClass || "");
    modalBody.innerHTML = bodyHtml;
    modal.classList.add("open");
  }

  function mrow(icon, label, val) {
    return `<div class='wx-modal-row'><span class='lbl'>${icon} ${label}</span><span class='val'>${val}</span></div>`;
  }

  function dirML(deg) {
    const d = ((deg % 360) + 360) % 360;
    if (d >= 337 || d < 23) return "വടക്ക്";
    if (d < 68) return "വടക്കുകിഴക്ക്";
    if (d < 113) return "കിഴക്ക്";
    if (d < 158) return "തെക്കുകിഴക്ക്";
    if (d < 203) return "തെക്ക്";
    if (d < 248) return "തെക്കുപടിഞ്ഞാറ്";
    if (d < 293) return "പടിഞ്ഞാറ്";
    return "വടക്കുപടിഞ്ഞാറ്";
  }

  function beaufort(kmh) {
    const scale = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    const desc = ["Calm", "Light air", "Light breeze", "Gentle breeze", "Moderate breeze",
      "Fresh breeze", "Strong breeze", "Near gale", "Gale", "Strong gale", "Storm", "Violent storm", "Hurricane"];
    const b = scale.findIndex(v => kmh < v);
    return { force: b === -1 ? 12 : b, description: desc[b === -1 ? 12 : b] };
  }

  function countTrailingOnes(arr) {
    let c = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === 1) c++;
      else break;
    }
    return c;
  }

  function getRainClassification(rate) {
    if (rate < 0.5) return "🌦️ ചാറ്റൽമഴ";
    if (rate < 2.0) return "🌧️ നേരിയ മഴ";
    if (rate < 5.0) return "🌧️ മിതമായ മഴ";
    if (rate < 15.0) return "🌧️ ഇടത്തരം മഴ";
    if (rate < 30.0) return "🌧️ ശക്തമായ മഴ";
    if (rate < 60.0) return "⛈️ അതിശക്തമായ മഴ";
    return "🌩️ അതിതീവ്ര മഴ";
  }

  /* -------------------------------------------------------------
   * D. DATA FETCH & DISPATCHER PIPELINE
   * ------------------------------------------------------------- */
  async function updateAll() {
    try {
      const [liveRes, owmRes, piezoRes, nowcastRes] = await Promise.allSettled([
        fetch(API_URL, { cache: "no-store" }).then(r => r.json()),
        fetch(OW_URL, { cache: "no-store" }).then(r => r.json()),
        fetch(PIEZO_URL, { cache: "no-store" }).then(r => r.json()),
        fetch(NOWCAST_URL, { cache: "no-store" }).then(r => r.json())
      ]);

      const payload = liveRes.status === "fulfilled" ? liveRes.value : null;
      const owm = owmRes.status === "fulfilled" ? owmRes.value : null;
      const piezo = piezoRes.status === "fulfilled" ? piezoRes.value : null;
      const nowcast = nowcastRes.status === "fulfilled" ? nowcastRes.value : {};

      if (!payload) return;

      const ld = payload.live_data || {};
      const tmp = ld.temperature || {};
      const hum = ld.humidity || {};
      const wnd = ld.wind || {};
      const prs = ld.pressure || {};
      const rn = ld.rain || {};

      // 1. Wind Unit Conversion: mph -> km/h
      const rawSpeedMph = wnd.speed_kmh != null ? parseFloat(wnd.speed_kmh) : 0;
      const rawGustMph = wnd.gust_kmh != null ? parseFloat(wnd.gust_kmh) : rawSpeedMph;
      const rawDayGustMph = payload.daily_max_gust_kmh != null ? parseFloat(payload.daily_max_gust_kmh) : null;

      const speedKmh = rawSpeedMph * 1.60934;
      const gustKmh = rawGustMph * 1.60934;
      const dayGustKmh = rawDayGustMph != null ? rawDayGustMph * 1.60934 : null;

      EngineState.windSpeed = speedKmh;
      EngineState.windGust = gustKmh;
      EngineState.windDirDeg = wnd.direction_degrees != null ? parseFloat(wnd.direction_degrees) : 250;
      EngineState.windSign = (EngineState.windDirDeg > 180) ? 1 : -1;

      // Solar & Radiative Input
      EngineState.solarWm2 = ld.solar_wm2 != null ? parseFloat(ld.solar_wm2) : 250;
      EngineState.uvi = ld.uvi != null ? parseFloat(ld.uvi) : 2;
      EngineState.humidity = hum.outdoor != null ? parseFloat(hum.outdoor) : 75;

      if (nowcast?.analytics?.solar_elevation_deg != null) {
        EngineState.solarElevation = nowcast.analytics.solar_elevation_deg;
      }
      if (nowcast?.analytics?.visibility_m != null) {
        EngineState.visibilityMeters = nowcast.analytics.visibility_m;
      }
      if (nowcast?.analytics?.pm2_5 != null) {
        EngineState.pm25 = nowcast.analytics.pm2_5;
      }

      if (nowcast?.conditions?.sky_cloud?.cloudiness_pct != null) {
        EngineState.cloudCoverPct = nowcast.conditions.sky_cloud.cloudiness_pct;
      } else if (owm?.clouds?.all != null) {
        EngineState.cloudCoverPct = owm.clouds.all;
      }

      // 2. Advanced Rain Logic & Piezo Sensor Fusion
      const rainRate = rn.rate_mm_hr != null ? parseFloat(rn.rate_mm_hr) : 0;
      const piezoArr = Array.isArray(piezo) ? piezo.map(p => p.v) : [];
      const trailingOnes = countTrailingOnes(piezoArr);
      const nowMs = Date.now();

      let resolvedRainConditionText = "";
      let isRainingVisual = false;
      let isDrizzleVisual = false;

      // Scenario A: Active Gauge Accumulation (Tipping Bucket > 0 mm/h)
      if (rainRate > 0) {
        isRainingVisual = true;
        isDrizzleVisual = false;

        let baseDesc = getRainClassification(rainRate);

        // Check if intensity is dropping noticeably
        if (RainTracker.previousRate > 0 && rainRate < RainTracker.previousRate * 0.85) {
          baseDesc += " (മഴ കുറയുന്നു)";
        }

        resolvedRainConditionText = baseDesc;
        RainTracker.wasActivelyRaining = true;
        RainTracker.previousRate = rainRate;
        RainTracker.rainStoppedTimestamp = 0;

      // Scenario B: Rain Has Just Stopped (Rate dropped to 0 from >0)
      } else if (RainTracker.wasActivelyRaining && rainRate === 0) {
        if (RainTracker.rainStoppedTimestamp === 0) {
          RainTracker.rainStoppedTimestamp = nowMs;
        }

        // Show 'മഴ ശമിച്ചു' for 5 minutes, ignoring lingering wet sensor
        if (nowMs - RainTracker.rainStoppedTimestamp < RainTracker.STOP_GRACE_DURATION_MS) {
          resolvedRainConditionText = "🌦️ മഴ ശമിച്ചു";
          isRainingVisual = false;
          isDrizzleVisual = false;
        } else {
          // Grace period elapsed, fully reset rain memory
          RainTracker.wasActivelyRaining = false;
          RainTracker.previousRate = 0;
          RainTracker.rainStoppedTimestamp = 0;
        }

      // Scenario C: Pre-Rain / Dew / Early Drizzle Detection via Piezo
      } else if (trailingOnes >= 1 && trailingOnes <= 4) {
        // Piezo triggered, rate is 0: show 'മഴ' and trigger drizzle animation
        resolvedRainConditionText = "🌦️ മഴ";
        isRainingVisual = false;
        isDrizzleVisual = true;

      // Scenario D: 5+ consecutive 1s with 0 mm/h -> Deemed unnoticeable / false alarm
      } else {
        isRainingVisual = false;
        isDrizzleVisual = false;
        RainTracker.previousRate = 0;
      }

      EngineState.rainRateMmHr = rainRate;
      EngineState.isRaining = isRainingVisual;
      EngineState.isDrizzle = isDrizzleVisual;

      // 3. Corroborated Thunderstorm State
      const thunder = nowcast?.conditions?.thunderstorm || {};
      EngineState.isStorm = thunder.confirmed || false;
      EngineState.stormReportedNearby = !!(thunder.active && !thunder.confirmed);

      CelestialEngine.update(EngineState.solarElevation, EngineState.cloudCoverPct);

      // 4. UI Text & Label Synchronization
      const t = tmp.outdoor != null ? tmp.outdoor : "--";
      const feels = tmp.feels_like_outdoor != null ? tmp.feels_like_outdoor : "--";
      const h = hum.outdoor != null ? hum.outdoor : "--";
      const vis = owm?.visibility ? (owm.visibility / 1000).toFixed(1) : "--";
      const windSpeedText = (Math.round(speedKmh * 10) / 10).toFixed(1);
      const windGustText = (Math.round(gustKmh * 10) / 10).toFixed(1);
      const dayGustText = dayGustKmh != null ? (Math.round(dayGustKmh * 10) / 10).toFixed(1) : "--";
      const mlDir = dirML(EngineState.windDirDeg);

      const ncComps = nowcast.components || {};
      latestNowcastFull = nowcast.nowcast?.ml || "--";
      latestNowcastIndoor = ncComps.indoor_ml || "--";
      latestNowcastWind = ncComps.wind_ml || "--";

      // If active rain/cessation is occurring, prioritize that; otherwise fallback to nowcast sky text
      latestCondition = resolvedRainConditionText || ncComps.sky_ml || "--";

      document.getElementById("wd-temp").textContent = t;
      document.getElementById("wd-feels").textContent = feels;
      document.getElementById("wd-humidity").textContent = h;
      document.getElementById("wd-visibility").textContent = vis;
      document.getElementById("wd-condition").textContent = latestCondition;
      document.getElementById("wd-wind").textContent = `${windSpeedText} km/h`;
      document.getElementById("wd-wind-detail").textContent = `Gust ${windGustText} km/h · ${mlDir}`;
      document.getElementById("wd-pressure").textContent = prs.absolute_hpa != null ? prs.absolute_hpa : "--";
      document.getElementById("wd-uvi").textContent = ld.uvi != null ? ld.uvi : "--";
      document.getElementById("wd-solar").textContent = ld.solar_wm2 != null ? ld.solar_wm2 : "--";

      document.getElementById("wd-indoor-temp").textContent = tmp.indoor != null ? tmp.indoor : "--";
      document.getElementById("wd-indoor-humidity").textContent = hum.indoor != null ? hum.indoor : "--";
      document.getElementById("wd-indoor-feels").textContent = tmp.feels_like_indoor != null ? tmp.feels_like_indoor : "--";

      const now = new Date();
      document.getElementById("wd-last-updated").textContent = payload.updated_at
        ? new Date(payload.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      // Store references for click dialogs
      latestWind = {
        speed: windSpeedText,
        gust: windGustText,
        dirDeg: EngineState.windDirDeg,
        dirComp: wnd.direction_compass || "W",
        mlDir: mlDir,
        avg10Deg: wnd.avg_10min_dir_deg != null ? Math.round(parseFloat(wnd.avg_10min_dir_deg)) : "--",
        avg10Comp: wnd.avg_10min_dir_compass || "--",
        dayGust: dayGustText
      };

      latestMain = {
        indoorT: tmp.indoor,
        indoorH: hum.indoor,
        indoorFeels: tmp.feels_like_indoor,
        pressureAbs: prs.absolute_hpa,
        pressureRel: prs.relative_hpa,
        uvi: ld.uvi,
        solar: ld.solar_wm2,
        vpd: ld.vpd_kpa,
        dewOut: tmp.dew_point_outdoor,
        dewIn: tmp.dew_point_indoor,
        rain: rainRate,
        rainDaily: rn.daily_mm,
        humidity: h,
        cloudPct: EngineState.cloudCoverPct,
        piezoNow: piezoArr.length ? piezoArr[piezoArr.length - 1] : 0,
        piezoArr: piezoArr
      };

    } catch (err) {
      console.error("Telemetry sync failed:", err);
    }
  }

  /* -------------------------------------------------------------
   * E. ATTACH CLICK LISTENERS FOR MODALS
   * ------------------------------------------------------------- */
  const windBox = document.getElementById("wd-wind-box");
  if (windBox) {
    windBox.onclick = function () {
      if (!latestWind) return;
      const lw = latestWind;
      const bft = beaufort(parseFloat(lw.speed));
      const gbft = beaufort(parseFloat(lw.gust));
      showModal(
        "💨 കാറ്റ് — വിശദ വിവരങ്ങൾ",
        mrow("🌬", "ഇപ്പോഴത്തെ വേഗത", lw.speed + " km/h") +
        mrow("🧭", "ദിശ", lw.mlDir + " (" + lw.dirComp + ", " + lw.dirDeg + "°)") +
        mrow("💨", "ഇപ്പോഴത്തെ ഗസ്റ്റ്", lw.gust + " km/h") +
        mrow("📈", "ഇന്ന് ഏറ്റവും ഉയർന്ന ഗസ്റ്റ്", lw.dayGust + " km/h") +
        mrow("🌀", "Beaufort (speed)", bft.force + " — " + bft.description) +
        mrow("🌀", "Beaufort (gust)", gbft.force + " — " + gbft.description) +
        mrow("📊", "10 മിനിറ്റ് ശരാശരി ദിശ", lw.avg10Comp + " (" + lw.avg10Deg + "°)") +
        `<div style='margin-top:12px;padding:10px;background:#f8f9fa;border-radius:6px;text-align:center;font-size:14px;font-weight:700;color:#2c3e50;'>${latestNowcastWind || "--"}</div>`,
        "wind"
      );
    };
  }

  const indoorBox = document.getElementById("wd-indoor-box");
  if (indoorBox) {
    indoorBox.onclick = function () {
      const m = latestMain;
      showModal(
        "🏠 Indoor Climate",
        "<div class='wx-modal-note' style='text-align:left;padding-top:10px;color:#888;font-size:12px;'>കോൺക്രീറ്റ് കെട്ടിടത്തിനകത്ത് ഉള്ള അന്തരീക്ഷം</div>" +
        mrow("🌡", "Temperature", (m.indoorT != null ? m.indoorT : "--") + "°C") +
        mrow("🌫", "Feels like", (m.indoorFeels != null ? m.indoorFeels : "--") + "°C") +
        mrow("💧", "Humidity", (m.indoorH != null ? m.indoorH : "--") + "%") +
        `<div style='margin-top:12px;padding:10px;background:#f0f7ff;border-radius:8px;text-align:center;font-size:14px;font-weight:700;color:#1a2233;'>${latestNowcastIndoor || "--"}</div>`,
        "indoor"
      );
    };
  }

  const condBox = document.getElementById("wd-condition-box");
  if (condBox) {
    condBox.onclick = function () {
      const m = latestMain;
      showModal(
        "🌤 കാലാവസ്ഥ വിശദീകരണം",
        mrow("☀️", "UVI", m.uvi != null ? m.uvi : "--") +
        mrow("🔆", "Solar", (m.solar != null ? m.solar : "--") + " W/m²") +
        mrow("☁️", "Cloud cover", (m.cloudPct != null ? m.cloudPct : "--") + " %") +
        mrow("🌱", "VPD", (m.vpd != null ? m.vpd : "--") + " kPa") +
        mrow("🌡", "Dew Point (Out)", (m.dewOut != null ? m.dewOut : "--") + "°C") +
        mrow("🌧", "Rain rate (now)", (m.rain || 0) + " mm/hr") +
        mrow("🌧", "Rain today", (m.rainDaily || 0) + " mm") +
        mrow("💧", "Outdoor humidity", (m.humidity != null ? m.humidity : "--") + "%") +
        mrow("📊", "Pressure (Abs)", (m.pressureAbs || "--") + " hPa") +
        mrow("💦", "Piezo സെൻസർ", (m.piezoNow === 1 ? "നനവ് (1)" : "ഉണക്കം (0)")) +
        `<div style='margin:12px 0 4px;padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;font-size:14px;font-weight:700;line-height:1.5;color:#1a2233;'>${latestNowcastFull || latestCondition}</div>`,
        "condition"
      );
    };
  }

  /* -------------------------------------------------------------
   * F. BOOTSTRAP SEQUENCE
   * ------------------------------------------------------------- */
  resizeCanvas();
  CelestialEngine.initStars();
  CloudEngine.init();
  RainEngine.init();
  updateAll();
  setInterval(updateAll, 30000);
  requestAnimationFrame(animate);

})();
