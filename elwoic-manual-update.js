// =============================================
//        ELWOIC AUTOMATIC UPDATE SYSTEM
//  Updated: Includes default text + headings
// =============================================

// Current date/time
const today = new Date();

/* ==================================================
    🌦️ MANUAL UPDATE SECTION — Shows ONLY if today 
       matches the configured manual update date
================================================== */

const manualDate = new Date("2026-1-30T24:00:00");

// Write here your manual update text (or leave empty)
const manualMessage =
    "No manual updates available, site under checking";

const defaultManual =
    "No manual updates available. Check live updates on ELWOIC.";

// Target paragraph
const manualDiv = document.getElementById("weather-message");

if (today.toDateString() === manualDate.toDateString()) {
    manualDiv.innerHTML = manualMessage.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    manualDiv.style.color = "red";

    // Flash effect
    const flash = document.createElement("style");
    flash.innerHTML = `
        @keyframes flash {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.2; }
        }
    `;
    document.head.appendChild(flash);

    manualDiv.style.animation = "flash 1s infinite";
} else {
    manualDiv.innerText = defaultManual;
    manualDiv.style.color = "#333";
    manualDiv.style.animation = "none";
}

/* ==================================================
    🌤️ PRE-UPDATE SECTION — Visible UNTIL set date
================================================== */

const preUpdateEnd = new Date("2025-11-23T24:00:00");

// Write here your pre-update text (or leave empty)
const preUpdateMessage =
    "No pre updates, site under cheking";

// Default if empty or expired
const defaultPre = "No new pre-updates available at the moment.";

const preDiv = document.getElementById("preupdate-message");

if (today < preUpdateEnd && preUpdateMessage.trim() !== "") {
    preDiv.innerText = preUpdateMessage;
    preDiv.style.color = "#cc9900";
} else {
    preDiv.innerText = defaultPre;
    preDiv.style.color = "#999";
}

/* ==================================================
    💧 REGULAR INFORMATION SECTION
================================================== */

const infoMessage =
    "This section holds supplementary information about the observation center.";

const defaultInfo = "No additional information available at this moment.";

const infoDiv = document.getElementById("info-message");

// Use provided infoMessage or fallback
infoDiv.innerText =
    infoMessage.trim() !== "" ? infoMessage : defaultInfo;

infoDiv.style.color = "#555";

