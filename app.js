/* ── Todolize App JS ─────────────────────────────────────── */
'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  currentView: 'dashboard',
  currentCategory: 'all',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth() + 1,
  chartYear: new Date().getFullYear(),
  chartMonth: new Date().getMonth() + 1,
  selectedCalDay: null,
  monthlyChart: null,
  editingTaskId: null,
  theme: localStorage.getItem('todolize-theme') || 'ocean',
};

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  setPageDate();
  initFlatpickr();
  bindNav();
  bindSidebar();
  bindThemes();
  bindCategories();
  bindTaskModal();
  bindReminderModal();
  bindSearch();
  loadView('dashboard');
});

// ── Date Helpers ───────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function monthName(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function setPageDate() {
  const el = document.getElementById('pageDate');
  el.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

// ── Theme ──────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === t));
  state.theme = t;
  localStorage.setItem('todolize-theme', t);
}
function bindThemes() {
  document.querySelectorAll('.swatch').forEach(btn =>
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme))
  );
}

// ── Sidebar ────────────────────────────────────────────────
function bindSidebar() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
  });
}

// ── Navigation ─────────────────────────────────────────────
function bindNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadView(btn.dataset.view);
    });
  });
}
function loadView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById('pageTitle').textContent =
    { dashboard:'Dashboard', tasks:'My Tasks', calendar:'Calendar', reminders:'Reminders' }[view];

  if (view === 'dashboard')  loadDashboard();
  if (view === 'tasks')      loadAllTasks();
  if (view === 'calendar')   initCalendar();
  if (view === 'reminders')  loadReminders();
}

// ── Categories ─────────────────────────────────────────────
function bindCategories() {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentCategory = btn.dataset.cat;
      if (state.currentView === 'tasks') loadAllTasks();
    });
  });
}

// ── Flatpickr ──────────────────────────────────────────────
let fpDate, fpTime, fpRemDate, fpRemTime;
function initFlatpickr() {
  fpDate = flatpickr('#taskDate',    { dateFormat: 'Y-m-d' });
  fpTime = flatpickr('#taskTime',    { enableTime: true, noCalendar: true, dateFormat: 'H:i' });
  fpRemDate = flatpickr('#remDate',  { dateFormat: 'Y-m-d' });
  fpRemTime = flatpickr('#remTime',  { enableTime: true, noCalendar: true, dateFormat: 'H:i' });
}

// ── API helpers ─────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  const [overview, todayTasks] = await Promise.all([
    api('GET', '/api/stats/overview'),
    api('GET', `/api/tasks?date=${today()}`),
  ]);
  document.getElementById('st-completed').textContent = overview.completed_today;
  document.getElementById('st-pending').textContent   = overview.pending_today;
  document.getElementById('st-total').textContent     = overview.total_pending;
  document.getElementById('st-week').textContent      = overview.upcoming_week;
  document.getElementById('todayCount').textContent   = todayTasks.length;
  renderTaskList(todayTasks, 'todayTaskList', true);
  loadMonthlyChart();
}

// ── Monthly Chart ──────────────────────────────────────────
async function loadMonthlyChart() {
  const label = document.getElementById('chartMonthLabel');
  label.textContent = monthName(state.chartYear, state.chartMonth);
  const data = await api('GET', `/api/stats/monthly?year=${state.chartYear}&month=${state.chartMonth}`);
  const labels = data.map(d => d.day);
  const totals = data.map(d => d.total);
  const done   = data.map(d => d.completed);
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim();

  if (state.monthlyChart) state.monthlyChart.destroy();
  state.monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total', data: totals, backgroundColor: accentColor + '55', borderColor: accentColor, borderWidth: 2, borderRadius: 6 },
        { label: 'Completed', data: done, backgroundColor: successColor + '88', borderColor: successColor, borderWidth: 2, borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(), font: { family: 'Sora', size: 11 } } } },
      scales: {
        x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text3').trim(), font: { family: 'Sora', size: 10 } }, grid: { display: false } },
        y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text3').trim(), font: { family: 'Sora', size: 10 }, stepSize: 1 }, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() } },
      },
    },
  });
}
document.getElementById('chartPrev').addEventListener('click', () => {
  state.chartMonth--; if (state.chartMonth < 1) { state.chartMonth = 12; state.chartYear--; }
  loadMonthlyChart();
});
document.getElementById('chartNext').addEventListener('click', () => {
  state.chartMonth++; if (state.chartMonth > 12) { state.chartMonth = 1; state.chartYear++; }
  loadMonthlyChart();
});

// ── All Tasks ──────────────────────────────────────────────
async function loadAllTasks() {
  let url = `/api/tasks`;
  if (state.currentCategory !== 'all') url += `?category=${state.currentCategory}`;
  const tasks = await api('GET', url);
  renderTaskList(tasks, 'allTaskList', false);
}

// ── Task Rendering ─────────────────────────────────────────
function renderTaskList(tasks, containerId, compact) {
  const container = document.getElementById(containerId);
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">◉</span>No tasks here yet!</div>`;
    return;
  }
  const statusFilter = document.getElementById('filterStatus')?.value || 'all';
  const search = (document.getElementById('taskSearch')?.value || '').toLowerCase();
  let filtered = tasks;
  if (statusFilter === 'pending')   filtered = filtered.filter(t => !t.is_completed);
  if (statusFilter === 'completed') filtered = filtered.filter(t =>  t.is_completed);
  if (search) filtered = filtered.filter(t => t.title.toLowerCase().includes(search) || (t.notes||'').toLowerCase().includes(search));

  container.innerHTML = filtered.map(t => taskHTML(t, compact)).join('');
  container.querySelectorAll('.task-check').forEach(btn => {
    btn.addEventListener('click', () => toggleTask(+btn.dataset.id, btn.classList.contains('checked')));
  });
  container.querySelectorAll('.task-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditTask(+btn.dataset.id));
  });
  container.querySelectorAll('.task-del').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(+btn.dataset.id));
  });
}

function taskHTML(t, compact) {
  const repeatIcons = { none:'', daily:'🔁 Daily', weekly:'🔁 Weekly', monthly:'🔁 Monthly' };
  return `
  <div class="task-item ${t.is_completed ? 'completed' : ''} ${t.is_special ? 'special' : ''}">
    <div class="task-check ${t.is_completed ? 'checked' : ''}" data-id="${t.id}"></div>
    <div class="task-body">
      <div class="task-title">${escapeHtml(t.title)} ${t.is_special ? '✦' : ''}</div>
      <div class="task-meta">
        ${t.due_date ? `<span>📅 ${formatDate(t.due_date)}${t.due_time ? ' · ' + t.due_time : ''}</span>` : ''}
        <span class="task-tag">${t.category}</span>
        ${t.repeat !== 'none' ? `<span class="task-repeat-badge">${repeatIcons[t.repeat]}</span>` : ''}
        ${t.notes ? `<span title="${escapeHtml(t.notes)}">📝</span>` : ''}
      </div>
    </div>
    ${!compact ? `
    <div class="task-actions">
      <button class="task-btn task-edit" data-id="${t.id}" title="Edit">✎</button>
      <button class="task-btn del task-del" data-id="${t.id}" title="Delete">✕</button>
    </div>` : ''}
  </div>`;
}

// ── Task CRUD ──────────────────────────────────────────────
async function toggleTask(id, wasChecked) {
  await api('PUT', `/api/tasks/${id}`, { is_completed: !wasChecked });
  refreshCurrentView();
}
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  await api('DELETE', `/api/tasks/${id}`);
  refreshCurrentView();
}
function refreshCurrentView() {
  if (state.currentView === 'dashboard') loadDashboard();
  if (state.currentView === 'tasks')     loadAllTasks();
  if (state.currentView === 'calendar' && state.selectedCalDay) loadDayTasks(state.selectedCalDay);
}

// ── Task Modal ─────────────────────────────────────────────
function bindTaskModal() {
  document.getElementById('openTaskModal').addEventListener('click', () => openTaskModal());
  document.getElementById('closeTaskModal').addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskModal').addEventListener('click', closeTaskModal);
  document.getElementById('taskModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaskModal();
  });
  document.getElementById('taskForm').addEventListener('submit', saveTask);
}
function openTaskModal(prefillDate) {
  state.editingTaskId = null;
  document.getElementById('taskModalTitle').textContent = 'New Task';
  document.getElementById('taskForm').reset();
  if (fpDate) fpDate.clear();
  if (fpTime) fpTime.clear();
  if (prefillDate && fpDate) fpDate.setDate(prefillDate);
  document.getElementById('taskModalOverlay').classList.add('open');
}
function closeTaskModal() {
  document.getElementById('taskModalOverlay').classList.remove('open');
  state.editingTaskId = null;
}
async function openEditTask(id) {
  const task = await api('GET', `/api/tasks/${id}`).catch(() => null);
  if (!task) { await loadAllTasks(); return; }
  // Fetch from list instead
  const allTasks = await api('GET', '/api/tasks');
  const t = allTasks.find(x => x.id === id);
  if (!t) return;
  state.editingTaskId = id;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = id;
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('taskDesc').value = t.description;
  document.getElementById('taskCategory').value = t.category;
  document.getElementById('taskRepeat').value = t.repeat;
  document.getElementById('taskNotes').value = t.notes;
  document.getElementById('taskSpecial').checked = t.is_special;
  if (fpDate) t.due_date ? fpDate.setDate(t.due_date) : fpDate.clear();
  if (fpTime) t.due_time ? fpTime.setDate(t.due_time) : fpTime.clear();
  document.getElementById('taskModalOverlay').classList.add('open');
}
async function saveTask(e) {
  e.preventDefault();
  const payload = {
    title:      document.getElementById('taskTitle').value.trim(),
    description:document.getElementById('taskDesc').value,
    category:   document.getElementById('taskCategory').value,
    due_date:   document.getElementById('taskDate').value || null,
    due_time:   document.getElementById('taskTime').value || null,
    repeat:     document.getElementById('taskRepeat').value,
    notes:      document.getElementById('taskNotes').value,
    is_special: document.getElementById('taskSpecial').checked,
  };
  if (!payload.title) return;
  if (state.editingTaskId) {
    await api('PUT', `/api/tasks/${state.editingTaskId}`, payload);
  } else {
    await api('POST', '/api/tasks', payload);
  }
  closeTaskModal();
  refreshCurrentView();
}

// ── Search & Filter ────────────────────────────────────────
function bindSearch() {
  document.getElementById('taskSearch')?.addEventListener('input', loadAllTasks);
  document.getElementById('filterStatus')?.addEventListener('change', loadAllTasks);
}

// ── Calendar ───────────────────────────────────────────────
function initCalendar() {
  renderCalendar();
}
async function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  label.textContent = monthName(state.calYear, state.calMonth);
  const calData = await api('GET', `/api/calendar?year=${state.calYear}&month=${state.calMonth}`);

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // Day labels
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-label'; el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(state.calYear, state.calMonth - 1, 1).getDay();
  const daysInMonth = new Date(state.calYear, state.calMonth, 0).getDate();
  const prevDays = new Date(state.calYear, state.calMonth - 1, 0).getDate();

  // Prev month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const el = document.createElement('div');
    el.className = 'cal-day other-month';
    el.textContent = prevDays - i;
    grid.appendChild(el);
  }

  const todayStr = today();
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    const dateStr = `${state.calYear}-${String(state.calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (dateStr === todayStr) el.classList.add('today');
    if (state.selectedCalDay === dateStr) el.classList.add('selected');
    el.innerHTML = `<span>${d}</span>`;
    const info = calData[d];
    if (info) {
      const dots = document.createElement('div');
      dots.className = 'cal-dot-row';
      if (info.tasks)     dots.innerHTML += `<span class="cal-dot task"></span>`;
      if (info.reminders) dots.innerHTML += `<span class="cal-dot reminder"></span>`;
      el.appendChild(dots);
    }
    el.addEventListener('click', () => selectCalDay(dateStr));
    grid.appendChild(el);
  }

  // Next month filler
  const total = firstDay + daysInMonth;
  const remaining = (7 - total % 7) % 7;
  for (let d = 1; d <= remaining; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day other-month';
    el.textContent = d;
    grid.appendChild(el);
  }
}

document.getElementById('calPrev').addEventListener('click', () => {
  state.calMonth--; if (state.calMonth < 1) { state.calMonth = 12; state.calYear--; }
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', () => {
  state.calMonth++; if (state.calMonth > 12) { state.calMonth = 1; state.calYear++; }
  renderCalendar();
});

async function selectCalDay(dateStr) {
  state.selectedCalDay = dateStr;
  renderCalendar();
  loadDayTasks(dateStr);
}

async function loadDayTasks(dateStr) {
  const [tasks, allReminders] = await Promise.all([
    api('GET', `/api/tasks?date=${dateStr}`),
    api('GET', '/api/reminders'),
  ]);
  const d = new Date(dateStr + 'T00:00:00');
  const dayMonth = d.getMonth() + 1;
  const dayDay   = d.getDate();

  const reminders = allReminders.filter(r => {
    if (r.reminder_date === dateStr) return true;
    if (r.repeat_yearly) {
      const rd = new Date(r.reminder_date + 'T00:00:00');
      return rd.getMonth() + 1 === dayMonth && rd.getDate() === dayDay;
    }
    return false;
  });

  const title = document.getElementById('dayTasksTitle');
  title.textContent = `${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}`;

  const panel = document.getElementById('dayTasksPanel');
  panel.style.display = 'block';

  renderTaskList(tasks, 'dayTaskList', false);

  const remContainer = document.getElementById('dayReminderList');
  if (reminders.length) {
    remContainer.innerHTML = reminders.map(r => `
      <div class="task-item" style="border-left:3px solid var(--warn)">
        <div class="task-body">
          <div class="task-title">${reminderEmoji(r.reminder_type)} ${escapeHtml(r.title)}</div>
          <div class="task-meta">
            <span class="task-tag">${capitalize(r.reminder_type)}</span>
            ${r.reminder_time ? `<span>⏰ ${r.reminder_time}</span>` : ''}
            ${r.repeat_yearly ? `<span>🔁 Yearly</span>` : ''}
          </div>
        </div>
      </div>`).join('');
  } else {
    remContainer.innerHTML = '';
  }

  // Add task for this day button
  if (!document.getElementById('addTaskForDay')) {
    const btn = document.createElement('button');
    btn.id = 'addTaskForDay';
    btn.className = 'btn-add';
    btn.textContent = '+ Add Task for This Day';
    btn.style.marginTop = '1rem';
    btn.addEventListener('click', () => openTaskModal(dateStr));
    panel.appendChild(btn);
  }
}

// ── Reminders ──────────────────────────────────────────────
async function loadReminders() {
  const reminders = await api('GET', '/api/reminders');
  const container = document.getElementById('remindersList');
  if (!reminders.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔔</span>No reminders yet. Add your first!</div>`;
    return;
  }
  container.innerHTML = reminders.map(r => `
    <div class="reminder-card">
      <div class="reminder-type-badge ${r.reminder_type}">${reminderEmoji(r.reminder_type)} ${capitalize(r.reminder_type)}</div>
      <div class="reminder-title">${escapeHtml(r.title)}</div>
      <div class="reminder-date">📅 ${formatDate(r.reminder_date)}${r.reminder_time ? ' · ⏰ ' + r.reminder_time : ''}${r.repeat_yearly ? ' · 🔁 Yearly' : ''}</div>
      ${r.notes ? `<div class="reminder-notes">${escapeHtml(r.notes)}</div>` : ''}
      <div class="reminder-footer">
        <button class="task-btn del" onclick="deleteReminder(${r.id})">✕ Delete</button>
      </div>
    </div>`).join('');
}

function bindReminderModal() {
  document.getElementById('openReminderModal').addEventListener('click', () => {
    document.getElementById('reminderForm').reset();
    if (fpRemDate) fpRemDate.clear();
    if (fpRemTime) fpRemTime.clear();
    document.getElementById('reminderModalOverlay').classList.add('open');
  });
  document.getElementById('closeReminderModal').addEventListener('click', () =>
    document.getElementById('reminderModalOverlay').classList.remove('open'));
  document.getElementById('cancelReminderModal').addEventListener('click', () =>
    document.getElementById('reminderModalOverlay').classList.remove('open'));
  document.getElementById('reminderModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget)
      document.getElementById('reminderModalOverlay').classList.remove('open');
  });
  document.getElementById('reminderForm').addEventListener('submit', saveReminder);
}

async function saveReminder(e) {
  e.preventDefault();
  const payload = {
    title:         document.getElementById('remTitle').value.trim(),
    reminder_type: document.getElementById('remType').value,
    reminder_date: document.getElementById('remDate').value,
    reminder_time: document.getElementById('remTime').value || null,
    notes:         document.getElementById('remNotes').value,
    repeat_yearly: document.getElementById('remYearly').checked,
  };
  if (!payload.title || !payload.reminder_date) return;
  await api('POST', '/api/reminders', payload);
  document.getElementById('reminderModalOverlay').classList.remove('open');
  loadReminders();
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  await api('DELETE', `/api/reminders/${id}`);
  loadReminders();
}

// ── Utils ──────────────────────────────────────────────────
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function reminderEmoji(type) {
  return { birthday:'🎂', meeting:'🤝', special:'✨', reminder:'🔔' }[type] || '🔔';
}
