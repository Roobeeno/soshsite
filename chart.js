// chart.js — dedicated chart page (no table). Firestore → array → Chart.js

import { db } from "./firebase-init.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let chartInstance;
let chartMode = "incomeEvent";
const transactionsRef = collection(db, "transactions");
let transactions = []; // in-memory source

onSnapshot(transactionsRef, (snapshot) => {
  transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderChart();
});

document.getElementById("chartModeSelector")?.addEventListener("change", (e) => {
  chartMode = e.target.value;
  renderChart();
});

function aggregate(trans, mode) {
  const byEvent = {};
  const byCat = {};

  for (const t of trans) {
    const amt = Number(t.amount) || 0;
    const ev  = t.event || "Unspecified";
    const cat = t.category || "Other";

    if (!byEvent[ev]) byEvent[ev] = 0;
    if (!byCat[cat]) byCat[cat] = 0;

    if (mode === "incomeEvent"    && amt > 0) byEvent[ev] += amt;
    if (mode === "expenseEvent"   && amt < 0) byEvent[ev] += -amt;
    if (mode === "netEvent")                       byEvent[ev] += amt;

    if (mode === "incomeCategory" && amt > 0) byCat[cat] += amt;
    if (mode === "expenseCategory"&& amt < 0) byCat[cat] += -amt;
    if (mode === "netCategory")                      byCat[cat] += amt;
  }

  if (mode.includes("Event")) {
    return { labels: Object.keys(byEvent), data: Object.values(byEvent) };
  }
  return { labels: Object.keys(byCat), data: Object.values(byCat) };
}

function renderChart() {
  const ctx = document.getElementById("budgetChart");
  if (!ctx) return;

  const { labels, data } = aggregate(transactions, chartMode);

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Amount ($)",
        data,
        backgroundColor: "#457b9d",  // opaque
        borderColor: "#1E1E1E",
        borderWidth: 1
      }],
    },
    options: {
      responsive: true,
      animation: { duration: 400 },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.08)" } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}