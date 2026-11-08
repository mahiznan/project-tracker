<?php
// Storage endpoint for the tracker. GET returns the document, PUT replaces it.
// Keep the data OUTSIDE the web root. Default: ../tasks-data/ next to the site folder.
$DIR  = getenv('TASKS_DATA_DIR') ?: dirname(__DIR__) . '/tasks-data';
$FILE = $DIR . '/tasks.json';
$MAX  = 1024 * 1024;

function out($code, $body = '', $type = 'text/plain; charset=utf-8') {
  http_response_code($code);
  header('Content-Type: ' . $type);
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo $body;
  exit;
}

if (!is_dir($DIR) && !@mkdir($DIR, 0700, true)) out(500, 'Data folder missing');

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
  if (!file_exists($FILE)) file_put_contents($FILE, "{\"tasks\":[]}\n");
  out(200, file_get_contents($FILE), 'application/json; charset=utf-8');
}

if ($method !== 'PUT') { header('Allow: GET, PUT'); out(405, 'Method Not Allowed'); }

// Same-origin only: stops another website from making your logged-in browser save.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
  $oh = strtolower((string) parse_url($origin, PHP_URL_HOST));
  $hh = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
  if ($oh === '' || $oh !== $hh) out(403, 'Forbidden');
}

$raw = file_get_contents('php://input', false, null, 0, $MAX + 1);
if ($raw === false || strlen($raw) > $MAX) out(413, 'Too Large');
$doc = json_decode($raw);
if (json_last_error() !== JSON_ERROR_NONE) out(400, 'Invalid JSON');
if (!is_object($doc) || !isset($doc->tasks) || !is_array($doc->tasks)) out(400, 'Expected { tasks: [] }');

// Backups: previous save, plus one dated copy per day (30 days kept).
if (file_exists($FILE)) {
  @copy($FILE, $FILE . '.bak');
  $daily = $DIR . '/tasks-' . date('Y-m-d') . '.json';
  if (!file_exists($daily)) @copy($FILE, $daily);
  foreach (glob($DIR . '/tasks-*.json') ?: [] as $f) if (filemtime($f) < time() - 30 * 86400) @unlink($f);
}

$tmp = $FILE . '.tmp';
if (file_put_contents($tmp, json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX) === false
    || !rename($tmp, $FILE)) { @unlink($tmp); out(500, 'Write failed'); }
out(204);
