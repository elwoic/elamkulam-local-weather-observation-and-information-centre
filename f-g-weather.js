import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* =============================================================
   CONFIG
============================================================= */
const lat     = 10.9081;
const lon     = 76.2296;
const OWM_KEY = "ca13a2cbdc07e7613b6af82cff262295";

const API_URL  = "https://fine-boa-53.elwoicelamkulam.deno.net/";
const WIND_URL = "https://wind-fetcher.bold-waterfall-0d01.workers.dev/";

const OW_KEY = OWM_KEY;
const LAT = lat;
const LON = lon;

// Fetch options — always bypass cache for live station data
const LIVE = { cache: "no-store" };

let chart = null;

/* =============================================================
   RAIN TREND TRACKER
   Tracks last 3 readings of BOTH rate_mm_hr AND hourly_mm.
   Rain is only confirmed as active when:
     1. rate_mm_hr > 0  AND
     2. hourly_mm is also > 0 (i.e. accumulation has actually occurred)
     3. hourly_mm has increased across the last 2 readings (still accumulating)
   This prevents stale rate values triggering false "Raining" status.
============================================================= */
const rainHistory = [];        // rate_mm_hr readings
const hourlyHistory = [];      // hourly_mm readings
const RAIN_HISTORY_SIZE = 3;

function trackRain(rate, hourly) {
    rainHistory.push(rate);
    hourlyHistory.push(hourly);
    if (rainHistory.length  > RAIN_HISTORY_SIZE) rainHistory.shift();
    if (hourlyHistory.length > RAIN_HISTORY_SIZE) hourlyHistory.shift();
}

function isRainActive(rate, hourly) {
    // Primary guard: rate must be non-zero
    if (rate <= 0) return false;

    // Secondary guard: hourly accumulation must also be non-zero
    // (rules out stale rate from a rain event that already ended)
    if (hourly <= 0) return false;

    // Tertiary guard: hourly_mm must have increased in the last two readings
    // (confirms rain is still actively falling, not a frozen leftover value)
    if (hourlyHistory.length >= 2) {
        const prev = hourlyHistory[hourlyHistory.length - 2];
        const curr = hourlyHistory[hourlyHistory.length - 1];
        if (curr <= prev) return false; // accumulation has stopped
    }

    return true;
}

function isRainTrending() {
    // "Rain Starting" signal: rate just appeared and hourly is ticking up
    if (rainHistory.length < RAIN_HISTORY_SIZE) return false;
    if (hourlyHistory.length < 2) return false;

    const rateRising = rainHistory.every((v, i) =>
        i === 0 ? v > 0 : v >= rainHistory[i - 1] && v > 0
    );
    const hourlyRising =
        hourlyHistory[hourlyHistory.length - 1] > hourlyHistory[hourlyHistory.length - 2];

    return rateRising && hourlyRising;
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

function conditionFromStation(uvi, solar) {
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
   MALAYALAM CONDITION HELPER  (from dashboard script)
============================================================= */
const dirMap = (deg = 0) => {
    if (deg >= 337 || deg < 23) return "വടക്ക്";
    if (deg < 68) return "വടക്കുകിഴക്ക്";
    if (deg < 113) return "കിഴക്ക്";
    if (deg < 158) return "തെക്കുകിഴക്ക്";
    if (deg < 203) return "തെക്ക്";
    if (deg < 248) return "തെക്കുപടിഞ്ഞാറ്";
    if (deg < 293) return "പടിഞ്ഞാറ്";
    return "വടക്കുപടിഞ്ഞാറ്";
};

function getCondition(uvi, solar, rain) {
    if (rain > 0) return "🌧 മഴ പെയ്യുന്നു";
    if (uvi >= 6 && solar > 600) return "☀️ തെളിഞ്ഞ ആകാശം";
    if (solar > 300) return "🌤 ഭാഗികമായി മേഘാവൃതം";
    if (solar > 80) return "⛅ ചെറിയ മേഘങ്ങൾ";
    return "☁️ മേഘാവൃതം";
}

/* =============================================================
   DISPLAY HELPERS  (from table.js)
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
   UTIL  (from dashboard script)
============================================================= */
function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "--";
}

/* =============================================================
   SHARED DATA FETCH
   Single fetch for all three API calls, shared between
   the table columns and the dashboard UI.
============================================================= */
async function fetchAllSources() {
    const [stationRes, owmCurrentRes, forecastRes, windRes] = await Promise.all([
        fetch(API_URL,  LIVE).then(r => r.json()).catch(() => null),
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`)
            .then(r => r.json()).catch(() => null),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`)
            .then(r => r.json()).catch(() => null),
        fetch(WIND_URL, LIVE).then(r => r.json()).catch(() => null)
    ]);
    return { stationRes, owmCurrentRes, forecastRes, windRes };
}

/* =============================================================
   NOW COLUMN  (index 0) — station workers  [from table.js]
============================================================= */
function loadNowFromStation(stationRes, windRes, owmCurrentData) {
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

    // --- Rain — cross-check rate_mm_hr against hourly_mm to avoid stale values ---
    const rain   = stationRes?.rain?.rate_mm_hr ?? 0;
    const hourly = stationRes?.rain?.hourly_mm  ?? 0;
    trackRain(rain, hourly);

    const activeRain = isRainActive(rain, hourly);
    const trending   = !activeRain && isRainTrending();

    // --- Condition ---
    const uvi   = stationRes?.uvi   ?? 0;
    const solar = stationRes?.solar ?? 0;

    let cond;

    if (activeRain) {
        cond = { icon: "🌧️", text: `Raining (${rain} mm/hr)`, isRain: true };

    } else if (trending) {
        cond = { icon: "🌧️", text: "Rain Starting", isRain: true };

    } else if (isDaytime()) {
        cond = conditionFromStation(uvi, solar);

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
}

/* =============================================================
   FORECAST COLUMNS (index 1 = +3h, index 2 = +6h)  [from table.js]
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
   DASHBOARD UI UPDATE  (from main dashboard script)
============================================================= */
function updateDashboard(stationRes, owmCurrentRes, windRes) {
    if (!stationRes) return;

    /* ---------- SAFE CORE ---------- */
    const t = stationRes?.temperature?.outdoor ?? "--";
    const h = stationRes?.humidity?.outdoor ?? "--";
    const feels = stationRes?.temperature?.feels_like_outdoor ?? "--";

    const indoorT = stationRes?.temperature?.indoor ?? "--";
    const indoorH = stationRes?.humidity?.indoor ?? "--";
    const indoorFeels = stationRes?.temperature?.feels_like_indoor ?? "--";

    const wind  = windRes?.wind  || stationRes?.wind  || {};
    const uvi   = stationRes?.uvi   ?? 0;
    const solar = stationRes?.solar ?? 0;
    const rain  = stationRes?.rain?.rate_mm_hr ?? 0;

    const visibilityKm = owmCurrentRes?.visibility
        ? (owmCurrentRes.visibility / 1000).toFixed(1)
        : "--";

    const pressure =
        stationRes?.pressure?.absolute_hpa ??
        stationRes?.pressure?.relative_hpa ??
        "--";

    const condition = getCondition(uvi, solar, rain);

    const windSpeed = wind?.speed?.value  ?? wind?.speed  ?? 0;
    const windGust  = wind?.gust?.value   ?? wind?.gust   ?? 0;
    const windDir   = dirMap(wind?.direction?.degrees ?? wind?.direction ?? 0);

    /* ---------- MAIN UI ---------- */
    set("temp", t);
    set("humidity", h);
    set("feels", feels);
    set("visibility", visibilityKm);

    set("pressure", pressure);
    set("uvi", uvi);
    set("solar", solar);

    set("wind", `${windSpeed} km/h`);
    set("wind-detail", `ഗസ്റ്റ് ${windGust} km/h | ${windDir}`);

    set("condition", condition);

    /* ---------- TABLE ---------- */
    const table = document.getElementById("weather-table-body");
    if (table) {
        table.innerHTML = `
            <tr>
                <td>Ecowitt Weather Station</td>
                <td>${t}</td>
                <td>${h}</td>
                <td>${windSpeed}</td>
                <td>${condition}</td>
            </tr>
        `;
    }

    /* ---------- MARQUEE ---------- */
    set("weather-marquee-1",
        `Elamkulam: ${t}°C | Feels ${feels}°C | Humidity ${h}% | Wind ${windSpeed} km/h`
    );

    set("weather-marquee-2",
        `Indoor: ${indoorT}°C | ${indoorH}% | Feels ${indoorFeels}°C | Pressure ${pressure} hPa | UVI ${uvi} | Solar ${solar}`
    );

    /* ---------- EXTRA DETAILS ---------- */
    const extra = document.getElementById("extraWeather");
    if (extra) {
        extra.innerHTML = `
            <div style="font-size:12px;line-height:1.6">

                🌡 Outdoor: ${t}°C<br>
                💧 Humidity: ${h}%<br>
                🌬 Wind: ${windSpeed} km/h<br>

                <hr>

                🌧 Rate: ${rain} mm/hr<br>
                📊 Daily: ${stationRes?.rain?.daily_mm ?? 0} mm<br>
                🌪 Event: ${stationRes?.rain?.event_mm ?? 0} mm<br>

                <hr>

                🧭 Relative Pressure: ${stationRes?.pressure?.relative_hpa ?? "--"} hPa<br>
                🧪 Absolute Pressure: ${stationRes?.pressure?.absolute_hpa ?? "--"} hPa<br>

                <hr>

                ☀️ Condition: ${condition}

            </div>
        `;
    }

    /* ---------- CONDITION CLICK ---------- */
    const condBox = document.getElementById("condition-box");
    if (condBox) {
        condBox.onclick = () => {
            alert(
`കാലാവസ്ഥ വിശദീകരണം:

UVI: ${uvi}
Solar: ${solar}
Rain: ${rain} mm/hr
Pressure: ${pressure} hPa

അവലോകനം: ${condition}`
            );
        };
    }
}

/* =============================================================
   MAIN LOADER — single fetch cycle, feeds both table & dashboard
============================================================= */
async function loadAllData() {
    try {
        const { stationRes, owmCurrentRes, forecastRes, windRes } = await fetchAllSources();

        // --- Table: Now column ---
        loadNowFromStation(stationRes, windRes, owmCurrentRes);

        // --- Table: Forecast columns ---
        if (forecastRes?.list?.length >= 2) {
            updateForecastColumn(1, forecastRes.list[0]); // +3h
            updateForecastColumn(2, forecastRes.list[1]); // +6h
        } else {
            console.error("Forecast data unavailable.");
            for (let i = 1; i < 3; i++) {
                setEl(`owTemp${i}`, "N/A");
                setEl(`owCond${i}`, "Forecast Unavailable");
                displayRainStatus(`owRainBox${i}`, false, "N/A", true);
            }
        }

        // --- Dashboard UI ---
        updateDashboard(stationRes, owmCurrentRes, windRes);

    } catch (e) {
        console.error("Critical error in loadAllData:", e);
        for (let i = 0; i < 3; i++) {
            displayRainStatus(`owRainBox${i}`, false, "Error", true);
        }
    }
}

/* =============================================================
   CHART  (unchanged from dashboard script)
============================================================= */
function loadChart() {
    const cfg = {
        apiKey: "AIzaSyCp9n2WVKEktfYVEmEpXGg8ehpwd6yCYxo",
        authDomain: "weather-report-2026.firebaseapp.com",
        databaseURL: "https://weather-report-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "weather-report-2026"
    };

    const app = initializeApp(cfg, "chartApp");
    const db = getDatabase(app);

    const now = new Date();
    const path =
        `weather/${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}`;

    const logsRef = ref(db, path);

    onValue(logsRef, snap => {
        if (!snap.exists()) return;

        const raw = snap.val();
        let labels = [];
        let temps = [];

        Object.keys(raw).sort().forEach(h => {
            Object.keys(raw[h]).sort().forEach(m => {
                labels.push(`${h}:${m}`);
                temps.push(raw[h][m].outdoor_temp);
            });
        });

        draw(labels, temps);
    });
}

function draw(labels, temps) {
    const canvas = document.getElementById("trendChart");
    if (!canvas) return;

    if (chart) chart.destroy();

    const ctx = canvas.getContext("2d");

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                data: temps,
                borderColor: "#0073e6",
                backgroundColor: "rgba(0,115,230,0.1)",
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: i => `⏰ ${i[0].label}`,
                        label: i => `🌡 ${i.raw}°C`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: "#eee" } }
            }
        }
    });
}

/* =============================================================
   INIT
   - loadAllData runs immediately and every 30s (table.js cadence)
   - Chart loads once on DOMContentLoaded
============================================================= */
document.addEventListener("DOMContentLoaded", () => {
    loadAllData();
    loadChart?.();
    setInterval(loadAllData, 30000);
});
