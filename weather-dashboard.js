// weather-dashboard.js

document.addEventListener("DOMContentLoaded", () => {

    /* --- CONSTANTS --- */
    const OPENWEATHER_API_KEY = "856b819166fedc7df9e65814b23e0970";
    const ELAMKULAM_CITY = "Elamkulam,IN";
    const ELAMKULAM_LAT_GENERAL = 10.9081;
    const ELAMKULAM_LON_GENERAL = 76.2296;
    const ELAMKULAM_LAT_FORECAST_CHART = 9.971;
    const ELAMKULAM_LON_FORECAST_CHART = 76.318;
    let tempChartInstance = null;

    /* --- Marquee 1: Current Weather --- */
    async function updateCurrentWeather() {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${ELAMKULAM_CITY}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        try {
            const res = await fetch(url);
            const data = await res.json();

            const windSpeedKmh = (data.wind.speed * 3.6).toFixed(1);
            document.getElementById("weather-marquee-1").textContent =
                `Elamkulam Now: ${data.main.temp.toFixed(1)}°C (Feels like ${data.main.feels_like.toFixed(1)}°C), ${data.weather[0].description}, Humidity: ${data.main.humidity}%, Wind: ${windSpeedKmh} km/h`;
        } catch (err) {
            console.error("Error fetching current weather for marquee:", err);
            document.getElementById("weather-marquee-1").textContent = "Current Weather data unavailable.";
        }
    }

    /* --- Marquee 2: Forecast / Rain --- */
    async function updateForecastMarquee() {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${ELAMKULAM_LAT_GENERAL}&lon=${ELAMKULAM_LON_GENERAL}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        try {
            const response = await fetch(url);
            const data = await response.json();

            const current = data.list[0];
            const temp = current.main.temp.toFixed(1);
            const desc = current.weather[0].description;

            let nextPrecipitationText = "No significant rain expected soon.";

            for (let i = 1; i < 9; i++) {
                const forecast = data.list[i];
                if (!forecast) continue;
                const rainVolume = forecast.rain ? forecast.rain["3h"] || 0 : 0;
                const snowVolume = forecast.snow ? forecast.snow["3h"] || 0 : 0;

                if (rainVolume > 0.1 || snowVolume > 0.1) {
                    const totalPrecipitation = (rainVolume + snowVolume).toFixed(2);
                    const forecastTime = new Date(forecast.dt * 1000);
                    const now = new Date();
                    const diffMs = forecastTime - now;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                    nextPrecipitationText = `Rain expected in ${diffHours}h ${diffMinutes}m (${totalPrecipitation} mm in 3 hrs)`;
                    break;
                }
            }

            document.getElementById("weather-marquee-2").textContent =
                `24-Hour Outlook: Current Temp ${temp}°C, ${desc}. | ${nextPrecipitationText}`;
        } catch (err) {
            console.error("Error fetching forecast for marquee:", err);
            document.getElementById("weather-marquee-2").textContent = "Forecast data unavailable.";
        }
    }

    /* --- Fetch weather for table and chart --- */
    async function fetchWeather() {
        try {
            const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${ELAMKULAM_LAT_FORECAST_CHART}&lon=${ELAMKULAM_LON_FORECAST_CHART}&units=metric&appid=${OPENWEATHER_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.list && data.list.length > 0) {
                displayWeather(data);
                drawTempChart(data);
            } else {
                document.getElementById("weather-table-body").innerHTML =
                    "<tr><td colspan='5'>Failed to load OpenWeather forecast data.</td></tr>";
            }
        } catch (e) {
            document.getElementById("weather-table-body").innerHTML =
                "<tr><td colspan='5'>Error loading weather data. See console.</td></tr>";
            console.error("Fetch Error:", e);
        }
    }

    function displayWeather(data) {
        const now = data.list[0];
        const row = `
            <tr>
                <td>OpenWeather</td>
                <td>${now.main.temp.toFixed(1)} °C</td>
                <td>${now.main.humidity} %</td>
                <td>${now.wind.speed.toFixed(1)} m/s</td>
                <td>${now.weather[0].description}</td>
            </tr>
        `;
        document.getElementById("weather-table-body").innerHTML = row;
    }

    function drawTempChart(forecastData) {
        const canvas = document.getElementById("trendChart");
        if (!canvas) return;

        const forecasts = forecastData.list.slice(0, 8); // Next 24 hours
        const temps = forecasts.map(f => f.main.temp.toFixed(1));
        const times = forecasts.map(f => {
            const date = new Date(f.dt * 1000);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });

        if (tempChartInstance) tempChartInstance.destroy();

        const ctx = canvas.getContext('2d');
        tempChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: times,
                datasets: [{
                    label: 'Temperature (°C)',
                    data: temps,
                    borderColor: '#0073e6',
                    backgroundColor: 'rgba(0, 115, 230, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#004080',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Temp (°C)', color: '#555', font: { family: 'Poppins' } },
                        grid: { color: '#e0e0e0' }
                    },
                    x: { grid: { display: false }, ticks: { font: { family: 'Poppins' } } }
                }
            }
        });
    }

    /* --- Extra details --- */
    async function loadWeatherDetails() {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${ELAMKULAM_LAT_GENERAL}&lon=${ELAMKULAM_LON_GENERAL}&appid=${OPENWEATHER_API_KEY}&units=metric`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Error: ${res.statusText}`);
            const data = await res.json();

            let rainStatus = "No";
            if (data.weather[0].main.includes("Rain") || data.weather[0].description.includes("rain")) rainStatus = "Yes (Current Condition)";
            else if (data.rain && data.rain['1h'] > 0) rainStatus = `${data.rain['1h']} mm in the last hour`;
            else if (data.clouds && data.clouds.all > 75) rainStatus = "High chance of rain (Heavy Clouds)";

            let sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            document.getElementById("extraWeather").innerHTML = `
                <div class="details-item"><span>🌡️ Feels like:</span><span>${data.main.feels_like.toFixed(1)}°C</span></div>
                <div class="details-item"><span>🌬️ Wind:</span><span>${data.wind.speed.toFixed(1)} m/s, Dir: ${data.wind.deg}°</span></div>
                <div class="details-item"><span>💧 Pressure:</span><span>${data.main.pressure} hPa</span></div>
                <div class="details-item"><span>🌧️ Rain Status:</span><span>${rainStatus}</span></div>
                <div class="details-item"><span>☀️ Sunrise:</span><span>${sunrise}</span></div>
                <div class="details-item"><span>🌙 Sunset:</span><span>${sunset}</span></div>
            `;
        } catch (error) {
            console.error("Failed to load extra OpenWeather data:", error);
            document.getElementById("extraWeather").innerHTML =
                `<p style="color:red;text-align:center;margin:0;">Failed to load extra details.</p>`;
        }
    }

    /* --- Initialization --- */
    updateCurrentWeather();
    updateForecastMarquee();
    fetchWeather();
    loadWeatherDetails();

    setInterval(updateCurrentWeather, 600000);
    setInterval(updateForecastMarquee, 600000);

    /* --- WeatherWidget.io loader --- */
    !function(d,s,id){
        var js,fjs=d.getElementsByTagName(s)[0];
        if(!d.getElementById(id)){
            js=d.createElement(s);js.id=id;
            js.src='https://weatherwidget.io/js/widget.min.js';
            fjs.parentNode.insertBefore(js,fjs);
        }
    }(document,'script','weatherwidget-io-js');

});
