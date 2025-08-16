// main-manage.js  — cards + table + form toolbar + auth + chart + sorting + deposits
// -----------------------------------------------------------------------------

import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ---------- Firestore Refs ----------
const transactionsRef = collection(db, "transactions");
const eventsRef       = collection(db, "events");
const depositsRef     = doc(db, "meta/deposits");

// ---------- State ----------
let chartInstance;
let chartMode = "incomeEvent";
let categoryTotals = {
  FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
  Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
};
let deposits = 0;
let sortDirections = {};

// ======================= AUTH =======================
window.validateLogin = async function () {
  const email    = document.getElementById("email")?.value || "";
  const password = document.getElementById("password")?.value || "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("content").style.display = "block";
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};

// ======================= FORM ADD =======================
// Write-only: UI will update via onSnapshot
window.addRow = async function () {
  const event       = document.getElementById("events").value.trim();
  const date        = document.getElementById("date").value.trim();
  const amount      = parseFloat(document.getElementById("transactionAmount").value);
  const category    = document.getElementById("categories").value;
  const description = document.getElementById("description").value.trim();

  if (!event || !validateDate(date) || isNaN(amount) || !category || !description) {
    alert("Please fill all fields correctly (MM/DD/YYYY, amount, etc.).");
    return;
  }

  const btn = document.querySelector(".rect-cta");
  if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }

  try {
    await addDoc(transactionsRef, { event, date, amount, category, description });
    clearInputs();
  } catch (e) {
    alert("Failed to add transaction: " + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Add Transaction"; }
  }
};

// Add Event button (small square)
window.addEvent = async function () {
  const newEvent = prompt("Create New Event");
  if (!newEvent) return;

  const select = document.getElementById("events");
  if (select) {
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === newEvent) {
        alert("Event already exists.");
        return;
      }
    }
  }
  await addDoc(eventsRef, { name: newEvent });
};

// ======================= Realtime: Events Dropdown =======================
onSnapshot(eventsRef, (snapshot) => {
  const select = document.getElementById("events");
  if (!select) return;
  select.innerHTML = "";
  snapshot.forEach(docSnap => {
    const ev = docSnap.data();
    select.options[select.options.length] = new Option(ev.name, ev.name);
  });
});

// ======================= Realtime: Deposits (right-click on total) =======================
document.getElementById("totalAmount")?.addEventListener("contextmenu", async (e) => {
  e.preventDefault();
  const inputVal = prompt("Input deposit amount (positive for deposit, negative to remove)");
  if (inputVal === null) return;
  const num = Number(inputVal);
  if (Number.isNaN(num)) return alert("Please enter a valid number.");
  deposits += num;
  await setDoc(depositsRef, { value: deposits });
  updateTotal();
});
onSnapshot(depositsRef, (docSnap) => {
  deposits = docSnap.exists() ? Number(docSnap.data().value || 0) : 0;
  updateTotal();
});

// ======================= Cards: Animations & Builders =======================
function animateInsert(cardEl) {
  cardEl.classList.add('enter');
  requestAnimationFrame(() => cardEl.classList.add('enter-active'));
  cardEl.addEventListener('transitionend', () => {
    cardEl.classList.remove('enter', 'enter-active');
  }, { once: true });
}

function animateRemove(cardEl, done) {
  const h = cardEl.offsetHeight;
  cardEl.style.maxHeight = h + 'px';
  cardEl.getBoundingClientRect(); // force reflow
  cardEl.classList.add('exiting');
  cardEl.addEventListener('transitionend', () => done && done(), { once: true });
}

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

  // Right-click delete on card
  card.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    if (!confirm('Delete this entry?')) return;
    await deleteDoc(doc(db, "transactions", docId));
    // removal animation handled in onSnapshot('removed')
  });

  return card;
}

// ======================= Realtime: Transactions (build cards + table) =======================
onSnapshot(transactionsRef, (snapshot) => {
  const wrap  = document.getElementById("cards");                   // cards container
  const tbody = document.getElementById("main_table")?.tBodies[0];  // table body (can be hidden in CSS)

  // Build/animate cards incrementally using docChanges
  if (wrap) {
    snapshot.docChanges().forEach(change => {
      const id   = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added') {
        const card = createCard(id, data);
        wrap.prepend(card);                 // newest first; use appendChild for bottom
        animateInsert(card);
      }
      if (change.type === 'modified') {
        const old = wrap.querySelector(`[data-id="${id}"]`);
        const fresh = createCard(id, data);
        if (old) old.replaceWith(fresh);
        else { wrap.prepend(fresh); animateInsert(fresh); }
      }
      if (change.type === 'removed') {
        const card = wrap.querySelector(`[data-id="${id}"]`);
        if (card) animateRemove(card, () => card.remove());
      }
    });
  }

  // Rebuild table fully each tick (source for charts/sorting)
  categoryTotals = {
    FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
    Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
  };
  if (tbody) tbody.innerHTML = "";
  snapshot.forEach(docSnap => {
    const item = docSnap.data();
    if (tbody) addTableRow(item, docSnap.id);
    if (!(item.category in categoryTotals)) categoryTotals[item.category] = 0;
    categoryTotals[item.category] += item.amount;
  });

  updateChart();
  updateTotal();
  updateTextList();
});

// ======================= Clear All (danger) =======================
document.getElementById("clearDataBtn")?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to delete all saved transactions?")) return;
  const snap = await getDocs(transactionsRef);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "transactions", d.id))));
  const wrap = document.getElementById("cards");
  const tbody = document.getElementById("main_table")?.tBodies[0];
  if (wrap) wrap.innerHTML = "";
  if (tbody) tbody.innerHTML = "";
  categoryTotals = {
    FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
    Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
  };
  updateChart(); updateTotal(); updateTextList();
});

// ======================= Table helpers (kept for charts/sort) =======================
async function deleteInfo(docId) {
  if (confirm("Are you sure you want to delete this row?")) {
    await deleteDoc(doc(db, "transactions", docId));
  }
}

function addTableRow(item, docId) {
  const table = document.getElementById("main_table")?.tBodies[0];
  if (!table) return;
  const row = table.insertRow();
  row.insertCell(0).textContent = item.event;
  row.insertCell(1).textContent = item.date;
  row.insertCell(2).textContent = item.amount.toFixed(2);
  row.insertCell(3).textContent = item.category;
  row.insertCell(4).textContent = item.description;
  row.addEventListener('click', () => deleteInfo(docId));
}

// ======================= Totals / Text List =======================
function updateTotal() {
  const total = Object.values(categoryTotals).reduce((acc, v) => acc + v, 0);
  const el = document.getElementById("totalAmount");
  if (el) el.textContent = (Number(total) + Number(deposits)).toFixed(2);
}

function clearInputs() {
  const g = id => document.getElementById(id);
  if (g("events")) g("events").value = g("events").value; // keep selected event
  if (g("date")) g("date").value = "";
  if (g("transactionAmount")) g("transactionAmount").value = "";
  if (g("categories")) g("categories").value = "FoodAndBev";
  if (g("description")) g("description").value = "";
}

function validateDate(date) {
  return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(date);
}

function updateTextList() {
  const ul = document.querySelector(".details ul");
  if (!ul) return;
  ul.innerHTML = "";
  for (let category in categoryTotals) {
    const li = document.createElement("li");
    li.innerHTML = `${category}: <span class='percentage'>$${categoryTotals[category].toFixed(2)}</span>`;
    ul.appendChild(li);
  }
}

// ======================= Chart.js =======================
document.getElementById("chartModeSelector")?.addEventListener("change", (e) => {
  chartMode = e.target.value;
  updateChart();
});

function getChartData() {
  const events = {};
  const categories = {};
  const rows = document.getElementById("main_table")?.tBodies[0]?.rows || [];

  for (let row of rows) {
    const event = row.cells[0].textContent;
    const category = row.cells[3].textContent;
    const amount = parseFloat(row.cells[2].textContent);

    if (!events[event]) events[event] = 0;
    if (!categories[category]) categories[category] = 0;

    if (chartMode === "incomeEvent"    && amount > 0) events[event]     += amount;
    if (chartMode === "expenseEvent"   && amount < 0) events[event]     += -amount;
    if (chartMode === "incomeCategory" && amount > 0) categories[category] += amount;
    if (chartMode === "expenseCategory"&& amount < 0) categories[category] += -amount;
    if (chartMode === "netEvent")                          events[event]     += amount;
    if (chartMode === "netCategory")                       categories[category] += amount;
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
        animation: { duration: 800 },
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

// ======================= Sorting (table + mirror to cards) =======================
function updateHeaderArrows(activeIndex, asc) {
  const headers = document.querySelectorAll('#main_table th');
  headers.forEach((th, idx) => {
    th.textContent = th.textContent.replace(/\s[▲▼]$/, '');
    if (idx === activeIndex) th.textContent += asc ? ' ▲' : ' ▼';
  });
}

function sortTable(columnIndex) {
  const tbody = document.getElementById("main_table")?.tBodies[0];
  const rows  = tbody ? Array.from(tbody.rows) : [];
  const asc   = sortDirections[columnIndex] = !sortDirections[columnIndex];

  // Sort table (source of truth for chart calc)
  if (tbody) {
    rows.sort((a, b) => {
      const aText = a.cells[columnIndex].textContent.trim();
      const bText = b.cells[columnIndex].textContent.trim();

      if (columnIndex === 2) {
        return asc ? parseFloat(aText) - parseFloat(bText) : parseFloat(bText) - parseFloat(aText);
      }
      if (columnIndex === 1) {
        const parseDate = s => { const [m, d, y] = s.split('/').map(Number); return new Date(y, m-1, d); };
        return asc ? parseDate(aText) - parseDate(bText) : parseDate(bText) - parseDate(aText);
      }
      return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });
    rows.forEach(row => tbody.appendChild(row));
    updateHeaderArrows(columnIndex, asc);
  }

  // Mirror sort to cards
  const wrap = document.getElementById('cards');
  if (wrap) {
    const cards = Array.from(wrap.children);
    const keyByCol = (cIdx) => (cIdx === 0 ? 'event' : cIdx === 1 ? 'date' : cIdx === 2 ? 'amount' : 'category');
    const key = keyByCol(columnIndex);

    cards.sort((a, b) => {
      let av = a.dataset[key] || '';
      let bv = b.dataset[key] || '';
      if (key === 'amount') {
        av = parseFloat(av); bv = parseFloat(bv);
        return asc ? av - bv : bv - av;
      }
      if (key === 'date') {
        const p = s => { const [m,d,y] = s.split('/').map(Number); return new Date(y, m-1, d); };
        return asc ? p(av) - p(bv) : p(bv) - p(av);
      }
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    cards.forEach(c => wrap.appendChild(c));
  }
}

(function addSortListeners() {
  const headers = document.querySelectorAll('#main_table th');
  headers.forEach((th, idx) => {
    if (idx < 4) {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => sortTable(idx));
    }
  });
})();

// ======================= Chart mode selector hookup (if present) =======================
document.getElementById("chartModeSelector")?.addEventListener("change", (e) => {
  chartMode = e.target.value;
  updateChart();
});