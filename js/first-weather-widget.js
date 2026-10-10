/* =============================================================
   2. ELWOIC VAYU CANVAS ENGINE - (Frontend)
============================================================= */

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

    // Note: Keep your existing CelestialEngine, CloudEngine, VegetationEngine, RainEngine init code here...

    async function updateAll() {
        try {
            const d = await fetch(VAYU_CORE, { cache: "no-store" }).then(r => r.json());

            if (d.error) throw new Error(d.error);

            // Direct assignment - Worker does all calculations
            EngineState.rainRateMmHr = d.rain.rate_mm_hr;
            EngineState.isDrizzle = d.rain.isDrizzle;
            EngineState.isRaining = d.rain.isRaining;
            EngineState.isStorm = d.rain.isStorm;
            EngineState.solarElevation = d.engine.solarElevation;
            EngineState.cloudCoverPct = d.engine.cloudCoverPct;
            EngineState.solarWm2 = d.engine.solarWm2;
            EngineState.uvi = d.engine.uvi;
            EngineState.humidity = d.engine.humidity;
            EngineState.pm25 = d.engine.pm25;
            EngineState.windSpeed = d.engine.windSpeed;
            EngineState.windGust = d.engine.windGust;
            EngineState.windDirDeg = d.engine.windDirDeg;
            EngineState.windSign = d.engine.windDirDeg > 180 ? 1 : -1;
            EngineState.visibilityMeters = d.engine.visibilityM;

            // Engine updates
            if (typeof CelestialEngine !== "undefined") CelestialEngine.update(EngineState.solarElevation, EngineState.cloudCoverPct);

            // Canvas Overlay UI Updates
            const wdCond = document.getElementById("wd-condition");
            if (wdCond) wdCond.textContent = d.dashboard.conditionMl;
            
            const wdTemp = document.getElementById("wd-temp");
            if (wdTemp) wdTemp.textContent = d.dashboard.tempRaw;
            
            const wdWind = document.getElementById("wd-wind");
            if (wdWind) wdWind.textContent = `${EngineState.windSpeed.toFixed(1)} km/h`;
            
            const wdRainRate = document.getElementById("wd-rain-rate");
            if (wdRainRate) wdRainRate.textContent = `${d.rain.rate_mm_hr} mm/h`;

            // Rain animation strength
            if (typeof RainEngine !== "undefined") {
                RainEngine.dropCount = d.rain.isDrizzle ? 70 : Math.min(350, 100 + d.rain.rate_mm_hr * 45);
            }

        } catch (e) { 
            console.error("VAYU Core failed to load Engine State", e); 
        }
    }

    // Bootstrap Canvas Environment
    if (typeof resizeCanvas === "function") resizeCanvas(); 
    if (typeof CelestialEngine !== "undefined") CelestialEngine.initStars(); 
    if (typeof CloudEngine !== "undefined") CloudEngine.init(); 
    if (typeof RainEngine !== "undefined") RainEngine.init();
    
    updateAll();
    setInterval(updateAll, 30000);
    
    if (typeof animate === "function") requestAnimationFrame(animate);
})();
