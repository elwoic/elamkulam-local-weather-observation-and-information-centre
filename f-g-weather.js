import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* =============================================================
   CONFIG
============================================================= */
const lat     = 10.9081;
const lon     = 76.2296;
const OWM_KEY = "ca13a2cbdc07e7613b6af82cff262295";

const API_URL = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/live";

const LIVE = { cache: "no-store" };

let chart = null;

/* =============================================================
   RAIN TREND TRACKER
============================================================= */
const rainHistory   = [];
const hourlyHistory = [];
const RAIN_HISTORY_SIZE = 3;

function trackRain(rate, hourly) {
    rainHistory.push(rate);
    hourlyHistory.push(hourly);
    if (rainHistory.length   > RAIN_HISTORY_SIZE) rainHistory.shift();
    if (hourlyHistory.length > RAIN_HISTORY_SIZE) hourlyHistory.shift();
}

function isRainActive(rate, hourly) {
    if (rate   <= 0) return false;
    if (hourly <= 0) return false;
    if (hourlyHistory.length >= 2) {
        const prev = hourlyHistory[hourlyHistory.length - 2];
        const curr = hourlyHistory[hourlyHistory.length - 1];
        if (curr <= prev) return false;
    }
    return true;
}

function isRainTrending() {
    if (rainHistory.length   < RAIN_HISTORY_SIZE) return false;
    if (hourlyHistory.length < 2) return false;
    const rateRising = rainHistory.every((v, i) =>
        i === 0 ? v > 0 : v >= rainHistory[i - 1] && v > 0
    );
    const hourlyRising =
        hourlyHistory[hourlyHistory.length - 1] > hourlyHistory[hourlyHistory.length - 2];
    return rateRising && hourlyRising;
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

/* Malayalam condition helper */
const dirMap = (deg = 0) => {
    if (deg >= 337 || deg < 23)  return "വടക്ക്";
    if (deg < 68)                return "വടക്കുകിഴക്ക്";
    if (deg < 113)               return "കിഴക്ക്";
    if (deg < 158)               return "തെക്കുകിഴക്ക്";
    if (deg < 203)               return "തെക്ക്";
    if (deg < 248)               return "തെക്കുപടിഞ്ഞാറ്";
    if (deg < 293)               return "പടിഞ്ഞാറ്";
    return "വടക്കുപടിഞ്ഞാറ്";
};

function getCondition(uvi, solar, rain) {
    if (rain > 0)                    return "🌧 മഴ പെയ്യുന്നു";
    if (uvi >= 6 && solar > 600)     return "☀️ തെളിഞ്ഞ ആകാശം";
    if (solar > 300)                 return "🌤 ഭാഗികമായി മേഘാവൃതം";
    if (solar > 80)                  return "⛅ ചെറിയ മേഘങ്ങൾ";
    return "☁️ മേഘാവൃതം";
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

function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "--";
}

function formatTime(date) {
    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
}

/* =============================================================
   SHARED FETCH
============================================================= */
async function fetchAllSources() {
    const [payload, owmCurrentRes, forecastRes] = await Promise.all([
        fetch(API_URL, LIVE).then(r => r.json()).catch(() => null),
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`)
            .then(r => r.json()).catch(() => null),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`)
            .then(r => r.json()).catch(() => null)
    ]);
    return { payload, owmCurrentRes, forecastRes };
}

/* =============================================================
   NOW COLUMN (index 0)
============================================================= */
function loadNowFromStation(payload, owmCurrentData) {
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

    setEl("owWind0",
        `${windSpeed} km/h ${windComp} | Gust: ${windGust} km/h | Avg dir: ${avg10Comp} — ${bft}`
    );

    // --- Visibility from OWM ---
    const vis = owmCurrentData?.visibility
        ? `${(owmCurrentData.visibility / 1000).toFixed(1)} km`
        : "--";
    setEl("owVis0", vis);

    // --- Rain ---
    const rain   = rn.rate_mm_hr ?? 0;
    const hourly = rn.hourly_mm  ?? 0;
    trackRain(rain, hourly);

    const activeRain = isRainActive(rain, hourly);
    const trending   = !activeRain && isRainTrending();

    // --- Condition ---
    const uvi   = ld.uvi      ?? 0;
    const solar = ld.solar_wm2 ?? 0;

    let cond;
    if (rain > 0) {
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
        cond = owmCurrentData
            ? conditionFromOWM(
                owmCurrentData.weather?.[0]?.description ?? "",
                owmCurrentData.weather?.[0]?.main ?? ""
              )
            : { icon: "🌙", text: "Night", isRain: false };
    }

    setEl("owCond0", `${cond.icon} ${cond.text}`);
    displayRainStatus("owRainBox0", cond.isRain, cond.isRain ? "Raining" : "Dry");

    // --- Last updated from Supabase ---
    const updatedAt = payload.updated_at
        ? formatTime(new Date(payload.updated_at))
        : formatTime(new Date());
    setEl("stationLastUpdated", `🕐 Last updated: ${updatedAt}`);
}

/* =============================================================
   FORECAST COLUMNS (index 1 = +3h, index 2 = +6h)
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
   DASHBOARD UI UPDATE
============================================================= */
function updateDashboard(payload, owmCurrentRes) {
    if (!payload) return;

    const ld  = payload.live_data || {};
    const tmp = ld.temperature   || {};
    const hum = ld.humidity      || {};
    const wnd = ld.wind          || {};
    const prs = ld.pressure      || {};
    const rn  = ld.rain          || {};

    const t           = tmp.outdoor            ?? "--";
    const h           = hum.outdoor            ?? "--";
    const feels       = tmp.feels_like_outdoor ?? "--";
    const indoorT     = tmp.indoor             ?? "--";
    const indoorH     = hum.indoor             ?? "--";
    const indoorFeels = tmp.feels_like_indoor  ?? "--";

    const windSpeed  = wnd.speed_kmh         ?? 0;
    const windGust   = wnd.gust_kmh          ?? 0;
    const windDirDeg = wnd.direction_degrees ?? 0;
    const windDir    = dirMap(windDirDeg);

    const uvi      = ld.uvi       ?? 0;
    const solar    = ld.solar_wm2 ?? 0;
    const rain     = rn.rate_mm_hr ?? 0;
    const pressure = prs.absolute_hpa ?? prs.relative_hpa ?? "--";

    const visibilityKm = owmCurrentRes?.visibility
        ? (owmCurrentRes.visibility / 1000).toFixed(1)
        : "--";

    const condition = getCondition(uvi, solar, rain);

    /* ---------- MAIN UI ---------- */
    set("temp",        t);
    set("humidity",    h);
    set("feels",       feels);
    set("visibility",  visibilityKm);
    set("pressure",    pressure);
    set("uvi",         uvi);
    set("solar",       solar);
    set("wind",        `${windSpeed} km/h`);
    set("wind-detail", `ഗസ്റ്റ് ${windGust} km/h | ${windDir}`);
    set("condition",   condition);

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
                📊 Daily: ${rn.daily_mm ?? 0} mm<br>
                🌪 Event: ${rn.event_mm ?? 0} mm<br>
                <hr>
                🧭 Relative Pressure: ${prs.relative_hpa ?? "--"} hPa<br>
                🧪 Absolute Pressure: ${prs.absolute_hpa ?? "--"} hPa<br>
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
   MAIN LOADER
============================================================= */
async function loadAllData() {
    try {
        const { payload, owmCurrentRes, forecastRes } = await fetchAllSources();

        loadNowFromStation(payload, owmCurrentRes);

        if (forecastRes?.list?.length >= 2) {
            updateForecastColumn(1, forecastRes.list[0]);
            updateForecastColumn(2, forecastRes.list[1]);
        } else {
            console.error("Forecast data unavailable.");
            for (let i = 1; i < 3; i++) {
                setEl(`owTemp${i}`, "N/A");
                setEl(`owCond${i}`, "Forecast Unavailable");
                displayRainStatus(`owRainBox${i}`, false, "N/A", true);
            }
        }

        updateDashboard(payload, owmCurrentRes);

    } catch (e) {
        console.error("Critical error in loadAllData:", e);
        for (let i = 0; i < 3; i++) {
            displayRainStatus(`owRainBox${i}`, false, "Error", true);
        }
    }
}

/* =============================================================
   CHART
============================================================= */
function loadChart() {
    const cfg = {
        apiKey: "AIzaSyCp9n2WVKEktfYVEmEpXGg8ehpwd6yCYxo",
        authDomain: "weather-report-2026.firebaseapp.com",
        databaseURL: "https://weather-report-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "weather-report-2026"
    };

    const app = initializeApp(cfg, "chartApp");
    const db  = getDatabase(app);

    const now  = new Date();
    const path =
        `weather/${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}`;

    onValue(ref(db, path), snap => {
        if (!snap.exists()) return;
        const raw    = snap.val();
        const labels = [];
        const temps  = [];
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

    chart = new Chart(canvas.getContext("2d"), {
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
============================================================= */
document.addEventListener("DOMContentLoaded", () => {
    loadAllData();
    loadChart?.();
    setInterval(loadAllData, 30000);
});
