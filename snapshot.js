import { fetchWeatherApi } from "openmeteo";

const openWeatherKey = "856b819166fedc7df9e65814b23e0970";
const lat = 10.9081;
const lon = 76.2296;

async function fetchOpenWeather() {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherKey}&units=metric`
  );
  return await res.json();
}

async function fetchOpenMeteo() {
  const params = {
    latitude: lat,
    longitude: lon,
    hourly: "temperature_2m,humidity_2m,windspeed_10m",
  };
  const url = "https://api.open-meteo.com/v1/forecast";
  const responses = await fetchWeatherApi(url, params);
  const response = responses[0];

  const hourly = response.hourly()!;
  const utcOffset = response.utcOffsetSeconds();

  const hoursCount = (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval();
  const timeArray = Array.from({ length: hoursCount }, (_, i) =>
    new Date((Number(hourly.time()) + i * hourly.interval() + utcOffset) * 1000)
  );

  return {
    time: timeArray,
    temperature: hourly.variables(0)!.valuesArray(),
    humidity: hourly.variables(1)!.valuesArray(),
    windspeed: hourly.variables(2)!.valuesArray(),
  };
}

async function updateSnapshot() {
  try {
    const [owData, omData] = await Promise.all([fetchOpenWeather(), fetchOpenMeteo()]);

    // Use OpenWeather for real-time main data
    document.getElementById("temp").textContent = owData.main.temp.toFixed(1);
    document.getElementById("feels").textContent = owData.main.feels_like.toFixed(1);
    document.getElementById("humidity").textContent = owData.main.humidity;
    document.getElementById("wind").textContent = (owData.wind.speed * 3.6).toFixed(1);
    document.getElementById("visibility").textContent = (owData.visibility / 1000).toFixed(1);

    // Condition logic: combine OpenWeather & OpenMeteo forecast
    let condition = owData.weather[0].main;
    const nextHourTemp = omData.temperature[0];
    if (nextHourTemp > 35) condition += " 🔥";
    document.getElementById("condition").textContent = condition;

    document.getElementById("updated").textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error("Weather snapshot error:", err);
  }
}

// Initial load
updateSnapshot();
// Auto-refresh every 10 minutes
setInterval(updateSnapshot, 600000);
