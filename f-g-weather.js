/* =============================================================
   3. MAIN WEATHER DASHBOARD UI - (Frontend)
============================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const API_URL = "https://elwoic-vayu-core.bold-waterfall-0d01.workers.dev/";

let chart = null;

// UI Helpers
function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val ?? "--";
}

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

// MAIN LOADER
async function loadAllData() {
    try {
        const res = await fetch(API_URL, { cache: "no-store" });
        const d = await res.json();

        if (d.error) throw new Error(d.error);

        /* --- 1. Now Column --- */
        setEl("owTemp0", d.now.temp);
        setEl("owFeels0", d.now.feelsLike);
        setEl("owHum0", d.now.humidity);
        setEl("owPress0", d.now.pressure);
        setEl("owWind0", d.now.windDisplay);
        setEl("owVis0", d.now.visibility);
        setEl("owCond0", d.now.condDisplay);
        setEl("stationLastUpdated", d.now.lastUpdated);
        displayRainStatus("owRainBox0", d.now.rainBoxIsRain, d.now.rainBoxText);

        /* --- 2. Forecast Columns --- */
        if (d.forecast && d.forecast.length >= 2) {
            d.forecast.forEach((fc, idx) => {
                const i = idx + 1; // index 1 and 2
                setEl(`owTemp${i}`, fc.temp);
                setEl(`owFeels${i}`, fc.feelsLike);
                setEl(`owCond${i}`, fc.cond);
                setEl(`owHum${i}`, fc.hum);
                setEl(`owPress${i}`, fc.press);
                setEl(`owWind${i}`, fc.wind);
                setEl(`owVis${i}`, "N/A");
                displayRainStatus(`owRainBox${i}`, fc.isRain, fc.rainBoxText);
            });
        } else {
            for (let i = 1; i <= 2; i++) {
                setEl(`owTemp${i}`, "N/A");
                setEl(`owCond${i}`, "Forecast Unavailable");
                displayRainStatus(`owRainBox${i}`, false, "N/A", true);
            }
        }

        /* --- 3. Main Dashboard Overlays --- */
        setEl("temp", d.dashboard.tempRaw);
        setEl("humidity", d.dashboard.humRaw);
        setEl("feels", d.dashboard.feelsRaw);
        setEl("visibility", d.engine.visibilityM !== "--" ? (d.engine.visibilityM / 1000).toFixed(1) : "--");
        setEl("pressure", d.now.pressure);
        setEl("uvi", d.engine.uvi);
        setEl("solar", d.engine.solarWm2);
        setEl("wind", `${d.engine.windSpeed} km/h`);
        setEl("wind-detail", d.dashboard.windDetail);
        setEl("condition", d.dashboard.conditionMl);
        
        setEl("weather-table-body", d.dashboard.tableRowHtml);
        setEl("weather-marquee-1", d.dashboard.marquee1);
        setEl("weather-marquee-2", d.dashboard.marquee2);
        setEl("extraWeather", d.dashboard.extraDetailsHtml);

        const condBox = document.getElementById("condition-box");
        if (condBox) {
            condBox.onclick = () => alert(d.dashboard.alertText);
        }

    } catch (e) {
        console.error("Critical error in loadAllData:", e);
        for (let i = 0; i < 3; i++) {
            displayRainStatus(`owRainBox${i}`, false, "Error", true);
        }
    }
}

/* =============================================================
   CHART LOGIC (Untouched - Uses Firebase Direct WebSocket)
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
    const path = `weather/${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}`;

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

    // Chart.js requires Chart to be loaded via CDN in your HTML
    if (typeof Chart === "undefined") return;

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

// INIT
document.addEventListener("DOMContentLoaded", () => {
    loadAllData();
    loadChart();
    setInterval(loadAllData, 30000);
});
