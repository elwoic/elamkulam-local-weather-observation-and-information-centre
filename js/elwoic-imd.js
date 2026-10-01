/**
 * ELWOIC Malappuram five-day district warning map.
 *
 * Drop this file next to Forecast-Malappuram-Map.html. It uses the existing
 * ELWOIC IMD worker and makes only one request per refresh cycle.
 */
(function () {
  "use strict";

  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";
  const NORMAL_POLL_INTERVAL = 10 * 60 * 1000;
  const RETRY_POLL_INTERVAL = 3 * 60 * 1000;

  const WARNING_MAP = {
    "1": "No warning",
    "2": "Heavy rain",
    "3": "Heavy snow",
    "4": "Thunderstorm & lightning",
    "5": "Hailstorm",
    "6": "Dust storm",
    "7": "Dust-raising winds",
    "8": "Strong surface winds",
    "9": "Heat wave",
    "10": "Hot day",
    "11": "Warm night",
    "12": "Cold wave",
    "13": "Cold day",
    "14": "Ground frost",
    "15": "Fog",
    "16": "Very heavy rain",
    "17": "Extremely heavy rain"
  };

  const ALERTS = {
    "1": {
      name: "Red alert — Take action",
      shortName: "Red alert",
      className: "alert-red"
    },
    "2": {
      name: "Orange alert — Be prepared",
      shortName: "Orange alert",
      className: "alert-orange"
    },
    "3": {
      name: "Yellow alert — Be aware",
      shortName: "Yellow alert",
      className: "alert-yellow"
    },
    "4": {
      name: "Green — No warning",
      shortName: "No warning",
      className: "alert-green"
    }
  };

  // Used only when the page is opened outside elwoic.in, whose worker CORS
  // policy intentionally rejects other origins.
  const PREVIEW_DATA = {
    Date: "2026-10-01",
    District: "MALAPPURAM",
    Day_1: "2,4,8",
    Day_2: "4,8",
    Day_3: "4",
    Day_4: "4",
    Day_5: "1",
    Day1_Color: "3",
    Day2_Color: "3",
    Day3_Color: "3",
    Day4_Color: "3",
    Day5_Color: "4",
    updated_at: "Preview data"
  };

  let forecastData = null;
  let selectedDay = 0;
  let pollTimer = null;

  function decodeWarnings(value) {
    if (!value || value === "0") return ["No specific warning"];
    return value.split(",").map(function (code) {
      const cleanCode = code.trim();
      return WARNING_MAP[cleanCode] || "Weather event " + cleanCode;
    });
  }

  function dateAtOffset(dateString, offset) {
    const date = new Date(dateString + "T00:00:00");
    date.setDate(date.getDate() + offset);
    return date;
  }

  function formatDate(date, compact) {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: compact ? undefined : "long",
      day: "numeric",
      month: "short"
    }).format(date);
  }

  function dayData(index) {
    const number = index + 1;
    const colorId = forecastData["Day" + number + "_Color"] || "4";
    return {
      index: index,
      date: dateAtOffset(forecastData.Date, index),
      alert: ALERTS[colorId] || ALERTS["4"],
      warnings: decodeWarnings(forecastData["Day_" + number])
    };
  }

  function setAlertClass(element, className) {
    if (!element) return;
    element.classList.remove(
      "alert-red",
      "alert-orange",
      "alert-yellow",
      "alert-green"
    );
    element.classList.add(className);
  }

  function renderDayControls() {
    const tabs = document.getElementById("imdDays");
    const switcher = document.getElementById("mapDaySwitcher");
    if (!tabs || !switcher) return;

    tabs.innerHTML = "";
    switcher.innerHTML = "";

    for (let index = 0; index < 5; index += 1) {
      const day = dayData(index);

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "day-tab" + (index === selectedDay ? " active" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === selectedDay));
      tab.innerHTML =
        "<span>" +
        (index === 0 ? "Today" : formatDate(day.date, true)) +
        "</span>" +
        '<i class="alert-dot ' +
        day.alert.className +
        '" aria-hidden="true"></i>' +
        "<small>" +
        formatDate(day.date, true) +
        "</small>";
      tab.addEventListener("click", function () {
        selectDay(index);
      });
      tabs.appendChild(tab);

      const mapButton = document.createElement("button");
      mapButton.type = "button";
      mapButton.className = index === selectedDay ? "active" : "";
      mapButton.setAttribute("aria-pressed", String(index === selectedDay));
      mapButton.innerHTML =
        "<span>" +
        (index === 0 ? "Today" : "Day " + (index + 1)) +
        "</span>" +
        '<i class="' + day.alert.className + '" aria-hidden="true"></i>';
      mapButton.addEventListener("click", function () {
        selectDay(index);
      });
      switcher.appendChild(mapButton);
    }
  }

  function renderSelectedDay() {
    const day = dayData(selectedDay);
    const detail = document.getElementById("imdDetail");
    const badge = document.getElementById("mapAlertBadge");
    const shape = document.getElementById("districtShape");
    const shadow = document.getElementById("districtShadow");
    const marquee = document.getElementById("mapMarquee");

    if (detail) {
      detail.innerHTML =
        '<div class="warning-summary">' +
        '<i class="alert-dot ' +
        day.alert.className +
        '" aria-hidden="true"></i>' +
        "<div><p>" +
        day.alert.name +
        "</p><span>" +
        formatDate(day.date, false) +
        "</span></div></div>" +
        '<div class="warning-tags">' +
        day.warnings.map(function (warning) {
          return "<span>" + warning + "</span>";
        }).join("") +
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

    document.getElementById("mapDetailAlert").textContent = day.alert.name;
    document.getElementById("mapDetailDate").textContent =
      formatDate(day.date, false);
    document.getElementById("mapDetailWarnings").innerHTML =
      day.warnings.map(function (warning) {
        return "<span>" + warning + "</span>";
      }).join("");

    const description = document.getElementById("districtMapDesc");
    if (description) {
      description.textContent =
        "Malappuram district warning for " +
        formatDate(day.date, false) +
        ": " +
        day.alert.name +
        ". " +
        day.warnings.join(", ") +
        ".";
    }
  }

  function selectDay(index) {
    selectedDay = index;
    renderDayControls();
    renderSelectedDay();
  }

  function renderForecast(data, isPreview) {
    forecastData = data;
    selectedDay = 0;

    const notice = document.getElementById("previewNotice");
    if (notice) notice.style.display = isPreview ? "flex" : "none";

    const updated = document.getElementById("imdUpdatedAt");
    if (updated) {
      updated.textContent = data.updating
        ? "Updating latest bulletin…"
        : data.stale
          ? "Showing previous bulletin"
          : "Updated " + (data.updated_at || "recently");
    }

    renderDayControls();
    renderSelectedDay();
  }

  function bindMapInteractions() {
    const wrapper = document.getElementById("districtMapWrap");
    const map = document.getElementById("districtMap");
    if (!wrapper || !map) return;

    wrapper.addEventListener("pointerenter", function () {
      wrapper.classList.add("is-active");
    });
    wrapper.addEventListener("pointerleave", function () {
      wrapper.classList.remove("is-active");
    });
    map.addEventListener("focus", function () {
      wrapper.classList.add("is-active");
    });
    map.addEventListener("blur", function () {
      wrapper.classList.remove("is-active");
    });
    map.addEventListener("click", function () {
      wrapper.classList.toggle("is-active");
    });
  }

  function scheduleNextFetch(interval) {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(syncWeatherData, interval);
  }

  async function syncWeatherData() {
    try {
      const response = await fetch(WORKER_URL);
      if (!response.ok) throw new Error("IMD worker request failed");
      const data = await response.json();
      renderForecast(data, false);
      scheduleNextFetch(
        data.updating ? RETRY_POLL_INTERVAL : NORMAL_POLL_INTERVAL
      );
    } catch (error) {
      console.warn("Live IMD data unavailable on this origin:", error);
      renderForecast(PREVIEW_DATA, true);
      scheduleNextFetch(RETRY_POLL_INTERVAL);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindMapInteractions();
    syncWeatherData();
  });
})();
