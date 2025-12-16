const ELAMKULAM_LAT_GENERAL = 10.9081;
const ELAMKULAM_LON_GENERAL = 76.2296;
const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295";

// OpenWeatherMap AQI mapping
const statusMap = {
    1: { text: "Excellent", class: "aqi-good", range: "0–50" },
    2: { text: "Fair", class: "aqi-fair", range: "51–100" },
    3: { text: "Moderate", class: "aqi-moderate", range: "101–150" },
    4: { text: "Poor", class: "aqi-poor", range: "151–200" },
    5: { text: "Very Poor", class: "aqi-very-poor", range: "201+" }
};

// Health advice mapping
const healthMap = {
    1: "Air is clean. No health risk.",
    2: "Air quality is acceptable. Minor effects for very sensitive people.",
    3: "Moderate pollution. Sensitive groups may experience effects.",
    4: "Poor air quality. Sensitive groups should limit outdoor activity.",
    5: "Very Poor air quality. Everyone may experience health effects. Avoid outdoor activity."
};

async function loadAQIBox() {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${ELAMKULAM_LAT_GENERAL}&lon=${ELAMKULAM_LON_GENERAL}&appid=${OPENWEATHER_API_KEY}`;

    const aqiDiv = document.getElementById("aqiValue");
    const aqiCircle = document.getElementById("aqiCircle");
    const aqiAdviceDiv = document.getElementById("aqiAdvice");

    // Show loading while fetching
    aqiDiv.textContent = "Fetching AQI...";
    aqiCircle.className = "aqi-circle";
    aqiAdviceDiv.textContent = "";

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network response was not ok");

        const data = await res.json();
        const aqi = data?.list?.[0]?.main?.aqi;

        if (!aqi || !statusMap[aqi]) throw new Error("AQI data unavailable");

        const aqiStatus = statusMap[aqi];

        // Update text with approximate numeric range
        aqiDiv.textContent = `AQI ${aqi} — ${aqiStatus.text} (approx. ${aqiStatus.range})`;
        aqiAdviceDiv.textContent = healthMap[aqi];

        // Update classes safely
        aqiCircle.classList.remove("aqi-good","aqi-fair","aqi-moderate","aqi-poor","aqi-very-poor");
        aqiCircle.classList.add(aqiStatus.class);

    } catch (err) {
        console.error("AQI fetch error:", err);
        aqiDiv.textContent = "AQI data unavailable.";
        aqiCircle.className = "aqi-circle aqi-poor";
        aqiAdviceDiv.textContent = "Unable to retrieve health advice.";
    }
}

// Initial load + refresh every 10 minutes
loadAQIBox();
setInterval(loadAQIBox, 600000);
