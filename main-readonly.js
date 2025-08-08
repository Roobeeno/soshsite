import { db } from "./firebase-init.js";
import { collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let chartInstance;
let chartMode = "incomeEvent";
let categoryTotals = {
  FoodAndBev:0, Alcohol:0, Decor:0, Services:0, Reimbursement:0, Dues:0, Door:0, Fine:0, Other:0
};

const transactionsRef = collection(db, "transactions");

onSnapshot(transactionsRef, snapshot => {
  const tbody = document.getElementById("main_table").tBodies[0];
  tbody.innerHTML = "";
  categoryTotals = { FoodAndBev:0, Alcohol:0, Decor:0, Services:0, Reimbursement:0, Dues:0, Door:0, Fine:0, Other:0 };
  snapshot.forEach(docSnap => {
    const item = docSnap.data();
    const row = tbody.insertRow();
    row.insertCell(0).textContent = item.event;
    row.insertCell(1).textContent = item.date;
    row.insertCell(2).textContent = item.amount.toFixed(2);
    row.insertCell(3).textContent = item.category;
    row.insertCell(4).textContent = item.description;
    if (!(item.category in categoryTotals)) categoryTotals[item.category] = 0;
    categoryTotals[item.category] += item.amount;
  });
  updateChart(); updateTotal(); updateTextList();
});

document.getElementById("chartModeSelector").addEventListener("change", (e)=>{
  chartMode = e.target.value;
  updateChart();
});

function updateTotal() {
  let total = Object.values(categoryTotals).reduce((a,b)=>a+b,0);
  document.getElementById("totalAmount").textContent = (total).toFixed(2);
}
function updateTextList() {
  const ul = document.querySelector(".details ul");
  ul.innerHTML = "";
  for (let cat in categoryTotals) {
    const li = document.createElement("li");
    li.innerHTML = `${cat}: <span class='percentage'>$${categoryTotals[cat].toFixed(2)}</span>`;
    ul.appendChild(li);
  }
}
function getChartData() {
  const events = {}, categories = {};
  const rows = document.getElementById("main_table").tBodies[0].rows;
  for (let row of rows) {
    const event = row.cells[0].textContent;
    const category = row.cells[3].textContent;
    const amount = parseFloat(row.cells[2].textContent);
    if(!events[event]) events[event]=0;
    if(!categories[category]) categories[category]=0;
    if(chartMode==="incomeEvent" && amount>0) events[event]+=amount;
    if(chartMode==="expenseEvent" && amount<0) events[event]+=-amount;
    if(chartMode==="incomeCategory" && amount>0) categories[category]+=amount;
    if(chartMode==="expenseCategory" && amount<0) categories[category]+=-amount;
    if(chartMode==="netEvent") events[event]+=amount;
    if(chartMode==="netCategory") categories[category]+=amount;

    // <option value="netEvent">Net by Event</option>
    // <option value="netCategory">Net by Category</option>
  }
  const labels = chartMode.includes("Event")?Object.keys(events):Object.keys(categories);
  const data = chartMode.includes("Event")?Object.values(events):Object.values(categories);
  return { labels, data };
}
function updateChart() {
  const ctx = document.querySelector(".my-chart");
  const chartData = getChartData();
  if(chartInstance){
    chartInstance.data.labels=chartData.labels;
    chartInstance.data.datasets[0].data=chartData.data;
    chartInstance.update();
  }else{
    chartInstance = new Chart(ctx, {
      type:"bar",
      data:{labels:chartData.labels, datasets:[{label:"Amount ($)",data:chartData.data, backgroundColor:"#457b9d"}]},
      options:{responsive:true, plugins:{legend:{display:false}}}
    });
  }
}
