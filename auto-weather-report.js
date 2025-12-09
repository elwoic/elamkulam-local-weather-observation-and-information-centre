/* -----------------------------
   ELAMKULAM AUTO WEATHER REPORT
   Professional IMD-style Essay
   Updates every 1 hour
----------------------------- */

const apiKey = "ca13a2cbdc07e7613b6af82cff262295";
const latitude = 10.9081;
const longitude = 76.2296;

// Target section in forecast.html
const section = document.getElementById("automatic-weather-report");

// Fetch current weather from OpenWeather
async function fetchWeather() {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=ml`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OpenWeather API data fetch failed");
    return await res.json();
}

// Get today's IMD alert from imd-marquee.js
function getImdAlert() {
    const today = new Date().toISOString().slice(0,10);
    const alerts = window.imdAlerts || {};
    const lastUpdated = window.imdLastUpdated || "വിവരം ലഭ്യമല്ല";

    if (!alerts[today]) return { text: null, lastUpdated };

    const code = alerts[today].text.slice(-1).toLowerCase(); // r,y,o,g
    let text = "";

    if (code === "r") text = "ഇന്നലെ പ്രകാശിപ്പിച്ച IMD മുന്നറിയിപ്പ പ്രകാരം ചുവപ്പ് അലർട്ട് നിലവിലുണ്ട്. ശക്തമായ മഴയും കാറ്റും ഉണ്ടാകാനുള്ള സാധ്യത ഉയർന്നതായി നിരീക്ഷണം ചെയ്യപ്പെടുന്നു.";
    else if (code === "o") text = "ഇന്നലെ പ്രകാശിപ്പിച്ച IMD മുന്നറിയിപ്പ പ്രകാരം ഓറഞ്ച് അലർട്ട് നിലവിലുണ്ട്. ശക്തമായ കാലാവസ്ഥയ്ക്കുള്ള സാധ്യത ശ്രദ്ധയിൽപ്പെടുന്നു.";
    else if (code === "y") text = "ഇന്നലെ പ്രകാശിപ്പിച്ച IMD മുന്നറിയിപ്പ പ്രകാരം മഞ്ഞ അലർട്ട് നിലവിലുണ്ട്. മഴക്കാലാവസ്ഥ സാധാരണപേക്ഷിച്ച് കൂടുതൽ ശക്തിയോടെ ഉണ്ടാകാനുള്ള സാധ്യതകൾ നിലനിൽക്കുന്നു.";
    else if (code === "g") text = "ഇന്നലെ പ്രകാശിപ്പിച്ച IMD മുന്നറിയിപ്പ പ്രകാരം പച്ച അലർട്ട് നിലനിൽക്കുന്നു. വലിയ ഭീഷണി നിലവിലില്ല."; 

    return { text, lastUpdated };
}

// Create professional essay
function createEssay(weather, imd) {
    const dateTime = new Date().toLocaleString("ml-IN", { timeZone: "Asia/Kolkata" });
    const temp = weather.main.temp.toFixed(1);
    const feels = weather.main.feels_like.toFixed(1);
    const humidity = weather.main.humidity;
    const wind = (weather.wind.speed * 3.6).toFixed(1); // m/s → km/h
    const sky = weather.weather[0].description;

    let essay = `ഇന്ന് ${dateTime} നിലവാരം പ്രകാരം ഇളംകുളമിലുള്ള കാലാവസ്ഥ നിരീക്ഷണങ്ങൾ വിവരിച്ചാൽ, ശരാശരി താപനില ${temp}°C ആണ്. ശരീരത്തിൽ അനുഭവപ്പെടുന്ന താപനില ${feels}°C ആണ്. വായുവിലെ ഈർപ്പം ${humidity}% നിരീക്ഷിക്കപ്പെടുന്നു. കാറ്റിന്റെ വേഗം ഏകദേശം ${wind} km/h ആണ്. ആകാശനില ${sky} എന്ന നിലയിലാണ്.`;

    if (imd.text) essay += ` ${imd.text}`;

    essay += ` അവസാനമായി IMD ഈ വിവരം പുതുക്കിയത്: ${imd.lastUpdated} ആണ്.`;

    return essay;
}

// Update report in section
async function updateReport() {
    try {
        const weather = await fetchWeather();
        const imd = getImdAlert();
        section.innerHTML = `<p style="line-height:1.8; text-align:justify;">${createEssay(weather, imd)}</p>`;
    } catch (e) {
        section.innerHTML = "<p>⚠️ കാലാവസ്ഥ റിപ്പോർട്ട് ലോഡുചെയ്യുന്നതിൽ താൽക്കാലിക പിഴവ്.</p>";
        console.error(e);
    }
}

// First load + auto update every 1 hour
updateReport();
setInterval(updateReport, 60*60*1000);
