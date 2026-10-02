fetch("https://elwoic-forecast-report.bold-waterfall-0d01.workers.dev/")
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("report").innerText = d.essay_ml;
  });
