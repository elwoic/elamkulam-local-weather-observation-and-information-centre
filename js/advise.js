(function(){
  const OW_KEY = "ca13a2cbdc07e7613b6af82cff262295";
  const LAT = 10.9081, LON = 76.2296;
  const activities = [
    { key:"swimming",     label:"നീന്തൽ" },
    { key:"walking",      label:"നടത്തം / ഓട്ടം" },
    { key:"cycling",      label:"സൈക്കിൾ / ബൈക്ക്" },
    { key:"climbing",     label:"ട്രക്കിംഗ് / മലകയറ്റം" },
    { key:"fishing",      label:"മീൻപിടിത്തം" },
    { key:"drying",       label:"വസ്ത്രം ഉണക്കൽ" },
    { key:"construction", label:"നിർമ്മാണ ജോലികൾ" },
    { key:"farming",      label:"കൃഷിപ്പണികൾ" },
    { key:"outing",       label:"യാത്രകൾ / ഔട്ടിംഗ്" }
  ];
  const adviceML = {
    swimming:     { good:"അനുകൂലമാണ്.", moderate:"ശ്രദ്ധ വേണം.", avoid:"അപകടം, ഒഴിവാക്കുക." },
    walking:      { good:"നല്ല സമയം.", moderate:"ചൂട്/മഴ ശ്രദ്ധിക്കുക.", avoid:"അനുകൂലമല്ല." },
    cycling:      { good:"യാത്രയ്ക്ക് ഉചിതം.", moderate:"കാറ്റ്/മഴ ശ്രദ്ധിക്കുക.", avoid:"അപകടസാധ്യത." },
    climbing:     { good:"ട്രക്കിംഗിന് പോകാം.", moderate:"ജാഗ്രത പാലിക്കുക.", avoid:"മഴ/മിന്നൽ ഭീഷണി." },
    fishing:      { good:"അനുകൂല സമയം.", moderate:"കാലാവസ്ഥ ശ്രദ്ധിക്കുക.", avoid:"മിന്നൽ/കാറ്റ് ഭീഷണി." },
    drying:       { good:"വേഗത്തിൽ ഉണങ്ങും.", moderate:"സമയം എടുക്കും.", avoid:"സാധ്യമല്ല." },
    construction: { good:"ജോലികൾക്ക് ഉചിതം.", moderate:"ചൂട് ശ്രദ്ധിക്കുക.", avoid:"അപകടം, നിർത്തുക." },
    farming:      { good:"കൃഷിപ്പണിക്ക് നല്ലത്.", moderate:"മഴ/ചൂട് ശ്രദ്ധിക്കുക.", avoid:"മിന്നൽ ഭീഷണി." },
    outing:       { good:"യാത്രയ്ക്ക് അനുയോജ്യം.", moderate:"കുട കരുതുക.", avoid:"യാത്ര ഒഴിവാക്കുക." }
  };
  const statusLabel = { good:"✔ Good", moderate:"⚠ Caution", avoid:"✕ Avoid" };

  function recommend(key, temp, humidity, wind, condition) {
    const now = new Date(), month = now.getMonth(), hour = now.getHours();
    const isRainy   = /rain|drizzle|shower/i.test(condition);
    const isThunder = /thunder|storm/i.test(condition);
    const isDry     = (month >= 11 || month <= 2);
    if (isThunder) return "avoid";
    switch(key) {
      case "swimming":     return isDry ? (isRainy && wind > 30 ? "moderate" : "good") : (isRainy || wind > 25 ? "avoid" : "good");
      case "drying":       return isRainy ? (isDry ? "moderate" : "avoid") : humidity > 80 ? "moderate" : (hour >= 18 || hour <= 6 ? "moderate" : "good");
      case "climbing":
      case "walking":      return isRainy ? (isDry ? "moderate" : "avoid") : temp > 35 ? "moderate" : "good";
      case "construction":
      case "farming":      return (isRainy && !isDry) ? "avoid" : temp > 37 ? "moderate" : "good";
      default:             return isRainy ? "moderate" : "good";
    }
  }

  async function update() {
    const grid = document.getElementById("act-grid");
    const upd  = document.getElementById("act-updated");
    try {
      const data      = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OW_KEY}&units=metric`).then(r => r.json());
      const temp      = data.main.temp;
      const humidity  = data.main.humidity;
      const wind      = data.wind.speed * 3.6;
      const condition = data.weather[0].main.toLowerCase();
      grid.innerHTML  = "";
      activities.forEach(a => {
        const status = recommend(a.key, temp, humidity, wind, condition);
        const card   = document.createElement("div");
        card.className = "act-card s-" + status;
        card.innerHTML = `<div class="act-title">${a.label}</div>
                          <div class="act-status">${statusLabel[status]}</div>
                          <div class="act-advice">${adviceML[a.key][status]}</div>`;
        grid.appendChild(card);
      });
      upd.textContent = "അവസാനം പുതുക്കിയത്: " + new Date().toLocaleTimeString("ml-IN");
    } catch(e) {
      grid.innerHTML = `<div class="act-card s-avoid" style="grid-column:1/-1;">വിവരങ്ങൾ ലഭ്യമായില്ല. ദയവായി അല്പം കഴിഞ്ഞ് ശ്രമിക്കുക.</div>`;
    }
  }
  update();
  setInterval(update, 15 * 60 * 1000);
})();
