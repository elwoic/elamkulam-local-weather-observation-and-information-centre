document.addEventListener("DOMContentLoaded", () => {
  const panel    = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl    = document.getElementById("alert-pre");
  const infoEl   = document.getElementById("alert-info");
  const timeEl   = document.getElementById("alert-timestamp");

  // Same unified worker the admin console talks to.
  const WORKER_URL = "https://elwoic-unified-manual-updates.bold-waterfall-0d01.workers.dev";

  /* ── IMMEDIATE LOADING STATE ── */
  const loadingHtml = `
    <div class="loading-text">
      <div class="spinner-wrapper">
        <div class="spinner-ring"></div>
        <div class="spinner-dot"></div>
      </div>
      <span>Connecting to database...</span>
    </div>`;

  if (panel) {
    panel.style.display = "block";
    if (manualEl) manualEl.innerHTML = loadingHtml;
    if (preEl)    preEl.innerHTML    = loadingHtml;
    if (infoEl)   infoEl.innerHTML   = loadingHtml;
  }

  // Fetch the resolved, already-stacked, already-time-filtered blocks
  // for one destination. The worker only returns blocks that are
  // status:'active' AND within their visible_from/expires_at window —
  // no date math needed here anymore.
  async function fetchDestination(destinationKey) {
    const res = await fetch(`${WORKER_URL}/api/blocks?destination=${destinationKey}`);
    if (!res.ok) throw new Error(`Failed to load ${destinationKey}`);
    return res.json(); // [{ id, text, blink, created_at }, ...]  (may be empty array)
  }

  function renderStacked(el, blocks, emptyText, color) {
    if (!el) return { active: false, blink: false, latest: 0 };
    el.classList.remove("blink");

    if (!blocks || blocks.length === 0) {
      el.textContent = emptyText;
      el.style.color = "";
      return { active: false, blink: false, latest: 0 };
    }

    // Multiple blocks can be active for the same destination at once —
    // show every one of them, stacked, rather than picking just one.
    el.innerHTML = blocks
      .map(b => `<div class="alert-line">${escapeHtml(b.text)}</div>`)
      .join("");
    el.style.color = color;

    const anyBlink = blocks.some(b => b.blink === true);
    if (anyBlink) el.classList.add("blink");

    const latest = Math.max(...blocks.map(b => b.created_at || 0));
    return { active: true, blink: anyBlink, latest };
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  async function fetchLiveAlerts() {
    try {
      const [manualBlocks, preBlocks, infoBlocks] = await Promise.all([
        fetchDestination("manual_update"),
        fetchDestination("pre_update"),
        fetchDestination("info"),
      ]);

      const manualResult = renderStacked(manualEl, manualBlocks, "No updates available at this time", "red");
      const preResult    = renderStacked(preEl, preBlocks, "No updates scheduled", "#f1c40f");
      const infoResult   = renderStacked(infoEl, infoBlocks, "No general information", "");

      const activeUpdatesCount =
        (manualResult.active ? 1 : 0) + (preResult.active ? 1 : 0) + (infoResult.active ? 1 : 0);

      if (timeEl) {
        const latest = Math.max(manualResult.latest, preResult.latest, infoResult.latest, 0);
        timeEl.textContent = latest ? "Last updated: " + new Date(latest).toLocaleString() : "";
      }

      // Hide panel completely ONLY if there are exactly 0 active sections
      if (panel) {
        panel.style.display = (activeUpdatesCount > 0) ? "block" : "none";
      }
    } catch (error) {
      console.error("ELWOIC Database Fetch Error:", error);
      if (manualEl) manualEl.textContent = "Unable to load critical alerts.";
      if (preEl) preEl.textContent = "Failed to sync updates.";
      if (infoEl) infoEl.textContent = "Service momentarily unreachable.";
    }
  }

  // Execute on page spin-up
  fetchLiveAlerts();
});
