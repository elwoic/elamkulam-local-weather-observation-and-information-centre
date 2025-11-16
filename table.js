// table.js
const lat = 10.9081;
const lon = 76.2296;
const OWM_KEY = "ca13a2cbdc07e7613b6af82cff262295"; // OpenWeather API Key

// --- Helper Functions ---

function displayRainStatus(elementId, isRaining, text, isError = false) {
    const r = document.getElementById(elementId);
    if (!r) return; // Exit if element not found
    
    if (isError) {
        r.innerHTML = `<span class="error-status">⚠️ API Error</span>`;
    } else if (isRaining) {
        r.innerHTML = `<span class="rain-status yes">🌧️ ${text}</span>`;
    } else {
        r.innerHTML = `<span class="rain-status no">☀️ ${text}</span>`;
    }
}

function updateTableData(index, data) {
    // Current Conditions use the 'current' object from the API response
    if (index === 0) {
        document.getElementById(`owTemp${index}`).textContent = `${data.main.temp.toFixed(1)}°C`;
        document.getElementById(`owFeels${index}`).textContent = `${data.main.feels_like.toFixed(1)}°C`;
        const cond = data.weather[0].description;
        document.getElementById(`owCond${index}`).textContent = cond.charAt(0).toUpperCase() + cond.slice(1);
        document.getElementById(`owHum${index}`).textContent = `${data.main.humidity}%`;
        document.getElementById(`owPress${index}`).textContent = `${data.main.pressure} hPa`;
        const wind = (data.wind.speed * 3.6).toFixed(1);
        document.getElementById(`owWind${index}`).textContent = `${wind} km/h`;
        const vis = (data.visibility / 1000).toFixed(1);
        document.getElementById(`owVis${index}`).textContent = `${vis} km`;

        const isRaining = cond.includes("rain") || cond.includes("shower");
        displayRainStatus(`owRainBox${index}`, isRaining, isRaining ? "Raining/Showers" : "Clear Conditions");
        
    } else {
        // Forecast Data (index 1 for 3h, index 2 for 6h)
        document.getElementById(`owTemp${index}`).textContent = `${data.main.temp.toFixed(1)}°C`;
        document.getElementById(`owFeels${index}`).textContent = `${data.main.feels_like.toFixed(1)}°C`;
        const cond = data.weather[0].description;
        document.getElementById(`owCond${index}`).textContent = cond.charAt(0).toUpperCase() + cond.slice(1);
        document.getElementById(`owHum${index}`).textContent = `${data.main.humidity}%`;
        document.getElementById(`owPress${index}`).textContent = `${data.main.pressure} hPa`;
        const wind = (data.wind.speed * 3.6).toFixed(1);
        document.getElementById(`owWind${index}`).textContent = `${wind} km/h`;
        // Visibility is often missing or generalized in 3-hour forecasts, use default or a placeholder
        document.getElementById(`owVis${index}`).textContent = `N/A`; 

        const rainText = data.weather[0].main.includes("Rain") ? "Rain Expected" : "Dry";
        const isRaining = data.weather[0].main.includes("Rain") || data.weather[0].main.includes("Drizzle");
        displayRainStatus(`owRainBox${index}`, isRaining, rainText);
    }
}

// --- Main Data Loading Function ---

async function loadOpenWeatherData() {
    try {
        // Fetch Current Weather (for column 1)
        const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
        const currentData = await currentRes.json();

        // Fetch 3-Hour Forecast (for columns 2 and 3)
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
        const forecastData = await forecastRes.json();

        if (currentRes.ok) {
            // Column 0: Current Conditions
            updateTableData(0, currentData);
        } else {
             // Handle current data error for column 0
             for(let i = 0; i < 3; i++) {
                displayRainStatus(`owRainBox${i}`, false, "Error", true);
             }
             return;
        }

        if (forecastRes.ok && forecastData.list && forecastData.list.length >= 2) {
            // Column 1: Next 3 Hours (The first forecast item is 3 hours out)
            updateTableData(1, forecastData.list[0]);
            
            // Column 2: Next 6 Hours (The second forecast item is 6 hours out)
            updateTableData(2, forecastData.list[1]);
        } else {
            // Handle forecast data error for columns 1 and 2
            console.error("OpenWeather Forecast Error: Data not available for 3 & 6 hours.");
            for(let i = 1; i < 3; i++) {
                document.getElementById(`owTemp${i}`).textContent = `N/A`;
                document.getElementById(`owCond${i}`).textContent = `Forecast Unavailable`;
                displayRainStatus(`owRainBox${i}`, false, "N/A", true);
            }
        }

    } catch (e) {
        console.error("Critical OpenWeather API Error:", e);
        // Display error across all rain boxes
        for(let i = 0; i < 3; i++) {
            displayRainStatus(`owRainBox${i}`, false, "Error", true);
        }
    }
}

// Run the data load on page load
loadOpenWeatherData();
// Optional: Reload data every 30 minutes (1800000 ms)
// setInterval(loadOpenWeatherData, 1800000);
