// main-manage.js — manage view with bounce-in / swoosh-out card animations (no table, no chart)

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
let deposits = 0;
let transactions = [];  // array of {id, event, date, amount, category, description}
let firstLoad = true;   // prevents entrance animation storm on initial render

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

// ======================= Cards + Animations via docChanges =======================
onSnapshot(transactionsRef, (snapshot) => {
  // 1) Keep an array for totals + category list
  transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  updateTotal();
  updateCategoryList(transactions);

  // 2) Animate add/modify/remove incrementally
  const wrap = document.getElementById("cards");
  if (!wrap) return;

  if (firstLoad) {
    // Initial paint: build all cards without entrance animation
    wrap.innerHTML = "";
    transactions.forEach(item => wrap.appendChild(createCard(item.id, item)));
    firstLoad = false;
    return;
  }

  snapshot.docChanges().forEach(change => {
    const id = change.doc.id;
    const data = change.doc.data();

    if (change.type === "added") {
      // Guard against duplicates if Firestore reorders
      if (!wrap.querySelector(`[data-id="${id}"]`)) {
        const card = createCard(id, data);
        wrap.prepend(card);            // newest on top
        animateInsertBounce(card);
      }
    }

    if (change.type === "modified") {
      const old = wrap.querySelector(`[data-id="${id}"]`);
      const fresh = createCard(id, data);
      if (old) old.replaceWith(fresh);
      // subtle nudge to indicate change
      animateInsertBounce(fresh, /*quick*/ true);
    }

    if (change.type === "removed") {
      const card = wrap.querySelector(`[data-id="${id}"]`);
      if (card) animateRemoveSwoosh(card, () => card.remove());
    }
  });
});

// ======================= Render helpers =======================
function createCard(docId, item) {
  const card = document.createElement("div");
  card.className = "txn-card";
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
        ${item.amount >= 0 ? '$' : '-$'}${Math.abs(Number(item.amount)).toFixed(2)}
      </div>
      <div class="desc">${item.description || ''}</div>
    </div>
    <div class="txn-right">
      <div class="category">${item.category}</div>
    </div>
  `;

  // Right-click delete on card
  card.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    if (!confirm("Delete this entry?")) return;
    await deleteDoc(doc(db, "transactions", docId));
  });

  return card;
}

// ---- Animations ----
function animateInsertBounce(el, quick = false) {
  el.classList.remove("enter-bounce-quick", "enter-bounce");
  el.classList.add(quick ? "enter-bounce-quick" : "enter-bounce");
  el.addEventListener("animationend", () => {
    el.classList.remove("enter-bounce-quick", "enter-bounce");
  }, { once: true });
}

function animateRemoveSwoosh(el, done) {
  // Lock height so we can collapse smoothly at the end
  el.style.maxHeight = el.offsetHeight + "px";
  el.classList.add("exit-swoosh");
  el.addEventListener("animationend", () => {
    el.classList.remove("exit-swoosh");
    if (done) done();
  }, { once: true });
}

// ======================= Clear All (danger) =======================
document.getElementById("clearDataBtn")?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to delete all saved transactions?")) return;
  const snap = await getDocs(transactionsRef);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "transactions", d.id))));
});

// ======================= Totals & Categories =======================
function updateTotal() {
  const sum = transactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const el = document.getElementById("totalAmount");
  if (el) el.textContent = (sum + Number(deposits)).toFixed(2);
}

function updateCategoryList(items) {
  const totals = {};
  items.forEach(t => {
    const cat = t.category || "Other";
    const amt = Number(t.amount) || 0;
    totals[cat] = (totals[cat] || 0) + amt;
  });
  const ul = document.querySelector(".details ul");
  if (!ul) return;
  ul.innerHTML = "";
  Object.keys(totals).forEach(cat => {
    const li = document.createElement("li");
    li.innerHTML = `${cat}: <span class='percentage'>$${totals[cat].toFixed(2)}</span>`;
    ul.appendChild(li);
  });
}

// ======================= Utils =======================
function clearInputs() {
  const g = id => document.getElementById(id);
  if (g("events")) g("events").value = g("events").value;
  if (g("date")) g("date").value = "";
  if (g("transactionAmount")) g("transactionAmount").value = "";
  if (g("categories")) g("categories").value = "FoodAndBev";
  if (g("description")) g("description").value = "";
}

function validateDate(date) {
  return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(date);
}