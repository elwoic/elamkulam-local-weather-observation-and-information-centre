// imd-marquee.js
const alerts = {
  "2025-11-09": { text: "IMD Alert For Malappuram District: y" },
  "2025-11-10": { text: "IMD Alert For Malappuram District: y" },
  "2025-11-11": { text: "IMD Alert For Malappuram District: g" },
  "2025-11-12": { text: "IMD Alert For Malappuram District: g" },
  "2025-11-13": { text: "IMD Alert For Malappuram District: g" }
};

const lastUpdated = "2025-11-09 12:26 PM";

function updateMarquee(marqueeTextEl, marqueeContainerEl) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const bgColors = {
    green: "linear-gradient(90deg, #009900, #33cc33)",
    yellow: "linear-gradient(90deg, #ffcc00, #ffee33)",
    orange: "linear-gradient(90deg, #ff6600, #ff9933)",
    red: "linear-gradient(90deg, #cc0000, #ff3333)",
    default: "linear-gradient(90deg, #444, #888)"
  };

  const levelMap = {
    g: { color: "green", full: "Green" },
    y: { color: "yellow", full: "Yellow" },
    o: { color: "orange", full: "Orange" },
    r: { color: "red", full: "Red" }
  };

  if (alerts[todayKey]) {
    let alertText = alerts[todayKey].text;
    const shortCode = alertText.slice(-1).toLowerCase();
    const mapping = levelMap[shortCode] || { color: "default", full: "Unknown" };
    alertText = alertText.replace(/([oyrg])$/i, mapping.full);

    marqueeTextEl.textContent = `Today ${dd}/${mm}/${yyyy}, ${alertText}  |  Last Updated: ${lastUpdated}`;
    marqueeContainerEl.style.background = bgColors[mapping.color] || bgColors.default;
  } else {
    marqueeTextEl.textContent = `⚠️ Updated data unavailable for ${dd}/${mm}/${yyyy}.  |  Last Updated: ${lastUpdated}`;
    marqueeContainerEl.style.background = bgColors.default;
  }
}
