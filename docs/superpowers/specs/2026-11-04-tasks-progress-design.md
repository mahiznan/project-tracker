# Tasks & Progress: Design

A minimal single-page tracker for a 30-minute weekly manager check-in. It shows tasks with ETA, status and collapsible subtasks. Data lives in `tasks.json` next to the app and is saved back to it on every change.

Approved visual reference: `mock/v3.html` (the real app is that file split into `index.html`, `styles.css`, `app.js`, plus the server).

## Goals
- Open and readable in under a second. No framework, no build step, no npm dependencies.
- Show only what a manager needs: task name, ETA, status, subtasks and their status.
- Edits (status, new task, new subtask, archive) are saved to `tasks.json` automatically.

## Non-goals (first version)
- Rename or delete of tasks and subtasks (edit `tasks.json` by hand; Archive hides a task).
- Multi-user editing, auth, history, notifications, remote hosting.

## Decisions taken as defaults (change if wrong)
1. **Task status is derived from subtasks**: no subtasks or all pending → Pending; all completed → Completed; otherwise In progress. It is never stored.
2. **No rename or delete in the UI.**

## Files
```
project-tracker/
├── index.html   shell: header, #tasks, #more, #arch
├── styles.css   theme tokens via light-dark(), layout
├── app.js       state, render, events (event delegation)
├── server.js    static server + PUT /tasks.json (node built-ins only)
├── tasks.json   data (source of truth)
└── mock/        design references (not shipped)
```

## Data model (`tasks.json`)
```json
{ "tasks": [
  { "id": 1730000000000, "name": "Payments API migration",
    "start": "2026-10-12", "end": "2026-11-20", "archived": false,
    "subtasks": [ { "name": "Load testing", "status": "pending" } ] }
] }
```
- `status` of a subtask is one of `pending`, `in-progress`, `completed`.
- `start` is set to today on creation and is not displayed. `end` is the ETA (`YYYY-MM-DD`). `archived` may be omitted when false.
- Array order is display order. New tasks are added at the top.

## UI behavior
- **Header:** title "Tasks & Progress" and icon buttons: add task, one/all tasks flip, expand/collapse all flip, theme toggle.
- **Task row:** circle-plus (minus when open) · name · fixed-width status capsule with icon. ETA (`ETA: 20 Nov 2026`) shows only when expanded. Only the first task is visible on load; the double-chevron on the divider reveals one more per click.
- **Expanded task:** subtasks (name · icon · status text, aligned in a column), "Add subtask" field, Archive link. Clicking a subtask cycles pending → in-progress → completed → pending.
- **New task:** `+` opens a name + date row. Enter saves, Esc cancels. The new task opens with the subtask field focused.
- **Archive:** collapsed section at the bottom with a count. Archived tasks can be in any state and expand like normal tasks; expanded ones show Restore.
- **Theme:** follows the device; the toggle overrides and is remembered in `localStorage`. Needs a 2024+ browser (`light-dark()`).
- All user text is HTML-escaped before rendering.

## Persistence
- **Load:** `fetch('tasks.json')` on startup. If it fails, show "Could not load tasks.json" in place of the list.
- **Save:** after every data change the client sends `PUT /tasks.json` with the whole document (debounced ~150 ms, optimistic UI). On failure a small "Not saved" note appears next to the title; the next successful save clears it.
- **Concurrency:** last write wins. This is a single-user local tool.

## Server (`node server.js`)
- Binds to `127.0.0.1`, port `3000` (override with `PORT`).
- Serves only `index.html`, `styles.css`, `app.js`, `tasks.json`. Anything else is 404, so there is no path traversal.
- `GET /tasks.json` returns the file. If it does not exist the server creates `{"tasks":[]}` first.
- `PUT /tasks.json` accepts JSON up to 1 MB whose root is an object with a `tasks` array. Anything else gets 400. A valid body is written to a temp file and renamed over `tasks.json`, so a crash cannot leave a half-written file.
- Other methods on these paths get 405.

## Testing
- **Server (`node --test`, no dependencies):** GET returns the data; valid PUT persists; invalid JSON and wrong shape get 400; oversized body is rejected; unknown path is 404; a missing file is created on first GET.
- **UI (manual checklist in the plan):** cycle a subtask and confirm `tasks.json` changed; add a task and subtask; archive and restore; reveal and flip controls; theme toggle and reload; stop the server and confirm "Not saved".
