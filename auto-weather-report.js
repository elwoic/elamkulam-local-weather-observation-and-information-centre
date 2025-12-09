/* -----------------------------
    Elamkulam Auto Weather Report
    Updates every 1 hour
------------------------------ */

// 🛑 FIX: The external imd-marquee.js is loaded first in HTML (not via import).
// We access the variables it defines globally (window or globalThis).

// Define the global variables used in the script. They will be overwritten 
// if the external script successfully loads them into the global scope.
const imdAlerts = globalThis.alerts || {}; // Assuming the external file uses 'alerts' as defined in your earlier post
const imdLastUpdated = globalThis.lastUpdated || "Unknown"; // Assuming the external file uses 'lastUpdated' as defined in your earlier post


/* OpenWeather API Details */
const openWeatherApiKey = "ca13a2cbdc07e7613b6af82cff262295";
const latitude = 10.9081;
const longitude = 76.2296;

/* Firebase */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1aZw", // (Using placeholder key from your prompt)
  authDomain: "weather-report-66bdf.firebaseapp.com",
  databaseURL: "https://weather-report-66bdf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "weather-report-66bdf",
  storageBucket: "weather-report-66bdf.appspot.com",
  messagingSenderId: "820772327655",
  appId: "1:820772327655:web:03782ad29732f73d86ec26"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* DOM target */
const output = document.getElementById("elamkulamForecastText");

/* ⏳ Convert IMD alert code to Malayalam message  */
function interpretIMD(code) {
  if (!code) return "പ്രധാന മുന്നറിയിപ്പ് ഒന്നുമില്ലെന്ന് ഐഎംഡി അറിയിക്കുന്നു.";
  if (code.includes(": y")) return "ഇന്ന് മഞ്ഞ അലർട്ട് പ്രഖ്യാപിച്ചിട്ടുണ്ട്. ഇടിമിന്നലോടു കൂടിയ മഴക്കും ശക്തമായ കാറ്റിനും സാധ്യത.";
  if (code.includes(": o")) return "ഇന്ന് ഓറഞ്ച് അലർട്ട്. അതിവർഷവും വെള്ളപ്പൊക്ക സാധ്യതകളും മുൻകരുതൽ വേണം.";
  if (code.includes(": r")) return "ഇന്ന് ചുവപ്പ് അലർട്ട്. അത്യാധിക മഴയും ജീവഹാനി സാധ്യതകളും ഉള്ളതിനാൽ അതീവ ജാഗ്രത ആവശ്യമാണ്.";
  return "പ്രധാന മുന്നറിയിപ്പ് ഒന്നുമില്ലെന്ന് ഐഎംഡി അറിയിക്കുന്നു.";
}

/* 🌧 Fetch Firebase granted reports */
async function fetchCommunityReports() {
  // Fix: The Firebase path should be "weather_reports" or similar, assuming "granted_reports" is a direct node.
  const snapshot = await get(ref(db, "granted_reports")); 
  if (!snapshot.exists()) return "";
  let reports = Object.values(snapshot.val()).map(r => r?.report || "");
  let combined = reports.join(" ");
  return combined.trim();
}

/* 🌡 Main Function */
async function generateReport() {
  try {
    /* Fetch OpenWeather */
    const owUrl =
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${openWeatherApiKey}&units=metric&lang=en`;
    const openw = await fetch(owUrl).then(r => r.ok ? r.json() : null);

    /* Fetch Open-Meteo */
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=uv_index,precipitation_probability`;
    const openm = await fetch(omUrl).then(r => r.ok ? r.json() : null);

    // --- Data Validation ---
    if (!openw) {
        throw new Error("Failed to fetch OpenWeather data.");
    }
    // -----------------------

    /* IMD alert */
    // Ensure the date key matches the format used in imd-marquee.js ("YYYY-MM-DD")
    const todayKey = new Date().toISOString().split("T")[0]; 
    
    // Use the variable that holds the data loaded from the global scope (imdAlerts)
    let imdAlertText = imdAlerts?.[todayKey]?.text || "";
    let imdMalayalam = interpretIMD(imdAlertText);
    
    /* Firebase reports */
    let communityText = await fetchCommunityReports();

    /* Weather values */
    let temp = openw?.main?.temp;
    let feels = openw?.main?.feels_like;
    let humidity = openw?.main?.humidity;
    let wind = openw?.wind?.speed;
    let rain = openw?.weather?.[0]?.description;
    // Fix: Access Open-Meteo data correctly. For the current hour, it's the 0 index.
    let rainProb = openm?.hourly?.precipitation_probability?.[0] || 0; 
    let uv = openm?.hourly?.uv_index?.[0] || 0;

    /* 📝 Malayalam IMD-style forecast essay */
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ml-IN", {
      day: "numeric", month: "long", year: "numeric"
    });

    // Fix: Ensure the IMD last updated time is included (using imdLastUpdated)
    const essay = `
ഇലങ്കുളം പ്രദേശത്തേക്കുള്ള ഇന്നത്തെ കാലാവസ്ഥ പ്രവചനം — ${formattedDate}

ഇന്ന് രാവിലെ മുതൽ പ്രദേശത്ത് താപനില ശരാശരി **${temp}°C** ആയി രേഖപ്പെടുത്തുന്നു. ശരീരത്തിൽ അനുഭവപ്പെടുന്ന ചൂട്
ഏകദേശം ${feels}°C ആണ്. വായുവിലെ ഈർപ്പം ${humidity}% നിരക്കിലുണ്ട്.

**IMD മുന്നറിയിപ്പ്:** ${imdMalayalam}
അവസാനമായി പുതുക്കിയത്: ${imdLastUpdated}

മേഘാവരണം നിലനിൽക്കുന്നതിനാൽ മഴയ്ക്കുള്ള സാധ്യത **${rainProb}%** ആണ്. കാറ്റിന്റെ വേഗം ഏകദേശം
${wind} മീറ്റർ / സെക്കൻഡ് ആയി പ്രതീക്ഷിക്കുന്നു. നിലവിലെ കാലാവസ്ഥാ നിരീക്ഷണങ്ങൾ പ്രകാരം "${rain}" തരത്തിലുള്ള
കാലാവസ്ഥയാണ് സാധ്യത. അൾട്രാവയലറ്റ് വികിരണ സൂചിക UV = ${uv} ആണ്; ഉച്ചയോടെ സൂര്യപ്രകാശം കൂടുതലാകുമ്പോൾ
കുട്ടികൾ, മുതിർന്നവർ, ചർമ്മരോഗമുള്ളവർ മുൻകരുതൽ പാലിക്കുക.

${
    communityText
    ? `\n\n**നാട്ടുകാരുടെ റിപ്പോർട്ടുകൾ:** ${communityText} `
    : ""
}

കാലാവസ്ഥയിലെ മാറ്റങ്ങൾ അതിവേഗം സംഭവിക്കാവുന്നതിനാൽ പുറംപ്രവർത്തനങ്ങളും
യാത്രകളും ആസൂത്രണം ചെയ്യുമ്പോൾ ജാഗ്രത പാലിക്കുക. കൂടുതൽ മുന്നറിയിപ്പുകൾ ലഭിക്കുമ്പോൾ
മറുപടി റിപ്പോർട്ട് പ്രസിദ്ധീകരിക്കും.
    `.trim();

    output.innerHTML = essay.replace(/\n\n+/g, "<br><br>");

  } catch (err) {
    console.error("Report generation failed:", err);
    output.innerHTML = `⚠ കാലാവസ്ഥ റിപ്പോർട്ട് ഇപ്പോള്‍ ലഭ്യമല്ല. ദയവായി പിന്നീട് ശ്രമിക്കുക. (Error: ${err.message})`;
  }
}

/* First load + auto update every 1 hour */
generateReport();
setInterval(generateReport, 60 * 60 * 1000); // Update every 1 hour (3,600,000 milliseconds)
