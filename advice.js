// ---------------------------
// WEATHER API CONFIG
// ---------------------------
const openWeatherApiKey = "856b819166fedc7df9e65814b23e0970";
const latitude = 10.9081;
const longitude = 76.2296;

async function loadWeatherSnapshot() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${openWeatherApiKey}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    const temp = data.main.temp;
    const feels = data.main.feels_like;
    const humidity = data.main.humidity;
    const wind = (data.wind.speed * 3.6).toFixed(1);
    const visibility = (data.visibility / 1000).toFixed(1);
    const condition = data.weather[0].main;

    // Update Snapshot (IF you are using the IDs in your page)
    if (document.getElementById("temp")) {
      document.getElementById("temp").textContent = temp.toFixed(1);
      document.getElementById("feels").textContent = feels.toFixed(1);
      document.getElementById("humidity").textContent = humidity;
      document.getElementById("wind").textContent = wind;
      document.getElementById("visibility").textContent = visibility;
      document.getElementById("condition").textContent = condition;
      document.getElementById("updated").textContent =
        new Date().toLocaleTimeString();
    }

    generateAdvice(temp, humidity, wind, visibility, condition);
  } catch (err) {
    console.error(err);
    document.getElementById("advice-output").innerHTML =
      "⚠ Unable to load weather data.";
  }
}

// ---------------------------
// ADVICE GENERATOR
// ---------------------------
function generateAdvice(temp, humidity, wind, visibility, condition) {
  let html = "";

  // HEALTH
  html += `<div class="advice-box"><strong>Health Advice:</strong><br>`;
  if (temp >= 32) html += "• Very hot — Drink more water.<br>";
  else if (temp <= 20) html += "• Cool weather — Keep warm.<br>";
  else html += "• Comfortable temperature.<br>";

  if (humidity >= 80) html += "• High humidity — Sweating & discomfort.<br>";
  else if (humidity <= 40) html += "• Low humidity — Dry skin & throat.<br>";
  html += "</div>";

  // OUTDOOR
  html += `<div class="advice-box"><strong>Outdoor Activities:</strong><br>`;
  if (condition === "Rain" || wind >= 35)
    html += "• Avoid outdoor activities.<br>";
  else html += "• Good for outdoor activities.<br>";
  html += "</div>";

  // DRIVING
  html += `<div class="advice-box"><strong>Driving Conditions:</strong><br>`;
  if (visibility <= 2 || condition === "Rain")
    html += `<span class="warning">• Poor visibility — Drive carefully.</span><br>`;
  else html += "• Driving is normal.<br>";
  html += "</div>";

  // FISHING
  html += `<div class="advice-box"><strong>Fishing:</strong><br>`;
  if (wind >= 30) html += "• Unsafe — Strong winds.<br>";
  else if (condition === "Rain") html += "• Be cautious — Rain possible.<br>";
  else html += "• Good fishing conditions.<br>";
  html += "</div>";

  // CYCLING
  html += `<div class="advice-box"><strong>Cycling / Biking:</strong><br>`;
  if (wind >= 30) html += "• Avoid cycling — Strong winds.<br>";
  else if (condition === "Rain") html += "• Slippery roads — Ride safely.<br>";
  else html += "• Good for cycling.<br>";
  html += "</div>";

  // BEACH
  html += `<div class="advice-box"><strong>Beach & Pool:</strong><br>`;
  if (condition === "Rain") html += "• Not suitable — Rainy.<br>";
  else if (temp >= 30) html += "• Great for beach & pool.<br>";
  else html += "• Okay, but water may be cool.<br>";
  html += "</div>";

  document.getElementById("advice-output").innerHTML = html;
}

// ---------------------------
// AUTO UPDATE EVERY 10 MIN
// ---------------------------
loadWeatherSnapshot();
setInterval(loadWeatherSnapshot, 10 * 60 * 1000);
