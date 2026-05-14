 // table.js

const lat     = 10.9081;
const lon     = 76.2296;
const OWM_KEY = "ca13a2cbdc07e7613b6af82cff262295";

const API_URL  = "https://elwoi-dashboar-parameters.bold-waterfall-0d01.workers.dev/";
const WIND_URL = "https://wind-fetcher.bold-waterfall-0d01.workers.dev/";

// Fetch options — always bypass cache for live station data
const LIVE = { cache: "no-store" };

/* =============================================================
   RAIN TREND TRACKER
   Keeps last 3 rain rate readings (one per 30s cycle).
   If all 3 are non-zero and each >= previous → rain is confirmed.
   If rate just ticked above 0 with a rising trend → "Rain Starting".
============================================================= */
const rainHistory = [];
const RAIN_HISTORY_SIZE = 3;

function trackRain(rate) {
    rainHistory.push(rate);
    if (rainHistory.length > RAIN_HISTORY_SIZE) rainHistory.shift();
}

function isRainTrending() {
    if (rainHistory.length < RAIN_HISTORY_SIZE) return false;
    return rainHistory.every((v, i) =>
        i === 0 ? v > 0 : v >= rainHistory[i - 1] && v > 0
    );
}

/* =============================================================
   CONDITION LOGIC
   Day   → derived from station sensors (UVI, solar, rain)
   Night → derived from OWM current weather description
   Boundary: civil twilight approx 06:00–19:00 IST
============================================================= */
function isDaytime() {
    const h = new Date().getHours();
    return h >= 6 && h < 19;
}

function conditionFromStation(uvi, solar, rain) {
    if (rain > 0)                return { icon: "🌧️", text: "Raining",       isRain: true  };
    if (uvi >= 8 && solar > 700) return { icon: "☀️",  text: "Blazing Sun",   isRain: false };
    if (uvi >= 6 && solar > 500) return { icon: "🌞",  text: "Sunny",         isRain: false };
    if (uvi >= 3 && solar > 250) return { icon: "🌤️",  text: "Mostly Sunny",  isRain: false };
    if (solar > 80)              return { icon: "⛅",  text: "Partly Cloudy", isRain: false };
    if (solar > 10)              return { icon: "🌥️",  text: "Mostly Cloudy", isRain: false };
    return                              { icon: "☁️",  text: "Overcast",      isRain: false };
}

function conditionFromOWM(owmDesc, owmMain) {
    const d = owmDesc.toLowerCase();
    const m = owmMain.toLowerCase();
    if (m.includes("thunderstorm")) return { icon: "⛈️",  text: "Thunderstorm",  isRain: true  };
    if (m.includes("drizzle"))      return { icon: "🌦️",  text: "Drizzle",       isRain: true  };
    if (m.includes("rain"))         return { icon: "🌧️",  text: "Rain",          isRain: true  };
    if (m.includes("snow"))         return { icon: "❄️",  text: "Snow",          isRain: false };
    if (m.includes("mist") || m.includes("fog"))
                                    return { icon: "🌫️",  text: "Foggy / Mist",  isRain: false };
    if (d.includes("overcast"))     return { icon: "☁️",  text: "Overcast",      isRain: false };
    if (d.includes("broken") || d.includes("scattered"))
                                    return { icon: "🌥️",  text: "Mostly Cloudy", isRain: false };
    if (d.includes("few clouds"))   return { icon: "🌤️",  text: "Few Clouds",    isRain: false };
    if (d.includes("clear"))        return { icon: "🌙",  text: "Clear Night",   isRain: false };
    return                                 { icon: "🌙",  text: "Night",         isRain: false };
}

/* =============================================================
   DISPLAY HELPERS
============================================================= */
function displayRainStatus(elementId, isRaining, text, isError = false) {
    const r = document.getElementById(elementId);
    if (!r) return;
    if (isError) {
        r.innerHTML = `<span class="error-status">⚠️ API Error</span>`;
    } else if (isRaining) {
        r.innerHTML = `<span class="rain-status yes">🌧️ ${text}</span>`;
    } else {
        r.innerHTML = `<span class="rain-status no">☀️ ${text}</span>`;
    }
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "--";
}

function formatTime(date) {
    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
}

/* =============================================================
   NOW COLUMN  (index 0) — station workers
============================================================= */
async function loadNowFromStation(owmCurrentData) {
    try {
        const [stationRes, windRes] = await Promise.all([
            fetch(API_URL,  LIVE).then(r => r.json()).catch(() => null),
            fetch(WIND_URL, LIVE).then(r => r.json()).catch(() => null)
        ]);

        if (!stationRes) {
            displayRainStatus("owRainBox0", false, "Error", true);
            return;
        }

        // --- Temperature & Humidity ---
        const temp  = stationRes?.temperature?.outdoor ?? "--";
        const feels = stationRes?.temperature?.feels_like_outdoor ?? "--";
        const hum   = stationRes?.humidity?.outdoor ?? "--";
        const press = stationRes?.pressure?.relative_hpa
                   ?? stationRes?.pressure?.absolute_hpa
                   ?? "--";

        setEl("owTemp0",  temp  !== "--" ? `${temp}°C`    : "--");
        setEl("owFeels0", feels !== "--" ? `${feels}°C`   : "--");
        setEl("owHum0",   hum   !== "--" ? `${hum}%`      : "--");
        setEl("owPress0", press !== "--" ? `${press} hPa` : "--");

        // --- Wind (from WIND_URL) ---
        const wind      = windRes?.wind || {};
        const windSpeed = wind?.speed?.value ?? 0;
        const windGust  = wind?.gust?.value  ?? 0;
        const windComp  = wind?.direction?.compass           ?? "--";
        const avg10Comp = wind?.avg_10min?.direction_compass ?? "--";
        const beaufort  = wind?.speed?.beaufort?.description ?? "";

        setEl("owWind0",
            `${windSpeed} km/h ${windComp} | Gust: ${windGust} km/h | Avg dir: ${avg10Comp} — ${beaufort}`
        );

        // --- Visibility from OWM ---
        const vis = owmCurrentData?.visibility
            ? `${(owmCurrentData.visibility / 1000).toFixed(1)} km`
            : "--";
        setEl("owVis0", vis);

        // --- Rain trend tracking ---
        const rain = stationRes?.rain?.rate_mm_hr ?? 0;
        trackRain(rain);
        const trending = isRainTrending();

        // --- Condition ---
        const uvi   = stationRes?.uvi   ?? 0;
        const solar = stationRes?.solar ?? 0;

        let cond;

        if (rain > 0 || trending) {
            const label = (trending && rain === 0)
                ? "Rain Starting"
                : `Raining (${rain} mm/hr)`;
            cond = { icon: "🌧️", text: label, isRain: true };

        } else if (isDaytime()) {
            cond = conditionFromStation(uvi, solar, rain);

            if (!cond.isRain && owmCurrentData) {
                const owmMain = owmCurrentData.weather?.[0]?.main ?? "";
                if (owmMain.includes("Rain") || owmMain.includes("Drizzle") || owmMain.includes("Thunderstorm")) {
                    cond = conditionFromOWM(owmCurrentData.weather[0].description, owmMain);
                }
            }

        } else {
            if (owmCurrentData) {
                cond = conditionFromOWM(
                    owmCurrentData.weather?.[0]?.description ?? "",
                    owmCurrentData.weather?.[0]?.main ?? ""
                );
            } else {
                cond = { icon: "🌙", text: "Night", isRain: false };
            }
        }

        setEl("owCond0", `${cond.icon} ${cond.text}`);
        displayRainStatus("owRainBox0", cond.isRain, cond.isRain ? "Raining" : "Dry");

        // --- Last updated time ---
        const stationTs = stationRes?.timestamp;
        const updatedAt = stationTs
            ? formatTime(new Date(stationTs))
            : formatTime(new Date());
        setEl("stationLastUpdated", `🕐 Last updated: ${updatedAt}`);

    } catch (e) {
        console.error("Station fetch error:", e);
        displayRainStatus("owRainBox0", false, "Error", true);
    }
}

/* =============================================================
   FORECAST COLUMNS (index 1 = +3h, index 2 = +6h) — OWM only
============================================================= */
function updateForecastColumn(index, data) {
    setEl(`owTemp${index}`,  `${data.main.temp.toFixed(1)}°C`);
    setEl(`owFeels${index}`, `${data.main.feels_like.toFixed(1)}°C`);

    const cond = data.weather[0].description;
    setEl(`owCond${index}`, cond.charAt(0).toUpperCase() + cond.slice(1));
    setEl(`owHum${index}`,  `${data.main.humidity}%`);
    setEl(`owPress${index}`,`${data.main.pressure} hPa`);

    const wind = (data.wind.speed * 3.6).toFixed(1);
    setEl(`owWind${index}`, `${wind} km/h`);
    setEl(`owVis${index}`,  "N/A");

    const rainText  = data.weather[0].main.includes("Rain") ? "Rain Expected" : "Dry";
    const isRaining = data.weather[0].main.includes("Rain") || data.weather[0].main.includes("Drizzle");
    displayRainStatus(`owRainBox${index}`, isRaining, rainText);
}

/* =============================================================
   MAIN LOADER
============================================================= */
async function loadAllData() {
    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
            fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`)
        ]);

        const currentData  = currentRes.ok  ? await currentRes.json()  : null;
        const forecastData = forecastRes.ok ? await forecastRes.json() : null;

        await loadNowFromStation(currentData);

        if (forecastData?.list?.length >= 2) {
            updateForecastColumn(1, forecastData.list[0]); // +3h
            updateForecastColumn(2, forecastData.list[1]); // +6h
        } else {
            console.error("Forecast data unavailable.");
            for (let i = 1; i < 3; i++) {
                setEl(`owTemp${i}`, "N/A");
                setEl(`owCond${i}`, "Forecast Unavailable");
                displayRainStatus(`owRainBox${i}`, false, "N/A", true);
            }
        }

    } catch (e) {
        console.error("Critical error in loadAllData:", e);
        for (let i = 0; i < 3; i++) {
            displayRainStatus(`owRainBox${i}`, false, "Error", true);
        }
    }
}

// --- Init & auto-refresh every 30 seconds ---
loadAllData();
setInterval(loadAllData, 30000);
