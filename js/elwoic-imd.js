/**
 * ELWOIC Unified Weather Monitoring Script
 * Handles Static Marquee, Live Nowcast Ticker, and 5-Day IMD Warnings via a single Worker request.
 */

(function () {
  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

  // Polling Intervals (in milliseconds)
  const NORMAL_POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes for normal refresh
  const RETRY_POLL_INTERVAL = 3 * 60 * 1000;   // 3 minutes when waiting for bulletin updates

  let pollTimer = null;
  let cachedImdData = null;

  // --- MAPPINGS & LOOKUPS ---

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

  const COLOR_META = {
    "1": { name: "Red alert — Take action",    hex: "#ef4444", dot: "dot-5" },
    "2": { name: "Orange alert — Be prepared", hex: "#f97316", dot: "dot-4" },
    "3": { name: "Yellow alert — Be aware",    hex: "#eab308", dot: "dot-3" },
    "4": { name: "Green — No warning",         hex: "#22c55e", dot: "dot-1" }
  };

  const IMD_CATEGORIES = {
    1: "No Severe Weather",
    2: "Light Rain (< 5 mm/hr)",
    3: "Light Snow (< 5 cm/hr)",
    4: "Light Thunderstorms (Wind < 40 kmph)",
    5: "Slight Dust Storm",
    6: "Low Lightning Probability (< 30%)",
    7: "Moderate Rain (5-15 mm/hr)",
    8: "Moderate Snow (5-15 cm/hr)",
    9: "Moderate Thunderstorms (Wind 41-61 kmph)",
    10: "Moderate Dust Storm",
    11: "Moderate Lightning Probability (30-60%)",
    12: "Heavy Rain (> 15 mm/hr)",
    13: "Heavy Snow (> 15 cm/hr)",
    14: "Severe Thunderstorms (Wind 62-87 kmph)",
    15: "Very Severe Thunderstorms (Wind > 87 kmph)",
    17: "Thunderstorms with Hail",
    18: "Severe Dust Storm (Wind > 61 kmph)",
    19: "High Lightning Probability (> 60%)"
  };

  // --- HELPER FUNCTIONS ---

  function decodeWarnings(codeStr) {
    if (!codeStr || codeStr === "0") return ["No specific warning"];
    return codeStr.split(",").map(c => WARNING_MAP[c.trim()] || ("Weather event " + c.trim()));
  }

  function getISTDate() {
    const s = new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit"
    });
    return new Date(s);
  }

  function offsetDate(baseDate, days) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function isNowcastExpired(nowcast, validUntilMs) {
    if (validUntilMs && Date.now() > validUntilMs) return true;
    if (nowcast && nowcast.vupto && nowcast.vupto.length >= 4) {
      const now = new Date();
      const istNow = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
      const currentHHMM = (istNow.getHours() * 100) + istNow.getMinutes();
      const vuptoHHMM = parseInt(nowcast.vupto, 10);
      if (nowcast.toi && parseInt(nowcast.toi, 10) <= vuptoHHMM) {
        if (currentHHMM > vuptoHHMM) return true;
      }
    }
    return false;
  }

  function scheduleNextFetch(ms) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(syncWeatherData, ms);
  }

  // --- UI RENDER MODULES ---

  // 1. Static Marquee Setup (No API network requests)
  function initStaticMarquee() {
    const marqueeTextEl = document.getElementById("marqueeText");
    const marqueeContainerEl = document.getElementById("marqueeContainer");
    if (marqueeTextEl && marqueeContainerEl) {
      marqueeTextEl.textContent = "Welcome to the Elamkulam Local Weather Observation & Information Centre (ELWOIC).";
      marqueeContainerEl.style.background = "#222";
    }
  }

  // 2. Nowcast Ticker Render
  function renderNowcastUI(data) {
    const container = document.getElementById("nowcast-container");
    const ticker = document.getElementById("nowcast-ticker");
    if (!container || !ticker) return;

    if (data && data.nowcast) {
      const textElements = [];

      for (let i = 1; i <= 19; i++) {
        if (i === 16) continue;
        const catValue = data.nowcast[`cat${i}`];
        if (catValue && catValue !== "0" && catValue !== 0) {
          textElements.push(IMD_CATEGORIES[i].toUpperCase());
        }
      }

      if (data.nowcast.cat16 && data.nowcast.cat16 !== "0") {
        textElements.push(data.nowcast.cat16.toUpperCase());
      }
      if (data.nowcast.message && data.nowcast.message !== "0") {
        textElements.push(data.nowcast.message.toUpperCase());
      }

      let tickerText = textElements.join(" | ") || "ACTIVE NOWCAST ALERT ISSUED";

      if (data.nowcast.toi && data.nowcast.vupto) {
        const formatTime = (t) => `${t.substring(0, 2)}:${t.substring(2)}`;
        tickerText += ` (VALID: ${formatTime(data.nowcast.toi)} TO ${formatTime(data.nowcast.vupto)} IST)`;
      }

      const alertColor = data.nowcast.color_name ? data.nowcast.color_name.toUpperCase() : "UNKNOWN";
      const expired = data.is_expired || isNowcastExpired(data.nowcast, data.valid_until_ms);

      if (expired || data.cache_status === "EXPIRED_STALE_UPDATING") {
        ticker.innerText = `🇮🇳 IMD NOWCAST (${alertColor} ALERT) [EXPIRED - UPDATING...]: ${tickerText}`;
      } else {
        ticker.innerText = `🇮🇳 IMD NOWCAST (${alertColor} ALERT): ${tickerText}`;
      }

      container.className = "nowcast-marquee-container";
      container.classList.add(`nowcast-color-${data.nowcast.color_name}`);
      container.style.display = "flex";
    } else {
      container.style.display = "none";
    }
  }

  // 3. IMD 5-Day Warnings Render
  function renderDailyWarningsUI(data) {
    const daysContainer = document.getElementById("imdDays");
    const upEl = document.getElementById("imdUpdatedAt");
    const statusEl = document.getElementById("imdStatusBar");

    if (!daysContainer) return;

    cachedImdData = data;

    if (upEl) {
      upEl.textContent = "System updated: " + (data.updated_at || "N/A");
    }

    const todayIST = getISTDate();
    const base = new Date(data.Date);
    base.setHours(0, 0, 0, 0);

    let diff = Math.round((todayIST - base) / 86400000);
    if (diff < 0) diff = 0;
    if (diff > 4) diff = 4;

    renderDaysTab(diff);

    if (statusEl) {
      const parts = [];
      if (data.stale) parts.push("⚠ Showing previous bulletin");
      if (data.updating) parts.push("🔄 Updating latest data...");
      if (data.error_mode) parts.push("⚠ Using backup data");
      if (data.is_cached) parts.push("Served from cache · " + (data.fetch_period || ""));

      if (parts.length) {
        statusEl.style.display = "block";
        statusEl.textContent = parts.join("  ·  ");
      } else {
        statusEl.style.display = "none";
      }
    }
  }

  function renderDaysTab(todayDiff) {
    const container = document.getElementById("imdDays");
    if (!container || !cachedImdData) return;

    let html = "";
    const base = new Date(cachedImdData.Date);
    base.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      const colorId = cachedImdData["Day" + (i + 1) + "_Color"] || "4";
      const meta = COLOR_META[colorId] || { dot: "dot-x", hex: "#888" };
      const isToday = i === todayDiff;
      const isActive = isToday ? "active" : "";
      const labelClass = isToday ? "imd-day-label today" : "imd-day-label";
      const labelText = isToday ? "Today" : offsetDate(base, i);

      html += `<button class="imd-day-btn ${isActive}" role="tab" aria-selected="${isToday}" data-day="${i}" onclick="window._imdSelect(${i})">
        <span class="${labelClass}">${labelText}</span>
        <div class="imd-color-dot ${meta.dot}"></div>
        <span class="imd-day-date">${offsetDate(base, i)}</span>
      </button>`;
    }

    container.innerHTML = html;
    renderDetail(todayDiff);
  }

  function renderDetail(i) {
    const detail = document.getElementById("imdDetail");
    if (!detail || !cachedImdData) return;

    const colorId = cachedImdData["Day" + (i + 1) + "_Color"] || "4";
    const meta = COLOR_META[colorId] || { name: "Unknown", hex: "#888", dot: "dot-x" };
    const warnings = decodeWarnings(cachedImdData["Day_" + (i + 1)]);
    const base = new Date(cachedImdData.Date);
    base.setHours(0, 0, 0, 0);
    const dateLabel = offsetDate(base, i);

    const tags = warnings.map(w => `<span class="imd-warning-tag">${w}</span>`).join("");

    detail.innerHTML = `
      <div class="imd-detail-top">
        <div class="imd-alert-dot" style="background:${meta.hex};"></div>
        <span class="imd-alert-name">${meta.name}</span>
        <span class="imd-alert-date">${dateLabel}</span>
      </div>
      <div class="imd-warning-tags">${tags}</div>`;
  }

  // Global tab selection binding
  window._imdSelect = function (i) {
    document.querySelectorAll(".imd-day-btn").forEach((btn, idx) => {
      btn.classList.toggle("active", idx === i);
      btn.setAttribute("aria-selected", idx === i);
    });
    renderDetail(i);
  };

  // --- CENTRALIZED FETCH HANDLER ---

  async function syncWeatherData() {
    try {
      const response = await fetch(WORKER_URL);
      if (!response.ok) throw new Error("Worker network response was not ok");

      const data = await response.json();

      // Render all components from the single payload
      renderNowcastUI(data);
      renderDailyWarningsUI(data);

      const isExpired = data.is_expired || isNowcastExpired(data.nowcast, data.valid_until_ms);
      const isUpdating = data.updating || data.cache_status === "EXPIRED_STALE_UPDATING";

      if (isExpired || isUpdating) {
        // Poll every 3 minutes while expecting an update
        scheduleNextFetch(RETRY_POLL_INTERVAL);
      } else {
        // Normal 10-minute refresh cycle
        scheduleNextFetch(NORMAL_POLL_INTERVAL);
      }

    } catch (error) {
      console.error("ELWOIC Weather Sync Error:", error);

      const daysEl = document.getElementById("imdDays");
      if (daysEl) {
        daysEl.innerHTML = '<div class="imd-loading-row">⚠ Could not load IMD data. Please check official IMD channels.</div>';
      }

      scheduleNextFetch(RETRY_POLL_INTERVAL);
    }
  }

  // --- INITIALIZATION ---

  document.addEventListener("DOMContentLoaded", () => {
    initStaticMarquee();
    syncWeatherData();
  });

})();
