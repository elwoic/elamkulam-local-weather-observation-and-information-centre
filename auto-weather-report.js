/* -----------------------------
    Elamkulam Auto Weather Report
    Updates every 1 hour
------------------------------ */

// 🚨 WORKAROUND: Accessing global variables (assumes imd-marquee.js is loaded first in HTML)
// Use the exact variable names that would be set by the external script.
const imdAlerts = globalThis.alerts || {}; 
const imdLastUpdated = globalThis.lastUpdated || "വിവരം ലഭ്യമല്ല"; 


/* OpenWeather API Details */
const openWeatherApiKey = "ca13a2cbdc07e7613b6af82cff262295";
const latitude = 10.9081;
const longitude = 76.2296;

/* Firebase */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1aZw", 
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

// 🆕 NEW UTILITY FUNCTION: Cleans up strings and numbers by removing extra quotes
function cleanValue(value) {
    if (typeof value === 'string') {
        // Strip leading/trailing double quotes
        return value.replace(/^"|"$/g, '');
    }
    return value;
}

/* ⏳ Convert IMD alert code to Malayalam message  */
function interpretIMD(code) {
  if (!code) return "പ്രധാന മുന്നറിയിപ്പുകളൊന്നും നിലവിൽ പ്രഖ്യാപിച്ചിട്ടില്ല.";
  if (code.includes(": y")) return "മഞ്ഞ അലർട്ട് നിലവിലുണ്ട്. ഇടിമിന്നലോടു കൂടിയ മഴക്കും ശക്തമായ കാറ്റിനും സാധ്യതയുണ്ടെന്ന് മുന്നറിയിപ്പ് നൽകുന്നു.";
  if (code.includes(": o")) return "ഓറഞ്ച് അലർട്ട് പ്രഖ്യാപിച്ചു. അതിശക്തമായ മഴ, വെള്ളപ്പൊക്ക സാധ്യതകൾ, പുഴകളിലെ ജലനിരപ്പ് ഉയരാൻ സാധ്യത. **അതീവ ജാഗ്രത ആവശ്യമാണ്.**";
  if (code.includes(": r")) return "ചുവപ്പ് അലർട്ട് പ്രഖ്യാപിച്ചു. അതീവ അതിശക്തമായ മഴ, മണ്ണിടിച്ചിൽ, ജീവഹാനി സാധ്യതകൾ. **അടിയന്തിരമായി അധികൃതരുടെ നിർദ്ദേശങ്ങൾ പാലിക്കുക.**";
  return "പ്രധാന മുന്നറിയിപ്പുകളൊന്നും നിലവിൽ പ്രഖ്യാപിച്ചിട്ടില്ല.";
}

/* 🌧 Fetch Firebase granted reports */
async function fetchCommunityReports() {
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

    if (!openw) {
        throw new Error("കാലാവസ്ഥാ ഡാറ്റ ലഭ്യമായില്ല.");
    }

    /* IMD alert */
    const todayKey = new Date().toISOString().split("T")[0]; 
    let imdAlertText = imdAlerts?.[todayKey]?.text || "";
    let imdMalayalam = interpretIMD(imdAlertText);
    
    /* Firebase reports */
    let communityText = await fetchCommunityReports();

    /* Weather values - APPLYING cleanValue() */
    let temp = cleanValue(openw?.main?.temp);
    let feels = cleanValue(openw?.main?.feels_like);
    let humidity = cleanValue(openw?.main?.humidity);
    let wind = cleanValue(openw?.wind?.speed);
    let rain = cleanValue(openw?.weather?.[0]?.description);
    let rainProb = cleanValue(openm?.hourly?.precipitation_probability?.[0] || 0); 
    let uv = cleanValue(openm?.hourly?.uv_index?.[0] || 0);

    /* 📝 REVISED FORMAL MALAYALAM FORECAST ESSAY */
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ml-IN", {
      day: "numeric", month: "long", year: "numeric"
    });
    
    const hour = now.getHours();
    let timePeriod;
    if (hour >= 5 && hour < 12) {
        timePeriod = "ഇന്ന് രാവിലെ";
    } else if (hour >= 12 && hour < 17) {
        timePeriod = "ഇന്ന് ഉച്ചയ്ക്ക് ശേഷം";
    } else {
        timePeriod = "ഇന്ന് വൈകുന്നേരം";
    }

    const essay = `
## 🔸 എളംകുളം കാലാവസ്ഥാ റിപ്പോർട്ട്: ${formattedDate}

**${timePeriod} രേഖപ്പെടുത്തിയ പ്രധാന വിവരങ്ങൾ:**
* **താപനില:** **${temp}°C** ആണ് രേഖപ്പെടുത്തിയിരിക്കുന്നത്. (ശരീരത്തിൽ അനുഭവപ്പെടുന്നത്: ${feels}°C)
* **ആർദ്രത (Humidity):** **${humidity}%**
* **കാറ്റ് (Wind Speed):** **${wind} മീറ്റർ/സെക്കൻഡ്.**
* **അന്തരീക്ഷ സ്ഥിതി:** നിലവിൽ "${rain}" തരത്തിലുള്ള അന്തരീക്ഷമാണ് ഇവിടെ പ്രവചിക്കപ്പെടുന്നത്.

**🔸 മഴ സാധ്യതയും UV സൂചികയും**
* **മഴയ്ക്കുള്ള സാധ്യത:** **${rainProb}%** ആണ്.
* **UV വികിരണ സൂചിക:** **${uv}**

---

## 🟡 IMD മുന്നറിയിപ്പും ജാഗ്രതയും
${imdMalayalam}
അവസാനമായി **പുതുക്കിയത്:** ${imdLastUpdated}

---

## 👥 പൊതുജന നിരീക്ഷണ റിപ്പോർട്ടുകൾ

${
    communityText
    ? `ഈ പ്രദേശത്തെ ജനങ്ങൾ നൽകിയ നിരീക്ഷണ റിപ്പോർട്ടുകൾ പ്രകാരം: ${communityText}`
    : `പൊതുജനങ്ങളിൽ നിന്നുള്ള നിരീക്ഷണ റിപ്പോർട്ടുകൾ നിലവിൽ ലഭ്യമായിട്ടില്ല.`
}

---

## 📢 ഔദ്യോഗിക അറിയിപ്പ്
അടുത്ത മണിക്കൂറുകളിൽ കാലാവസ്ഥയിൽ മാറ്റം വരാൻ സാധ്യതയുണ്ട്. എല്ലാ പൗരന്മാരും ഔദ്യോഗിക മുന്നറിയിപ്പുകൾക്കായി ശ്രദ്ധിക്കുകയും, ആവശ്യമായ മുൻകരുതലുകൾ സ്വീകരിക്കുകയും **ജാഗ്രത പാലിക്കുകയും** ചെയ്യണമെന്ന് അറിയിക്കുന്നു.
    `.trim();

    // The output is now formatted using Markdown headings (##) for structure
    output.innerHTML = essay.replace(/\n\n+/g, "<br><br>");

  } catch (err) {
    console.error("Report generation failed:", err);
    output.innerHTML = `⚠ കാലാവസ്ഥ റിപ്പോർട്ട് പ്രസിദ്ധീകരിക്കുന്നതിൽ പിഴവ് സംഭവിച്ചു. സാങ്കേതിക തകരാർ: ${err.message}`;
  }
}

/* First load + auto update every 1 hour */
generateReport();
setInterval(generateReport, 60 * 60 * 1000);
