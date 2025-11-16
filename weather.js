const lat = 10.9081;
const lon = 76.2296;

const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&hourly=relativehumidity_2m,pressure_msl&timezone=Asia/Kolkata`;

async function loadWeather() {
    try {
        const res = await fetch(url);
        const data = await res.json();

        // Current data
        const current = data.current_weather;
        const daily = data.daily;

        document.getElementById("temp").textContent = current.temperature;
        document.getElementById("wind").textContent = current.windspeed;
        document.getElementById("condition").textContent = current.weathercode;

        document.getElementById("tmin").textContent = daily.temperature_2m_min[0];
        document.getElementById("tmax").textContent = daily.temperature_2m_max[0];

        // Humidity & pressure from hourly
        document.getElementById("humidity").textContent = data.hourly.relativehumidity_2m[0];
        document.getElementById("pressure").textContent = data.hourly.pressure_msl[0];

        // Feels-like approximation
        document.getElementById("feels").textContent = (current.temperature - 0.7).toFixed(1);

        // Extra details
        document.getElementById("extraWeather").innerHTML = `
            🌅 Sunrise: <strong>${daily.sunrise[0].split("T")[1]}</strong><br>
            🌇 Sunset: <strong>${daily.sunset[0].split("T")[1]}</strong><br>
            💨 Wind Direction: <strong>${current.winddirection}°</strong>
        `;

        document.getElementById("updated").textContent = new Date().toLocaleTimeString();

    } catch (err) {
        console.error(err);
        document.getElementById("extraWeather").textContent = "Failed to load data.";
    }
}

loadWeather();
setInterval(loadWeather, 600000);
