const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

// Prevent multiple refresh timers
let refreshScheduled = false;

// Standard IMD Code Decodes
const WARNING_MAP = {
  "1": "Very Heavy Rain",
  "4": "Thunderstorm & Lightning",
  "8": "Gusty Winds",
  "10": "Heavy Rain",
  "12": "Extremely Heavy Rain",
  "16": "Squall"
};

// Standard IMD Color Mapping
const COLOR_MAP = {
  "1": {
    name: "Green (No Warning)",
    css: "linear-gradient(90deg, #1d976c, #93f9b9)"
  },
  "3": {
    name: "Yellow alert (Be Aware)",
    css: "linear-gradient(90deg, #f7971e, #ffd200)"
  },
  "4": {
    name: "Orange alert (Be Prepared)",
    css: "linear-gradient(90deg, #f46b45, #eea849)"
  },
  "5": {
    name: "Red alert (Take Action)",
    css: "linear-gradient(90deg, #cb2d3e, #ef473a)"
  }
};

// Decode IMD warning codes
function decodeWarnings(codeString) {
  if (!codeString || codeString === "0") {
    return "No Specific Warning";
  }

  return codeString
    .split(",")
    .map(code => WARNING_MAP[code.trim()] || `Weather Event ${code}`)
    .join(" & ");
}

// Safe date formatter
function formatDateSafe(dateStr) {
  if (!dateStr) return "Unknown date";

  const d = new Date(dateStr);

  if (isNaN(d)) return "Unknown date";

  return d.toLocaleDateString("en-GB");
}

// Get IST date object
function getISTDate() {
  const now = new Date();
  return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
}

// Main updater
async function updateMarqueeLive() {

  const marqueeTextEl = document.getElementById("marqueeText");
  const marqueeContainerEl = document.getElementById("marqueeContainer");

  try {

    const response = await fetch(WORKER_URL);

    if (!response.ok) {
      throw new Error("Network response failed");
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // -----------------------------
    // IMD DAY CALCULATION LOGIC
    // -----------------------------

    // IMD bulletin base date
    const baseDate = new Date(data.Date);

    // Today's IST date
    const todayIST = getISTDate();

    // Remove time
    baseDate.setHours(0, 0, 0, 0);
    todayIST.setHours(0, 0, 0, 0);

    // Difference in days
    let diffDays = Math.floor(
      (todayIST - baseDate) / (1000 * 60 * 60 * 24)
    );

    // Safety limits
    if (diffDays < 0) diffDays = 0;
    if (diffDays > 4) diffDays = 4;

    // Dynamic day selection
    const warningKey = `Day_${diffDays + 1}`;
    const colorKey = `Day${diffDays + 1}_Color`;

    // Selected warning + color
    const warningText = decodeWarnings(data[warningKey]);

    const colorId = data[colorKey];

    const colorInfo =
      COLOR_MAP[colorId] || {
        name: "Unknown",
        css: "#333"
      };

    // Today's display date
    const dateStr = todayIST.toLocaleDateString("en-GB");

    // -----------------------------
    // STATUS PREFIXES
    // -----------------------------

    const prefixParts = [];

    if (data.stale) {
      prefixParts.push("⚠️ Showing previous IMD bulletin.");
    }

    if (data.updating) {
      prefixParts.push("🔄 Updating latest IMD data...");
    }

    if (data.error_mode) {
      prefixParts.push("⚠️ Using backup data.");
    }

    const prefix =
      prefixParts.length
        ? prefixParts.join(" ") + " "
        : "";

    // -----------------------------
    // FINAL TEXT
    // -----------------------------

    marqueeTextEl.textContent =
      `${prefix}IMD Alert for Malappuram district ${dateStr}: ${colorInfo.name} ${warningText} | Last Updated: ${data.updated_at || "N/A"} | Source: India Meteorological Department (IMD)`;

    // Background color
    marqueeContainerEl.style.background = colorInfo.css;

    // -----------------------------
    // AUTO REFRESH
    // -----------------------------

    if (data.updating && !refreshScheduled) {

      refreshScheduled = true;

      setTimeout(() => {

        refreshScheduled = false;

        updateMarqueeLive();

      }, 30000);
    }

  } catch (error) {

    console.error("ELWOIC IMD Fetch Error:", error);

    marqueeTextEl.textContent =
      "⚠️ IMD Alert System currently unavailable. Please check official IMD channels.";

    marqueeContainerEl.style.background = "#222";
  }
}

// Initial load
document.addEventListener("DOMContentLoaded", updateMarqueeLive);
