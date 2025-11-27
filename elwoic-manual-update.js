/* ============================================================
   ELWOIC — SMART AUTO UPDATE SYSTEM
   Manual = today's message only
   Pre-update = tomorrow's message (moves to manual after midnight)
   ============================================================ */


/* ---------------------------
   0. Helper: Convert DD/MM/YYYY
---------------------------- */
function parseDate(ddmmyyyy) {
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d);  // midnight of that day
}


/* ---------------------------
   1. User writes messages HERE
---------------------------- */

// Message for a specific day
const manualDate = "25/11/2025";       // Manual update day
const manualText = "No manual updates. Site under developement.";

// Pre-update: message for the tomorrow
const preDate = "26/11/2025";          // Tomorrow's date
const preText = "No manual updates. Site under valuation";


/* ---------------------------
   2. Default messages
---------------------------- */
const defaultManual = "No manual updates available.";
const defaultPre = "No new pre-updates.";
const defaultInfo = "No additional information.";


/* ---------------------------
   3. Convert dates
---------------------------- */
const today = new Date();
today.setHours(0,0,0,0);  // remove time part

const manualDay = parseDate(manualDate);
const preDay = parseDate(preDate);



/* ---------------------------
   4. Select HTML IDs
---------------------------- */
const manualDiv = document.getElementById("weather-message");
const preDiv = document.getElementById("preupdate-message");
const infoDiv = document.getElementById("info-message");


/* ============================================================
   5. MAIN LOGIC
============================================================ */
if (manualDiv) {

    // Case A — TODAY = manual day
    if (today.getTime() === manualDay.getTime()) {
        manualDiv.innerHTML = manualText;
        manualDiv.classList.add("blink-alert"); // blinking OK
    }

    // Case B — TODAY = pre-update day → pre becomes manual
    else if (today.getTime() === preDay.getTime()) {
        manualDiv.innerHTML = preText;
        manualDiv.classList.add("blink-alert"); // blinking FIXED
    }

    // Case C — Default day
    else {
        manualDiv.innerHTML = defaultManual;
        manualDiv.classList.remove("blink-alert"); // prevent red/blink FIXED
    }
}




/* ============================================================
   6. PRE-UPDATE DISPLAY
   - Show pre only BEFORE its day starts
   - Hide pre once that day arrives
   ============================================================ */

if (preDiv) {

    // Before the pre-update day → show tomorrow's info
    if (today.getTime() < preDay.getTime()) {
        preDiv.innerHTML = preText;

    // On or after pre-update day → reset
    } else {
        preDiv.innerHTML = defaultPre;
    }
}

// Remove blink class when today is after the pre-day
if (today.getTime() > preDay.getTime()) {
    manualDiv.classList.remove("blink-alert");
}


/* ============================================================
   7. INFORMATION SECTION (Static)
 ============================================================ */
if (infoDiv) {
    infoDiv.innerHTML = defaultInfo;
}
