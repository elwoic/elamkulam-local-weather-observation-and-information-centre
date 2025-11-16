// ------------------------------------
// CONFIG
// ------------------------------------
const openWeatherApiKey = "ca13a2cbdc07e7613b6af82cff262295";
const latitude = 10.9081;
const longitude = 76.2296;

const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${openWeatherApiKey}&units=metric`;

// ------------------------------------
// HEALTH + ACTIVITY ADVICE LOGIC
// ------------------------------------
function generateAdvice(temp, humidity, wind, condition) {
  let health = "";
  let activity = "";

  // ---------- HEALTH ----------
  if (temp >= 35) {
    health = "Very hot. Stay hydrated, avoid long outdoor exposure, and use sunscreen.";
  } else if (temp >= 28) {
    health = "Warm weather. Drink extra water and avoid heavy outdoor work in noon.";
  } else if (temp <= 20) {
    health = "Cool weather. Wear light warm clothing if going outside.";
  } else {
    health = "Weather is generally safe for all activities.";
  }

  if (humidity >= 80) {
    health += " High humidity may cause discomfort.";
  }

  // ---------- ACTIVITY ----------
  if (condition.includes("Rain") || condition.includes("Drizzle")) {
    activity =
      "Rainy conditions. Avoid cycling and motorbike trips. Driving requires caution. Fishing may be disturbed.";
  } else if (wind >= 25) {
    activity =
      "Windy. Avoid flying kites, cycling, or fishing in open waters. Driving may feel unstable.";
  } else {
    activity =
      "Good weather for cycling, outdoor walking, light traveling, and fishing.";
  }

  return { health, activity };
}

// ------------------------------------
// LOAD + UPDATE UI
// ------------------------------------
async function loadHealthAdvice() {
  try {
    const res = await fetch(weatherURL);
    const data = await res.json();

    const temp = data.main.temp;
    const humidity = data.main.humidity;
    const wind = (data.wind.speed * 3.6).toFixed(1);
    const condition = data.weather[0].main;

    const { health, activity } = generateAdvice(temp, humidity, wind, condition);

    document.getElementById("ha-temp").textContent = temp.toFixed(1);
    document.getElementById("ha-humidity").textContent = humidity;
    document.getElementById("ha-wind").textContent = wind;
    document.getElementById("ha-condition").textContent = condition;

    document.getElementById("health-advice").textContent = health;
    document.getElementById("activity-advice").textContent = activity;

    document.getElementById("ha-updated").textContent =
      new Date().toLocaleTimeString();
  } catch (error) {
    console.error("Advice fetch error:", error);
    document.getElementById("health-advice").textContent =
      "Error loading health advice.";
    document.getElementById("activity-advice").textContent =
      "Error loading activity advice.";
  }
}

loadHealthAdvice();
setInterval(loadHealthAdvice, 10 * 60 * 1000); // refresh every 10 min
