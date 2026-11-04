# Tasks & Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved mock (`mock/v3.html`) into a working local app that loads and saves `tasks.json` through a tiny Node server.

**Architecture:** A static page (`index.html`, `styles.css`, `app.js`) fetches `tasks.json` and renders it. Every data change sends the whole document back with `PUT /tasks.json`. `server.js` serves four files and does an atomic write (temp file, then rename).

**Tech Stack:** Vanilla HTML/CSS/JS, Node 18+ built-ins only (`http`, `fs`, `node:test`). Node 26 is installed here.

## Global Constraints

- No framework, no build step, no npm dependencies.
- Server binds to `127.0.0.1`, port `3000` (override with `PORT`).
- Server serves only `index.html`, `styles.css`, `app.js`, `tasks.json`; anything else is 404.
- `PUT /tasks.json`: JSON body up to 1 MB, root must be an object with a `tasks` array, else 400 (413 if too large). Write via temp file + rename.
- Task status is derived from subtasks and never stored: no subtasks or all pending → `pending`; all `completed` → `completed`; otherwise `in-progress`.
- Subtask status values: `pending`, `in-progress`, `completed`.
- UI is the approved mock; `mock/v3.html` is the visual source of truth. Do not change look or copy.
- All user-entered text is HTML-escaped before rendering.
- Theme follows the device; the toggle choice is kept in `localStorage.theme`.
- The folder is not a git repo. Commit steps apply only if the user runs `git init`; otherwise skip them.

---

## File Structure

```
project-tracker/
├── package.json      scripts: start, test
├── server.js         createServer(dataFile) + CLI start
├── test/server.test.js
├── index.html        shell (from mock/v3.html markup)
├── styles.css        (from mock/v3.html <style>)
├── app.js            (from mock/v3.html main <script>, plus load/save)
└── tasks.json        seed data
```

### Task 1: Server with atomic save (TDD)

**Files:**
- Create: `package.json`, `server.js`, `test/server.test.js`

**Interfaces:**
- Produces: `createServer(dataFile: string): http.Server` exported from `server.js`. Routes: `GET /` and `/index.html`, `/styles.css`, `/app.js`, `GET|PUT /tasks.json`. Later tasks rely on `PUT /tasks.json` returning `204` on success.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "project-tracker",
  "private": true,
  "scripts": { "start": "node server.js", "test": "node --test" }
}
```

- [ ] **Step 2: Write the failing tests** in `test/server.test.js`

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createServer } = require("../server");

let server, base, file;
test.before(async () => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pt-")), "tasks.json");
  server = createServer(file);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const put = body => fetch(base + "/tasks.json", {
  method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body)
});

test("GET creates an empty file when missing", async () => {
  const res = await fetch(base + "/tasks.json");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { tasks: [] });
  assert.ok(fs.existsSync(file));
});

test("PUT persists valid data atomically", async () => {
  const doc = { tasks: [{ id: 1, name: "a", subtasks: [] }] };
  assert.equal((await put(doc)).status, 204);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), doc);
  assert.deepEqual(await (await fetch(base + "/tasks.json")).json(), doc);
  assert.ok(!fs.existsSync(file + ".tmp"), "temp file must not remain");
});

test("PUT rejects invalid JSON", async () => {
  assert.equal((await put("{nope")).status, 400);
});

test("PUT rejects wrong shape and leaves the file unchanged", async () => {
  const before = fs.readFileSync(file, "utf8");
  assert.equal((await put({})).status, 400);
  assert.equal((await put({ tasks: "x" })).status, 400);
  assert.equal((await put("[]")).status, 400);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});

test("PUT rejects bodies over 1 MB", async () => {
  const big = '{"tasks":[],"pad":"' + "x".repeat(1024 * 1024) + '"}';
  assert.equal((await put(big)).status, 413);
});

test("unknown paths are 404", async () => {
  assert.equal((await fetch(base + "/server.js")).status, 404);
  assert.equal((await fetch(base + "/package.json")).status, 404);
});

test("wrong method on tasks.json is 405", async () => {
  assert.equal((await fetch(base + "/tasks.json", { method: "DELETE" })).status, 405);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/rajeshkumarm/workspace/project-tracker && node --test`
Expected: FAIL with `Cannot find module '../server'`.

- [ ] **Step 4: Write `server.js`**

```js
const http = require("http"), fs = require("fs"), path = require("path");

const MAX = 1024 * 1024;
const FILES = { "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/app.js": "app.js" };
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
                ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function send(res, code, body = "", type = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function createServer(dataFile) {
  function put(req, res) {
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size <= MAX) chunks.push(c); });
    req.on("end", () => {
      if (size > MAX) return send(res, 413, "Too Large");
      let doc;
      try { doc = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return send(res, 400, "Invalid JSON"); }
      if (!doc || typeof doc !== "object" || !Array.isArray(doc.tasks)) return send(res, 400, "Expected { tasks: [] }");
      const tmp = dataFile + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + "\n");
      fs.renameSync(tmp, dataFile);
      send(res, 204);
    });
  }

  return http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/tasks.json") {
      if (req.method === "GET") {
        if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '{"tasks":[]}\n');
        return send(res, 200, fs.readFileSync(dataFile), TYPES[".json"]);
      }
      return req.method === "PUT" ? put(req, res) : send(res, 405, "Method Not Allowed");
    }
    const name = FILES[url];
    if (!name) return send(res, 404, "Not Found");
    if (req.method !== "GET") return send(res, 405, "Method Not Allowed");
    send(res, 200, fs.readFileSync(path.join(__dirname, name)), TYPES[path.extname(name)]);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer(path.join(__dirname, "tasks.json")).listen(port, "127.0.0.1", () =>
    console.log(`Tasks & Progress → http://localhost:${port}`));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: 7 tests pass, 0 fail.

- [ ] **Step 6: Commit (only if `git init` was run)**

```bash
git add package.json server.js test/server.test.js && git commit -m "feat: tasks.json server with atomic save"
```

---

### Task 2: Split the mock into the real app and wire load/save

**Files:**
- Create: `tasks.json`, `index.html`, `styles.css`, `app.js` (the last three are generated from `mock/v3.html` by the script in Step 2)
- Modify: `test/server.test.js` (add a static-serving test)

**Interfaces:**
- Consumes: Task 1 server and its `PUT /tasks.json` → `204`.
- Produces: the finished app served at `http://localhost:3000`.

- [ ] **Step 1: Write the seed `tasks.json`** (starter content; the user replaces it with real tasks)

```json
{
  "tasks": [
    { "id": 1, "name": "Payments API migration", "start": "2026-10-12", "end": "2026-11-20", "subtasks": [
      { "name": "Audit existing endpoints", "status": "completed" },
      { "name": "Design new schema", "status": "completed" },
      { "name": "Implement v2 endpoints", "status": "in-progress" },
      { "name": "Load testing", "status": "pending" } ] },
    { "id": 2, "name": "Onboarding flow redesign", "start": "2026-10-01", "end": "2026-10-30", "subtasks": [
      { "name": "User interviews", "status": "completed" },
      { "name": "Build steps 1–3", "status": "in-progress" },
      { "name": "A/B test setup", "status": "pending" } ] },
    { "id": 3, "name": "CI pipeline speed-up", "archived": true, "start": "2026-09-15", "end": "2026-10-15", "subtasks": [
      { "name": "Enable build caching", "status": "completed" },
      { "name": "Parallelise test suites", "status": "completed" } ] }
  ]
}
```

- [ ] **Step 2: Split `mock/v3.html` into three files.** Save as `/private/tmp/claude-501/-Users-rajeshkumarm-workspace-project-tracker/3f6b567e-c71b-4d0f-a5e2-80120bc04332/scratchpad/split.py` and run it from the project root with `python3 -I <that path>`:

```python
import re
s = open("mock/v3.html").read()
css = re.search(r"<style>\n(.*?)</style>", s, re.S).group(1)
js = re.findall(r"<script>(.*?)</script>", s, re.S)[1].strip() + "\n"
html = re.sub(r"<style>.*?</style>", '<link rel="stylesheet" href="styles.css">', s, flags=re.S)
html = re.sub(r"<script>\n.*?</script>", '<script src="app.js"></script>', html, flags=re.S)  # main script only; the head one has no newline after the tag
open("styles.css", "w").write(css)
open("app.js", "w").write(js)
open("index.html", "w").write(html)
```

Expected: `index.html` keeps the small inline theme-restore `<script>` in `<head>` (prevents a flash), links `styles.css`, and ends with `<script src="app.js"></script>`. Check with `grep -c "<script" index.html` → `2`.

- [ ] **Step 3: Replace the sample data in `app.js` with a loaded variable.** Delete the whole `const data = { tasks: [ ... ]};` block (from `const data = { tasks: [` through its closing `]};`) and put this in its place:

```js
let data = { tasks: [] };
```

- [ ] **Step 4: Add the save function** in `app.js`, directly above `const find = ...`:

```js
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
```

- [ ] **Step 5: Call `save()` after data changes.**

In the click handler, change the lines for `cycle` and `archive` and the end of the handler so saving happens only for those two:

```js
  else if (a === "cycle") { t.subtasks[b.dataset.i].status = NEXT[t.subtasks[b.dataset.i].status]; save(); }
  else if (a === "archive") { t.archived = !t.archived; open.delete(t.id); save(); }
```

In the submit handler, add `save();` immediately before the final `render();` of that handler.

- [ ] **Step 6: Load on startup.** At the very end of `app.js`, replace

```js
dark.onchange = render;
render();
```

with

```js
dark.onchange = render;
fetch("tasks.json")
  .then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(d => { data = d; render(); })
  .catch(() => { $("tasks").innerHTML = '<div class="empty">Could not load tasks.json</div>'; });
```

- [ ] **Step 7: Add the "Not saved" note.**

In `index.html` change `<h1>Tasks &amp; Progress</h1>` to:

```html
<h1>Tasks &amp; Progress <small class="note" id="note" hidden>Not saved</small></h1>
```

Append to `styles.css`:

```css
.note{font-size:12px;font-weight:500;color:light-dark(#c2410c,#fb923c);margin-left:8px}
```

- [ ] **Step 8: Add the static-serving test** at the end of `test/server.test.js`

```js
test("serves the app shell and assets", async () => {
  for (const [p, type] of [["/", "text/html"], ["/styles.css", "text/css"], ["/app.js", "text/javascript"]]) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.ok(res.headers.get("content-type").startsWith(type), p);
  }
});
```

- [ ] **Step 9: Run the tests and a syntax check**

Run: `node --test && node --check app.js`
Expected: 8 tests pass; `node --check` prints nothing.

- [ ] **Step 10: Commit (only if `git init` was run)**

```bash
git add index.html styles.css app.js tasks.json test/server.test.js && git commit -m "feat: split mock into app with load/save"
```

---

### Task 3: End-to-end verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Start the server**

Run: `cd /Users/rajeshkumarm/workspace/project-tracker && npm start` (in the background)
Expected: prints `Tasks & Progress → http://localhost:3000`.

- [ ] **Step 2: Check the save path from the shell**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X PUT localhost:3000/tasks.json -d '{"tasks":[]}'` then `curl -s localhost:3000/tasks.json`
Expected: `204`, then `{"tasks": []}`. Restore the seed `tasks.json` from Task 2 Step 1 afterwards.

- [ ] **Step 3: Walk the UI at `http://localhost:3000`** and confirm each item. After every data change, `cat tasks.json` must show it.

  1. Only the first task is visible; ETA and subtasks are hidden.
  2. Click the circle-plus: ETA and subtasks appear, plus becomes minus, nothing else moves.
  3. Click a subtask: it cycles pending → in progress → completed → pending, the task capsule updates, and `tasks.json` changes.
  4. Double-chevron on the line reveals one task per click, then disappears.
  5. The `─`/`☰` icon flips between one task and all tasks; the chevron icon flips between expanded and collapsed with all tasks visible.
  6. `+` opens the new-task row; Enter with a name and date adds it at the top, opened, with focus in "Add subtask"; Esc cancels. Typing `<b>x</b>` as a name shows literally.
  7. Add two subtasks in a row with Enter; both appear as Pending.
  8. Archive a task: it moves into Archive and the count updates. Restore moves it back.
  9. Theme icon switches light/dark and survives a reload; with no saved choice it follows the system.
  10. Stop the server, change a subtask: "Not saved" appears next to the title. Restart and change again: it disappears.
  11. Reload after edits: all changes are still there.

- [ ] **Step 4: Fix anything that failed, re-run `node --test`, then stop the server.**

- [ ] **Step 5: Commit (only if `git init` was run)**

```bash
git add -A && git commit -m "chore: verify end to end"
```
