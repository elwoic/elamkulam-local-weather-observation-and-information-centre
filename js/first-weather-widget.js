(function () {
  "use strict";
  const VAYU_CORE = "https://elwoic-vayu-core.bold-waterfall-0d01.workers.dev/";

  const EngineState = {
    solarElevation: 35, solarWm2: 0, uvi: 0, humidity: 99,
    pm25: 0, windSpeed: 0, windGust: 0, windDirDeg: 250,
    windSign: 1, cloudCoverPct: 98, rainRateMmHr: 0,
    isDrizzle: false, isRaining: false, isStorm: false,
    visibilityMeters: 10000, time: 0
  };

  //... keep your CelestialEngine, CloudEngine, VegetationEngine, RainEngine init code here...

  async function updateAll() {
    try {
      const d = await fetch(VAYU_CORE, { cache: "no-store" }).then(r => r.json());

      // Direct assign - no calculations
      EngineState.rainRateMmHr = d.rain.rate_mm_hr;
      EngineState.isDrizzle = d.rain.isDrizzle;
      EngineState.isRaining = d.rain.isRaining;
      EngineState.isStorm = d.condition.thunderstorm?.confirmed || false;
      EngineState.solarElevation = d.engine.solarElevation;
      EngineState.cloudCoverPct = d.engine.cloudCoverPct;
      EngineState.solarWm2 = d.engine.solarWm2;
      EngineState.uvi = d.engine.uvi;
      EngineState.humidity = d.engine.humidity;
      EngineState.pm25 = d.engine.pm25;
      EngineState.windSpeed = d.engine.windSpeed;
      EngineState.windGust = d.engine.windGust;
      EngineState.windDirDeg = d.engine.windDirDeg;
      EngineState.windSign = d.engine.windDirDeg > 180? 1 : -1;
      EngineState.visibilityMeters = d.engine.visibilityM;

      CelestialEngine.update(EngineState.solarElevation, EngineState.cloudCoverPct);

      // UI
      document.getElementById("wd-condition").textContent = d.condition.ml;
      document.getElementById("wd-temp").textContent = d.raw.live_data?.temperature?.outdoor?? "--";
      document.getElementById("wd-wind").textContent = `${EngineState.windSpeed.toFixed(1)} km/h`;
      document.getElementById("wd-rain-rate").textContent = `${d.rain.rate_mm_hr} mm/h`;

      // Rain animation strength based on intensity
      // This is the only place where rate affects visuals
      RainEngine.dropCount = d.rain.isDrizzle? 70 : Math.min(350, 100 + d.rain.rate_mm_hr * 45);

    } catch (e) { console.error("vayu-core failed", e); }
  }

  // bootstrap
  resizeCanvas(); CelestialEngine.initStars(); CloudEngine.init(); RainEngine.init();
  updateAll();
  setInterval(updateAll, 30000);
  requestAnimationFrame(animate);
})();
