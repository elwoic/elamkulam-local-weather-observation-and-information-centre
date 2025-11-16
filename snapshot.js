// ---------------------------
// CONFIGURATION
// ---------------------------
const openWeatherApiKey = "ca13a2cbdc07e7613b6af82cff262295"; // <-- Add your OpenWeatherMap API key
const latitude = 10.9081;     // Elamkulam latitude
const longitude = 76.2296;    // Elamkulam longitude

// Open-Meteo endpoint (direct browser fetch)
const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,humidity_2m,windspeed_10m&current_weather=true&timezone=Asia/Kolkata`;

// ---------------------------
// MAIN FUNCTION
// ---------------------------
async function loadWeatherSnapshot() {
  try {
    // 1️⃣ OpenWeatherMap fetch
    const owRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${openWeatherApiKey}&units=metric`);
    const owData = await owRes.json();

    // Extract values from OpenWeather
    const temp = owData.main.temp.toFixed(1);
    const feels = owData.main.feels_like.toFixed(1);
    const humidity = owData.main.humidity;
    const wind = (owData.wind.speed * 3.6).toFixed(1); // m/s → km/h
    const visibility = (owData.visibility / 1000).toFixed(1);
    const condition = owData.weather[0].main;

    // 2️⃣ Open-Meteo fetch
    const omRes = await fetch(openMeteoUrl);
    const omData = await omRes.json();

    // Extract current weather from Open-Meteo
    const omTemp = omData.current_weather?.temperature ?? "--";
    const omWind = omData.current_weather?.windspeed ?? "--";

    // ---------------------------
    // 3️⃣ Update HTML boxes
    // ---------------------------
    document.getElementById("temp").textContent = temp;
    document.getElementById("feels").textContent = feels;
    document.getElementById("humidity").textContent = humidity;
    document.getElementById("wind").textContent = wind;
    document.getElementById("visibility").textContent = visibility;
    document.getElementById("condition").textContent = condition;

    // Optional: you can add Open-Meteo values to a separate box if desired
    // e.g., document.getElementById("om-temp").textContent = omTemp;

    document.getElementById("updated").textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error("Weather snapshot failed:", err);
    document.getElementById("updated").textContent = "Error fetching data";
  }
}

// ---------------------------
// INITIAL LOAD + AUTO REFRESH
// ---------------------------
loadWeatherSnapshot();
setInterval(loadWeatherSnapshot, 10 * 60 * 1000); // every 10 minutes
