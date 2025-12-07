// auto-weather-report.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, set, push, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// -----------------------
// Firebase Config
// -----------------------
const firebaseConfig = {
    apiKey: "AIzaSyD1aZw3jvnMAzt6enCG6_DGkxaSQqg2NlA",
    authDomain: "weather-report-66bdf.firebaseapp.com",
    databaseURL: "https://weather-report-66bdf-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "weather-report-66bdf",
    storageBucket: "weather-report-66bdf.firebasestorage.app",
    messagingSenderId: "599939260562",
    appId: "1:599939260562:web:a0fbf532279a191559864b"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// -----------------------
// API Keys
// -----------------------
const openWeatherApiKey = "ca13a2cbdc07e7613b6af82cff262295";
const windyKey = "SBA9nIS9VtzpbIUnhpfEY7arpWfu3xN3";

// -----------------------
// IMD Alerts (example from your imd-marquee.js)
// -----------------------
const imdAlerts = {
    "2025-12-04": "g", "2025-12-05": "g", "2025-12-06": "g",
    "2025-12-07": "g", "2025-12-08": "g"
};

// -----------------------
// Utility Functions
// -----------------------
function formatDate(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// Generate variation in phrasing
function randomPhrase(phrases) {
    return phrases[Math.floor(Math.random() * phrases.length)];
}

// Escape HTML (optional)
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// -----------------------
// Fetch Weather Data
// -----------------------
async function fetchWeatherData() {
    const lat = 10.9081; // Elamkulam latitude
    const lon = 76.2296; // Elamkulam longitude

    // OpenWeatherMap
    const owUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric`;
    const owResp = await fetch(owUrl);
    const owData = await owResp.json();

    // OpenMeteo - hourly wind, pressure
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,pressure_msl&timezone=Asia/Kolkata`;
    const omResp = await fetch(omUrl);
    const omData = await omResp.json();

    // Windy API - alerts
    // Note: Windy requires server-side proxy or paid plan; here just placeholder
    const windyData = { alerts: [] }; 

    return { owData, omData, windyData };
}

// -----------------------
// Fetch User Reports from Firebase
// -----------------------
async function fetchUserReports() {
    const reportsRef = ref(db, "report-5d8c0-default-rtdb"); // adjust path if needed
    const snapshot = await get(reportsRef);
    return snapshot.exists() ? snapshot.val() : [];
}

// -----------------------
// Generate Malayalam Essay
// -----------------------
function generateEssay(data) {
    const { owData, omData, userReports } = data;

    const phrasesMorning = [
        "രാവിലെ കാലാവസ്ഥ ഇപ്രകാരം ആയിരുന്നു",
        "രാവിലെ കാലാവസ്ഥ ഇങ്ങനെ രേഖപ്പെടുത്തിയിരിക്കുന്നു",
        "രാവിലെ കാലാവസ്ഥ എങ്ങിനെയിരുന്നതെന്ന് നിരീക്ഷിക്കാം"
    ];
    const phrasesEvening = [
        "വൈകുന്നേരം/രാത്രി കാലാവസ്ഥ ഇപ്രകാരം ആയിരുന്നു",
        "വൈകുന്നേരം/രാത്രി കാലാവസ്ഥ ഇങ്ങനെ രേഖപ്പെടുത്തിയിരിക്കുന്നു",
        "വൈകുന്നേരം/രാത്രി കാലാവസ്ഥ എങ്ങിനെയിരുന്നതെന്ന് നിരീക്ഷിക്കാം"
    ];

    // OpenWeather
    const temp = owData.main?.temp ?? "N/A";
    const humidity = owData.main?.humidity ?? "N/A";
    const weatherDesc = owData.weather?.[0]?.description ?? "N/A";

    // User Reports
    const reportsText = Object.values(userReports || {}).map(r => `- ${r.name || "അനോണിമസ്"}: ${r.observation}`).join("\n") || "ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ ലഭിച്ചിട്ടില്ല.";

    // IMD Alert
    const todayKey = formatDate();
    const imdAlertCode = imdAlerts[todayKey] || null;
    const imdAlertText = imdAlertCode === "g" ? "മൂല്യനില: Green" :
                         imdAlertCode === "y" ? "മൂല്യനില: Yellow" :
                         imdAlertCode === "o" ? "മൂല്യനില: Orange" :
                         imdAlertCode === "r" ? "മൂല്യനില: Red" : "IMD മുന്നറിയിപ്പ് ലഭ്യമല്ല";

    // Essay
    const essay = `
ഇന്ന് എളംകുളത്ത് കാലാവസ്ഥ:
${randomPhrase(phrasesMorning)}: താപനില ${temp}°C, സാന്ദ്രത ${humidity}%, വിശദീകരണം: ${weatherDesc}.
${randomPhrase(phrasesEvening)}: (വൈകുന്നേര/രാത്രി പ്രവചനങ്ങൾ ഇപ്പോൾ അപ്‌ഡേറ്റ് ചെയ്യുന്നു).

ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ:
${reportsText}

IMD മുന്നറിയിപ്പ്: ${imdAlertText}
`;

    return essay.trim();
}

// -----------------------
// Update Today Report (Hourly)
// -----------------------
async function updateTodayReport() {
    const weatherData = await fetchWeatherData();
    const userReports = await fetchUserReports();
    const essay = generateEssay({ owData: weatherData.owData, omData: weatherData.omData, userReports });

    // Update in Firebase today_report node
    await set(ref(db, "today_report"), {
        text: essay,
        timestamp: Date.now()
    });

    console.log("Today report updated.");
}

// -----------------------
// End-of-Day Storage
// -----------------------
async function storeEndOfDay() {
    const snapshot = await get(ref(db, "today_report"));
    if (!snapshot.exists()) return;

    const todayKey = formatDate();
    await set(ref(db, `weather_reports/${todayKey}`), snapshot.val());
    console.log("End-of-day report stored in weather_reports.");
}

// -----------------------
// Scheduler
// -----------------------
function startScheduler() {
    // Update hourly
    updateTodayReport(); // immediate run
    setInterval(updateTodayReport, 60 * 60 * 1000);

    // Check every minute for midnight
    setInterval(async () => {
        const now = new Date();
        if (now.getHours() === 23 && now.getMinutes() === 59) {
            await storeEndOfDay();
        }
    }, 60 * 1000);
}

// -----------------------
// Start Automation
// -----------------------
startScheduler();
