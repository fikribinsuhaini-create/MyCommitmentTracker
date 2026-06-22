const configReady =
  window.SUPABASE_URL &&
  window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_URL.includes("YOUR_PROJECT") &&
  !window.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const state = {
  session: null,
  user: null,
  profile: null,
  commitments: [],
  payments: [],
  goals: [],
  transactions: [],
  snapshots: [],
  page: "dashboard",
  deferredPrompt: null,
  vaultUnlocked: false,
  vaultTouchedAt: 0
};

const supabase = configReady
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

const nodes = {
  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  bottomNav: document.getElementById("bottom-nav"),
  authMessage: document.getElementById("auth-message"),
  pageTitle: document.getElementById("page-title"),
  toast: document.getElementById("toast"),
  installButton: document.getElementById("install-button"),
  vaultSection: document.getElementById("vault-section"),
  vaultList: document.getElementById("vault-list")
};

const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (month) => {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
};

const currency = () => state.profile?.currency?.trim() || "RM";
const money = (value) => `${currency()}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const currentMonth = () => monthKey(new Date());

function showToast(message) {
  nodes.toast.textContent = message;
  nodes.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => nodes.toast.classList.add("hidden"), 2600);
}

function showAuthMessage(message, isError = false) {
  nodes.authMessage.textContent = message;
  nodes.authMessage.style.color = isError ? "#ffb6b6" : "var(--muted)";
}

function setPage(page) {
  state.page = page;
  document.querySelectorAll(".page").forEach((node) => node.classList.toggle("active", node.dataset.page === page));
  document.querySelectorAll(".nav-item").forEach((node) => node.classList.toggle("active", node.dataset.pageTarget === page));
  nodes.pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
  if (page !== "savings") lockVault();
}

function todayMonthMetrics() {
  const publicGoals = state.goals.filter((goal) => !goal.is_private);
  const paidMap = new Map(
    state.payments.filter((item) => item.month === currentMonth()).map((item) => [item.commitment_id, item.is_paid])
  );
  const salary = Number(state.profile?.monthly_salary || 0);
  const totalCommitments = state.commitments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalSavings = publicGoals.reduce((sum, item) => sum + Number(item.current_amount || 0), 0);
  const paidItems = state.commitments.filter((item) => paidMap.get(item.id));
  const paidTotal = paidItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const unpaidCount = state.commitments.length - paidItems.length;

  return {
    salary,
    totalCommitments,
    totalSavings,
    balance: salary - totalCommitments - totalSavings,
    paidCount: paidItems.length,
    unpaidCount,
    paidTotal,
    unpaidTotal: totalCommitments - paidTotal
  };
}

function nextSalaryDate() {
  const salaryDate = Number(state.profile?.salary_date || 1);
  const now = new Date();

  const buildSalaryDate = (year, month) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(salaryDate, lastDay));
  };

  let next = buildSalaryDate(now.getFullYear(), now.getMonth());
  if (now > next) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    next = buildSalaryDate(nextMonth.getFullYear(), nextMonth.getMonth());
  }

  return next.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function applyTheme() {
  document.body.classList.toggle("light", !state.profile?.dark_mode);
}

function toggleApp(authed) {
  nodes.authView.classList.toggle("active", !authed);
  nodes.appView.classList.toggle("active", authed);
  nodes.bottomNav.classList.toggle("hidden", !authed);
}

function openModal(id) {
  document.getElementById(id).showModal();
}

function closeModal(id) {
  document.getElementById(id).close();
}

function lockVault() {
  state.vaultUnlocked = false;
  nodes.vaultSection.classList.add("hidden");
  nodes.vaultList.classList.add("hidden");
  renderSavings();
}

function touchVault() {
  state.vaultTouchedAt = Date.now();
}

function scheduleVaultLock() {
  setInterval(() => {
    if (state.vaultUnlocked && Date.now() - state.vaultTouchedAt > 60000) {
      lockVault();
      showToast("Vault locked after inactivity");
    }
  }, 10000);
}

function createCardActions(actions) {
  return actions.map((action) => `<button class="${action.className || "ghost-button compact"}" data-action="${action.action}" data-id="${action.id}" type="button">${action.label}</button>`).join("");
}

function renderDashboard() {
  const metrics = todayMonthMetrics();
  const month = currentMonth();
  const paidMap = new Map(
    state.payments.filter((item) => item.month === currentMonth()).map((item) => [item.commitment_id, item.is_paid])
  );
  document.getElementById("dashboard-month-label").textContent = monthLabel(month);
  document.getElementById("next-salary-date").textContent = nextSalaryDate();
  document.getElementById("metric-salary").textContent = money(metrics.salary);
  document.getElementById("metric-commitments").textContent = money(metrics.totalCommitments);
  document.getElementById("metric-savings").textContent = money(metrics.totalSavings);
  document.getElementById("metric-balance").textContent = money(metrics.balance);
  document.getElementById("paid-count").textContent = metrics.paidCount;
  document.getElementById("unpaid-count").textContent = metrics.unpaidCount;
  document.getElementById("snapshot-month-title").textContent = monthLabel(month);
  document.getElementById("snapshot-salary").textContent = money(metrics.salary);
  document.getElementById("snapshot-commitments").textContent = money(metrics.totalCommitments);
  document.getElementById("snapshot-savings").textContent = money(metrics.totalSavings);
  document.getElementById("snapshot-balance").textContent = money(metrics.balance);

  const dashboardList = document.getElementById("dashboard-commitments-list");
  const sorted = [...state.commitments].sort((a, b) => Number(a.due_date) - Number(b.due_date));
  dashboardList.innerHTML = sorted.length
    ? sorted.map((item) => {
        const isPaid = Boolean(paidMap.get(item.id));
        return `
          <button class="card-item dashboard-commitment-card" data-action="open-dashboard-commitment" data-id="${item.id}" type="button">
            <div class="card-top">
              <div>
                <h3>${item.name}</h3>
                <p class="muted">Due: ${item.due_date}${suffix(item.due_date)}</p>
              </div>
              <span class="tag ${isPaid ? "paid" : "unpaid"}">${isPaid ? "Paid" : "Unpaid"}</span>
            </div>
            <div class="summary-row">
              <strong>${money(item.amount)}</strong>
              <span class="muted">Tap to update</span>
            </div>
          </button>
        `;
      }).join("")
    : `<article class="card-item"><p class="muted">No commitments yet.</p></article>`;
}

function renderCommitments() {
  const search = document.getElementById("commitment-search").value.trim().toLowerCase();
  const sort = document.getElementById("commitment-sort").value;
  const paidMap = new Map(
    state.payments.filter((item) => item.month === currentMonth()).map((item) => [item.commitment_id, item.is_paid])
  );

  const sorted = [...state.commitments]
    .filter((item) => item.name.toLowerCase().includes(search))
    .sort((a, b) => {
      if (sort === "amount_desc") return Number(b.amount) - Number(a.amount);
      if (sort === "amount_asc") return Number(a.amount) - Number(b.amount);
      if (sort === "name") return a.name.localeCompare(b.name);
      return Number(a.due_date) - Number(b.due_date);
    });

  document.getElementById("paid-total").textContent = money(todayMonthMetrics().paidTotal);
  document.getElementById("unpaid-total").textContent = money(todayMonthMetrics().unpaidTotal);

  const list = document.getElementById("commitments-list");
  list.innerHTML = sorted.length
    ? sorted.map((item) => {
        const isPaid = Boolean(paidMap.get(item.id));
        return `
          <article class="card-item">
            <div class="card-top">
              <div>
                <h3>${item.name}</h3>
                <p class="muted">Due: ${item.due_date}${suffix(item.due_date)}</p>
              </div>
              <span class="tag ${isPaid ? "paid" : "unpaid"}">${isPaid ? "Paid" : "Unpaid"}</span>
            </div>
            <div class="summary-row">
              <strong>${money(item.amount)}</strong>
              ${item.notes ? `<span class="muted">${item.notes}</span>` : `<span class="muted">No notes</span>`}
            </div>
            <div class="card-actions">
              ${createCardActions([
                { action: "toggle-commitment", id: item.id, label: isPaid ? "Mark Unpaid" : "Mark Paid" },
                { action: "edit-commitment", id: item.id, label: "Edit" },
                { action: "delete-commitment", id: item.id, label: "Delete", className: "danger-button compact" }
              ])}
            </div>
          </article>
        `;
      }).join("")
    : `<article class="card-item"><p class="muted">No commitments yet.</p></article>`;
}

function renderSavings() {
  const publicGoals = state.goals.filter((item) => !item.is_private);
  const privateGoals = state.goals.filter((item) => item.is_private);
  document.getElementById("savings-list").innerHTML = renderGoalCards(publicGoals, false);
  if (state.vaultUnlocked) {
    nodes.vaultSection.classList.remove("hidden");
    nodes.vaultList.classList.remove("hidden");
    nodes.vaultList.innerHTML = renderGoalCards(privateGoals, true);
  }
}

function renderGoalCards(goals, isPrivate) {
  if (!goals.length) return `<article class="card-item"><p class="muted">${isPrivate ? "No secret goals yet." : "No savings goals yet."}</p></article>`;

  return goals.map((goal) => {
    const pct = goal.target_amount > 0 ? Math.min(100, Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100)) : 0;
    const history = state.transactions
      .filter((entry) => entry.savings_goal_id === goal.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3);

    return `
      <article class="card-item">
        <div class="card-top">
          <div>
            <h3>${goal.name}</h3>
            <p class="muted">${money(goal.current_amount)} / ${money(goal.target_amount)}</p>
          </div>
          ${isPrivate ? `<span class="tag private">Private</span>` : ""}
        </div>
        <div class="split-metrics">
          <div><span class="muted">Current</span><strong>${money(goal.current_amount)}</strong></div>
          <div><span class="muted">Target</span><strong>${money(goal.target_amount)}</strong></div>
          <div><span class="muted">Progress</span><strong>${pct}%</strong></div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="card-actions">
          ${createCardActions([
            { action: "deposit-goal", id: goal.id, label: "Deposit" },
            { action: "withdraw-goal", id: goal.id, label: "Withdraw" },
            { action: "edit-goal", id: goal.id, label: "Edit" },
            { action: "delete-goal", id: goal.id, label: "Delete", className: "danger-button compact" }
          ])}
        </div>
        <div class="history-list">
          ${history.length ? history.map((entry) => `<div class="history-row"><span>${entry.type === "deposit" ? "Deposit" : "Withdraw"}</span><strong>${money(entry.amount)}</strong></div>`).join("") : `<span class="muted">No recent transactions</span>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderProgress() {
  const sorted = [...state.snapshots].sort((a, b) => a.month < b.month ? 1 : -1);
  const commitmentsByMonth = new Map();
  state.commitments.forEach((item) => {
    const arr = commitmentsByMonth.get(currentMonth()) || [];
    arr.push(item);
    commitmentsByMonth.set(currentMonth(), arr);
  });

  document.getElementById("snapshots-list").innerHTML = sorted.length
    ? sorted.map((item) => {
        const expandedBreakdown = (item.commitment_breakdown || []).map((commitment) => `<div class="history-row"><span>${commitment.name}</span><strong>${money(commitment.amount)}</strong></div>`).join("");
        const savingsBreakdown = (item.savings_breakdown || []).map((goal) => `<div class="history-row"><span>${goal.name}</span><strong>${money(goal.current_amount)}</strong></div>`).join("");
        return `
          <article class="card-item snapshot-month-card">
            <div class="card-top">
              <div>
                <h3>${monthLabel(item.month)}</h3>
                <p class="muted">Balance ${money(item.balance)}</p>
              </div>
              <button class="ghost-button compact" data-action="toggle-snapshot" data-id="${item.id}" type="button">View Details</button>
            </div>
            <div class="snapshot-details hidden" id="snapshot-${item.id}">
              <div class="split-metrics">
                <div><span class="muted">Salary</span><strong>${money(item.salary)}</strong></div>
                <div><span class="muted">Commitments</span><strong>${money(item.total_commitments)}</strong></div>
                <div><span class="muted">Savings</span><strong>${money(item.total_savings)}</strong></div>
              </div>
              <div class="subtle-divider"></div>
              <div class="history-list">
                <strong>Commitment Breakdown</strong>
                ${expandedBreakdown || `<span class="muted">No items</span>`}
              </div>
              <div class="history-list">
                <strong>Savings Breakdown</strong>
                ${savingsBreakdown || `<span class="muted">No items</span>`}
              </div>
            </div>
          </article>
        `;
      }).join("")
    : `<article class="card-item"><p class="muted">Snapshots appear after first sync.</p></article>`;

  drawLineChart("savings-chart", sorted.slice().reverse().map((item) => Number(item.total_savings || 0)), "#22c383");
  drawLineChart("balance-chart", sorted.slice().reverse().map((item) => Number(item.balance || 0)), "#72e4b5");
  drawBarChart("comparison-chart", sorted.slice().reverse().map((item) => ({
    label: item.month.slice(5),
    salary: Number(item.salary || 0),
    commitments: Number(item.total_commitments || 0),
    savings: Number(item.total_savings || 0)
  })));
}

function renderSettings() {
  document.getElementById("monthly-salary").value = state.profile?.monthly_salary ?? "";
  document.getElementById("salary-date").value = state.profile?.salary_date ?? "";
  document.getElementById("currency").value = state.profile?.currency ?? "RM";
  document.getElementById("private-pin").value = state.profile?.private_vault_pin ?? "";
  document.getElementById("dark-mode").checked = Boolean(state.profile?.dark_mode);
}

function renderAll() {
  applyTheme();
  renderDashboard();
  renderCommitments();
  renderSavings();
  renderProgress();
  renderSettings();
}

function suffix(day) {
  if ([11, 12, 13].includes(Number(day))) return "th";
  const last = Number(day) % 10;
  if (last === 1) return "st";
  if (last === 2) return "nd";
  if (last === 3) return "rd";
  return "th";
}

async function ensureProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data) {
    state.profile = data;
    return;
  }

  const defaults = {
    id: userId,
    monthly_salary: 0,
    salary_date: 1,
    currency: "RM",
    private_vault_pin: "",
    dark_mode: true
  };
  const { data: created, error: createError } = await supabase.from("profiles").insert(defaults).select().single();
  if (createError) throw createError;
  state.profile = created;
}

async function loadData() {
  const [commitments, payments, goals, transactions, snapshots] = await Promise.all([
    supabase.from("commitments").select("*").order("due_date"),
    supabase.from("commitment_payments").select("*").eq("month", currentMonth()),
    supabase.from("savings_goals").select("*").order("created_at", { ascending: false }),
    supabase.from("savings_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("monthly_snapshots").select("*").order("month", { ascending: false })
  ]);

  [commitments, payments, goals, transactions, snapshots].forEach((result) => {
    if (result.error) throw result.error;
  });

  state.commitments = commitments.data;
  state.payments = payments.data;
  state.goals = goals.data;
  state.transactions = transactions.data;
  state.snapshots = snapshots.data;
}

async function syncSnapshot() {
  const metrics = todayMonthMetrics();
  const payload = {
    user_id: state.user.id,
    month: currentMonth(),
    salary: metrics.salary,
    total_commitments: metrics.totalCommitments,
    total_savings: metrics.totalSavings,
    balance: metrics.balance,
    commitment_breakdown: state.commitments.map((item) => ({
      name: item.name,
      amount: Number(item.amount || 0),
      due_date: item.due_date
    })),
    savings_breakdown: state.goals
      .filter((goal) => !goal.is_private)
      .map((goal) => ({
        name: goal.name,
        current_amount: Number(goal.current_amount || 0),
        target_amount: Number(goal.target_amount || 0)
      }))
  };

  const { error } = await supabase.from("monthly_snapshots").upsert(payload, { onConflict: "user_id,month" });
  if (error) throw error;
}

async function bootstrapApp(session) {
  state.session = session;
  state.user = session?.user || null;

  if (!state.user) {
    toggleApp(false);
    return;
  }

  await ensureProfile(state.user.id);
  await loadData();
  await syncSnapshot();
  await loadData();
  toggleApp(true);
  renderAll();
}

async function requireSupabase() {
  if (!supabase) {
    showAuthMessage("Fill config.js with Supabase URL and anon key.", true);
    throw new Error("Supabase config missing");
  }
}

async function signIn(email, password) {
  await requireSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function signUp(email, password) {
  await requireSupabase();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

async function resetPassword(email) {
  await requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}${location.pathname}`
  });
  if (error) throw error;
}

async function updatePassword(nextPassword) {
  await requireSupabase();
  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) throw error;
}

async function saveCommitment(event) {
  event.preventDefault();
  const id = document.getElementById("commitment-id").value;
  const payload = {
    user_id: state.user.id,
    name: document.getElementById("commitment-name").value.trim(),
    amount: Number(document.getElementById("commitment-amount").value),
    due_date: Number(document.getElementById("commitment-due-date").value),
    notes: document.getElementById("commitment-notes").value.trim()
  };

  const query = id ? supabase.from("commitments").update(payload).eq("id", id) : supabase.from("commitments").insert(payload);
  const { error } = await query;
  if (error) throw error;

  closeModal("commitment-modal");
  event.target.reset();
  await refreshApp("Commitment saved");
}

async function saveGoal(event) {
  event.preventDefault();
  const id = document.getElementById("goal-id").value;
  const payload = {
    user_id: state.user.id,
    name: document.getElementById("goal-name").value.trim(),
    target_amount: Number(document.getElementById("goal-target").value),
    current_amount: Number(document.getElementById("goal-current").value),
    is_private: document.getElementById("goal-private").value === "true"
  };

  const query = id ? supabase.from("savings_goals").update(payload).eq("id", id) : supabase.from("savings_goals").insert(payload);
  const { error } = await query;
  if (error) throw error;

  closeModal("goal-modal");
  event.target.reset();
  await refreshApp("Goal saved");
}

async function saveTransaction(event) {
  event.preventDefault();
  const goalId = document.getElementById("transaction-goal-id").value;
  const type = document.getElementById("transaction-type").value;
  const amount = Number(document.getElementById("transaction-amount").value);
  const goal = state.goals.find((entry) => entry.id === goalId);
  const current = Number(goal.current_amount || 0);
  const next = type === "deposit" ? current + amount : current - amount;

  if (next < 0) {
    showToast("Cannot withdraw below zero");
    return;
  }

  const { error: txError } = await supabase.from("savings_transactions").insert({
    user_id: state.user.id,
    savings_goal_id: goalId,
    type,
    amount,
    notes: document.getElementById("transaction-notes").value.trim()
  });
  if (txError) throw txError;

  const { error: goalError } = await supabase.from("savings_goals").update({ current_amount: next }).eq("id", goalId);
  if (goalError) throw goalError;

  closeModal("transaction-modal");
  event.target.reset();
  await refreshApp("Savings updated");
}

async function refreshApp(message) {
  await loadData();
  await syncSnapshot();
  await loadData();
  renderAll();
  if (message) showToast(message);
}

async function toggleCommitmentPaid(id) {
  const found = state.payments.find((item) => item.commitment_id === id && item.month === currentMonth());
  const payload = {
    user_id: state.user.id,
    commitment_id: id,
    month: currentMonth(),
    is_paid: !found?.is_paid,
    paid_at: !found?.is_paid ? new Date().toISOString() : null
  };
  const { error } = await supabase.from("commitment_payments").upsert(payload, { onConflict: "user_id,commitment_id,month" });
  if (error) throw error;
  await refreshApp("Payment status updated");
}

function fillCommitmentForm(item) {
  document.getElementById("commitment-modal-title").textContent = item ? "Edit Commitment" : "Add Commitment";
  document.getElementById("commitment-id").value = item?.id || "";
  document.getElementById("commitment-name").value = item?.name || "";
  document.getElementById("commitment-amount").value = item?.amount || "";
  document.getElementById("commitment-due-date").value = item?.due_date || "";
  document.getElementById("commitment-notes").value = item?.notes || "";
  openModal("commitment-modal");
}

function fillGoalForm(goal, isPrivate = false) {
  document.getElementById("goal-modal-title").textContent = goal ? "Edit Goal" : isPrivate ? "Add Secret Goal" : "Add Goal";
  document.getElementById("goal-id").value = goal?.id || "";
  document.getElementById("goal-private").value = String(goal?.is_private ?? isPrivate);
  document.getElementById("goal-name").value = goal?.name || "";
  document.getElementById("goal-target").value = goal?.target_amount || "";
  document.getElementById("goal-current").value = goal?.current_amount || 0;
  openModal("goal-modal");
}

function fillTransactionForm(goalId, type) {
  document.getElementById("transaction-modal-title").textContent = type === "deposit" ? "Deposit to Goal" : "Withdraw from Goal";
  document.getElementById("transaction-goal-id").value = goalId;
  document.getElementById("transaction-type").value = type;
  document.getElementById("transaction-amount").value = "";
  document.getElementById("transaction-notes").value = "";
  openModal("transaction-modal");
}

function fillDashboardCommitmentModal(item) {
  const payment = state.payments.find((entry) => entry.commitment_id === item.id && entry.month === currentMonth());
  const isPaid = Boolean(payment?.is_paid);
  document.getElementById("dashboard-commitment-title").textContent = item.name;
  document.getElementById("dashboard-commitment-amount").textContent = money(item.amount);
  document.getElementById("dashboard-commitment-due").textContent = `${item.due_date}${suffix(item.due_date)}`;
  document.getElementById("dashboard-commitment-status").textContent = isPaid ? "Paid" : "Unpaid";
  document.getElementById("dashboard-commitment-notes").textContent = item.notes || "No notes";
  const toggleButton = document.getElementById("dashboard-commitment-toggle");
  toggleButton.dataset.id = item.id;
  toggleButton.textContent = isPaid ? "✓ Mark Unpaid" : "✓ Mark Paid";
  openModal("dashboard-commitment-modal");
}

async function deleteRow(table, id, label) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  await refreshApp(`${label} deleted`);
}

function drawLineChart(id, values, color) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.offsetWidth * devicePixelRatio;
  const height = canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  if (!values.length) return;

  const displayWidth = canvas.offsetWidth;
  const displayHeight = canvas.offsetHeight;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pad = 18;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, displayHeight - pad);
  ctx.lineTo(displayWidth, displayHeight - pad);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = pad + (index * (displayWidth - pad * 2)) / Math.max(values.length - 1, 1);
    const y = displayHeight - pad - ((value - min) / Math.max(max - min, 1)) * (displayHeight - pad * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBarChart(id, items) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.offsetWidth * devicePixelRatio;
  const height = canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  if (!items.length) return;

  const displayWidth = canvas.offsetWidth;
  const displayHeight = canvas.offsetHeight;
  const pad = 18;
  const max = Math.max(...items.flatMap((item) => [item.salary, item.commitments, item.savings]), 1);
  const groupWidth = (displayWidth - pad * 2) / items.length;
  const barWidth = Math.max(8, (groupWidth - 12) / 3);
  const colors = ["#4ade80", "#fbbf24", "#60a5fa"];

  items.forEach((item, index) => {
    [item.salary, item.commitments, item.savings].forEach((value, barIndex) => {
      const barHeight = (value / max) * (displayHeight - pad * 2);
      const x = pad + index * groupWidth + barIndex * (barWidth + 4);
      const y = displayHeight - pad - barHeight;
      ctx.fillStyle = colors[barIndex];
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  });
}

async function handleAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  try {
    if (action === "toggle-commitment") await toggleCommitmentPaid(id);
    if (action === "open-dashboard-commitment") {
      fillDashboardCommitmentModal(state.commitments.find((item) => item.id === id));
      closeModal("dashboard-commitments-modal");
    }
    if (action === "edit-commitment") fillCommitmentForm(state.commitments.find((item) => item.id === id));
    if (action === "delete-commitment") await deleteRow("commitments", id, "Commitment");
    if (action === "edit-goal") fillGoalForm(state.goals.find((item) => item.id === id));
    if (action === "delete-goal") await deleteRow("savings_goals", id, "Goal");
    if (action === "deposit-goal") fillTransactionForm(id, "deposit");
    if (action === "withdraw-goal") fillTransactionForm(id, "withdraw");
    if (action === "toggle-snapshot") document.getElementById(`snapshot-${id}`).classList.toggle("hidden");
  } catch (error) {
    showToast(error.message);
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify({
    profile: state.profile,
    commitments: state.commitments,
    payments: state.payments,
    goals: state.goals,
    transactions: state.transactions,
    snapshots: state.snapshots
  }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `commitment-tracker-${currentMonth()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importData(file) {
  const parsed = JSON.parse(await file.text());

  if (parsed.profile) {
    const { error } = await supabase.from("profiles").update({
      monthly_salary: parsed.profile.monthly_salary,
      salary_date: parsed.profile.salary_date,
      currency: parsed.profile.currency,
      private_vault_pin: parsed.profile.private_vault_pin,
      dark_mode: parsed.profile.dark_mode
    }).eq("id", state.user.id);
    if (error) throw error;
  }

  const tables = [
    ["commitments", parsed.commitments],
    ["commitment_payments", parsed.payments],
    ["savings_goals", parsed.goals],
    ["savings_transactions", parsed.transactions],
    ["monthly_snapshots", parsed.snapshots]
  ];

  for (const [table, rows] of tables) {
    if (Array.isArray(rows) && rows.length) {
      const normalized = rows.map((row) => ({ ...row, user_id: state.user.id, id: row.id || crypto.randomUUID() }));
      const { error } = await supabase.from(table).upsert(normalized);
      if (error) throw error;
    }
  }

  await refreshApp("Import complete");
}

function setupEvents() {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-auth-tab]").forEach((node) => node.classList.toggle("active", node === button));
      document.querySelectorAll(".auth-form").forEach((form) => form.classList.toggle("active", form.id === `${button.dataset.authTab}-form`));
      showAuthMessage("");
    });
  });

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      await signIn(form.get("email"), form.get("password"));
      showAuthMessage("Logged in");
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  document.getElementById("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      await signUp(form.get("email"), form.get("password"));
      showAuthMessage("Check email for confirmation.");
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  document.getElementById("forgot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      await resetPassword(form.get("email"));
      showAuthMessage("Reset link sent.");
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  const recoveryForm = document.getElementById("password-recovery-form");
  if (recoveryForm) {
    recoveryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await updatePassword(document.getElementById("recovery-password").value);
        closeModal("password-recovery-modal");
        showToast("Password updated");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  document.querySelectorAll("[data-page-target]").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.pageTarget)));
  document.getElementById("snapshot-card").addEventListener("click", () => setPage("progress"));
  document.getElementById("dashboard-commitments-trigger").addEventListener("click", () => openModal("dashboard-commitments-modal"));
  document.getElementById("dashboard-commitment-toggle").addEventListener("click", async (event) => {
    try {
      await toggleCommitmentPaid(event.currentTarget.dataset.id);
      closeModal("dashboard-commitment-modal");
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById("commitment-form").addEventListener("submit", (event) => saveCommitment(event).catch((error) => showToast(error.message)));
  document.getElementById("goal-form").addEventListener("submit", (event) => saveGoal(event).catch((error) => showToast(error.message)));
  document.getElementById("transaction-form").addEventListener("submit", (event) => saveTransaction(event).catch((error) => showToast(error.message)));
  document.getElementById("settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      monthly_salary: Number(document.getElementById("monthly-salary").value || 0),
      salary_date: Number(document.getElementById("salary-date").value || 1),
      currency: document.getElementById("currency").value.trim() || "RM",
      private_vault_pin: document.getElementById("private-pin").value.trim(),
      dark_mode: document.getElementById("dark-mode").checked
    };

    try {
      const { error } = await supabase.from("profiles").update(payload).eq("id", state.user.id);
      if (error) throw error;
      state.profile = { ...state.profile, ...payload };
      await refreshApp("Settings saved");
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelectorAll("[data-open-modal]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.openModal === "goal-modal") fillGoalForm(null, false);
    else fillCommitmentForm(null);
  }));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

  document.getElementById("commitment-search").addEventListener("input", renderCommitments);
  document.getElementById("commitment-sort").addEventListener("change", renderCommitments);
  document.addEventListener("click", handleAction);

  document.getElementById("logout-button").addEventListener("click", async () => {
    await supabase.auth.signOut();
    lockVault();
    showToast("Logged out");
  });

  document.getElementById("export-button").addEventListener("click", exportData);
  document.getElementById("backup-button").addEventListener("click", exportData);
  document.getElementById("restore-button").addEventListener("click", () => document.getElementById("import-input").click());
  document.getElementById("import-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await importData(file);
    } catch (error) {
      showToast(error.message);
    } finally {
      event.target.value = "";
    }
  });

  document.getElementById("vault-pin-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const pin = document.getElementById("vault-pin-input").value.trim();
    if (!pin || pin !== (state.profile?.private_vault_pin || "")) {
      showToast("Wrong PIN");
      return;
    }
    state.vaultUnlocked = true;
    touchVault();
    closeModal("vault-pin-modal");
    renderSavings();
    showToast("Vault unlocked");
  });

  document.getElementById("vault-lock-button").addEventListener("click", () => {
    lockVault();
    showToast("Vault locked");
  });
  document.getElementById("vault-add-button").addEventListener("click", () => fillGoalForm(null, true));

  const vaultTrigger = document.getElementById("vault-trigger");
  let holdTimer = null;
  let lastTap = 0;
  const triggerVault = () => {
    document.getElementById("vault-pin-input").value = "";
    openModal("vault-pin-modal");
  };
  vaultTrigger.addEventListener("pointerdown", () => {
    holdTimer = setTimeout(triggerVault, 700);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
    vaultTrigger.addEventListener(evt, () => clearTimeout(holdTimer));
  });
  vaultTrigger.addEventListener("click", () => {
    const now = Date.now();
    if (now - lastTap < 280) triggerVault();
    lastTap = now;
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    nodes.installButton.classList.remove("hidden");
  });

  nodes.installButton.addEventListener("click", async () => {
    if (!state.deferredPrompt) return;
    await state.deferredPrompt.prompt();
    state.deferredPrompt = null;
    nodes.installButton.classList.add("hidden");
  });

  window.addEventListener("visibilitychange", () => {
    if (document.hidden) lockVault();
  });

  ["click", "keydown", "pointerdown"].forEach((evt) => {
    document.addEventListener(evt, () => {
      if (state.vaultUnlocked) touchVault();
    });
  });
}

async function init() {
  setupEvents();
  scheduleVaultLock();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  if (!configReady) {
    showAuthMessage("Fill config.js with Supabase project values.", true);
    return;
  }

  const { data } = await supabase.auth.getSession();
  await bootstrapApp(data.session);
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      document.getElementById("recovery-password").value = "";
      openModal("password-recovery-modal");
    }
    await bootstrapApp(session);
  });
}

init().catch((error) => {
  console.error(error);
  showToast(error.message);
});


