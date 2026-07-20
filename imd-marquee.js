const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

let refreshScheduled = false;

// Official IMD Warning Code mapping (api_reference.html#api-6)
const WARNING_MAP = {
  "1":  "No Warning",
  "2":  "Heavy Rain",
  "3":  "Heavy Snow",
  "4":  "Thunderstorm & Lightning",
  "5":  "Hailstorm",
  "6":  "Dust Storm",
  "7":  "Dust Raising Winds",
  "8":  "Strong Surface Winds",
  "9":  "Heat Wave",
  "10": "Hot Day",
  "11": "Warm Night",
  "12": "Cold Wave",
  "13": "Cold Day",
  "14": "Ground Frost",
  "15": "Fog",
  "16": "Very Heavy Rain",
  "17": "Extremely Heavy Rain"
};

// Official IMD Color Code mapping (corrected 2026-06-05)
const COLOR_MAP = {
  "1": { name: "Red alert (Take Action)",    css: "linear-gradient(90deg, #cb2d3e, #ef473a)" },
  "2": { name: "Orange alert (Be Prepared)", css: "linear-gradient(90deg, #f46b45, #eea849)" },
  "3": { name: "Yellow alert (Be Aware)",    css: "linear-gradient(90deg, #f7971e, #ffd200)" },
  "4": { name: "Green (No Warning)",         css: "linear-gradient(90deg, #1d976c, #93f9b9)" }
};

function decodeWarnings(codeString) {
  if (!codeString || codeString === "0") {
    return "No Specific Warning";
  }
  return codeString
    .split(",")
    .map(code => WARNING_MAP[code.trim()] || `Weather Event ${code}`)
    .join(" & ");
}

function getISTDate() {
  const indiaDateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return new Date(indiaDateStr);
}

async function updateMarqueeLive() {
  const marqueeTextEl = document.getElementById("marqueeText");
  const marqueeContainerEl = document.getElementById("marqueeContainer");
  
  try {
    const response = await fetch(WORKER_URL);
    if (!response.ok) throw new Error("Network response failed");
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const todayIST = getISTDate();
    const dateStr = todayIST.toLocaleDateString("en-GB");

    // 🛑 REMOVED the diffDays logic. 
    // ✅ ALWAYS target Day 1 of the latest available bulletin.
    const warningKey = "Day_1";
    const colorKey = "Day1_Color";

    const warningText = decodeWarnings(data[warningKey]);
    const colorId = data[colorKey];
    const colorInfo = COLOR_MAP[colorId] || { name: "Unknown", css: "#333" };

    const prefixParts = [];
    if (data.stale)      prefixParts.push("⚠️ Showing previous IMD bulletin.");
    if (data.updating)   prefixParts.push("🔄 Updating latest IMD data...");
    if (data.error_mode) prefixParts.push("⚠️ Using backup data.");
    const prefix = prefixParts.length ? prefixParts.join(" ") + " " : "";

    // The dateStr will dynamically show today's date (20/07/2026), 
    // but pull the Day_1 data (Yellow) from the JSON.
    marqueeTextEl.textContent = 
      `${prefix}IMD Alert for Malappuram district ${dateStr}: ${colorInfo.name} — ${warningText} | Last Updated: ${data.updated_at || "N/A"} | Source: India Meteorological Department (IMD)`;
    
    marqueeContainerEl.style.background = colorInfo.css;

    if (data.updating && !refreshScheduled) {
      refreshScheduled = true;
      setTimeout(() => {
        refreshScheduled = false;
        updateMarqueeLive();
      }, 30000);
    }

  } catch (error) {
    console.error("ELWOIC IMD Fetch Error:", error);
    marqueeTextEl.textContent = "⚠️ IMD Alert System currently unavailable. Please check official IMD channels.";
    marqueeContainerEl.style.background = "#222";
  }
}

document.addEventListener("DOMContentLoaded", updateMarqueeLive);
