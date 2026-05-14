
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* =========================
   CONFIG
========================= */
const API_URL  = "https://elwoi-dashboar-parameters.bold-waterfall-0d01.workers.dev/";
const WIND_URL = "https://wind-fetcher.bold-waterfall-0d01.workers.dev/";

const OW_KEY = "ca13a2cbdc07e7613b6af82cff262295";
const LAT = 10.9081;
const LON = 76.2296;

let chart = null;

/* =========================
   HELPERS
========================= */

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

/* =========================
   MAIN UPDATE
========================= */
async function update() {
    try {
        const [workerRes, owRes, windRes] = await Promise.all([
            fetch(API_URL).then(r => r.json()).catch(() => null),
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OW_KEY}&units=metric`)
                .then(r => r.json()).catch(() => null),
            fetch(WIND_URL).then(r => r.json()).catch(() => null)
        ]);

        if (!workerRes) return;

        /* ---------- SAFE CORE ---------- */
        const t = workerRes?.temperature?.outdoor ?? "--";
        const h = workerRes?.humidity?.outdoor ?? "--";
        const feels = workerRes?.temperature?.feels_like_outdoor ?? "--";

        const indoorT = workerRes?.temperature?.indoor ?? "--";
        const indoorH = workerRes?.humidity?.indoor ?? "--";
        const indoorFeels = workerRes?.temperature?.feels_like_indoor ?? "--";

        const wind  = windRes?.wind  || workerRes?.wind  || {};
        const uvi   = workerRes?.uvi   ?? 0;
        const solar = workerRes?.solar ?? 0;
        const rain  = workerRes?.rain?.rate_mm_hr ?? 0;

        const visibilityKm = owRes?.visibility
            ? (owRes.visibility / 1000).toFixed(1)
            : "--";

        const pressure =
            workerRes?.pressure?.absolute_hpa ??
            workerRes?.pressure?.relative_hpa ??
            "--";

        const condition = getCondition(uvi, solar, rain);

        const windSpeed = wind?.speed?.value  ?? wind?.speed  ?? 0;
        const windGust  = wind?.gust?.value   ?? wind?.gust   ?? 0;
        const windDir   = dirMap(wind?.direction?.degrees ?? wind?.direction ?? 0);

        /* =========================
           MAIN UI
        ========================= */

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

        /* =========================
           TABLE (FIXED ALWAYS WORKS)
        ========================= */
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

        /* =========================
           MARQUEE FIX
        ========================= */
        set("weather-marquee-1",
            `Elamkulam: ${t}°C | Feels ${feels}°C | Humidity ${h}% | Wind ${windSpeed} km/h`
        );

        set("weather-marquee-2",
            `Indoor: ${indoorT}°C | ${indoorH}% | Feels ${indoorFeels}°C | Pressure ${pressure} hPa | UVI ${uvi} | Solar ${solar}`
        );

        /* =========================
           EXTRA DETAILS (FIXED ORDER)
        ========================= */
        const extra = document.getElementById("extraWeather");
        if (extra) {
            extra.innerHTML = `
                <div style="font-size:12px;line-height:1.6">

                    🌡 Outdoor: ${t}°C<br>
                    💧 Humidity: ${h}%<br>
                    🌬 Wind: ${windSpeed} km/h<br>

                    <hr>

                    🌧 Rate: ${rain} mm/hr<br>
                    📊 Daily: ${workerRes?.rain?.daily_mm ?? 0} mm<br>
                    🌪 Event: ${workerRes?.rain?.event_mm ?? 0} mm<br>

                    <hr>

                    🧭 Relative Pressure: ${workerRes?.pressure?.relative_hpa ?? "--"} hPa<br>
                    🧪 Absolute Pressure: ${workerRes?.pressure?.absolute_hpa ?? "--"} hPa<br>

                    <hr>

                    ☀️ Condition: ${condition}

                </div>
            `;
        }

        /* =========================
           CONDITION CLICK
        ========================= */
        document.getElementById("condition-box").onclick = () => {
            alert(
`കാലാവസ്ഥ വിശദീകരണം:

UVI: ${uvi}
Solar: ${solar}
Rain: ${rain} mm/hr
Pressure: ${pressure} hPa

അവലോകനം: ${condition}`
            );
        };

    } catch (e) {
        console.error(e);
    }
}

/* =========================
   UTIL
========================= */
function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "--";
}

/* =========================
   CHART (UNCHANGED)
========================= */
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

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
    update();
    loadChart?.();
    setInterval(update, 60000);
});
