# Tasks & Progress

A minimal tracker for weekly progress check-ins. Tasks, ETA, status and subtasks are saved on every change.

## Run locally
```
npm start      # http://localhost:3000  (PORT=… to change); data in tasks.json
npm test       # server tests
```
No dependencies. Needs Node 18+ and a 2024+ browser.

## Deploy to cPanel (e.g. tasks.learnerandtutor.com)
The app talks to `tasks.php` (locally, `server.js` answers the same URL).

1. Enable HTTPS: cPanel → SSL/TLS Status → run AutoSSL for the domain.
2. `./build-deploy.sh`, then upload the contents of `deploy/` to the site's document root.
3. `tasks.php` stores data in `../tasks-data/` (outside the web root, created on first use). Override with the `TASKS_DATA_DIR` env var.
4. cPanel → Directory Privacy → protect the document root and create a user. **Required**: the app has no login of its own.
5. Check: private window shows a login prompt; `curl -i https://<domain>/tasks.php` returns 401.

Backups are written next to the data: `tasks.json.bak` (previous save) and one `tasks-YYYY-MM-DD.json` per day (30 days kept).
