let data = { tasks: [] }, loaded = false;

const $ = id => document.getElementById(id);
const LABEL = {completed:"Completed","in-progress":"In progress",pending:"Pending"};
const NEXT = {pending:"in-progress","in-progress":"completed",completed:"pending"};
const svg = (d, s=16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ring = '<circle cx="8" cy="8" r="7.25" stroke="currentColor" stroke-width="1.5"/>';
const ICON = {
  completed: '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.25" fill="currentColor"/><path d="M5 8.3l2.2 2.2L11 6" style="stroke:var(--tick)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "in-progress": `<svg viewBox="0 0 16 16" fill="none">${ring}<g fill="currentColor"><circle class="jd" cx="4.9" cy="8" r="1.05"/><circle class="jd" cx="8" cy="8" r="1.05"/><circle class="jd" cx="11.1" cy="8" r="1.05"/></g></svg>`,
  pending: `<svg viewBox="0 0 16 16" fill="none">${ring}<path d="M8 4.6V8l2.3 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const I = {
  add: svg('<path d="M8 3v10M3 8h10"/>'), all: svg('<path d="M4.5 6.5 8 3l3.5 3.5M4.5 9.5 8 13l3.5-3.5"/>'),
  none: svg('<path d="M4.5 3 8 6.5 11.5 3M4.5 13 8 9.5l3.5 3.5"/>'), list: svg('<path d="M3 4.5h10M3 8h10M3 11.5h10"/>'),
  one: svg('<path d="M3 8h10"/>'), more: svg('<path d="M2.5 2.5 6 6l3.5-3.5M2.5 6.5 6 10l3.5-3.5"/>', 12),
  moon: svg('<path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z"/>'),
  sun: svg('<circle cx="8" cy="8" r="2.8"/><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1"/>'),
  chev: svg('<path d="M6 4l4 4-4 4"/>', 12),
  sort0: svg('<path d="M5.5 12.5v-9M3.5 5.5l2-2 2 2M10.5 3.5v9M8.5 10.5l2 2 2-2"/>'),
  sort1: svg('<path d="M3 4.5h4M3 8h6M3 11.5h8M12.5 12V4M10.5 6l2-2 2 2"/>'),
  sort2: svg('<path d="M3 4.5h8M3 8h6M3 11.5h4M12.5 4v8M10.5 10l2 2 2-2"/>'),
  up: svg('<path d="M4.5 10 8 6.5l3.5 3.5"/>'), down: svg('<path d="M4.5 6 8 9.5 11.5 6"/>'),
  archive: svg('<path d="M2.5 3.5h11v2.5h-11zM3.5 6v7h9V6M8 7.8v3.2M6.4 9.6 8 11.2l1.6-1.6"/>'),
  restore: svg('<path d="M2.5 3.5h11v2.5h-11zM3.5 6v7h9V6M8 11V7.8M6.4 9.4 8 7.8l1.6 1.6"/>'),
  trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v3.5M9 7v3.5"/>', 14)
};
const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = d => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
const status = t => { const a = t.subtasks.map(s => s.status);
  return !a.length || a.every(x => x==="pending") ? "pending" : a.every(x => x==="completed") ? "completed" : "in-progress"; };

const dark = matchMedia("(prefers-color-scheme:dark)");
const isDark = () => (document.documentElement.dataset.theme || (dark.matches ? "dark" : "light")) === "dark";
const open = new Set();
let shown = 1, adding = false, archOpen = false, focus = null, armed = null, sort = 0;  // sort: 0 manual, 1 status (active first), 2 status (completed first)
const RANK = {"in-progress":0, pending:1, completed:2};
const active = () => {
  const a = data.tasks.filter(t => !t.archived);
  return sort ? a.map(t => [RANK[status(t)], t]).sort((x, y) => sort === 1 ? x[0] - y[0] : y[0] - x[0]).map(x => x[1]) : a;
};

const lbl = s => `<span${s === "in-progress" ? ' class="shine"' : ""}>${LABEL[s]}</span>`;
const btn = (cls, a, icon, label, i, on) => `<button class="${cls}${on?" armed":""}" data-a="${a}"${i==null?"":` data-i="${i}"`} title="${on?"Click again to delete":label}" aria-label="${label}">${icon}</button>`;

const taskHTML = t => {
  const st = status(t), o = open.has(t.id), A = active(), i = A.indexOf(t);
  return `<article class="task${o?" open":""}" data-id="${t.id}">
    <button class="head" data-a="toggle"><i class="plus"></i>
      <div class="info"><div class="title">${esc(t.name)}</div>${o?`<div class="dates">ETA: ${fmt(t.end)}</div>`:""}</div>
      <span class="capsule ${st}">${ICON[st]}${lbl(st)}</span></button>
    ${o?`<div class="subs">${t.subtasks.map((s,i)=>`<div class="sub ${s.status}"><button class="cyc" data-a="cycle" data-i="${i}"><span class="label">${esc(s.name)}</span><span class="stat">${ICON[s.status]}${lbl(s.status)}</span></button>${btn("del","delsub",I.trash,"Delete subtask",i,armed===`s:${t.id}:${i}`)}</div>`).join("")}
      <form class="subnew"><input name="n" placeholder="Add subtask" autocomplete="off" required></form>
      <div class="acts">${!sort && i > 0 ? btn("act","up",I.up,"Move up") : ""}${!sort && i >= 0 && i < A.length - 1 ? btn("act","down",I.down,"Move down") : ""}${btn("act","archive",t.archived?I.restore:I.archive,t.archived?"Restore":"Archive")}${btn("act","deltask",I.trash,"Delete task",null,armed===`t:${t.id}`)}</div></div>`:""}
  </article>`;
};

function render() {
  const T = active(), A = data.tasks.filter(t => t.archived);
  shown = Math.min(Math.max(shown, 1), Math.max(T.length, 1));
  const full = shown >= T.length, allOpen = full && T.every(t => open.has(t.id));
  $("tasks").innerHTML = (adding ? `<form class="newtask"><i class="plus"></i><input name="n" placeholder="New task" autocomplete="off" required><input name="d" type="date" required></form>` : "")
    + T.slice(0, shown).map(taskHTML).join("");
  $("archived").innerHTML = archOpen ? (A.map(taskHTML).join("") || '<div class="empty">Nothing archived</div>') : "";
  $("arch").classList.toggle("open", archOpen);
  document.querySelector(".arch-head").innerHTML = `${I.chev} Archive <span>${A.length ? "· " + A.length : ""}</span>`;
  $("add").innerHTML = I.add;
  $("list").innerHTML = full ? I.one : I.list;  $("list").title = full ? "Show first task only" : "Show all tasks";
  $("all").innerHTML = allOpen ? I.none : I.all; $("all").title = allOpen ? "Collapse all" : "Show all";
  $("theme").innerHTML = isDark() ? I.sun : I.moon; $("theme").title = isDark() ? "Light theme" : "Dark theme";
  $("sort").innerHTML = I["sort" + sort]; $("sort").classList.toggle("on", !!sort);
  $("sort").title = ["Sort by status", "Sorted: In progress first (click to reverse)", "Sorted: Completed first (click for manual order)"][sort];
  $("more").innerHTML = I.more; $("more").hidden = full;
  if (focus) { document.querySelector(focus)?.focus(); focus = null; }
}

let saveTimer;
function save() {
  if (!loaded) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    let failed;
    try {
      failed = !(await fetch("tasks.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).ok;
    } catch { failed = true; }
    $("note").hidden = !failed;
  }, 150);
}

const find = el => data.tasks.find(t => t.id == el.closest(".task")?.dataset.id);

document.addEventListener("click", e => {
  if (!loaded) return;
  const was = armed; armed = null;
  const b = e.target.closest("[data-a]"); if (!b) { if (was) render(); return; }
  const t = find(b), a = b.dataset.a;
  if (a === "toggle") open.has(t.id) ? open.delete(t.id) : open.add(t.id);
  else if (a === "cycle") { t.subtasks[b.dataset.i].status = NEXT[t.subtasks[b.dataset.i].status]; save(); }
  else if (a === "archive") { t.archived = !t.archived; open.delete(t.id); save(); }
  else if (a === "deltask") { if (was === `t:${t.id}`) { data.tasks = data.tasks.filter(x => x !== t); open.delete(t.id); save(); } else armed = `t:${t.id}`; }
  else if (a === "delsub") { const k = `s:${t.id}:${b.dataset.i}`; if (was === k) { t.subtasks.splice(b.dataset.i, 1); save(); } else armed = k; }
  else if (a === "sort") sort = (sort + 1) % 3;
  else if ((a === "up" || a === "down") && !sort) {
    const A = active(), o = A[A.indexOf(t) + (a === "up" ? -1 : 1)];
    if (o) { const x = data.tasks.indexOf(t), y = data.tasks.indexOf(o); [data.tasks[x], data.tasks[y]] = [o, t]; focus = `[data-id="${t.id}"] [data-a="${a}"]`; save(); }
  }
  else if (a === "more") shown++;
  else if (a === "list") { shown = shown >= active().length ? 1 : active().length; open.clear(); }
  else if (a === "all") { const T = active(), every = shown >= T.length && T.every(x => open.has(x.id));
    if (every) open.clear(); else { shown = T.length; T.forEach(x => open.add(x.id)); } }
  else if (a === "add") { adding = !adding; if (adding) focus = ".newtask input"; }
  else if (a === "arch") archOpen = !archOpen;
  else if (a === "theme") { const t = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = t; try { localStorage.theme = t } catch {} }
  render();
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (!loaded) return;
  const f = e.target, n = f.n.value.trim(); if (!n) return;
  if (f.classList.contains("newtask")) {
    const t = {id: Date.now(), name: n, start: new Date().toLocaleDateString("en-CA"), end: f.d.value, subtasks: []};
    data.tasks.unshift(t); open.add(t.id); adding = false; shown++;
    focus = `[data-id="${t.id}"] .subnew input`;
  } else {
    const t = find(f); t.subtasks.push({name: n, status: "pending"});
    focus = `[data-id="${t.id}"] .subnew input`;
  }
  save();
  render();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && adding) { adding = false; render(); }
  else if (e.key === "Enter" && e.target.closest?.(".newtask")) {
    e.preventDefault();
    const f = e.target.form;
    if (e.target.name !== "n") f.requestSubmit();                       // Enter in the date field saves
    else if (f.n.value.trim()) { f.d.focus(); try { f.d.showPicker() } catch {} }  // Enter in the name opens the date picker
    else f.reportValidity();
  }
});
dark.onchange = render;
fetch("tasks.json")
  .then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(d => { if (!d || !Array.isArray(d.tasks)) throw 0; data = d; loaded = true; shown = active().length; render(); })
  .catch(() => { $("tasks").innerHTML = '<div class="empty">Could not load tasks.json</div>'; });
