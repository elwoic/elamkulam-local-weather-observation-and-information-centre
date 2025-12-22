/* ============================================================
   ELWOIC — SMART AUTO UPDATE SYSTEM (fixed & more robust)
   - Normalizes dates to date-only (no time part / timezone safe)
   - Clear rules:
       1) If today === manualDate -> show manualText (blink)  
       2) Else if today === preDate    -> show preText in manual slot (blink)
       3) Else                        -> show default manual text (no blink)
   - Pre-update area shows preText while today < preDate, otherwise defaultPre
   ============================================================ */

/* ---------------------------
   Helper: create date-only timestamp (local)
   Returns a number (ms since epoch) for YYYY-MM-DD at local midnight
---------------------------- */
function dateOnlyTimestampFromDMY(ddmmyyyy) {
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return NaN;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  // Use local midnight to avoid timezone offsets
  return new Date(y, m, d).setHours(0, 0, 0, 0);
}

/* ---------------------------
   Config: User messages (edit these)
---------------------------- */
// Manual (message shown on the manual day)
const manualDate = "22/12/2025";
const manualText = "No manual updates";

// Pre-update (message for the next day)
const preDate = "23/12/2025";
const preText = "No manual updates";

/* ---------------------------
   Defaults
---------------------------- */
const defaultManual = "No manual updates available.";
const defaultPre = "No new pre-updates.";
const defaultInfo = "No additional information.";

/* ---------------------------
   Normalize today's date-only timestamp
---------------------------- */
const now = new Date();
const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

/* ---------------------------
   Convert configured dates to timestamps
---------------------------- */
const manualTs = dateOnlyTimestampFromDMY(manualDate);
const preTs = dateOnlyTimestampFromDMY(preDate);

/* ---------------------------
   Select HTML elements (IDs must exist)
---------------------------- */
const manualDiv = document.getElementById("weather-message");   // manual area
const preDiv = document.getElementById("preupdate-message");    // pre-update area
const infoDiv = document.getElementById("info-message");        // static info area

/* ============================================================
   Main logic
============================================================ */

// Safety: if parse failed, set defaults and log error
if (Number.isNaN(manualTs)) {
  console.error("Invalid manualDate format. Expected DD/MM/YYYY:", manualDate);
}
if (Number.isNaN(preTs)) {
  console.error("Invalid preDate format. Expected DD/MM/YYYY:", preDate);
}

/* 1) MANUAL area behavior:
   - If today === manualDate -> show manualText (blink)
   - Else if today === preDate -> show preText (blink)  // pre moves to manual once pre day arrives
   - Else -> show defaultManual (no blink)
*/
if (manualDiv) {
  if (!Number.isNaN(manualTs) && todayTs === manualTs) {
    manualDiv.innerHTML = manualText;
    manualDiv.classList.add("blink-alert");
  } else if (!Number.isNaN(preTs) && todayTs === preTs) {
    // On the pre day, promote the preText into the manual slot (as you wanted)
    manualDiv.innerHTML = preText;
    manualDiv.classList.add("blink-alert");
  } else {
    manualDiv.innerHTML = defaultManual;
    manualDiv.classList.remove("blink-alert");
  }
}

/* 2) PRE-UPDATE area behavior:
   - Show preText while TODAY < preDate (i.e., BEFORE the pre-day starts)
   - Once today >= preDate, hide/reset pre area
*/
if (preDiv) {
  if (!Number.isNaN(preTs) && todayTs < preTs) {
    preDiv.innerHTML = preText;
  } else {
    preDiv.innerHTML = defaultPre;
  }
}

/* 3) Static info area */
if (infoDiv) {
  infoDiv.innerHTML = defaultInfo;
}
/* ============================================================
   FINAL VISIBILITY CHECK — Hide section if no real content
============================================================ */

const manualSection = document.getElementById("manual-update");

if (manualSection && manualDiv && preDiv && infoDiv) {
  const manualTextFinal = manualDiv.textContent.trim();
  const preTextFinal = preDiv.textContent.trim();
  const infoTextFinal = infoDiv.textContent.trim();

  const isManualEmpty =
    manualTextFinal === "" || manualTextFinal === defaultManual;

  const isPreEmpty =
    preTextFinal === "" || preTextFinal === defaultPre;

  const isInfoEmpty =
    infoTextFinal === "" || infoTextFinal === defaultInfo;

  // If ALL sections are effectively empty → hide whole notice box
  if (isManualEmpty && isPreEmpty && isInfoEmpty) {
    manualSection.style.display = "none";
  }
}

/* Optional debug output in console for testing */
console.debug("today:", new Date(todayTs).toDateString(),
              "manual:", manualDate, new Date(manualTs).toDateString(),
              "pre:", preDate, new Date(preTs).toDateString());
