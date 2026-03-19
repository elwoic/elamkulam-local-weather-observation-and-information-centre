import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* --- Firebase Setup --- */
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "report-20d26.firebaseapp.com",
  databaseURL: "https://report-20d26-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "report-20d26"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {

    /* ---------------- CONSTANTS ---------------- */
    const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295";
    const CITY = "Elamkulam,IN";
    const LAT = 10.9081;
    const LON = 76.2296;

    let tempChartInstance = null;

    /* ---------------- MARQUEE 1 ---------------- */
    async function updateCurrentWeather() {
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${OPENWEATHER_API_KEY}&units=metric`);
            const data = await res.json();

            const wind = (data.wind.speed * 3.6).toFixed(1);

            document.getElementById("weather-marquee-1").textContent =
                `Elamkulam Now: ${data.main.temp.toFixed(1)}°C (Feels like ${data.main.feels_like.toFixed(1)}°C), ${data.weather[0].description}, Humidity: ${data.main.humidity}%, Wind: ${wind} km/h`;
        } catch {
            document.getElementById("weather-marquee-1").textContent = "Weather unavailable.";
        }
    }

    /* ---------------- MARQUEE 2 ---------------- */
    async function updateForecastMarquee() {
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_API_KEY}&units=metric`);
            const data = await res.json();

            const current = data.list[0];

            document.getElementById("weather-marquee-2").textContent =
                `24-Hour Outlook: ${current.main.temp.toFixed(1)}°C, ${current.weather[0].description}`;
        } catch {
            document.getElementById("weather-marquee-2").textContent = "Forecast unavailable.";
        }
    }

    /* ---------------- TABLE ---------------- */
    async function fetchWeatherTable() {
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_API_KEY}&units=metric`);
            const data = await res.json();

            document.getElementById("weather-table-body").innerHTML = `
                <tr>
                    <td>OpenWeather</td>
                    <td>${data.main.temp.toFixed(1)} °C</td>
                    <td>${data.main.humidity} %</td>
                    <td>${data.wind.speed.toFixed(1)} m/s</td>
                    <td>${data.weather[0].description}</td>
                </tr>
            `;
        } catch {
            document.getElementById("weather-table-body").innerHTML =
                "<tr><td colspan='5'>Failed to load data</td></tr>";
        }
    }

    /* ---------------- FIREBASE GRAPH (12H CLEAN) ---------------- */
    function loadFirebaseTempChart() {

        const logsRef = ref(db, "weather_logs");

        onValue(logsRef, (snapshot) => {
            if (!snapshot.exists()) return;

            let data = Object.values(snapshot.val());

            // SORT
            data.sort((a, b) => new Date(a.timestamp_utc) - new Date(b.timestamp_utc));

            // LAST 12 HOURS
            const now = new Date();
            const last12h = data.filter(d => {
                const t = new Date(d.timestamp_utc);
                return (now - t) <= 12 * 60 * 60 * 1000;
            });

            // CREATE 30-MIN SLOTS
            const buckets = {};

            last12h.forEach(d => {
                const date = new Date(d.timestamp_utc);

                let roundedMin = date.getMinutes() < 30 ? 0 : 30;

                const slot = new Date(date);
                slot.setMinutes(roundedMin, 0, 0);

                const key = slot.toISOString();

                // keep latest value
                buckets[key] = d.temp_c;
            });

            const sortedKeys = Object.keys(buckets).sort();

            const temps = sortedKeys.map(k => buckets[k]);

            const times = sortedKeys.map(k => {
                const d = new Date(k);
                return d.toLocaleTimeString("en-IN", {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            });

            drawChart(times, temps);
        });
    }

    /* ---------------- DRAW CHART ---------------- */
    function drawChart(times, temps) {

        const canvas = document.getElementById("trendChart");
        if (!canvas) return;

        if (tempChartInstance) tempChartInstance.destroy();

        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, "rgba(0,115,230,0.3)");
        gradient.addColorStop(1, "rgba(0,115,230,0)");

        tempChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: times,
                datasets: [{
                    data: temps,
                    borderColor: "#0073e6",
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        grid: { color: "#eee" }
                    }
                }
            }
        });
    }

    /* ---------------- EXTRA DETAILS ---------------- */
    async function loadWeatherDetails() {
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_API_KEY}&units=metric`);
            const data = await res.json();

            document.getElementById("extraWeather").innerHTML = `
                <div class="details-item"><span>🌡️ Feels like:</span><span>${data.main.feels_like.toFixed(1)}°C</span></div>
                <div class="details-item"><span>🌬️ Wind:</span><span>${data.wind.speed.toFixed(1)} m/s</span></div>
                <div class="details-item"><span>💧 Pressure:</span><span>${data.main.pressure} hPa</span></div>
                <div class="details-item"><span>☀️ Sunrise:</span><span>${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}</span></div>
                <div class="details-item"><span>🌙 Sunset:</span><span>${new Date(data.sys.sunset * 1000).toLocaleTimeString()}</span></div>
            `;
        } catch {
            document.getElementById("extraWeather").innerHTML = "Failed to load details";
        }
    }

    /* ---------------- INIT ---------------- */
    updateCurrentWeather();
    updateForecastMarquee();
    fetchWeatherTable();
    loadFirebaseTempChart();
    loadWeatherDetails();

    setInterval(updateCurrentWeather, 600000);
    setInterval(updateForecastMarquee, 600000);

});
