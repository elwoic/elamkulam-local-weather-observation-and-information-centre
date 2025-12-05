const windyApiKey = "xYiE7xLI3n0JpxRb4n4EK2jfNHGQL8BO";
const latitude = 10.9081;
const longitude = 76.2296;

async function loadWeatherSnapshot() {
  try {
    // Windy Point Forecast API
    const payload = {
      lat: latitude,
      lon: longitude,
      model: "gfs",
      parameters: ["temp", "wind", "wind_dir", "rh", "clouds", "precip", "weather_code"], // weather_code gives condition
      key: windyApiKey
    };

    const res = await fetch("https://api.windy.com/api/point-forecast/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // Extract current weather (first hour)
    const temp = data.temp[0].value.toFixed(1);
    const feels = temp;
    const humidity = data.rh[0].value.toFixed(0);
    const wind = data.wind[0].value.toFixed(1);
    const visibility = data.visibility ? data.visibility[0].value.toFixed(1) : "--";
    const conditionCode = data.weather_code[0].value;

    // Map Windy weather_code to icon + text
    const weatherMap = {
      0: ["☀", "Clear"],
      1: ["🌤", "Partly Cloudy"],
      2: ["☁", "Cloudy"],
      3: ["🌧", "Rain"],
      4: ["⛈", "Thunderstorm"],
      5: ["❄", "Snow"],
      6: ["🌫", "Fog"]
      // add more codes if needed
    };

    const [icon, conditionText] = weatherMap[conditionCode] || ["☁", "Unknown"];

    // Update main dashboard
    document.getElementById("temp").textContent = temp;
    document.getElementById("feels").textContent = feels;
    document.getElementById("humidity").textContent = humidity;
    document.getElementById("wind").textContent = wind;
    document.getElementById("visibility").textContent = visibility;
    document.getElementById("condition").textContent = conditionText;
    document.getElementById("updated").textContent = new Date().toLocaleTimeString();

    // Build 5-day timeline
    const timelineContainer = document.getElementById("windy-forecast-timeline");
    timelineContainer.innerHTML = ""; // clear old items

    // Windy API hourly data → 5 days ≈ 120 hours
    for (let i = 0; i < 120; i += 24) { // pick every 24h for 1 per day
      const date = new Date(data.time[i].timestamp * 1000);
      const day = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
      const code = data.weather_code[i].value;
      const tempDay = data.temp[i].value.toFixed(1);
      const [iconDay, conditionDay] = weatherMap[code] || ["☁", "Unknown"];

      const item = document.createElement("div");
      item.className = "timeline-item";
      item.innerHTML = `
        <div class="day">${day}</div>
        <div class="icon">${iconDay}</div>
        <div class="temp">${tempDay}°C</div>
        <div class="condition">${conditionDay}</div>
      `;
      timelineContainer.appendChild(item);
    }

  } catch (err) {
    console.error("Weather snapshot failed:", err);
    document.getElementById("updated").textContent = "Error fetching data";
    document.getElementById("windy-forecast-timeline").innerHTML = "<p>Forecast unavailable</p>";
  }
}

// Initial load + auto-refresh
loadWeatherSnapshot();
setInterval(loadWeatherSnapshot, 10 * 60 * 1000); // every 10 minutes
