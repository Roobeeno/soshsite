import { db } from "./firebase-init.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  filterTransactionsBySchoolYear,
  populateSchoolYearSelect,
  resolveSelectedSchoolYear,
  saveSchoolYear,
  schoolYearDateRangeLabel,
  schoolYearLabel,
} from "./school-year.js";

const transactionsRef = collection(db, "transactions");
const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let allTransactions = [];
let selectedSchoolYear = "";
let searchTerm = "";
let sortPreset = "date-desc";

const categoryLabels = {
  FoodAndBev: "Food & Bev",
  Alcohol: "Alcohol",
  Decor: "Decor",
  Services: "Services",
  Service: "Services",
  Reimbursement: "Reimbursement",
  Dues: "Social Dues",
  Door: "Door Fee",
  Fine: "Fine",
  Other: "Other",
};

onSnapshot(transactionsRef, (snapshot) => {
  allTransactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  selectedSchoolYear = resolveSelectedSchoolYear(
    allTransactions,
    selectedSchoolYear,
  );
  selectedSchoolYear = populateSchoolYearSelect(
    document.getElementById("schoolYearSelector"),
    allTransactions,
    selectedSchoolYear,
  );
  refreshPage();
});

document
  .getElementById("schoolYearSelector")
  ?.addEventListener("change", (event) => {
    selectedSchoolYear = event.target.value;
    saveSchoolYear(selectedSchoolYear);
    refreshPage();
  });

document
  .getElementById("transactionSearch")
  ?.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderCurrentView();
  });

document.getElementById("sortPreset")?.addEventListener("change", (event) => {
  sortPreset = event.target.value;
  renderCurrentView();
});

function schoolYearTransactions() {
  return filterTransactionsBySchoolYear(allTransactions, selectedSchoolYear);
}

function refreshPage() {
  updateSchoolYearCopy();
  updateSummary();
  renderCurrentView();
}

function updateSchoolYearCopy() {
  const label = schoolYearLabel(selectedSchoolYear);
  setText("activitySchoolYear", `${label} school year`);
  setText("schoolYearRange", schoolYearDateRangeLabel(selectedSchoolYear));
}

function updateSummary() {
  const transactions = schoolYearTransactions();
  const income = transactions.reduce((sum, t) => {
    const amount = Number(t.amount) || 0;
    return amount > 0 ? sum + amount : sum;
  }, 0);

  const expense = transactions.reduce((sum, t) => {
    const amount = Number(t.amount) || 0;
    return amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);

  setText("totalAmount", money.format(income - expense));
  setText("incomeTotal", money.format(income));
  setText("expenseTotal", money.format(expense));
  setText("transactionCount", String(transactions.length));
}

function renderCurrentView() {
  const transactions = schoolYearTransactions();
  const filtered = transactions.filter((item) => {
    if (!searchTerm) return true;
    const haystack = [
      item.event,
      item.description,
      item.category,
      categoryLabel(item.category),
      item.date,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchTerm);
  });

  const sorted = [...filtered].sort(sortComparator(sortPreset));
  renderCards(sorted);

  const empty = document.getElementById("emptyState");
  if (empty) empty.classList.toggle("hidden", sorted.length !== 0);
}

function renderCards(items) {
  const wrap = document.getElementById("cards");
  if (!wrap) return;
  wrap.replaceChildren(...items.map(createCard));
}

function createCard(item) {
  const card = el("article", "txn-card");

  const main = el("div", "txn-main");
  const event = el("h3", "txn-event", item.event || "Untitled event");
  const desc = el("p", "txn-desc", item.description || "No description");
  const meta = el("div", "txn-meta");
  meta.append(
    el("span", "txn-date", prettyDate(item.date)),
    el("span", "category", categoryLabel(item.category)),
  );
  main.append(event, desc, meta);

  const side = el("div", "txn-side");
  const amountValue = Number(item.amount) || 0;
  side.append(
    el(
      "div",
      `amount ${amountValue >= 0 ? "positive" : "negative"}`,
      `${amountValue >= 0 ? "+$" : "−$"}${money.format(Math.abs(amountValue))}`,
    ),
  );

  card.append(main, side);
  return card;
}

function sortComparator(preset) {
  const [field, direction] = preset.split("-");
  const multiplier = direction === "asc" ? 1 : -1;

  return (a, b) => {
    if (field === "date") {
      return multiplier * (parseDate(a.date) - parseDate(b.date));
    }
    if (field === "amount") {
      return multiplier * ((Number(a.amount) || 0) - (Number(b.amount) || 0));
    }

    const av =
      field === "category" ? categoryLabel(a.category) : a[field] || "";
    const bv =
      field === "category" ? categoryLabel(b.category) : b[field] || "";
    return multiplier * String(av).localeCompare(String(bv));
  };
}

function parseDate(value) {
  const [m, d, y] = String(value || "")
    .split("/")
    .map(Number);
  if (!m || !d || !y) return 0;
  return new Date(y, m - 1, d).getTime();
}

function prettyDate(value) {
  const [m, d, y] = String(value || "")
    .split("/")
    .map(Number);
  if (!m || !d || !y) return value || "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function categoryLabel(value) {
  return (
    categoryLabels[value] ||
    String(value || "Other").replace(/([a-z])([A-Z])/g, "$1 $2")
  );
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
