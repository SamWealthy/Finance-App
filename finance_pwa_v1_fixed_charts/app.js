const STORAGE_KEY = "finance_tracker_v1";
const AUTH_KEY = "finance_tracker_auth_v1";

const defaultState = {
  income: 2700,
  expenses: [
    { id: crypto.randomUUID(), name: "Rent", amount: 650, paid: false },
    { id: crypto.randomUUID(), name: "Council Tax", amount: 178, paid: false },
    { id: crypto.randomUUID(), name: "Phone", amount: 104, paid: false },
    { id: crypto.randomUUID(), name: "Broadband", amount: 25, paid: false },
    { id: crypto.randomUUID(), name: "Life Insurance", amount: 45, paid: false },
    { id: crypto.randomUUID(), name: "Fuel", amount: 200, paid: false },
    { id: crypto.randomUUID(), name: "Disney", amount: 6, paid: false },
    { id: crypto.randomUUID(), name: "OpenAI", amount: 20, paid: false },
    { id: crypto.randomUUID(), name: "Google", amount: 5, paid: false },
    { id: crypto.randomUUID(), name: "Amazon", amount: 9, paid: false },
    { id: crypto.randomUUID(), name: "Tithe", amount: 270, paid: false },
    { id: crypto.randomUUID(), name: "Offerings", amount: 80, paid: false },
    { id: crypto.randomUUID(), name: "Family Support", amount: 100, paid: false },
    { id: crypto.randomUUID(), name: "ALC9 Payment", amount: 200, paid: false },
    { id: crypto.randomUUID(), name: "Klarna Payment", amount: 118, paid: false },
    { id: crypto.randomUUID(), name: "HSBC Overdraft", amount: 445, paid: false }
  ],
  debts: [
    { id: crypto.randomUUID(), name: "ALC9", balance: 12000, payment: 200, apr: 0 },
    { id: crypto.randomUUID(), name: "Klarna", balance: 232, payment: 118, apr: 0 },
    { id: crypto.randomUUID(), name: "HSBC Overdraft", balance: 445, payment: 445, apr: 39.9 }
  ]
};

let state = loadState();
let expenseChart = null;
let debtChart = null;
let unlocked = false;
let chartRenderTimer = null;

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function getAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function clearAuthInputs() {
  document.getElementById("passwordInput").value = "";
  document.getElementById("confirmPasswordInput").value = "";
}

function showAuthMode() {
  const auth = getAuth();
  const isSetup = !auth;

  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
  document.getElementById("authTitle").textContent = isSetup ? "Set Password" : "Enter Password";
  document.getElementById("authSubtitle").textContent = isSetup ? "Create a password for this device." : "Unlock your finance tracker.";
  document.getElementById("authButton").textContent = isSetup ? "Save Password" : "Unlock";
  document.getElementById("confirmPasswordInput").classList.toggle("hidden", !isSetup);
  document.getElementById("forgotPasswordBtn").classList.toggle("hidden", isSetup);
  document.getElementById("authMessage").textContent = "";
  clearAuthInputs();
}

function unlockApp() {
  unlocked = true;
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  render();
}

document.getElementById("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const auth = getAuth();
  const password = document.getElementById("passwordInput").value;
  const confirmPassword = document.getElementById("confirmPasswordInput").value;
  const message = document.getElementById("authMessage");

  if (!auth) {
    if (password.length < 4) {
      message.textContent = "Use at least 4 characters.";
      return;
    }
    if (password !== confirmPassword) {
      message.textContent = "Passwords do not match.";
      return;
    }
    const salt = crypto.randomUUID();
    const hash = await sha256(salt + password);
    setAuth({ salt, hash });
    unlockApp();
    return;
  }

  const attemptHash = await sha256(auth.salt + password);
  if (attemptHash === auth.hash) unlockApp();
  else message.textContent = "Incorrect password.";
});

document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
  const confirmReset = confirm("Password reset will delete this device's saved finance data and password. Continue?");
  if (!confirmReset) return;

  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  showAuthMode();
});

document.getElementById("lockBtn").addEventListener("click", () => {
  unlocked = false;
  showAuthMode();
});

document.getElementById("changePasswordBtn").addEventListener("click", async () => {
  const auth = getAuth();
  if (!auth) return;

  const current = prompt("Enter current password:");
  if (current === null) return;

  const currentHash = await sha256(auth.salt + current);
  if (currentHash !== auth.hash) {
    alert("Incorrect current password.");
    return;
  }

  const newPassword = prompt("Enter new password:");
  if (newPassword === null) return;

  if (newPassword.length < 4) {
    alert("Use at least 4 characters.");
    return;
  }

  const confirmNew = prompt("Confirm new password:");
  if (confirmNew === null) return;

  if (newPassword !== confirmNew) {
    alert("Passwords do not match.");
    return;
  }

  const salt = crypto.randomUUID();
  const hash = await sha256(salt + newPassword);
  setAuth({ salt, hash });

  alert("Password changed.");
});

function money(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(Number(value || 0));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function totalExpenses() {
  return state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function paidThisMonth() {
  return state.expenses.filter(item => item.paid).reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function remainingToPay() {
  return state.expenses.filter(item => !item.paid).reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function totalDebt() {
  return state.debts.reduce((sum, debt) => sum + Number(debt.balance || 0), 0);
}

function monthsToPayoff(balance, payment, apr) {
  balance = Number(balance || 0);
  payment = Number(payment || 0);
  apr = Number(apr || 0);

  if (balance <= 0) return "0";
  if (payment <= 0) return "No payment";

  const monthlyRate = apr / 100 / 12;

  if (monthlyRate === 0) return Math.ceil(balance / payment).toString();
  if (payment <= balance * monthlyRate) return "Not reducing";

  const months = -Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate);
  return Math.ceil(months).toString();
}

function renderDashboard() {
  const income = Number(state.income || 0);
  const outgoings = totalExpenses();
  const paid = paidThisMonth();
  const remaining = remainingToPay();
  const leftAfterRemaining = income - remaining;

  document.getElementById("incomeDisplay").textContent = money(income);
  document.getElementById("outgoingsDisplay").textContent = money(outgoings);
  document.getElementById("paidDisplay").textContent = money(paid);

  const leftDisplay = document.getElementById("leftDisplay");
  leftDisplay.textContent = money(leftAfterRemaining);
  leftDisplay.className = leftAfterRemaining >= 0 ? "positive" : "negative";

  document.getElementById("remainingText").textContent = `Remaining to pay: ${money(remaining)}`;
  document.getElementById("debtTotalText").textContent = `Total debt: ${money(totalDebt())}`;
  document.getElementById("incomeInput").value = state.income;
}

function renderExpenses() {
  const table = document.getElementById("expensesTable");
  table.innerHTML = "";

  state.expenses.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input class="checkbox" type="checkbox" ${item.paid ? "checked" : ""} data-action="toggle-paid" data-id="${item.id}" /></td>
      <td>${item.name}</td>
      <td>${money(item.amount)}</td>
      <td>${item.paid ? money(0) : money(item.amount)}</td>
      <td>
        <button class="icon-btn edit" data-action="edit-expense" data-id="${item.id}">Edit</button>
        <button class="icon-btn delete" data-action="delete-expense" data-id="${item.id}">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

function renderDebts() {
  const table = document.getElementById("debtsTable");
  table.innerHTML = "";

  state.debts.forEach(debt => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${debt.name}</td>
      <td>${money(debt.balance)}</td>
      <td>${money(debt.payment)}</td>
      <td>${Number(debt.apr || 0).toFixed(2)}%</td>
      <td>${monthsToPayoff(debt.balance, debt.payment, debt.apr)}</td>
      <td>
        <button class="icon-btn edit" data-action="edit-debt" data-id="${debt.id}">Edit</button>
        <button class="icon-btn delete" data-action="delete-debt" data-id="${debt.id}">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

function createOrUpdateCharts() {
  const expenseCtx = document.getElementById("expenseChart");
  const debtCtx = document.getElementById("debtChart");

  const expenseLabels = state.expenses.map(item => item.name);
  const expenseData = state.expenses.map(item => Number(item.amount || 0));

  const debtLabels = state.debts.map(debt => debt.name);
  const debtData = state.debts.map(debt => Number(debt.balance || 0));

  if (!expenseChart) {
    expenseChart = new Chart(expenseCtx, {
      type: "doughnut",
      data: {
        labels: expenseLabels,
        datasets: [{ label: "Expenses", data: expenseData }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 200,
        animation: false
      }
    });
  } else {
    expenseChart.data.labels = expenseLabels;
    expenseChart.data.datasets[0].data = expenseData;
    expenseChart.update("none");
  }

  if (!debtChart) {
    debtChart = new Chart(debtCtx, {
      type: "bar",
      data: {
        labels: debtLabels,
        datasets: [{ label: "Debt Balance", data: debtData }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 200,
        animation: false
      }
    });
  } else {
    debtChart.data.labels = debtLabels;
    debtChart.data.datasets[0].data = debtData;
    debtChart.update("none");
  }
}

function scheduleChartRender() {
  clearTimeout(chartRenderTimer);
  chartRenderTimer = setTimeout(createOrUpdateCharts, 50);
}

function render() {
  if (!unlocked) return;
  renderDashboard();
  renderExpenses();
  renderDebts();
  scheduleChartRender();
  saveState();
}

document.getElementById("incomeInput").addEventListener("input", event => {
  state.income = Number(event.target.value || 0);
  render();
});

document.getElementById("expenseForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("expenseName").value.trim();
  const amount = Number(document.getElementById("expenseAmount").value);
  if (!name || amount < 0) return;

  state.expenses.push({ id: crypto.randomUUID(), name, amount, paid: false });
  event.target.reset();
  render();
});

document.getElementById("debtForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("debtName").value.trim();
  const balance = Number(document.getElementById("debtBalance").value);
  const payment = Number(document.getElementById("debtPayment").value);
  const apr = Number(document.getElementById("debtInterest").value || 0);
  if (!name || balance < 0 || payment < 0 || apr < 0) return;

  state.debts.push({ id: crypto.randomUUID(), name, balance, payment, apr });
  event.target.reset();
  render();
});

document.addEventListener("click", event => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) return;

  if (action === "edit-expense") {
    const item = state.expenses.find(x => x.id === id);
    if (!item) return;

    const name = prompt("Expense name:", item.name);
    if (name === null) return;

    const amount = prompt("Amount £:", item.amount);
    if (amount === null) return;

    item.name = name.trim() || item.name;
    item.amount = Number(amount || item.amount);
    render();
  }

  if (action === "delete-expense") {
    state.expenses = state.expenses.filter(x => x.id !== id);
    render();
  }

  if (action === "edit-debt") {
    const debt = state.debts.find(x => x.id === id);
    if (!debt) return;

    const name = prompt("Debt name:", debt.name);
    if (name === null) return;

    const balance = prompt("Balance £:", debt.balance);
    if (balance === null) return;

    const payment = prompt("Monthly payment £:", debt.payment);
    if (payment === null) return;

    const apr = prompt("APR %:", debt.apr);
    if (apr === null) return;

    debt.name = name.trim() || debt.name;
    debt.balance = Number(balance || debt.balance);
    debt.payment = Number(payment || debt.payment);
    debt.apr = Number(apr || 0);
    render();
  }

  if (action === "delete-debt") {
    state.debts = state.debts.filter(x => x.id !== id);
    render();
  }
});

document.addEventListener("change", event => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;

  if (action === "toggle-paid") {
    const item = state.expenses.find(x => x.id === id);
    if (item) {
      item.paid = event.target.checked;
      render();
    }
  }
});

document.getElementById("resetMonthBtn").addEventListener("click", () => {
  if (!confirm("Reset all monthly paid ticks to unpaid?")) return;
  state.expenses.forEach(item => item.paid = false);
  render();
});

document.getElementById("factoryResetBtn").addEventListener("click", () => {
  if (!confirm("This will restore the original budget and delete your edits. Continue?")) return;
  state = structuredClone(defaultState);
  render();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "finance-tracker-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importInput").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.expenses || !imported.debts) throw new Error("Invalid backup file.");
      state = imported;
      render();
    } catch {
      alert("Import failed. Please check the backup file.");
    }
  };

  reader.readAsText(file);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(console.error);
}

showAuthMode();
