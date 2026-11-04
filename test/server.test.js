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
