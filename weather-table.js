<script>
// --- Weather Loader ---
const OPENWEATHER_KEY = "856b819166fedc7df9e65814b23e0970";
const LAT = 10.9081;
const LON = 76.2296;

async function fetchOpenWeather() {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OpenWeather failed");
  return await res.json();
}

// Helper: check value
function safeVal(v) { return v ?? "--"; }

async function loadWeatherTable() {
  try {
    const data = await fetchOpenWeather();
    // current + next 3 forecasts (3h, 6h, 9h)
    const list = data.list;
    const current = list[0];
    const f3 = list[1];
    const f6 = list[2];
    const f9 = list[3];

    // Fill table
    document.getElementById("temp-current").textContent = safeVal(current.main.temp.toFixed(1));
    document.getElementById("temp-3h").textContent = safeVal(f3.main.temp.toFixed(1));
    document.getElementById("temp-6h").textContent = safeVal(f6.main.temp.toFixed(1));
    document.getElementById("temp-9h").textContent = safeVal(f9.main.temp.toFixed(1));

    document.getElementById("feels-current").textContent = safeVal(current.main.feels_like.toFixed(1));
    document.getElementById("feels-3h").textContent = safeVal(f3.main.feels_like.toFixed(1));
    document.getElementById("feels-6h").textContent = safeVal(f6.main.feels_like.toFixed(1));
    document.getElementById("feels-9h").textContent = safeVal(f9.main.feels_like.toFixed(1));

    document.getElementById("humidity-current").textContent = safeVal(current.main.humidity);
    document.getElementById("humidity-3h").textContent = safeVal(f3.main.humidity);
    document.getElementById("humidity-6h").textContent = safeVal(f6.main.humidity);
    document.getElementById("humidity-9h").textContent = safeVal(f9.main.humidity);

    document.getElementById("cond-current").textContent = safeVal(current.weather[0].description);
    document.getElementById("cond-3h").textContent = safeVal(f3.weather[0].description);
    document.getElementById("cond-6h").textContent = safeVal(f6.weather[0].description);
    document.getElementById("cond-9h").textContent = safeVal(f9.weather[0].description);

    document.getElementById("wind-current").textContent = safeVal((current.wind.speed * 3.6).toFixed(1));
    document.getElementById("wind-3h").textContent = safeVal((f3.wind.speed * 3.6).toFixed(1));
    document.getElementById("wind-6h").textContent = safeVal((f6.wind.speed * 3.6).toFixed(1));
    document.getElementById("wind-9h").textContent = safeVal((f9.wind.speed * 3.6).toFixed(1));

    document.getElementById("vis-current").textContent = safeVal((current.visibility/1000).toFixed(1));
    document.getElementById("vis-3h").textContent = safeVal((f3.visibility/1000).toFixed(1));
    document.getElementById("vis-6h").textContent = safeVal((f6.visibility/1000).toFixed(1));
    document.getElementById("vis-9h").textContent = safeVal((f9.visibility/1000).toFixed(1));

    const rain = r => r.rain && r.rain["3h"] ? r.rain["3h"].toFixed(2) : "0.00";
    document.getElementById("rain-current").textContent = rain(current);
    document.getElementById("rain-3h").textContent = rain(f3);
    document.getElementById("rain-6h").textContent = rain(f6);
    document.getElementById("rain-9h").textContent = rain(f9);

    document.getElementById("updated").textContent = new Date().toLocaleTimeString();
  } catch (e) {
    console.error("Weather load failed:", e);
  }
}

// Initial load + refresh every 2 minutes
loadWeatherTable();
setInterval(loadWeatherTable, 120000);
</script>
