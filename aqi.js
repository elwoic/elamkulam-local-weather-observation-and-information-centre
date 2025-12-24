const LAT = 10.9081;
const LON = 76.2296;

/* AQI status */
function getAQIStatus(aqi) {
  if (aqi <= 50) return { text: "Good", class: "aqi-good", emoji: "😀" };
  if (aqi <= 100) return { text: "Satisfactory", class: "aqi-fair", emoji: "🙂" };
  if (aqi <= 200) return { text: "Moderate", class: "aqi-moderate", emoji: "😐" };
  if (aqi <= 300) return { text: "Poor", class: "aqi-poor", emoji: "😷" };
  return { text: "Very Poor", class: "aqi-very-poor", emoji: "☹️" };
}

/* Health advice */
function getHealthAdvice(aqi) {
  if (aqi <= 50) return "Air quality is good. Ideal for outdoor activities.";
  if (aqi <= 100) return "Air quality is acceptable. Sensitive people should be cautious.";
  if (aqi <= 200) return "Moderate pollution. Reduce prolonged outdoor exertion.";
  if (aqi <= 300) return "Poor air quality. Limit outdoor activities.";
  return "Very poor air quality. Avoid outdoor activities.";
}

/* PM2.5 → AQI */
function pm25ToAQI(pm) {
  const bp = [
    { cL: 0, cH: 12, aL: 0, aH: 50 },
    { cL: 12.1, cH: 35.4, aL: 51, aH: 100 },
    { cL: 35.5, cH: 55.4, aL: 101, aH: 150 },
    { cL: 55.5, cH: 150.4, aL: 151, aH: 200 },
    { cL: 150.5, cH: 250.4, aL: 201, aH: 300 },
    { cL: 250.5, cH: 500, aL: 301, aH: 500 }
  ];
  for (const r of bp) {
    if (pm >= r.cL && pm <= r.cH) {
      return Math.round(((r.aH - r.aL)/(r.cH - r.cL))*(pm - r.cL) + r.aL);
    }
  }
  return null;
}

async function loadAQIBox() {
  const aqiDiv = document.getElementById("aqiValue");
  const aqiCircle = document.getElementById("aqiCircle");
  const aqiAdviceDiv = document.getElementById("aqiAdvice");

  aqiDiv.textContent = "Fetching AQI...";
  aqiAdviceDiv.textContent = "";
  aqiCircle.className = "aqi-circle";

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5`;
    const res = await fetch(url);
    const data = await res.json();

    const pm25 = data?.current?.pm2_5;
    if (pm25 == null) throw new Error("No data");

    const aqi = pm25ToAQI(pm25);
    const status = getAQIStatus(aqi);

    aqiDiv.textContent = `AQI ${aqi} — ${status.text} ${status.emoji}`;
    aqiAdviceDiv.textContent =
      `${getHealthAdvice(aqi)} (PM2.5: ${pm25} µg/m³ • Estimated)`;

    aqiCircle.classList.add(status.class);

  } catch (e) {
    aqiDiv.textContent = "AQI unavailable";
    aqiAdviceDiv.textContent = "Unable to retrieve air quality data.";
    aqiCircle.classList.add("aqi-moderate");
  }
}

loadAQIBox();
setInterval(loadAQIBox, 600000);
</script>
