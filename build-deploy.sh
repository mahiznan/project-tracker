#!/bin/sh
# Collects only the files that go to the web host into ./deploy
set -e
cd "$(dirname "$0")"
rm -rf deploy && mkdir deploy
cp index.html app.js styles.css tasks.php .htaccess deploy/
echo "Upload the contents of ./deploy to your site folder:"; ls -A deploy
