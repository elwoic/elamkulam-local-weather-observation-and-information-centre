/**
 * ELWOIC Unified Weather Monitoring Script
 *
 * ONE request to the IMD worker drives every IMD element on the site:
 *   1. Daily IMD Warning Marquee      (#marqueeContainer / #marqueeText)
 *   2. Live Nowcast Ticker            (#nowcast-container / #nowcast-ticker)
 *   3. 5-Day IMD warnings + district map (Forecast page: #imdDays, #imdDetail,
 *      #districtMap …). If a page still has the OLD 5-day box (no #districtMap)
 *      the old tab renderer is used, so nothing that worked before breaks.
 *
 * Every renderer checks that its elements exist first, so the same file is
 * safe to load on any page (shell, forecast, etc.).
 *
 * Polling: 10 min normally, 3 min while the bulletin/nowcast is updating.
 */

(function () {
  "use strict";

  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

  const NORMAL_POLL_INTERVAL = 10 * 60 * 1000;
  const RETRY_POLL_INTERVAL = 3 * 60 * 1000;

  // The worker's CORS policy only allows elwoic.in. Preview data is shown
  // ONLY when the page is opened somewhere else (e.g. an online editor), never
  // on the real site — so residents can never see made-up alerts.
  const IS_LIVE_HOST = /(^|\.)elwoic\.in$/i.test(window.location.hostname);

  let pollTimer = null;
  let cachedImdData = null;   // latest worker payload
  let forecastData = null;    // same payload, used by the map renderer
  let selectedDay = 0;
  let userPickedDay = null;   // keeps the viewer's chosen day across refreshes

  // --- MAPPINGS & LOOKUPS ---

  const WARNING_MAP = {
    "1":  "No Warning", "2":  "Heavy Rain", "3":  "Heavy Snow",
    "4":  "Thunderstorm & Lightning", "5":  "Hailstorm", "6":  "Dust Storm",
    "7":  "Dust Raising Winds", "8":  "Strong Surface Winds", "9":  "Heat Wave",
    "10": "Hot Day", "11": "Warm Night", "12": "Cold Wave",
    "13": "Cold Day", "14": "Ground Frost", "15": "Fog",
    "16": "Very Heavy Rain", "17": "Extremely Heavy Rain"
  };

  // Daily marquee backgrounds
  const MARQUEE_COLOR_MAP = {
    "1": { name: "Red alert (Take Action)",    css: "linear-gradient(90deg, #cb2d3e, #ef473a)" },
    "2": { name: "Orange alert (Be Prepared)", css: "linear-gradient(90deg, #f46b45, #eea849)" },
    "3": { name: "Yellow alert (Be Aware)",    css: "linear-gradient(90deg, #f7971e, #ffd200)" },
    "4": { name: "Green (No Warning)",         css: "linear-gradient(90deg, #1d976c, #93f9b9)" }
  };

  // Legacy 5-day box (old markup)
  const COLOR_META = {
    "1": { name: "Red alert — Take action",    hex: "#ef4444", dot: "dot-5" },
    "2": { name: "Orange alert — Be prepared", hex: "#f97316", dot: "dot-4" },
    "3": { name: "Yellow alert — Be aware",    hex: "#eab308", dot: "dot-3" },
    "4": { name: "Green — No warning",         hex: "#22c55e", dot: "dot-1" }
  };

  // New map section
  const MAP_ALERTS = {
    "1": { name: "Red alert — Take action",    shortName: "Red alert",    className: "alert-red" },
    "2": { name: "Orange alert — Be prepared", shortName: "Orange alert", className: "alert-orange" },
    "3": { name: "Yellow alert — Be aware",    shortName: "Yellow alert", className: "alert-yellow" },
    "4": { name: "Green — No warning",         shortName: "No warning",   className: "alert-green" }
  };

  const ALERT_CLASSES = ["alert-red", "alert-orange", "alert-yellow", "alert-green"];

  const IMD_CATEGORIES = {
    1: "No Severe Weather", 2: "Light Rain (< 5 mm/hr)", 3: "Light Snow (< 5 cm/hr)",
    4: "Light Thunderstorms (Wind < 40 kmph)", 5: "Slight Dust Storm",
    6: "Low Lightning Probability (< 30%)", 7: "Moderate Rain (5-15 mm/hr)",
    8: "Moderate Snow (5-15 cm/hr)", 9: "Moderate Thunderstorms (Wind 41-61 kmph)",
    10: "Moderate Dust Storm", 11: "Moderate Lightning Probability (30-60%)",
    12: "Heavy Rain (> 15 mm/hr)", 13: "Heavy Snow (> 15 cm/hr)",
    14: "Severe Thunderstorms (Wind 62-87 kmph)", 15: "Very Severe Thunderstorms (Wind > 87 kmph)",
    17: "Thunderstorms with Hail", 18: "Severe Dust Storm (Wind > 61 kmph)",
    19: "High Lightning Probability (> 60%)"
  };

  // --- HELPER FUNCTIONS ---

  function decodeWarnings(codeStr) {
    if (!codeStr || codeStr === "0") return ["No specific warning"];
    return String(codeStr).split(",").map(c => WARNING_MAP[c.trim()] || ("Weather event " + c.trim()));
  }

  function getISTDate() {
    const s = new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit"
    });
    return new Date(s);
  }

  // "YYYY-MM-DD" -> local midnight (avoids the UTC shift of new Date("YYYY-MM-DD"))
  function parseBaseDate(dateString) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString || "");
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(baseDate, days) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    return d;
  }

  function offsetDate(baseDate, days) {
    return addDays(baseDate, days).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  // Which of the 5 forecast days is "today" in IST (bulletin may be a day old)
  function getTodayDiff(data) {
    const base = parseBaseDate(data.Date);
    let diff = Math.round((getISTDate() - base) / 86400000);
    if (isNaN(diff) || diff < 0) diff = 0;
    if (diff > 4) diff = 4;
    return diff;
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

  // =====================================================================
  // 1. DAILY IMD MARQUEE
  // =====================================================================
  function renderDailyMarqueeUI(data) {
    const marqueeTextEl = document.getElementById("marqueeText");
    const marqueeContainerEl = document.getElementById("marqueeContainer");
    if (!marqueeTextEl || !marqueeContainerEl) return;

    const todayIST = getISTDate();
    const dateStr = todayIST.toLocaleDateString("en-GB");

    const warningText = decodeWarnings(data["Day_1"]).join(" & ");
    const colorId = data["Day1_Color"] || "4";
    const colorInfo = MARQUEE_COLOR_MAP[colorId] || { name: "Unknown", css: "#333" };

    const prefixParts = [];
    if (data.stale)      prefixParts.push("⚠️ Showing previous IMD bulletin.");
    if (data.updating)   prefixParts.push("🔄 Updating latest IMD data...");
    if (data.error_mode) prefixParts.push("⚠️ Using backup data.");
    const prefix = prefixParts.length ? prefixParts.join(" ") + " " : "";

    marqueeTextEl.textContent = `${prefix}IMD Alert for Malappuram district ${dateStr}: ${colorInfo.name} — ${warningText} | Last Updated: ${data.updated_at || "N/A"} | Source: India Meteorological Department (IMD)`;
    marqueeContainerEl.style.background = colorInfo.css;
  }

  // =====================================================================
  // 2. NOWCAST TICKER
  // =====================================================================
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

  // =====================================================================
  // 3a. 5-DAY WARNINGS — NEW DISTRICT MAP SECTION (Forecast page)
  // =====================================================================
  function formatDate(date, compact) {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: compact ? undefined : "long",
      day: "numeric",
      month: "short"
    }).format(date);
  }

  function mapDayData(index) {
    const number = index + 1;
    const colorId = forecastData["Day" + number + "_Color"] || "4";
    return {
      index: index,
      date: addDays(parseBaseDate(forecastData.Date), index),
      alert: MAP_ALERTS[colorId] || MAP_ALERTS["4"],
      warnings: decodeWarnings(forecastData["Day_" + number])
    };
  }

  // className === null -> neutral (no alert colour)
  function setAlertClass(element, className) {
    if (!element) return;
    ALERT_CLASSES.forEach(function (c) { element.classList.remove(c); });
    if (className) element.classList.add(className);
  }

  function renderMapDayControls() {
    const tabs = document.getElementById("imdDays");
    const switcher = document.getElementById("mapDaySwitcher");
    if (!tabs || !switcher) return;

    const todayDiff = getTodayDiff(forecastData);

    tabs.innerHTML = "";
    switcher.innerHTML = "";

    for (let index = 0; index < 5; index += 1) {
      const day = mapDayData(index);
      const isToday = index === todayDiff;

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "day-tab" + (index === selectedDay ? " active" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === selectedDay));
      tab.innerHTML =
        "<span>" + (isToday ? "Today" : formatDate(day.date, true)) + "</span>" +
        '<i class="alert-dot ' + day.alert.className + '" aria-hidden="true"></i>' +
        "<small>" + formatDate(day.date, true) + "</small>";
      tab.addEventListener("click", function () { selectMapDay(index); });
      tabs.appendChild(tab);

      const mapButton = document.createElement("button");
      mapButton.type = "button";
      mapButton.className = index === selectedDay ? "active" : "";
      mapButton.setAttribute("aria-pressed", String(index === selectedDay));
      mapButton.innerHTML =
        "<span>" + (isToday ? "Today" : "Day " + (index + 1)) + "</span>" +
        '<i class="' + day.alert.className + '" aria-hidden="true"></i>';
      mapButton.addEventListener("click", function () { selectMapDay(index); });
      switcher.appendChild(mapButton);
    }
  }

  function renderMapSelectedDay() {
    const day = mapDayData(selectedDay);
    const detail = document.getElementById("imdDetail");
    const badge = document.getElementById("mapAlertBadge");
    const shape = document.getElementById("districtShape");
    const shadow = document.getElementById("districtShadow");
    const marquee = document.getElementById("mapMarquee");

    if (detail) {
      detail.innerHTML =
        '<div class="warning-summary">' +
        '<i class="alert-dot ' + day.alert.className + '" aria-hidden="true"></i>' +
        "<div><p>" + day.alert.name + "</p><span>" + formatDate(day.date, false) + "</span></div></div>" +
        '<div class="warning-tags">' +
        day.warnings.map(function (w) { return "<span>" + w + "</span>"; }).join("") +
        "</div>";
    }

    setAlertClass(badge, day.alert.className);
    setAlertClass(shape, day.alert.className);
    setAlertClass(shadow, day.alert.className);

    if (badge) badge.querySelector("span").textContent = day.alert.shortName;

    if (marquee) {
      marquee.innerHTML =
        "<span>Kerala weather overview</span>" +
        "<b>Selected: " + formatDate(day.date, false) + "</b>" +
        "<span>" + day.alert.name + "</span>" +
        "<b>" + day.warnings.join(" · ") + "</b>";
    }

    const hoverAlert = document.getElementById("mapDetailAlert");
    const hoverDate = document.getElementById("mapDetailDate");
    const hoverWarnings = document.getElementById("mapDetailWarnings");
    if (hoverAlert) hoverAlert.textContent = day.alert.name;
    if (hoverDate) hoverDate.textContent = formatDate(day.date, false);
    if (hoverWarnings) {
      hoverWarnings.innerHTML = day.warnings.map(function (w) { return "<span>" + w + "</span>"; }).join("");
    }

    const description = document.getElementById("districtMapDesc");
    if (description) {
      description.textContent =
        "Malappuram district warning for " + formatDate(day.date, false) + ": " +
        day.alert.name + ". " + day.warnings.join(", ") + ".";
    }
  }

  function selectMapDay(index) {
    selectedDay = index;
    userPickedDay = index;
    renderMapDayControls();
    renderMapSelectedDay();
  }

  function renderMapUI(data, isPreview) {
    forecastData = data;
    selectedDay = userPickedDay !== null ? userPickedDay : getTodayDiff(data);

    const notice = document.getElementById("previewNotice");
    if (notice) notice.style.display = isPreview ? "flex" : "none";

    const updated = document.getElementById("imdUpdatedAt");
    if (updated) {
      updated.textContent = data.updating
        ? "Updating latest bulletin…"
        : data.stale
          ? "Showing previous bulletin"
          : data.error_mode
            ? "Showing backup data"
            : "Updated " + (data.updated_at || "recently");
    }

    renderMapDayControls();
    renderMapSelectedDay();
  }

  // Live site + worker unreachable: show an honest "unavailable" state
  function renderMapUnavailable() {
    const tabs = document.getElementById("imdDays");
    const switcher = document.getElementById("mapDaySwitcher");
    const detail = document.getElementById("imdDetail");
    const updated = document.getElementById("imdUpdatedAt");
    const badge = document.getElementById("mapAlertBadge");
    const marquee = document.getElementById("mapMarquee");
    const notice = document.getElementById("previewNotice");

    if (notice) notice.style.display = "none";
    if (tabs) tabs.innerHTML = "";
    if (switcher) switcher.innerHTML = "";
    if (updated) updated.textContent = "Live IMD data unavailable";

    if (detail) {
      detail.innerHTML =
        '<div class="warning-summary"><div><p>IMD data currently unavailable</p>' +
        "<span>Please check the official IMD website for warnings.</span></div></div>";
    }

    setAlertClass(badge, null);
    setAlertClass(document.getElementById("districtShape"), null);
    setAlertClass(document.getElementById("districtShadow"), null);
    if (badge) badge.querySelector("span").textContent = "Unavailable";

    if (marquee) {
      marquee.innerHTML = "<span>Kerala weather overview</span><b>IMD data currently unavailable</b>";
    }

    const hoverAlert = document.getElementById("mapDetailAlert");
    const hoverDate = document.getElementById("mapDetailDate");
    const hoverWarnings = document.getElementById("mapDetailWarnings");
    if (hoverAlert) hoverAlert.textContent = "Data unavailable";
    if (hoverDate) hoverDate.textContent = "";
    if (hoverWarnings) hoverWarnings.innerHTML = "";
  }

  function bindMapInteractions() {
    const wrapper = document.getElementById("districtMapWrap");
    const map = document.getElementById("districtMap");
    if (!wrapper || !map) return;

    wrapper.addEventListener("pointerenter", function () { wrapper.classList.add("is-active"); });
    wrapper.addEventListener("pointerleave", function () { wrapper.classList.remove("is-active"); });
    map.addEventListener("focus", function () { wrapper.classList.add("is-active"); });
    map.addEventListener("blur", function () { wrapper.classList.remove("is-active"); });
    map.addEventListener("click", function () { wrapper.classList.toggle("is-active"); });
  }

  // =====================================================================
  // 3b. 5-DAY WARNINGS — LEGACY BOX (only if a page still has the old markup)
  // =====================================================================
  function renderDailyWarningsUI(data) {
    const daysContainer = document.getElementById("imdDays");
    const upEl = document.getElementById("imdUpdatedAt");
    const statusEl = document.getElementById("imdStatusBar");

    if (!daysContainer) return;
    cachedImdData = data;

    if (upEl) upEl.textContent = "System updated: " + (data.updated_at || "N/A");

    renderDaysTab(getTodayDiff(data));

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
    const base = parseBaseDate(cachedImdData.Date);

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
    const dateLabel = offsetDate(parseBaseDate(cachedImdData.Date), i);

    const tags = warnings.map(w => `<span class="imd-warning-tag">${w}</span>`).join("");

    detail.innerHTML = `
      <div class="imd-detail-top">
        <div class="imd-alert-dot" style="background:${meta.hex};"></div>
        <span class="imd-alert-name">${meta.name}</span>
        <span class="imd-alert-date">${dateLabel}</span>
      </div>
      <div class="imd-warning-tags">${tags}</div>`;
  }

  window._imdSelect = function (i) {
    document.querySelectorAll(".imd-day-btn").forEach((btn, idx) => {
      btn.classList.toggle("active", idx === i);
      btn.setAttribute("aria-selected", idx === i);
    });
    renderDetail(i);
  };

  // =====================================================================
  // CENTRALIZED FETCH HANDLER — one request updates everything
  // =====================================================================
  const hasMapSection = function () { return !!document.getElementById("districtMap"); };

  async function syncWeatherData() {
    try {
      const response = await fetch(WORKER_URL);
      if (!response.ok) throw new Error("Worker network response was not ok");

      const data = await response.json();

      renderDailyMarqueeUI(data);
      renderNowcastUI(data);
      if (hasMapSection()) renderMapUI(data, false);
      else renderDailyWarningsUI(data);

      const isExpired = data.is_expired || isNowcastExpired(data.nowcast, data.valid_until_ms);
      const isUpdating = data.updating || data.cache_status === "EXPIRED_STALE_UPDATING";

      scheduleNextFetch(isExpired || isUpdating ? RETRY_POLL_INTERVAL : NORMAL_POLL_INTERVAL);

    } catch (error) {
      console.error("ELWOIC Weather Sync Error:", error);

      // Marquee fallback (any page that has it)
      const marqueeTextEl = document.getElementById("marqueeText");
      if (marqueeTextEl) {
        marqueeTextEl.textContent = "⚠️ IMD Alert System currently unavailable. Please check official IMD channels.";
      }

      if (hasMapSection()) {
        if (IS_LIVE_HOST) {
          renderMapUnavailable();
        } else {
          // Opened outside elwoic.in (CORS blocks the worker): demo data + notice
          renderMapUI(PREVIEW_DATA, true);
        }
      } else {
        const daysEl = document.getElementById("imdDays");
        if (daysEl) {
          daysEl.innerHTML = '<div class="imd-loading-row">⚠ Could not load IMD data. Please check official IMD channels.</div>';
        }
      }

      scheduleNextFetch(RETRY_POLL_INTERVAL);
    }
  }

  // Demo data — used ONLY off elwoic.in (see IS_LIVE_HOST)
  const PREVIEW_DATA = {
    Date: new Date().toISOString().slice(0, 10),
    District: "MALAPPURAM",
    Day_1: "2,4,8", Day_2: "4,8", Day_3: "4", Day_4: "4", Day_5: "1",
    Day1_Color: "3", Day2_Color: "3", Day3_Color: "3", Day4_Color: "3", Day5_Color: "4",
    updated_at: "Preview data"
  };

  // --- INITIALIZATION ---
  function init() {
    bindMapInteractions();
    syncWeatherData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
