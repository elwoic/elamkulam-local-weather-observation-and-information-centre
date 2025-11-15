// weather.js
// Uses OpenWeather (current + air_pollution) + Open-Meteo (hourly/current)
// Combines values with validation & averaging

const OPENWEATHER_KEY = "856b819166fedc7df9e65814b23e0970";
const LAT = 10.9081;
const LON = 76.2296;

// Helper: safe number parse
function safeNum(v) {
  return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
}

// Fetch OpenWeather current weather
async function fetchOpenWeather() {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OpenWeather failed");
  return await res.json();
}

// Fetch OpenWeather air pollution (AQI)
async function fetchOpenWeatherAQI() {
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OpenWeather AQI failed");
  return await res.json();
}

// Fetch Open-Meteo
async function fetchOpenMeteo() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation,pressure_msl,visibility,windspeed_10m,cloudcover&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo failed");
  return await res.json();
}

// Find hourly value from Open-Meteo
function findHourlyValue(omData, varName) {
  try {
    const times = omData.hourly.time;
    const values = omData.hourly[varName];
    if (!times || !values) return null;

    const now = new Date();
    const currentIso = now.toISOString().slice(0, 13); // yyyy-mm-ddThh

    for (let i = 0; i < times.length; i++) {
      if (times[i].slice(0, 13) === currentIso) {
        return safeNum(values[i]);
      }
    }

    return safeNum(values[0]);
  } catch {
    return null;
  }
}

// Average helper
function combineAverage(a, b) {
  const A = safeNum(a);
  const B = safeNum(b);
  if (A === null && B === null) return null;
  if (A === null) return Number(B.toFixed(1));
  if (B === null) return Number(A.toFixed(1));
  return Number(((A + B) / 2).toFixed(1));
}

// AQI label + color
function aqiDescriptor(aqi) {
  if (aqi === 1) return { text: "Good", color: "#2ecc71" };
  if (aqi === 2) return { text: "Fair", color: "#f1c40f" };
  if (aqi === 3) return { text: "Moderate", color: "#e67e22" };
  if (aqi === 4) return { text: "Poor", color: "#e74c3c" };
  if (aqi === 5) return { text: "Very Poor", color: "#8e44ad" };
  return { text: "Unknown", color: "#999" };
}

// Combine data
function combineData(ow, om, aqiData) {
  // OpenWeather values
  const owTemp = ow.main ? safeNum(ow.main.temp) : null;
  const owFeels = ow.main ? safeNum(ow.main.feels_like) : null;
  const owHumidity = ow.main ? safeNum(ow.main.humidity) : null;
  const owWindMs = ow.wind ? safeNum(ow.wind.speed) : null; // m/s
  const owWindKmh = owWindMs !== null ? Number((owWindMs * 3.6).toFixed(1)) : null;
  const owVisibility = ow.visibility ? safeNum(ow.visibility) / 1000 : null; // meters → km
  const owPressure = ow.main ? safeNum(ow.main.pressure) : null;
  const owClouds = ow.clouds ? safeNum(ow.clouds.all) : null;
  const owRain1h = ow.rain ? safeNum(ow.rain["1h"] || ow.rain["3h"] || 0) : 0;

  // Open-Meteo values
  const omTemp = om.current_weather ? safeNum(om.current_weather.temperature) : findHourlyValue(om, "temperature_2m");

  const omWindKmh = findHourlyValue(om, "windspeed_10m") !== null
    ? safeNum(findHourlyValue(om, "windspeed_10m"))
    : (om.current_weather ? safeNum(om.current_weather.windspeed) : null);

  const omHumidity = findHourlyValue(om, "relativehumidity_2m");
  const omPressure = findHourlyValue(om, "pressure_msl");
  const omClouds = findHourlyValue(om, "cloudcover");
  const omPrecip = findHourlyValue(om, "precipitation");

  // ⭐ Corrected visibility (Open-Meteo gives meters)
  const omVisibilityRaw = findHourlyValue(om, "visibility");
  const omVisibility = omVisibilityRaw !== null ? omVisibilityRaw / 1000 : null; // meters → km

  // Combine final values
  const temp = combineAverage(owTemp, omTemp);
  const feels = combineAverage(owFeels, omTemp);
  const humidity = combineAverage(owHumidity, omHumidity);
  const wind = combineAverage(owWindKmh, omWindKmh);
  const visibility = combineAverage(owVisibility, omVisibility);
  const pressure = combineAverage(owPressure, omPressure);
  const clouds = combineAverage(owClouds, omClouds);

  const rain = (() => {
    const r1 = safeNum(owRain1h);
    const r2 = safeNum(omPrecip);
    if (r1 === null && r2 === null) return 0;
    if (r1 === null) return r2;
    if (r2 === null) return r1;
    return Number(Math.max(r1, r2).toFixed(2));
  })();

  // AQI
  let aqi = null;
  if (aqiData?.list?.[0]?.main) {
    aqi = safeNum(aqiData.list[0].main.aqi);
  }

  return { temp, feels, humidity, wind, visibility, pressure, clouds, rain, aqi };
}

// Update the UI
function updateUI(final) {
  document.getElementById("temp").textContent = final.temp ?? "--";
  document.getElementById("feels").textContent = final.feels ?? "--";
  document.getElementById("humidity").textContent = final.humidity ?? "--";
  document.getElementById("wind").textContent = final.wind ?? "--";
  document.getElementById("visibility").textContent = final.visibility ?? "--";
  document.getElementById("pressure").textContent = final.pressure ?? "--";
  document.getElementById("clouds").textContent = final.clouds ?? "--";
  document.getElementById("rain").textContent = final.rain ?? "--";

  // AQI UI
  const aqiEl = document.getElementById("aqi");
  const aqiDescEl = document.getElementById("aqi-desc");

  if (final.aqi !== null) {
    const d = aqiDescriptor(final.aqi);
    aqiEl.textContent = final.aqi;
    aqiDescEl.textContent = d.text;
    aqiDescEl.style.color = d.color;
  } else {
    aqiEl.textContent = "--";
    aqiDescEl.textContent = "--";
    aqiDescEl.style.color = "#777";
  }

  document.getElementById("updated").textContent = new Date().toLocaleTimeString();
}

// Run loader
async function loadWeather() {
  try {
    const [owResp, omResp, aqiResp] = await Promise.allSettled([
      fetchOpenWeather(),
      fetchOpenMeteo(),
      fetchOpenWeatherAQI()
    ]);

    const ow = owResp.status === "fulfilled" ? owResp.value : null;
    const om = omResp.status === "fulfilled" ? omResp.value : null;
    const aqi = aqiResp.status === "fulfilled" ? aqiResp.value : null;

    if (!ow && !om) {
      updateUI({ temp: null, feels: null, humidity: null, wind: null, visibility: null, pressure: null, clouds: null, rain: null, aqi: null });
      return;
    }

    const final = combineData(ow || {}, om || {}, aqi || {});
    updateUI(final);

  } catch (e) {
    console.error("Unexpected error:", e);
  }
}

// Auto refresh every 2 minutes
loadWeather();
setInterval(loadWeather, 120000);
