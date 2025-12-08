// auto-weather-report.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, set, push, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
// ✅ Import IMD alert data from the external file
import { imdAlertData } from "./imd-marquee.js"; 

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
// Fetch Weather Data (Elamkulam)
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
    const omResp = await fetch(owUrl); // NOTE: Changed to owUrl here as omUrl was causing issues
    const omData = await omResp.json();

    // Windy API - alerts (placeholder)
    const windyData = { alerts: [] }; 

    return { owData, omData, windyData };
}

// -----------------------
// Fetch User Reports from Firebase
// -----------------------
async function fetchUserReports() {
    const reportsRef = ref(db, "weather_reports"); 
    const snapshot = await get(reportsRef);

    const allReports = snapshot.exists() ? snapshot.val() : {};
    const grantedReports = Object.values(allReports).filter(r => r.granted === "yes");

    return grantedReports;
}

// -----------------------
// Generate Malayalam Essay (with History and IMD Alert)
// -----------------------
function generateEssay(data) {
    const { owData, omData, userReports, oldReportText } = data; // Added oldReportText for history

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

    // --- Weather Data ---
    const temp = owData.main?.temp ?? "N/A";
    const humidity = owData.main?.humidity ?? "N/A";
    const weatherDesc = owData.weather?.[0]?.description ?? "N/A";

    // --- User Reports ---
    const reportsText = Object.values(userReports || {}).map(r => `- ${r.name || "അനോണിമസ്"}: ${r.observation}`).join("\n") || "ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ ലഭിച്ചിട്ടില്ല.";

    // --- Hourly History (Past Condition Consideration) ---
    let pastObservation = "";
    if (oldReportText) {
        // Extract the weather description from the previous report
        const match = oldReportText.match(/വിശദീകരണം: (.*?)\./s);
        if (match) {
            pastObservation = `കഴിഞ്ഞ റിപ്പോർട്ടിൽ ${match[1].trim()} രേഖപ്പെടുത്തിയിരുന്നു.\n\n`;
        }
    }

    // --- IMD Alert Logic (using imdAlertData) ---
    const todayKey = formatDate();
    const alerts = imdAlertData.alerts;
    const lastUpdated = imdAlertData.lastUpdated;

    const levelMap = {
        g: { full: "Green" },
        y: { full: "Yellow" },
        o: { full: "Orange" },
        r: { full: "Red" }
    };

    let imdAlertText;
    
    if (todayKey in alerts) {
        let alertText = alerts[todayKey].text;
        const shortCode = alertText.slice(-1).toLowerCase();
        const mapping = levelMap[shortCode] || { full: "Unknown" };
        
        // Convert 'g', 'y', etc. to 'Green', 'Yellow', etc.
        imdAlertText = alertText.replace(/([oyrg])$/i, mapping.full); 
    } else {
        imdAlertText = "IMD മുന്നറിയിപ്പ് ലഭ്യമല്ല";
    }

    // Essay Structure
    const essay = `
ഇന്ന് എളംകുളത്ത് കാലാവസ്ഥ:
${pastObservation}${randomPhrase(phrasesMorning)}: താപനില ${temp}°C, സാന്ദ്രത ${humidity}%, വിശദീകരണം: ${weatherDesc}.
${randomPhrase(phrasesEvening)}: (വൈകുന്നേര/രാത്രി പ്രവചനങ്ങൾ ഇപ്പോൾ അപ്‌ഡേറ്റ് ചെയ്യുന്നു).

IMD മുന്നറിയിപ്പ് (മലപ്പുറം ജില്ല): ${imdAlertText}
അവസാനമായി പുതുക്കിയത്: ${lastUpdated}

ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ:
${reportsText}
`;

    return essay.trim();
}

// -----------------------
// Update Today Report (Hourly, fetches old report for continuity)
// -----------------------
async function updateTodayReport() {
    // 1. Fetch current/old report from Firebase
    const oldReportSnapshot = await get(ref(db, "today_report"));
    const oldReport = oldReportSnapshot.exists() ? oldReportSnapshot.val() : null;

    // 2. Fetch new data
    const weatherData = await fetchWeatherData();
    const userReports = await fetchUserReports();

    // 3. Generate essay, passing the old report text
    const essay = generateEssay({ 
        owData: weatherData.owData, 
        omData: weatherData.omData, 
        userReports,
        oldReportText: oldReport ? oldReport.text : null // Pass past report for continuity
    });

    // 4. Update in Firebase today_report node
    await set(ref(db, "today_report"), {
        text: essay,
        timestamp: Date.now()
    });

    console.log("Today report updated.");
}

// -----------------------
// End-of-Day Storage (Stores the final, accumulated report)
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

    // Check every minute for midnight (23:59)
    setInterval(async () => {
        const now = new Date();
        // Check if it's 23:59 IST (or close to midnight for end-of-day storage)
        if (now.getHours() === 23 && now.getMinutes() === 59) {
            await storeEndOfDay();
        }
    }, 60 * 1000);
}

// -----------------------
// Start Automation
// -----------------------
startScheduler();
