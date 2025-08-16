// main-readonly.js — cards-only view (no form, no animations), shares look with manage

import { db } from "./firebase-init.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let chartInstance;
let chartMode = "incomeEvent";
let categoryTotals = {
  FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
  Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
};

const transactionsRef = collection(db, "transactions");

// --------- Build one card (same visual structure as manage) ----------
function createCard(docId, item) {
  const card = document.createElement('div');
  card.className = 'txn-card';
  card.dataset.id       = docId;
  card.dataset.event    = item.event || "";
  card.dataset.date     = item.date || "";
  card.dataset.amount   = String(item.amount ?? 0);
  card.dataset.category = item.category || "";

  card.innerHTML = `
    <div class="txn-left">
      <div class="event">Event: ${item.event}</div>
      <div class="date">Date: ${item.date}</div>
    </div>
    <div class="txn-mid">
      <div class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">
        ${item.amount >= 0 ? '$' : '-$'}${Math.abs(item.amount).toFixed(2)}
      </div>
      <div class="desc">${item.description || ''}</div>
    </div>
    <div class="txn-right">
      <div class="category">${item.category}</div>
    </div>
  `;
  // Read-only: no right-click delete
  return card;
}

// --------- FLIP utils for pretty resorting (optional) ----------
function capturePositions(container) {
  const map = new Map();
  Array.from(container.children).forEach(el => {
    map.set(el, el.getBoundingClientRect());
  });
  return map;
}
function playFLIP(container, before) {
  const after = new Map();
  Array.from(container.children).forEach(el => {
    after.set(el, el.getBoundingClientRect());
  });
  const prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  after.forEach((afterBox, el) => {
    const beforeBox = before.get(el);
    if (!beforeBox) return;
    const dx = beforeBox.left - afterBox.left;
    const dy = beforeBox.top  - afterBox.top;
    if (dx || dy) {
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
      requestAnimationFrame(() => {
        // force style recalc
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        el.style.transition = prefersReduced ? 'none' : '';
        el.style.transform = '';
      });
    }
  });
}

// --------- Realtime: render cards + keep hidden table for charts ---------
onSnapshot(transactionsRef, (snapshot) => {
  const wrap  = document.getElementById("cards");                    // visible cards
  const tbody = document.getElementById("main_table")?.tBodies[0];   // hidden table for charts

  // reset aggregates
  categoryTotals = {
    FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
    Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
  };

  // rebuild cards (static—no add/remove animations on readonly)
  if (wrap) {
    wrap.innerHTML = "";
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      wrap.appendChild(createCard(docSnap.id, item));
    });
    // keep current sort after refresh (if the controls exist)
    applyCurrentSort();
  }

  // rebuild hidden table for chart calculations
  if (tbody) {
    tbody.innerHTML = "";
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      const row = tbody.insertRow();
      row.insertCell(0).textContent = item.event;
      row.insertCell(1).textContent = item.date;
      row.insertCell(2).textContent = Number(item.amount).toFixed(2);
      row.insertCell(3).textContent = item.category;
      row.insertCell(4).textContent = item.description || "";

      if (!(item.category in categoryTotals)) categoryTotals[item.category] = 0;
      categoryTotals[item.category] += Number(item.amount);
    });
  }

  updateChart();
  updateTotal();
  updateTextList();
});

// --------- Chart mode selector ----------
document.getElementById("chartModeSelector")?.addEventListener("change", (e) => {
  chartMode = e.target.value;
  updateChart();
});

// --------- Sorting controls (optional UI) ----------
document.getElementById("sortField")?.addEventListener("change", applyCurrentSort);
document.getElementById("sortDir")?.addEventListener("change", applyCurrentSort);

function parseDateMMDDYYYY(s) {
  // expects "MM/DD/YYYY"
  const [m, d, y] = (s || "").split("/").map(Number);
  if (!m || !d || !y) return new Date(0); // earliest if malformed
  return new Date(y, m - 1, d);
}

function sortCards(field, dir) {
  const wrap = document.getElementById("cards");
  if (!wrap) return;

  const before = capturePositions(wrap); // FIRST

  const mult = dir === "asc" ? 1 : -1;
  const cards = Array.from(wrap.children);

  cards.sort((a, b) => {
    let av = a.dataset[field] || '';
    let bv = b.dataset[field] || '';

    if (field === 'amount') {
      av = parseFloat(av) || 0; bv = parseFloat(bv) || 0;
      return mult * (av - bv);
    }
    if (field === 'date') {
      const ad = parseDateMMDDYYYY(av);
      const bd = parseDateMMDDYYYY(bv);
      return mult * (ad - bd);
    }
    return mult * av.localeCompare(bv);
  });

  // Reattach in sorted order (LAST)
  cards.forEach(c => wrap.appendChild(c));

  // Invert + Play
  playFLIP(wrap, before);
}

function applyCurrentSort() {
  const fieldSel = document.getElementById("sortField");
  const dirSel = document.getElementById("sortDir");
  if (!fieldSel || !dirSel) return;
  sortCards(fieldSel.value, dirSel.value);
}

// --------- Totals / details ----------
function updateTotal() {
  const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const el = document.getElementById("totalAmount");
  if (el) el.textContent = Number(total).toFixed(2);
}

function updateTextList() {
  const ul = document.querySelector(".details ul");
  if (!ul) return;
  ul.innerHTML = "";
  for (let cat in categoryTotals) {
    const li = document.createElement("li");
    li.innerHTML = `${cat}: <span class='percentage'>$${categoryTotals[cat].toFixed(2)}</span>`;
    ul.appendChild(li);
  }
}

// --------- Chart.js (reads from hidden table rows) ----------
function getChartData() {
  const events = {};
  const categories = {};
  const rows = document.getElementById("main_table")?.tBodies[0]?.rows || [];

  for (let row of rows) {
    const event = row.cells[0].textContent;
    const category = row.cells[3].textContent;
    const amount = parseFloat(row.cells[2].textContent) || 0;

    if (!events[event]) events[event] = 0;
    if (!categories[category]) categories[category] = 0;

    if (chartMode === "incomeEvent"    && amount > 0) events[event] += amount;
    if (chartMode === "expenseEvent"   && amount < 0) events[event] += -amount;
    if (chartMode === "incomeCategory" && amount > 0) categories[category] += amount;
    if (chartMode === "expenseCategory"&& amount < 0) categories[category] += -amount;
    if (chartMode === "netEvent")      events[event] += amount;
    if (chartMode === "netCategory")   categories[category] += amount;
  }

  const labels = chartMode.includes("Event") ? Object.keys(events) : Object.keys(categories);
  const data   = chartMode.includes("Event") ? Object.values(events) : Object.values(categories);
  return { labels, data };
}

function updateChart() {
  const ctx = document.querySelector(".my-chart");
  if (!ctx) return;
  const chartData = getChartData();

  if (chartInstance) {
    chartInstance.data.labels = chartData.labels;
    chartInstance.data.datasets[0].data = chartData.data;
    chartInstance.update();
  } else {
    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: chartData.labels,
        datasets: [{ label: "Amount ($)", data: chartData.data, backgroundColor: "#457b9d" }]
      },
      options: {
        responsive: true,
        animation: { duration: 400 },
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  }
}