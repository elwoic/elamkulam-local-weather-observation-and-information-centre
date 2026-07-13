// js/logbook-widget.js
// Pulls the human-verified "Station Logbook" reports (published via the
// ELWOIC admin console) into the "എലങ്കുളം കാലാവസ്ഥാ സമഗ്ര റിപ്പോർട്ട്" hub
// on Forecast.html, alongside the AI-generated essay from elamkulam-forecast.js.
//
// Data source: same Worker API used by the standalone public archive page.
// This script does NOT replace that standalone page — it links out to it
// (via ARCHIVE_PAGE below) for the full letterhead / printable document.

(function () {
  "use strict";

  const API_BASE_URL = "https://elwoic-weather-diary-api.bold-waterfall-0d01.workers.dev";

  // Filename of the standalone printable "Public Logbook Archive" page.
  // Update this if that page is hosted under a different name/path.
  const ARCHIVE_PAGE = "logbook.html";

  let reportsCache = {};
  let sortedPublished = [];

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(s) {
    return s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
  }

  // ---------------- Tab switching (shared by both tabs) ----------------
  window.switchReportTab = function (which) {
    const autoBtn = document.getElementById("tab-btn-auto");
    const logBtn = document.getElementById("tab-btn-logbook");
    const autoPanel = document.getElementById("panel-auto");
    const logPanel = document.getElementById("panel-logbook");
    if (!autoBtn || !logBtn || !autoPanel || !logPanel) return;

    const showAuto = which === "auto";
    autoBtn.classList.toggle("active", showAuto);
    logBtn.classList.toggle("active", !showAuto);
    autoBtn.setAttribute("aria-selected", String(showAuto));
    logBtn.setAttribute("aria-selected", String(!showAuto));
    autoPanel.classList.toggle("active", showAuto);
    logPanel.classList.toggle("active", !showAuto);
  };

  // ---------------- Fetch + render ----------------
  async function init() {
    const select = document.getElementById("logbook-select");
    if (!select) return; // markup not present on this page

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports`);
      if (!res.ok) throw new Error("logbook fetch failed: " + res.status);
      const data = await res.json();
      reportsCache = data || {};

      sortedPublished = Object.values(reportsCache)
        .filter((r) => r && r.status === "published")
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.report_id || "").localeCompare(a.report_id || ""));

      if (!sortedPublished.length) {
        showEmptyState(false);
        return;
      }

      select.innerHTML = sortedPublished
        .map((r) => `<option value="${escapeHtml(r.report_id)}">${escapeHtml(r.date)} — ${escapeHtml(r.report_id)}</option>`)
        .join("");

      const badge = document.getElementById("logbook-tab-badge");
      if (badge) {
        badge.style.display = "inline-flex";
        badge.textContent = String(sortedPublished.length);
      }

      renderLogbookEntry(sortedPublished[0].report_id);
      renderVerifyBanner();
    } catch (e) {
      console.warn("logbook-widget: fetch error", e);
      showEmptyState(true);
    }
  }

  function showEmptyState(isError) {
    const select = document.getElementById("logbook-select");
    const body = document.getElementById("logbook-body");
    if (select) select.innerHTML = `<option value="">ലഭ്യമല്ല</option>`;
    if (body) {
      body.innerHTML = `
        <div class="logbook-empty">
          <div class="logbook-empty-icon">🗄️</div>
          <div class="logbook-empty-title">${isError ? "ലോഗ്ബുക്ക് ലഭ്യമാക്കാൻ കഴിഞ്ഞില്ല" : "ലോഗ്ബുക്ക് റിപ്പോർട്ടുകൾ നിലവിൽ ലഭ്യമല്ല"}</div>
          <div class="logbook-empty-text">
            ഈ വിഭാഗത്തിൽ പബ്ലിഷ് ചെയ്ത ഔദ്യോഗിക നിരീക്ഷണ രേഖകൾ ഇപ്പോൾ ലഭ്യമല്ല അല്ലെങ്കിൽ ലഭ്യമാക്കിയവ പിൻവലിച്ചിരിക്കുന്നു.
            കൂടുതൽ വിവരങ്ങൾക്ക് ബന്ധപ്പെടുക:
          </div>
          <div class="logbook-empty-phone">📞 04933 316 750</div>
        </div>`;
    }
    const banner = document.getElementById("verify-banner");
    if (banner) banner.style.display = "none";
  }

  function logbookSection(title, text) {
    if (!text) return "";
    return `
      <div class="logbook-section">
        <h4>${title}</h4>
        <p>${escapeHtml(text)}</p>
      </div>`;
  }

  window.renderLogbookEntry = function (reportId) {
    const r = sortedPublished.find((x) => x.report_id === reportId) || reportsCache[reportId];
    const body = document.getElementById("logbook-body");
    if (!body) return;
    if (!r) {
      showEmptyState(false);
      return;
    }
    const c = r.content || {};

    body.innerHTML = `
      <div class="logbook-meta-row">
        <span class="logbook-badge verified">✅ മനുഷ്യ പരിശോധിച്ചത്</span>
        <span class="logbook-meta-item">നിരീക്ഷകൻ: <strong>${escapeHtml(r.observer || "സ്റ്റേഷൻ ഡ്യൂട്ടി ഓഫീസർ")}</strong></span>
        <span class="logbook-meta-item">ID: <strong>${escapeHtml(r.report_id)}</strong></span>
        <span class="logbook-meta-item">തീയതി: <strong>${escapeHtml(r.date)}</strong></span>
      </div>

      ${logbookSection("🔮 പ്രവചനം (Issued Forecast)", c.forecast)}
      ${logbookSection("☁️ യഥാർത്ഥ കാലാവസ്ഥ (Actual Weather)", c.actual_weather)}
      ${logbookSection("✔️ പ്രവചന വിലയിരുത്തൽ (Verification)", c.verification)}
      ${logbookSection("📐 ശ്രദ്ധേയമായ മാറ്റങ്ങൾ (Deviations)", c.deviations)}
      ${logbookSection("👁 അധിക നിരീക്ഷണങ്ങൾ (Human Observations)", c.additional_obs)}
      ${logbookSection("⏭ അടുത്ത മണിക്കൂറുകൾ (Outlook)", c.outlook)}

      <div class="logbook-actions">
        <a class="btn-logbook-full" href="${ARCHIVE_PAGE}?id=${encodeURIComponent(r.report_id)}" target="_blank" rel="noopener">
          📄 പൂർണ്ണ ഔദ്യോഗിക രേഖ / പ്രിന്റ് →
        </a>
      </div>
    `;
  };

  function renderVerifyBanner() {
    const banner = document.getElementById("verify-banner");
    if (!banner) return;
    const today = sortedPublished.find((r) => r.date === todayKey());
    if (today) {
      banner.style.display = "flex";
    } else {
      banner.style.display = "none";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
