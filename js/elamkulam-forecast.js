// NEW frontend-loader.js (15 lines)
fetch('https://elwoic-forecast-report.bold-waterfall-0d01.workers.dev/')
  .then(r => r.json())
  .then(data => {
    document.getElementById('elamkulam-forecast-report').innerHTML = data.essay;
  });
