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

const modeTitles = {
  incomeEvent: "Income by event",
  expenseEvent: "Spending by event",
  incomeCategory: "Income by category",
  expenseCategory: "Spending by category",
  netEvent: "Net cash flow by event",
  netCategory: "Net cash flow by category",
};

let chartInstance;
let chartMode = "incomeEvent";
let allTransactions = [];
let selectedSchoolYear = "";

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
  refreshAnalytics();
});

document
  .getElementById("schoolYearSelector")
  ?.addEventListener("change", (event) => {
    selectedSchoolYear = event.target.value;
    saveSchoolYear(selectedSchoolYear);
    refreshAnalytics();
  });

document
  .getElementById("chartModeSelector")
  ?.addEventListener("change", (event) => {
    chartMode = event.target.value;
    renderChart();
  });

function transactionsForSelectedYear() {
  return filterTransactionsBySchoolYear(allTransactions, selectedSchoolYear);
}

function refreshAnalytics() {
  setText(
    "chartSchoolYear",
    `${schoolYearLabel(selectedSchoolYear)} school year`,
  );
  setText("analyticsYearRange", schoolYearDateRangeLabel(selectedSchoolYear));
  updateSummary();
  renderChart();
}

function updateSummary() {
  let income = 0;
  let expense = 0;

  transactionsForSelectedYear().forEach((t) => {
    const amount = Number(t.amount) || 0;
    if (amount > 0) income += amount;
    if (amount < 0) expense += Math.abs(amount);
  });

  setText("analyticsBalance", money.format(income - expense));
  setText("analyticsIncome", money.format(income));
  setText("analyticsExpense", money.format(expense));
}

function aggregate(items, mode) {
  const totals = new Map();
  const byEvent = mode.endsWith("Event");

  items.forEach((t) => {
    const amount = Number(t.amount) || 0;
    const key = byEvent
      ? t.event || "Unspecified"
      : categoryLabel(t.category || "Other");

    let contribution = 0;
    if (mode.startsWith("income") && amount > 0) contribution = amount;
    if (mode.startsWith("expense") && amount < 0)
      contribution = Math.abs(amount);
    if (mode.startsWith("net")) contribution = amount;

    if (contribution !== 0) {
      totals.set(key, (totals.get(key) || 0) + contribution);
    }
  });

  const entries = [...totals.entries()].sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  );
  return {
    labels: entries.map(([label]) => label),
    data: entries.map(([, value]) => Number(value.toFixed(2))),
  };
}

function renderChart() {
  const canvas = document.getElementById("budgetChart");
  if (!canvas || typeof Chart === "undefined") return;

  const title = modeTitles[chartMode] || "Budget breakdown";
  setText("chartTitle", title);

  const { labels, data } = aggregate(transactionsForSelectedYear(), chartMode);
  const isEmpty = labels.length === 0;
  canvas.style.display = isEmpty ? "none" : "block";
  document.getElementById("chartEmpty")?.classList.toggle("hidden", !isEmpty);
  if (isEmpty) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = undefined;
    }
    return;
  }

  const colors = chartColors();

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = colors.fill;
    chartInstance.data.datasets[0].borderColor = colors.stroke;
    chartInstance.options.plugins.tooltip.callbacks.label = tooltipLabel;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Amount",
          data,
          backgroundColor: colors.fill,
          borderColor: colors.stroke,
          borderWidth: 1,
          borderRadius: 7,
          maxBarThickness: 58,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: { duration: 350 },
      layout: { padding: { top: 8 } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: "#667085",
            font: { family: "Montserrat", size: 11, weight: 600 },
            maxRotation: 35,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: "#eef1f4" },
          ticks: {
            color: "#98a2b3",
            font: { family: "Montserrat", size: 11 },
            callback: (value) => "$" + Number(value).toLocaleString("en-US"),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { label: tooltipLabel },
        },
      },
    },
  });
}

function chartColors() {
  if (chartMode.startsWith("income")) {
    return { fill: "rgba(22, 131, 93, 0.72)", stroke: "#16835d" };
  }
  if (chartMode.startsWith("expense")) {
    return { fill: "rgba(181, 71, 63, 0.70)", stroke: "#b5473f" };
  }
  return { fill: "rgba(53, 104, 154, 0.72)", stroke: "#35689a" };
}

function tooltipLabel(context) {
  const value = Number(context.raw) || 0;
  const sign = value < 0 ? "−" : "";
  return `${sign}$${money.format(Math.abs(value))}`;
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
