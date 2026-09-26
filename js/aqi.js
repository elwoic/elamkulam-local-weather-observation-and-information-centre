  const AQI_API = "https://curly-sound-5bea.elwoicelamkulam.workers.dev/api";

  function pm25ToAQI_aqi(pm){
    const bp=[{cL:0,cH:12,aL:0,aH:50},{cL:12.1,cH:35.4,aL:51,aH:100},{cL:35.5,cH:55.4,aL:101,aH:150},{cL:55.5,cH:150.4,aL:151,aH:200},{cL:150.5,cH:250.4,aL:201,aH:300},{cL:250.5,cH:500,aL:301,aH:500}];
    for(const r of bp) if(pm>=r.cL&&pm<=r.cH) return Math.round(((r.aH-r.aL)/(r.cH-r.cL))*(pm-r.cL)+r.aL);
    return Math.round(pm);
  }

  function getAQIStatus(aqi){
    if(aqi<=50)  return {text:'Good',        color:'#4caf50', emoji:'😀', en:'Air quality is good.',         ml:'വായു ഗുണനിലവാരം നല്ലതാണ്.'};
    if(aqi<=100) return {text:'Satisfactory', color:'#8bc34a', emoji:'🙂', en:'Air quality is satisfactory.', ml:'വായു ഗുണനിലവാരം തൃപ്തികരമാണ്.'};
    if(aqi<=200) return {text:'Moderate',     color:'#ffc107', emoji:'😐', en:'Moderate pollution levels.',   ml:'മിതമായ വായു മലിനീകരണം.'};
    if(aqi<=300) return {text:'Poor',         color:'#ff9800', emoji:'😷', en:'Poor air quality.',            ml:'വായു ഗുണനിലവാരം മോശമാണ്.'};
    return           {text:'Very Poor',       color:'#f44336', emoji:'☹️', en:'Health alert.',                ml:'ആരോഗ്യ അടിയന്തരാവസ്ഥ.'};
  }

  function sensorColor(value, type){
    if(!value || isNaN(value)) return '#ccc';
    if(type==='pm10')            return value<=50?'#4caf50':value<=100?'#ffc107':'#f44336';
    if(type==='co2')             return value<=800?'#4caf50':value<=1200?'#ffc107':'#f44336';
    if(type==='tvoc'||type==='nox') return value<=100?'#4caf50':value<=200?'#ffc107':'#f44336';
    return '#ccc';
  }

  async function updateAQI(){
    try{
      const res=await fetch(AQI_API);
      if(!res.ok) throw new Error('AQI fetch failed');
      let data=await res.json();
      if(Array.isArray(data)) data=data[0];

      const pm    = parseFloat(data?.pm02_corrected??0);
      const pm10  = parseFloat(data?.pm10_corrected)||0;
      const aqi   = pm25ToAQI_aqi(pm);
      const st    = getAQIStatus(aqi);

      document.getElementById('aqi-dot').style.background   = st.color;
      document.getElementById('aqi-pulse').style.background = st.color;
      document.getElementById('aqi-status-text').textContent = `AQI ${aqi} — ${st.text} ${st.emoji}`;

      const hour=new Date().getHours();
      const alertEl=document.getElementById('wood-stove-alert');
      alertEl.style.display=(hour>=5&&hour<9&&pm>45)?'block':'none';

      document.getElementById('aqi-advice').innerHTML=`${st.en}<br><span style="font-family:'Noto Sans Malayalam',sans-serif;">${st.ml}</span><br><small style="color:var(--text-muted);">PM2.5: ${pm} µg/m³ | PM10: ${pm10} µg/m³</small>`;

      const s=(id,v,type)=>{
        const el=document.getElementById(id); if(el) el.textContent=v;
        const bar=document.getElementById(id+'-bar'); if(bar) bar.style.background=sensorColor(v,type);
      };
      s('aqi-pm10', pm10,  'pm10');
      s('aqi-co2',  parseFloat(data?.rco2_corrected)||0, 'co2');
      s('aqi-tvoc', parseFloat(data?.tvocIndex)||0, 'tvoc');
      s('aqi-nox',  parseFloat(data?.noxIndex)||0,  'nox');
      document.getElementById('aqi-time').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    } catch(e){
      console.error(e);
      document.getElementById('aqi-status-text').textContent='Offline';
    }
  }

  updateAQI();
  setInterval(updateAQI, 180000);
