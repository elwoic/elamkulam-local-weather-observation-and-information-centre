/**
 * ELWOIC Unified Weather Monitoring Script — REVISED VERSION
 *
 * Coordinates with the updated `imdalert` Cloudflare Worker:
 *   1. Daily IMD Warning Marquee     (#marqueeContainer / #marqueeText)
 *   2. Live Nowcast Ticker           (#nowcast-container / #nowcast-ticker)
 *   3. 5-Day IMD warnings + district map (Forecast page: #imdDays, #imdDetail,
 *      #districtMap …) with full backward support for the legacy 5-day box.
 *
 * Key Polling & Status Behaviour:
 *   - All Render fetching, locking, retry cooldowns, and KV updates remain
 *     strictly inside the Cloudflare Worker. The frontend never contacts Render directly.
 *   - Normal polling (10 min) when the nowcast is valid and no urgent update is needed
 *     (Case B & Case C, where background checks run transparently on the worker).
 *   - Rapid polling (3 min) when the nowcast validity has expired and an urgent update
 *     is in progress (Case A), or after a temporary network/cold-start error.
 *   - Automatic fallback to 10-min polling with clear user-facing status notices
 *     when the worker reports a persistent IMD/bridge outage (`imd_issue: true`).
 *   - Clear loading / temporary-unavailability messaging if Case D (cold start with
 *     no prior cached bulletin) fails or is still waking up the bridge.
 */

(function () {
  "use strict";

  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

  const NORMAL_POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes — normal valid state or persistent outage backoff
  const RETRY_POLL_INTERVAL = 3 * 60 * 1000;   // 3 minutes — active expiry refresh or temporary network/wakeup retry

  // Preview data is shown ONLY when opened outside elwoic.in (e.g., local/online editor),
  // never on the live production domain.
  const IS_LIVE_HOST = /(^|\.)elwoic\.in$/i.test(window.location.hostname);

  let pollTimer = null;
  let cachedImdData = null;   // latest valid worker payload
  let forecastData = null;    // same payload, used by the map renderer
  let selectedDay = 0;
  let userPickedDay = null;   // preserves the viewer's chosen day tab across background polls

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
    "1": { name: "Red alert (Take Action)",     css: "linear-gradient(90deg, #cb2d3e, #ef473a)" },
    "2": { name: "Orange alert (Be Prepared)",  css: "linear-gradient(90deg, #f46b45, #eea849)" },
    "3": { name: "Yellow alert (Be Aware)",     css: "linear-gradient(90deg, #f7971e, #ffd200)" },
    "4": { name: "Green (No Warning)",          css: "linear-gradient(90deg, #1d976c, #93f9b9)" }
  };

  // Legacy 5-day box (old markup)
  const COLOR_META = {
    "1": { name: "Red alert — Take action",     hex: "#ef4444", dot: "dot-5" },
    "2": { name: "Orange alert — Be prepared",  hex: "#f97316", dot: "dot-4" },
    "3": { name: "Yellow alert — Be aware",     hex: "#eab308", dot: "dot-3" },
    "4": { name: "Green — No warning",          hex: "#22c55e", dot: "dot-1" }
  };

  // New map section
  const MAP_ALERTS = {
    "1": { name: "Red alert — Take action",     shortName: "Red alert",    className: "alert-red" },
    "2": { name: "Orange alert — Be prepared",  shortName: "Orange alert", className: "alert-orange" },
    "3": { name: "Yellow alert — Be aware",     shortName: "Yellow alert", className: "alert-yellow" },
    "4": { name: "Green — No warning",          shortName: "No warning",   className: "alert-green" }
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
    return String(codeStr)
      .split(",")
      .map(c => WARNING_MAP[c.trim()] || ("Weather event " + c.trim()));
  }

  function getISTDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    let year = 1970, month = 1, day = 1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type === "year") year = parseInt(parts[i].value, 10);
      if (parts[i].type === "month") month = parseInt(parts[i].value, 10);
      if (parts[i].type === "day") day = parseInt(parts[i].value, 10);
    }
    return new Date(year, month - 1, day);
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

  // Which of the 5 forecast days is "today" in IST (bulletin may be from yesterday prior to 04:15 IST refresh)
  function getTodayDiff(data) {
    if (!data || !data.Date) return 0;
    const base = parseBaseDate(data.Date);
    let diff = Math.round((getISTDate() - base) / 86400000);
    if (isNaN(diff) || diff < 0) diff = 0;
    if (diff > 4) diff = 4;
    return diff;
  }

  function isNowcastExpired(nowcast, validUntilMs) {
    if (typeof validUntilMs === "number" && validUntilMs > 0) {
      return Date.now() > validUntilMs;
    }
    if (nowcast && nowcast.vupto && nowcast.vupto.length >= 4 && nowcast.vupto !== "0000") {
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

    const dayNumber = getTodayDiff(data) + 1;
    const warningCode = data["Day_" + dayNumber] || data["Day_1"];
    const colorId = data["Day" + dayNumber + "_Color"] || data["Day1_Color"] || "4";

    const warningText = decodeWarnings(warningCode).join(" & ");
    const colorInfo = MARQUEE_COLOR_MAP[colorId] || { name: "Unknown", css: "#333" };

    const isImdIssue = Boolean(data.imd_issue || data.cache_status === "IMD_SIDE_ISSUE");
    const prefixParts = [];

    if (isImdIssue) {
      prefixParts.push("⚠️ IMD side issue — showing last available bulletin.");
    } else {
      if (data.stale)      prefixParts.push("⚠️ Showing previous IMD bulletin.");
      if (data.updating)   prefixParts.push("🔄 Updating latest IMD data...");
      if (data.error_mode) prefixParts.push("⚠️ Using backup data.");
    }
    const prefix = prefixParts.length ? prefixParts.join(" ") + " " : "";
    const lastUpdated = data.updated_at || data.last_updated_ist || "N/A";

    marqueeTextEl.textContent = `${prefix}IMD Alert for Malappuram district ${dateStr}: ${colorInfo.name} — ${warningText} | Last Updated: ${lastUpdated} | Source: India Meteorological Department (IMD)`;
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

      if (
        data.nowcast.toi &&
        data.nowcast.vupto &&
        data.nowcast.vupto !== "0" &&
        data.nowcast.vupto !== "0000"
      ) {
        const formatTime = (t) => `${t.substring(0, 2)}:${t.substring(2)}`;
        tickerText += ` (VALID: ${formatTime(data.nowcast.toi)} TO ${formatTime(data.nowcast.vupto)} IST)`;
      }

      const alertColor = data.nowcast.color_name ? data.nowcast.color_name.toUpperCase() : "UNKNOWN";
      const isImdIssue = Boolean(data.imd_issue || data.cache_status === "IMD_SIDE_ISSUE");
      const expired = Boolean(data.is_expired || isNowcastExpired(data.nowcast, data.valid_until_ms));

      if (isImdIssue) {
        ticker.innerText = `🇮🇳 IMD NOWCAST (${alertColor} ALERT) [IMD SIDE ISSUE - SHOWING LAST ALERT]: ${tickerText}`;
      } else if (expired || data.cache_status === "EXPIRED_STALE_UPDATING") {
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

    if (badge && badge.querySelector("span")) {
      badge.querySelector("span").textContent = day.alert.shortName;
    }

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

    const isImdIssue = Boolean(data.imd_issue || data.cache_status === "IMD_SIDE_ISSUE");
    const updated = document.getElementById("imdUpdatedAt");
    if (updated) {
      updated.textContent = isImdIssue
        ? "IMD side issue — showing previous bulletin"
        : data.updating
          ? "Updating latest bulletin…"
          : data.stale
            ? "Showing previous bulletin"
            : data.error_mode
              ? "Showing backup data"
              : "Updated " + (data.updated_at || data.last_updated_ist || "recently");
    }

    renderMapDayControls();
    renderMapSelectedDay();
  }

  // Live site + no cached bulletin available (Case D cold start waking up or bridge unreachable)
  function renderMapUnavailable(statusOptions) {
    const opts = statusOptions || {};
    const isWakingUp = Boolean(opts.wakingUp);
    const isPersistentIssue = Boolean(opts.imdIssue);

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

    const headlineText = isWakingUp
      ? "Connecting to IMD weather bridge…"
      : isPersistentIssue
        ? "IMD weather bridge persistently unavailable"
        : "IMD data currently unavailable";

    const subText = isWakingUp
      ? "Fetching the latest Malappuram district bulletin. This page will update automatically."
      : "Please check the official IMD website for warnings while service is restored.";

    if (updated) {
      updated.textContent = isWakingUp
        ? "Fetching initial IMD bulletin…"
        : "Live IMD data unavailable";
    }

    if (detail) {
      detail.innerHTML =
        '<div class="warning-summary"><div><p>' + headlineText + "</p>" +
        "<span>" + subText + "</span></div></div>";
    }

    setAlertClass(badge, null);
    setAlertClass(document.getElementById("districtShape"), null);
    setAlertClass(document.getElementById("districtShadow"), null);
    if (badge && badge.querySelector("span")) {
      badge.querySelector("span").textContent = isWakingUp ? "Loading…" : "Unavailable";
    }

    if (marquee) {
      marquee.innerHTML = "<span>Kerala weather overview</span><b>" + headlineText + "</b>";
    }

    const hoverAlert = document.getElementById("mapDetailAlert");
    const hoverDate = document.getElementById("mapDetailDate");
    const hoverWarnings = document.getElementById("mapDetailWarnings");
    if (hoverAlert) hoverAlert.textContent = isWakingUp ? "Loading IMD data…" : "Data unavailable";
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

    if (upEl) upEl.textContent = "System updated: " + (data.updated_at || data.last_updated_ist || "N/A");

    const activeDayIndex = userPickedDay !== null ? userPickedDay : getTodayDiff(data);
    renderDaysTab(getTodayDiff(data), activeDayIndex);

    if (statusEl) {
      const isImdIssue = Boolean(data.imd_issue || data.cache_status === "IMD_SIDE_ISSUE");
      const parts = [];

      if (isImdIssue) {
        parts.push("⚠ IMD side issue — showing previous bulletin");
      } else {
        if (data.stale) parts.push("⚠ Showing previous bulletin");
        if (data.updating) parts.push("🔄 Updating latest data...");
        if (data.error_mode) parts.push("⚠ Using backup data");
      }

      if (data.is_cached) parts.push("Served from cache · " + (data.fetch_period || ""));

      if (parts.length) {
        statusEl.style.display = "block";
        statusEl.textContent = parts.join("  ·  ");
      } else {
        statusEl.style.display = "none";
      }
    }
  }

  function renderDaysTab(todayDiff, activeIndex) {
    const container = document.getElementById("imdDays");
    if (!container || !cachedImdData) return;

    const selected = typeof activeIndex === "number" ? activeIndex : todayDiff;
    let html = "";
    const base = parseBaseDate(cachedImdData.Date);

    for (let i = 0; i < 5; i++) {
      const colorId = cachedImdData["Day" + (i + 1) + "_Color"] || "4";
      const meta = COLOR_META[colorId] || { dot: "dot-x", hex: "#888" };
      const isToday = i === todayDiff;
      const isActive = i === selected ? "active" : "";
      const labelClass = isToday ? "imd-day-label today" : "imd-day-label";
      const labelText = isToday ? "Today" : offsetDate(base, i);

      html += `<button class="imd-day-btn ${isActive}" role="tab" aria-selected="${i === selected}" data-day="${i}" onclick="window._imdSelect(${i})">
        <span class="${labelClass}">${labelText}</span>
        <div class="imd-color-dot ${meta.dot}"></div>
        <span class="imd-day-date">${offsetDate(base, i)}</span>
      </button>`;
    }
    container.innerHTML = html;
    renderDetail(selected);
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
    userPickedDay = i;
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

      if (!response.ok) {
        let errPayload = null;
        try {
          errPayload = await response.json();
        } catch (_) {}

        const err = new Error(
          (errPayload && errPayload.error) || `Worker responded with HTTP ${response.status}`
        );
        err.status = response.status;
        err.payload = errPayload;
        throw err;
      }

      const data = await response.json();

      renderDailyMarqueeUI(data);
      renderNowcastUI(data);
      if (hasMapSection()) renderMapUI(data, false);
      else renderDailyWarningsUI(data);

      const isImdIssue = Boolean(data.imd_issue || data.cache_status === "IMD_SIDE_ISSUE");
      const isExpired = Boolean(data.is_expired || isNowcastExpired(data.nowcast, data.valid_until_ms));
      const isUpdating = Boolean(data.updating || data.cache_status === "EXPIRED_STALE_UPDATING");

      // Poll every 3 min while an expired nowcast is actively refreshing;
      // use 10-min normal polling when valid/fresh or when backing off during a persistent IMD issue.
      scheduleNextFetch((!isImdIssue && (isExpired || isUpdating)) ? RETRY_POLL_INTERVAL : NORMAL_POLL_INTERVAL);

    } catch (error) {
      console.error("ELWOIC Weather Sync Error:", error);

      const errPayload = (error && error.payload) || {};
      const isWakingUp = Boolean(errPayload.cold_start_pending || errPayload.updating || error.status === 503);
      const isPersistentIssue = Boolean(errPayload.imd_issue);

      // If we already rendered a valid bulletin earlier in this browser session,
      // keep it on screen and update status notices rather than wiping out the UI.
      if (cachedImdData || forecastData) {
        const fallbackData = {
          ...(forecastData || cachedImdData),
          stale: true,
          updating: !isPersistentIssue,
          imd_issue: isPersistentIssue,
          error_mode: true
        };
        renderDailyMarqueeUI(fallbackData);
        renderNowcastUI(fallbackData);
        if (hasMapSection()) renderMapUI(fallbackData, false);
        else renderDailyWarningsUI(fallbackData);
      } else {
        // Case D failure: no cached bulletin available yet
        const marqueeTextEl = document.getElementById("marqueeText");
        if (marqueeTextEl) {
          marqueeTextEl.textContent = isWakingUp
            ? "🔄 Connecting to IMD Weather Bridge and loading latest Malappuram bulletin..."
            : "⚠️ IMD Alert System temporarily unavailable. Please check official IMD channels.";
        }

        if (hasMapSection()) {
          if (IS_LIVE_HOST) {
            renderMapUnavailable({ wakingUp: isWakingUp, imdIssue: isPersistentIssue });
          } else {
            renderMapUI(PREVIEW_DATA, true);
          }
        } else {
          const daysEl = document.getElementById("imdDays");
          if (daysEl) {
            daysEl.innerHTML = isWakingUp
              ? '<div class="imd-loading-row">🔄 Loading latest IMD bulletin… Please wait.</div>'
              : '<div class="imd-loading-row">⚠ Could not load IMD data. Please check official IMD channels.</div>';
          }
        }
      }

      scheduleNextFetch(isPersistentIssue ? NORMAL_POLL_INTERVAL : RETRY_POLL_INTERVAL);
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
