import { auth, db } from "./firebase-init.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  filterTransactionsBySchoolYear,
  parseStoredDate,
  populateSchoolYearSelect,
  resolveSelectedSchoolYear,
  saveSchoolYear,
  schoolYearDateRangeLabel,
  schoolYearKeyForDate,
  schoolYearLabel,
} from "./school-year.js";

const transactionsRef = collection(db, "transactions");
const eventsRef = collection(db, "events");
const provider = new GoogleAuthProvider();
const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

let allTransactions = [];
let selectedSchoolYear = "";

window.logout = () => signOut(auth);

window.loginWithGoogle = async () => {
  const button = document.getElementById("googleLoginBtn");
  try {
    setLoginButtonState(button, true);
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Login failed: " + error.message);
    await signOut(auth);
  } finally {
    setLoginButtonState(button, false);
  }
};

onAuthStateChanged(auth, async (user) => {
  const loginSection = document.getElementById("loginSection");
  const content = document.getElementById("content");

  if (!user) {
    if (loginSection) loginSection.style.display = "grid";
    if (content) content.style.display = "none";
    return;
  }

  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    if (!adminDoc.exists()) {
      alert("You are not authorized to access admin features.");
      await signOut(auth);
      return;
    }

    if (loginSection) loginSection.style.display = "none";
    if (content) content.style.display = "block";
  } catch (error) {
    console.error("Admin authorization check failed", error);
    alert("Could not verify admin access. Please try again.");
    await signOut(auth);
  }
});

window.addRow = async function () {
  const event = document.getElementById("events")?.value.trim() || "";
  const dateInput = document.getElementById("date")?.value || "";
  const amount = parseFloat(
    document.getElementById("transactionAmount")?.value,
  );
  const category = document.getElementById("categories")?.value || "";
  const description =
    document.getElementById("description")?.value.trim() || "";

  if (
    !event ||
    !dateInput ||
    Number.isNaN(amount) ||
    !category ||
    !description
  ) {
    alert("Please complete every field before adding the transaction.");
    return;
  }

  const date = dateInputToStoredDate(dateInput);
  const parsedDate = parseStoredDate(date);
  if (!parsedDate) {
    alert("Please choose a valid date.");
    return;
  }

  const transactionSchoolYear = schoolYearKeyForDate(parsedDate);
  if (transactionSchoolYear !== selectedSchoolYear) {
    alert(
      `That date belongs to the ${schoolYearLabel(transactionSchoolYear)} school year.\n\n` +
        `You are currently managing ${schoolYearLabel(selectedSchoolYear)}. ` +
        `Change the school-year selector first, or choose a date within ${schoolYearDateRangeLabel(selectedSchoolYear)}.`,
    );
    return;
  }

  const button = document.querySelector(".rect-cta");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving…";
  }

  try {
    await addDoc(transactionsRef, {
      event,
      date,
      amount,
      category,
      description,
      schoolYear: selectedSchoolYear,
    });
    clearInputs();
  } catch (error) {
    alert("Failed to add transaction: " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Add transaction";
    }
  }
};

window.addEvent = async function () {
  const raw = prompt("Name the new event");
  const newEvent = raw?.trim();
  if (!newEvent) return;

  const select = document.getElementById("events");
  const duplicate = Array.from(select?.options || []).some(
    (option) => option.value.toLowerCase() === newEvent.toLowerCase(),
  );

  if (duplicate) {
    alert("That event already exists.");
    return;
  }

  try {
    await addDoc(eventsRef, { name: newEvent });
  } catch (error) {
    alert("Could not create the event: " + error.message);
  }
};

onSnapshot(eventsRef, (snapshot) => {
  const select = document.getElementById("events");
  if (!select) return;

  const current = select.value;
  const events = snapshot.docs
    .map((d) => d.data().name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  select.replaceChildren(...events.map((name) => new Option(name, name)));
  if (events.includes(current)) select.value = current;
});

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
  refreshAdmin();
});

document
  .getElementById("schoolYearSelector")
  ?.addEventListener("change", (event) => {
    selectedSchoolYear = event.target.value;
    saveSchoolYear(selectedSchoolYear);
    refreshAdmin();
  });

function transactionsForSelectedYear() {
  return filterTransactionsBySchoolYear(allTransactions, selectedSchoolYear);
}

function refreshAdmin() {
  const transactions = transactionsForSelectedYear();
  setText(
    "adminSchoolYearLabel",
    `${schoolYearLabel(selectedSchoolYear)} school year`,
  );
  setText("adminSchoolYearRange", schoolYearDateRangeLabel(selectedSchoolYear));
  setText(
    "ledgerSchoolYear",
    `${schoolYearLabel(selectedSchoolYear)} school year`,
  );
  setText(
    "dateSchoolYearHint",
    `Date must fall within ${schoolYearDateRangeLabel(selectedSchoolYear)}.`,
  );
  setText(
    "dangerZoneCopy",
    `Permanently delete all ${transactions.length} transactions in the ${schoolYearLabel(selectedSchoolYear)} school year.`,
  );

  updateTotal(transactions);
  renderCards(
    [...transactions].sort((a, b) => parseDate(b.date) - parseDate(a.date)),
  );
  document
    .getElementById("adminEmptyState")
    ?.classList.toggle("hidden", transactions.length !== 0);
}

function updateTotal(transactions) {
  const total = transactions.reduce(
    (sum, t) => sum + (Number(t.amount) || 0),
    0,
  );
  setText("totalAmount", money.format(total));
  setText("transactionCount", String(transactions.length));
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
  const value = Number(item.amount) || 0;
  const amount = el(
    "div",
    `amount ${value >= 0 ? "positive" : "negative"}`,
    `${value >= 0 ? "+$" : "−$"}${money.format(Math.abs(value))}`,
  );

  const deleteButton = el("button", "delete-button", "Delete");
  deleteButton.type = "button";
  deleteButton.setAttribute(
    "aria-label",
    `Delete ${item.event || "transaction"}`,
  );
  deleteButton.addEventListener("click", () => deleteTransaction(item, card));

  side.append(amount, deleteButton);
  card.append(main, side);
  return card;
}

async function deleteTransaction(item, card) {
  const amount = Number(item.amount) || 0;
  const formatted = `${amount >= 0 ? "+$" : "−$"}${money.format(Math.abs(amount))}`;
  const confirmed = confirm(
    `Delete this transaction?\n\n${item.event || "Untitled event"}\n${formatted}\n\nThis cannot be undone.`,
  );
  if (!confirmed) return;

  try {
    card.classList.add("exit-swoosh");
    await deleteDoc(doc(db, "transactions", item.id));
  } catch (error) {
    card.classList.remove("exit-swoosh");
    alert("Could not delete the transaction: " + error.message);
  }
}

document.getElementById("clearDataBtn")?.addEventListener("click", async () => {
  const transactions = transactionsForSelectedYear();
  if (!transactions.length) {
    alert(
      `There are no transactions in the ${schoolYearLabel(selectedSchoolYear)} school year.`,
    );
    return;
  }

  const confirmed = confirm(
    `Permanently delete all ${transactions.length} transactions from the ${schoolYearLabel(selectedSchoolYear)} school year?\n\n` +
      `Transactions from other school years will NOT be deleted.\n\nThis cannot be undone.`,
  );
  if (!confirmed) return;

  const button = document.getElementById("clearDataBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Deleting…";
  }

  try {
    await Promise.all(
      transactions.map((transaction) =>
        deleteDoc(doc(db, "transactions", transaction.id)),
      ),
    );
  } catch (error) {
    alert("Could not clear this school year: " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Clear this school year";
    }
  }
});

function clearInputs() {
  const date = document.getElementById("date");
  const amount = document.getElementById("transactionAmount");
  const category = document.getElementById("categories");
  const description = document.getElementById("description");

  if (date) date.value = "";
  if (amount) amount.value = "";
  if (category) category.value = "FoodAndBev";
  if (description) description.value = "";
  amount?.focus();
}

function dateInputToStoredDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
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

function setLoginButtonState(button, loading) {
  if (!button) return;
  button.disabled = loading;
  if (loading) button.lastChild.textContent = " Signing in…";
  else button.lastChild.textContent = " Sign in with Google";
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
