// --- Configuration ---
const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

// Mapping IMD Numerical Codes to readable English text
const WARNING_MAP = {
  "1": "Wind",
  "2": "Heat Wave",
  "4": "Thunderstorm & Lightning",
  "8": "Dust Storm",
  "10": "Heavy Rain",
  "12": "Very Heavy Rain",
  "16": "Extremely Heavy Rain"
  // Add more if you see other codes in the API
};

const COLOR_MAP = {
  "1": { name: "Green", css: "linear-gradient(90deg, #009900, #33cc33)" },
  "2": { name: "Yellow", css: "linear-gradient(90deg, #ffcc00, #ffee33)" },
  "3": { name: "Orange", css: "linear-gradient(90deg, #ff6600, #ff9933)" },
  "4": { name: "Red", css: "linear-gradient(90deg, #cc0000, #ff3333)" }
};

// Function to decode "4,10" into "Thunderstorm & Lightning, Heavy Rain"
function decodeWarnings(codeString) {
  if (!codeString || codeString === "0") return "No Specific Warning";
  return codeString.split(',')
    .map(code => WARNING_MAP[code.trim()] || `Warning ${code}`)
    .join(" & ");
}

async function updateMarqueeLive(marqueeTextEl, marqueeContainerEl) {
  try {
    const response = await fetch(WORKER_URL);
    if (!response.ok) throw new Error("Worker Error");
    
    const data = await response.json();

    // 1. Get the alert level and colors
    const colorId = data.Day1_Color;
    const colorInfo = COLOR_MAP[colorId] || { name: "Unknown", css: "linear-gradient(90deg, #444, #888)" };

    // 2. Decode the warning types (e.g., "4,10")
    const warningText = decodeWarnings(data.Day_1);

    // 3. Format Date
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB'); // Format: DD/MM/YYYY

    // 4. Update Marquee UI with Source Credit
    // Added "Source: India Meteorological Department (IMD)" at the end
    marqueeTextEl.textContent = `IMD Alert for Malappuram District ${dateStr}: ${colorInfo.name} Alert - ${warningText} | Last Updated: ${data.updated_at} | Source: India Meteorological Department (IMD)`;
    marqueeContainerEl.style.background = colorInfo.css;

  } catch (error) {
    console.error("Marquee Fetch Failed:", error);
    marqueeTextEl.textContent = "⚠️ Weather alert system temporarily unavailable. | Source: IMD";
    marqueeContainerEl.style.background = "linear-gradient(90deg, #333, #555)";
  }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    const marqueeTextEl = document.getElementById("marqueeText");
    const marqueeContainerEl = document.getElementById("marqueeContainer");

    if (marqueeTextEl && marqueeContainerEl) {
        // Show a loading message while the bridge wakes up
        marqueeTextEl.textContent = "Fetching latest IMD weather alerts...";
        updateMarqueeLive(marqueeTextEl, marqueeContainerEl);
    }
});
