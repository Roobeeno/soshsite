import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========== Firestore References ==========
const transactionsRef = collection(db, "transactions");
const eventsRef = collection(db, "events");
const depositsRef = doc(db, "meta/deposits");

let chartInstance;
let categoryTotals = {
  FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
  Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
};
let deposits = 0;
let sortDirections = {};
let chartMode = "incomeEvent";

// ---------- LOGIN ----------
window.validateLogin = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("content").style.display = "block";

    const user = userCredential.user;
    console.log("Logged in as:", user.email);
    console.log("UID:", user.uid);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
};

// ---------- EVENT LISTENERS ----------
document.getElementById("chartModeSelector").addEventListener("change", (e) => {
  chartMode = e.target.value;
  updateChart();
});

document.getElementById("clearDataBtn").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to delete all saved data?")) return;
  const snap = await getDocs(transactionsRef);
  snap.forEach(d => deleteDoc(doc(db, "transactions", d.id)));
  await setDoc(depositsRef, { value: 0 });

  categoryTotals = {
    FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
    Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
  };
  deposits = 0;
  document.getElementById("main_table").tBodies[0].innerHTML = "";
  updateChart(); updateTotal(); updateTextList();
});

// ---------- REALTIME SYNC ----------
onSnapshot(transactionsRef, (snapshot) => {
  const tbody = document.getElementById("main_table").tBodies[0];
  tbody.innerHTML = "";
  categoryTotals = {
    FoodAndBev: 0, Alcohol: 0, Decor: 0, Services: 0,
    Reimbursement: 0, Dues: 0, Door: 0, Fine: 0, Other: 0
  };
  snapshot.forEach(docSnap => {
    const item = docSnap.data();
    addTableRow(item, docSnap.id);
    if (!(item.category in categoryTotals)) categoryTotals[item.category] = 0;
    categoryTotals[item.category] += item.amount;
  });
  updateChart(); updateTotal(); updateTextList();
});

onSnapshot(eventsRef, (snapshot) => {
  const select = document.getElementById("events");
  select.innerHTML = "";
  snapshot.forEach(docSnap => {
    const ev = docSnap.data();
    select.options[select.options.length] = new Option(ev.name, ev.name);
  });
});

onSnapshot(depositsRef, (docSnap) => {
  if (docSnap.exists()) {
    deposits = Number(docSnap.data().value || 0);
    updateTotal();
  }
});

// ---------- ADD TRANSACTION ----------
window.addRow = async function () {
  const event = document.getElementById("events").value;
  const date = document.getElementById("date").value;
  const amount = parseFloat(document.getElementById("transactionAmount").value);
  const category = document.getElementById("categories").value;
  const description = document.getElementById("description").value;

  if (!event || !validateDate(date) || isNaN(amount) || !category || !description) {
    alert("Please fill all fields correctly.");
    return;
  }
  await addDoc(transactionsRef, { event, date, amount, category, description });
  clearInputs();
};

// ---------- ADD EVENT ----------
window.addEvent = async function addEvent() {
  const newEvent = prompt("Create New Event");
  if (!newEvent) return;

  const select = document.getElementById("events");
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === newEvent) {
      alert("Event already exists.");
      return;
    }
  }
  await addDoc(eventsRef, { name: newEvent });
}

function populateEventsDropdown() {
  const select = document.getElementById("events");
  select.innerHTML = ""; // Clear current options

  onSnapshot(eventsRef, (snapshot) => {
    select.innerHTML = ""; // Clear again on every update
    snapshot.forEach(doc => {
      const eventName = doc.data().name;
      const option = document.createElement("option");
      option.value = eventName;
      option.textContent = eventName;
      select.appendChild(option);
    });
  });
}

populateEventsDropdown()

// ---------- DEPOSITS (right-click) ----------
document.getElementById("totalAmount").addEventListener("contextmenu", async (e) => {
  e.preventDefault();
  const inputVal = prompt("Input deposit");
  if (isNaN(inputVal)) return alert("Please enter a valid number");
  deposits += Number(inputVal);
  await setDoc(depositsRef, { value: deposits });
  updateTotal();
});

// ---------- DELETE ROW ----------
async function deleteInfo(docId) {
  if (confirm("Are you sure you want to delete this row?")) {
    await deleteDoc(doc(db, "transactions", docId));
  }
}

function addTableRow(item, docId) {
  const table = document.getElementById("main_table").tBodies[0];
  const row = table.insertRow();
  row.insertCell(0).textContent = item.event;
  row.insertCell(1).textContent = item.date;
  row.insertCell(2).textContent = item.amount.toFixed(2);
  row.insertCell(3).textContent = item.category;
  row.insertCell(4).textContent = item.description;
  row.addEventListener('click', () => deleteInfo(docId));
}

// ---------- UTILITY FUNCTIONS ----------
function updateTotal() {
  let total = Object.values(categoryTotals).reduce((acc, val) => acc + val, 0);
  document.getElementById("totalAmount").textContent = (Number(total) + Number(deposits)).toFixed(2);
}

function clearInputs() {
  document.getElementById("events").value = "";
  document.getElementById("date").value = "";
  document.getElementById("transactionAmount").value = "";
  document.getElementById("categories").value = "FoodAndBev";
  document.getElementById("description").value = "";
}

function validateDate(date) {
  return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(date);
}

function updateTextList() {
  const ul = document.querySelector(".details ul");
  ul.innerHTML = "";
  for (let category in categoryTotals) {
    const li = document.createElement("li");
    li.innerHTML = `${category}: <span class='percentage'>$${categoryTotals[category].toFixed(2)}</span>`;
    ul.appendChild(li);
  }
}

// ---------- CHARTING ----------
function getChartData() {
  const events = {};
  const categories = {};
  const rows = document.getElementById("main_table").tBodies[0].rows;

  for (let row of rows) {
    const event = row.cells[0].textContent;
    const category = row.cells[3].textContent;
    const amount = parseFloat(row.cells[2].textContent);

    if (!events[event]) events[event] = 0;
    if (!categories[category]) categories[category] = 0;

    if (chartMode === "incomeEvent" && amount > 0) events[event] += amount;
    if (chartMode === "expenseEvent" && amount < 0) events[event] += -amount;
    if (chartMode === "incomeCategory" && amount > 0) categories[category] += amount;
    if (chartMode === "expenseCategory" && amount < 0) categories[category] += -amount;
  }

  const labels = chartMode.includes("Event") ? Object.keys(events) : Object.keys(categories);
  const data = chartMode.includes("Event") ? Object.values(events) : Object.values(categories);

  return { labels, data };
}

function updateChart() {
  const ctx = document.querySelector(".my-chart");
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
        datasets: [{
          label: "Amount ($)",
          data: chartData.data,
          backgroundColor: "#457b9d"
        }]
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

// ---------- TABLE SORT ----------
function updateHeaderArrows(activeIndex, asc) {
  const headers = document.querySelectorAll('#main_table th');
  headers.forEach((th, idx) => {
    th.textContent = th.textContent.replace(/\s[▲▼]$/, '');
    if (idx === activeIndex) th.textContent += asc ? ' ▲' : ' ▼';
  });
}

function sortTable(columnIndex) {
  const tbody = document.getElementById("main_table").tBodies[0];
  const rows = Array.from(tbody.rows);
  const asc = sortDirections[columnIndex] = !sortDirections[columnIndex];

  rows.sort((a, b) => {
    const aText = a.cells[columnIndex].textContent.trim();
    const bText = b.cells[columnIndex].textContent.trim();

    if (columnIndex === 2) {
      return asc ? parseFloat(aText) - parseFloat(bText) : parseFloat(bText) - parseFloat(aText);
    }
    if (columnIndex === 1) {
      const parseDate = s => {
        const [m, d, y] = s.split('/').map(Number);
        return new Date(y, m - 1, d);
      };
      return asc ? parseDate(aText) - parseDate(bText) : parseDate(bText) - parseDate(aText);
    }
    return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
  });

  rows.forEach(row => tbody.appendChild(row));
  updateHeaderArrows(columnIndex, asc);
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