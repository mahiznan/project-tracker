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
