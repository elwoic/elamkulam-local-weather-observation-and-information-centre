 // ===== Weather codes to Malayalam sentences =====
const codeSentences = {
  's': " {time} മണിക്ക് ആകാശം തെളിഞ്ഞിട്ടുണ്ട്, സൂര്യപ്രകാശം നിറഞ്ഞു.",
  'pc': " {time} മണിക്ക് ആകാശം ഭാഗികമായി മേഘങ്ങൾ കൊണ്ടാണ് മൂടിയിരിക്കുന്നത്.",
  'c': " {time} മണിക്ക് ആകാശം മേഘം കൊണ്ടാണ് മൂടിയിരിക്കുന്നത്.",
  'cl': " {time} മണിക്ക് ആകാശം പൂർണമായി തെളിഞ്ഞിരിക്കും.",
  'o': " {time} മണിക്ക് ആകാശം മുഴുവൻ മേഘംകൊണ്ട് മൂടിയിരിക്കുന്നു.",
  'h': " {time} മണിക്ക് അല്പം മൂടൽമഞ്ഞ് അനുഭവപ്പെടുന്നു.",
  'm': " {time} മണിക്ക് മഞ്ഞ് പടർന്നിരിക്കുന്നു.",
  'f': " {time} മണിക്ക് കനം കൂടിയ മഞ്ഞ് അനുഭവപ്പെടുന്നു.",
  'lr': " {time} മണിക്ക് ചെറിയ മഴ വീഴുന്നു.",
  'mr': " {time} മണിക്ക് മിതമായ മഴ വീഴുന്നു.",
  'hr': " {time} മണിക്ക് കനത്ത മഴ പെയ്യുന്നു.",
  'ts': " {time} മണിക്ക് ഇടിമിന്നലോടുകൂടിയ മിന്നൽക്കാറ്റ് അനുഭവപ്പെടുന്നു.",
  'w': " {time} മണിക്ക് കാറ്റ് ശക്തമായാണ് വീശുന്നത്.",
  'cy': " {time} മണിക്ക് ചുഴലി പ്രളയം മുന്നറിയിപ്പ് നിലവിലുണ്ട്."
};

// ===== Code to category for averaging =====
const codeCategory = {
  's': 'sunny',
  'pc': 'sunny',
  'cl': 'clear',
  'c': 'cloudy',
  'o': 'cloudy',
  'h': 'cloudy',
  'm': 'cloudy',
  'f': 'cloudy',
  'lr': 'rain',
  'mr': 'rain',
  'hr': 'rain',
  'ts': 'rain',
  'w': 'windy',
  'cy': 'rain'
};

// ===== Weather data for 6 days =====
const weatherData = {
  "22/12/2025": {
    "2:00 AM": "cl","4:00 AM": "cl","6:00 AM": "cl","8:00 AM": "cl",
    "10:00 AM": "cl","12:00 PM": "cl","2:00 PM": "cl","4:00 PM": "cl",
    "6:00 PM": "cl","8:00 PM": "cl","10:00 PM":"cl","12:00 AM": "cl"
  },
  "23/12/2025": {
    "2:00 AM": "cl","4:00 AM": "cl","6:00 AM": "cl","8:00 AM": "cl",
    "10:00 AM": "cl","12:00 PM": "cl","2:00 PM": "cl","4:00 PM": "cl",
    "6:00 PM": "cl","8:00 PM": "cl","10:00 PM": "cl","12:00 AM": "cl"
  },
  "24/12/2025": {
    "2:00 AM": "cl","4:00 AM": "cl","6:00 AM": "cl","8:00 AM": "cl",
    "10:00 AM": "cl","12:00 PM": "cl","2:00 PM": "cl","4:00 PM": "cl",
    "6:00 PM": "cl","8:00 PM": "cl","10:00 PM": "cl","12:00 AM": "cl"
  },
  "25/12/2025": {
    "2:00 AM": "cl","4:00 AM": "cl","6:00 AM": "cl","8:00 AM": "cl",
    "10:00 AM": "cl","12:00 PM": "cl","2:00 PM": "cl","4:00 PM": "cl",
    "6:00 PM": "pc","8:00 PM": "cl","10:00 PM": "cl","12:00 AM": "cl"
  },
  "26/12/2025": {
    "2:00 AM": "cl","4:00 AM": "cl","6:00 AM": "cl","8:00 AM": "cl",
    "10:00 AM": "cl","12:00 PM": "cl","2:00 PM": "pc","4:00 PM": "cl",
    "6:00 PM": "cl","8:00 PM": "cl","10:00 PM": "c","12:00 AM": "cl"
  },
  "27/12/2025": {
    "2:00 AM": "cl","4:00 AM": "cl","6:00 AM": "cl","8:00 AM": "cl",
    "10:00 AM": "cl","12:00 PM": "cl","2:00 PM": "cl","4:00 PM": "cl",
    "6:00 PM": "cl","8:00 PM": "cl","10:00 PM": "cl","12:00 AM": "cl"
  }
};

// ===== Function to generate HTML report for a date =====
function describeDayHtml(date) {
  const dayData = weatherData[date];
  if (!dayData) return `<div>${date} ന് ഡാറ്റ ലഭ്യമല്ല.</div>`;

  let categoryCounts = {};
  let htmlOutput = `<div><h3>${date} ന് കാലാവസ്ഥ:</h3>`;

  for (const [time, code] of Object.entries(dayData)) {
    const template = codeSentences[code] || " {time}: വിവരങ്ങൾ ലഭ്യമല്ല.";
    const sentence = template.replace("{time}", time);
    htmlOutput += `<p>${sentence}</p>`;

    const category = codeCategory[code] || "unknown";
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  // Dominant condition
  const dominant = Object.entries(categoryCounts).sort((a,b) => b[1]-a[1])[0][0];
  const dominantMalayalam = {
    'sunny': "ദിവസം പ്രധാനമായും സൂര്യപ്രകാശം നിറഞ്ഞിരിക്കുന്നു.",
    'cloudy': "ദിവസം പ്രധാനമായും മേഘമുള്ള ദിവസമാണ്.",
    'rain': "ദിവസം മഴയുള്ളതാണ്.",
    'windy': "ദിവസം കാറ്റ് ശക്തമായാണ് അനുഭവപ്പെടുന്നത്.",
    'unknown': "ദിവസത്തിന്റെ പ്രധാന കാലാവസ്ഥ വ്യക്തമല്ല."
  }[dominant];

  htmlOutput += `<p><strong>${dominantMalayalam}</strong></p>`;
  htmlOutput += `</div>`;
  return htmlOutput;
}

// ===== Render today's weather in first ID =====
function renderTodayWeather() {
  const container = document.getElementById("weather-report");
  container.innerHTML = ""; // clear

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayStr = `${dd}/${mm}/${yyyy}`;

  container.innerHTML = describeDayHtml(todayStr);
}

// ===== Placeholder for second unique ID (another page) =====
function renderOtherWeather() {
  const container = document.getElementById("weather-report-other");
  container.innerHTML = "<p>വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല.</p>";
}

// Run on page load
window.onload = function() {
  renderTodayWeather();
  renderOtherWeather();
};
