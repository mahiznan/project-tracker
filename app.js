let data = { tasks: [] };

const $ = id => document.getElementById(id);
const LABEL = {completed:"Completed","in-progress":"In progress",pending:"Pending"};
const NEXT = {pending:"in-progress","in-progress":"completed",completed:"pending"};
const svg = (d, s=16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ring = '<circle cx="8" cy="8" r="7.25" stroke="currentColor" stroke-width="1.5"/>';
const ICON = {
  completed: '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.25" fill="currentColor"/><path d="M5 8.3l2.2 2.2L11 6" style="stroke:var(--tick)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "in-progress": `<svg viewBox="0 0 16 16" fill="none">${ring}<g fill="currentColor"><circle cx="4.9" cy="8" r="1.05"/><circle cx="8" cy="8" r="1.05"/><circle cx="11.1" cy="8" r="1.05"/></g></svg>`,
  pending: `<svg viewBox="0 0 16 16" fill="none">${ring}<path d="M8 4.6V8l2.3 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const I = {
  add: svg('<path d="M8 3v10M3 8h10"/>'), all: svg('<path d="M4.5 6.5 8 3l3.5 3.5M4.5 9.5 8 13l3.5-3.5"/>'),
  none: svg('<path d="M4.5 3 8 6.5 11.5 3M4.5 13 8 9.5l3.5 3.5"/>'), list: svg('<path d="M3 4.5h10M3 8h10M3 11.5h10"/>'),
  one: svg('<path d="M3 8h10"/>'), more: svg('<path d="M2.5 2.5 6 6l3.5-3.5M2.5 6.5 6 10l3.5-3.5"/>', 12),
  moon: svg('<path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z"/>'),
  sun: svg('<circle cx="8" cy="8" r="2.8"/><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1"/>'),
  chev: svg('<path d="M6 4l4 4-4 4"/>', 12)
};
const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = d => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
const status = t => { const a = t.subtasks.map(s => s.status);
  return !a.length || a.every(x => x==="pending") ? "pending" : a.every(x => x==="completed") ? "completed" : "in-progress"; };

const dark = matchMedia("(prefers-color-scheme:dark)");
const isDark = () => (document.documentElement.dataset.theme || (dark.matches ? "dark" : "light")) === "dark";
const open = new Set();
let shown = 1, adding = false, archOpen = false, focus = null;
const active = () => data.tasks.filter(t => !t.archived);

const taskHTML = t => {
  const st = status(t), o = open.has(t.id);
  return `<article class="task${o?" open":""}" data-id="${t.id}">
    <button class="head" data-a="toggle"><i class="plus"></i>
      <div class="info"><div class="title">${esc(t.name)}</div>${o?`<div class="dates">ETA: ${fmt(t.end)}</div>`:""}</div>
      <span class="capsule ${st}">${ICON[st]}${LABEL[st]}</span></button>
    ${o?`<div class="subs">${t.subtasks.map((s,i)=>`<button class="sub ${s.status}" data-a="cycle" data-i="${i}"><span class="label">${esc(s.name)}</span><span class="stat">${ICON[s.status]}${LABEL[s.status]}</span></button>`).join("")}
      <form class="subnew"><input name="n" placeholder="Add subtask" autocomplete="off" required></form>
      <button class="act" data-a="archive">${t.archived?"Restore":"Archive"}</button></div>`:""}
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
  $("more").innerHTML = I.more; $("more").hidden = full;
  if (focus) { document.querySelector(focus)?.focus(); focus = null; }
}

let saveTimer;
function save() {
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
  const b = e.target.closest("[data-a]"); if (!b) return;
  const t = find(b), a = b.dataset.a;
  if (a === "toggle") open.has(t.id) ? open.delete(t.id) : open.add(t.id);
  else if (a === "cycle") { t.subtasks[b.dataset.i].status = NEXT[t.subtasks[b.dataset.i].status]; save(); }
  else if (a === "archive") { t.archived = !t.archived; open.delete(t.id); save(); }
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
  const f = e.target, n = f.n.value.trim(); if (!n) return;
  if (f.classList.contains("newtask")) {
    const t = {id: Date.now(), name: n, start: new Date().toISOString().slice(0,10), end: f.d.value, subtasks: []};
    data.tasks.unshift(t); open.add(t.id); adding = false; shown = Math.max(shown, 1);
    focus = `[data-id="${t.id}"] .subnew input`;
  } else {
    const t = find(f); t.subtasks.push({name: n, status: "pending"});
    focus = `[data-id="${t.id}"] .subnew input`;
  }
  save();
  render();
});

document.addEventListener("keydown", e => { if (e.key === "Escape" && adding) { adding = false; render(); } });
dark.onchange = render;
fetch("tasks.json")
  .then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(d => { data = d; render(); })
  .catch(() => { $("tasks").innerHTML = '<div class="empty">Could not load tasks.json</div>'; });
