// main-readonly.js — cards-only view with FLIP sorting (no table, no chart)

import { db } from "./firebase-init.js";
import {
  collection,
  onSnapshot,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const transactionsRef = collection(db, "transactions");
const depositsRef     = doc(db, "meta/deposits");

let transactions = [];
let deposits = 0;

/* ===================== FLIP HELPERS ===================== */
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

  const reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  after.forEach((afterBox, el) => {
    const prior = before.get(el);
    if (!prior) return;

    const dx = prior.left - afterBox.left;
    const dy = prior.top  - afterBox.top;

    if (dx || dy) {
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
      requestAnimationFrame(() => {
        // force layout
        void el.offsetHeight;
        el.style.transition = reduced ? 'none' : '';
        el.style.transform = '';
      });
    }
  });
}

/* ================ FIRESTORE SUBSCRIPTIONS ================ */
onSnapshot(depositsRef, (docSnap) => {
  deposits = docSnap.exists() ? Number(docSnap.data().value || 0) : 0;
  updateTotal();
});

onSnapshot(transactionsRef, (snapshot) => {
  transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCards(transactions);
  updateTotal();
  updateCategoryList(transactions);
  applyCurrentSort(); // keep current sort after refresh
});

/* ======================== RENDER ========================= */
function renderCards(items) {
  const wrap  = document.getElementById("cards");
  if (!wrap) return;
  wrap.innerHTML = "";
  items.forEach(item => wrap.appendChild(createCard(item.id, item)));
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
        ${item.amount >= 0 ? '$' : '-$'}${Math.abs(Number(item.amount)).toFixed(2)}
      </div>
      <div class="desc">${item.description || ''}</div>
    </div>
    <div class="txn-right">
      <div class="category">${item.category}</div>
    </div>
  `;
  // read-only: no delete handler
  return card;
}

/* ================== TOTALS + CATEGORY LIST ================= */
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

/* ======================== SORTING ======================== */
// expects cards carry data-*: event, date, amount, category
function parseDateMMDDYYYY(s) {
  const [m, d, y] = (s || "").split("/").map(Number);
  if (!m || !d || !y) return new Date(0);
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

  // LAST
  cards.forEach(c => wrap.appendChild(c));

  // INVERT + PLAY
  playFLIP(wrap, before);
}

function applyCurrentSort() {
  const fieldSel = document.getElementById("sortField");
  const dirSel   = document.getElementById("sortDir");
  if (!fieldSel || !dirSel) return;
  sortCards(fieldSel.value, dirSel.value);
}

// Wire sort controls if present
document.getElementById("sortField")?.addEventListener("change", applyCurrentSort);
document.getElementById("sortDir")?.addEventListener("change", applyCurrentSort);