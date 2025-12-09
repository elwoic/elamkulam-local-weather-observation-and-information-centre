/* -----------------------------
   Auto Weather Report (Essay Generator)
   For ELAMKULAM — Updates Every 1 Hour
----------------------------- */
const apiKey = "ca13a2cbdc07e7613b6af82cff262295";
const latitude = 10.9081;
const longitude = 76.2296;

const section = document.getElementById("automatic-weather-report");

async function fetchWeather() {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=ml`;
    const res = await fetch(url);
    const data = await res.json();
    return data.list[0];
}

function getImdAlert() {
    const today = new Date().toISOString().slice(0, 10);
    const alerts = window.imdAlerts || {};
    const lastUpdated = window.imdLastUpdated || "വിവരം ലഭ്യമല്ല";

    if (!alerts[today]) return { text: null, lastUpdated };

    let alertCode = alerts[today].text.slice(-1); // r/y/g etc
    let alertText = "പ്രത്യേക മുന്നറിയിപ്പ് ഇല്ല";

    if (alertCode === "r") alertText = " ഇന്നേക്ക് ചുവപ്പ് മുന്നറിയിപ്പ് പ്രഖ്യാപിച്ചിട്ടുണ്ട്. അത്യന്തം ശക്തമായ കാലാവസ്ഥക്ക് സാധ്യത.";
    if (alertCode === "y") alertText = " ഇന്നേക്ക് മഞ്ഞ മുന്നറിയിപ്പ് നിലവിലുണ്ട്. ജാഗ്രത പാലിക്കുക.";
    if (alertCode === "g") alertText = " ഇന്നേക്ക് പച്ച മുന്നറിയിപ്പ് — ഗുരുതരമായ കാലാവസ്ഥാ ഭീഷണി ഇല്ല.";

    return { text: alertText, lastUpdated };
}

function createEssay(weather, imd) {
    let dt = new Date().toLocaleString("ml-IN", { timeZone: "Asia/Kolkata" });
    let temp = weather.main.temp;
    let desc = weather.weather[0].description;
    let hum = weather.main.humidity;
    let wind = weather.wind.speed;

    return `
    <h2 class="text-xl font-bold mb-2">📌 ഇളംകുളം — ഓട്ടോമാറ്റിക് കാലാവസ്ഥ റിപ്പോർട്ട്</h2>

    <p class="leading-7 text-justify">
        ${dt} നിലവിൽ ഇളംകുളത്തിൽ ശരാശരി താപനില <b>${temp}°C</b> ആയി രേഖപ്പെടുത്തുന്നു. 
        ആകാശ നില <b>${desc}</b> ആണ്. ഈ സമയം വായുവിൽ <b>${hum}%</b> ഈർപ്പം നിലനിൽക്കുന്നു,
        കൂടാതെ കാറ്റിന്റെ വേഗം <b>${wind} km/h</b> ആയി രേഖപ്പെടുത്തിയിട്ടുണ്ട്.
    </p><br/>

    ${imd.text ? `
    <p class="leading-7 text-justify text-red-600 font-semibold">
        ⚠️ ഇന്ത്യാ കാലാവസ്ഥാ വകുപ്പ് (IMD) മുന്നറിയിപ്പ്: ${imd.text}
    </p>` : `
    <p class="leading-7 text-justify text-green-700 font-semibold">
        ഇന്ന് ഐ.എം.ഡി. മുന്നറിയിപ്പ് ലഭ്യമല്ല.
    </p>`}<br/>

    <p class="text-sm text-gray-600">🕒 IMD പുതുക്കിയ സമയം: ${imd.lastUpdated}</p>
    <p class="text-sm text-gray-600">🔄 ഈ റിപ്പോർട്ട് സ്വയം ഓരോ മണിക്കൂറിലും പുതുക്കപ്പെടുന്നു</p>
    `;
}

async function updateReport() {
    try {
        const weather = await fetchWeather();
        const imd = getImdAlert();
        section.innerHTML = createEssay(weather, imd);
    } catch {
        section.innerHTML = "<p>⚠️ റിപ്പോർട്ട് ലോഡുചെയ്യുന്നതിൽ താൽക്കാലിക പിഴവ്.</p>";
    }
}

updateReport();
setInterval(updateReport, 60 * 60 * 1000); // 1 hour
