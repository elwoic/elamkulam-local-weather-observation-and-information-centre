 // table.js

const lat     = 10.9081;
const lon     = 76.2296;
const OWM_KEY = "ca13a2cbdc07e7613b6af82cff262295";

const API_URL = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/live";

const LIVE = { cache: "no-store" };

/* =============================================================
   RAIN TREND TRACKER
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
   BEAUFORT SCALE (client-side)
============================================================= */
function beaufortDesc(kmh) {
    const scale = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    const desc  = ["Calm","Light air","Light breeze","Gentle breeze","Moderate breeze",
                   "Fresh breeze","Strong breeze","Near gale","Gale","Strong gale","Storm","Violent storm","Hurricane"];
    const b = scale.findIndex(v => kmh < v);
    return desc[b === -1 ? 12 : b];
}

/* =============================================================
   CONDITION LOGIC
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
   NOW COLUMN (index 0) — unified worker
============================================================= */
async function loadNowFromStation(owmCurrentData) {
    try {
        const payload = await fetch(API_URL, LIVE).then(r => r.json()).catch(() => null);

        if (!payload) {
            displayRainStatus("owRainBox0", false, "Error", true);
            return;
        }

        const ld  = payload.live_data || {};
        const tmp = ld.temperature   || {};
        const hum = ld.humidity      || {};
        const wnd = ld.wind          || {};
        const prs = ld.pressure      || {};
        const rn  = ld.rain          || {};

        // --- Temperature & Humidity ---
        const temp  = tmp.outdoor            ?? "--";
        const feels = tmp.feels_like_outdoor ?? "--";
        const hout  = hum.outdoor            ?? "--";
        const press = prs.relative_hpa ?? prs.absolute_hpa ?? "--";

        setEl("owTemp0",  temp  !== "--" ? `${temp}°C`    : "--");
        setEl("owFeels0", feels !== "--" ? `${feels}°C`   : "--");
        setEl("owHum0",   hout  !== "--" ? `${hout}%`     : "--");
        setEl("owPress0", press !== "--" ? `${press} hPa` : "--");

        // --- Wind ---
        const windSpeed  = wnd.speed_kmh             ?? 0;
        const windGust   = wnd.gust_kmh              ?? 0;
        const windComp   = wnd.direction_compass     ?? "--";
        const avg10Comp  = wnd.avg_10min_dir_compass ?? "--";
        const bft        = beaufortDesc(windSpeed);
        const dayMaxGust = payload.daily_max_gust_kmh ?? "--";

        setEl("owWind0",
            `${windSpeed} km/h ${windComp} | Gust: ${windGust} km/h | Avg dir: ${avg10Comp} — ${bft}`
        );

        // --- Visibility from OWM ---
        const vis = owmCurrentData?.visibility
            ? `${(owmCurrentData.visibility / 1000).toFixed(1)} km`
            : "--";
        setEl("owVis0", vis);

        // --- Rain trend ---
        const rain = rn.rate_mm_hr ?? 0;
        trackRain(rain);
        const trending = isRainTrending();

        // --- Condition ---
        const uvi   = ld.uvi      ?? 0;
        const solar = ld.solar_wm2 ?? 0;

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
            cond = owmCurrentData
                ? conditionFromOWM(
                    owmCurrentData.weather?.[0]?.description ?? "",
                    owmCurrentData.weather?.[0]?.main ?? ""
                  )
                : { icon: "🌙", text: "Night", isRain: false };
        }

        setEl("owCond0", `${cond.icon} ${cond.text}`);
        displayRainStatus("owRainBox0", cond.isRain, cond.isRain ? "Raining" : "Dry");

        // --- Last updated from Supabase updated_at ---
        const updatedAt = payload.updated_at
            ? formatTime(new Date(payload.updated_at))
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
