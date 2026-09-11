#!/bin/sh
# This file is part of Moodle - https://moodle.org/
#
# Moodle is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Moodle is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Moodle.  If not, see <https://www.gnu.org/licenses/>.
#
# CI helper: starts PHP's built-in web server for the site built by build-test-site.sh and
# waits until the login page answers 200. SOURCE it (". plugin/.github/serve-test-site.sh") in
# the same step that runs the tests: a server started in an earlier step does not reliably
# survive into the next one. POSIX sh on purpose, so it can be sourced from any shell.
#
# - Bound to 127.0.0.1, not "localhost": clients may resolve localhost to ::1, where the built-in
#   server does not listen, and then report HTTP 0 - which looks like a timeout.
# - PHP_CLI_SERVER_WORKERS: a single worker stalls as soon as a browser requests the many
#   subresources of a Moodle page in parallel.
#
# @copyright 2026 Ralf Erlebach
# @license   https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later

web=moodle
if [ -d moodle/public ]; then
  web=moodle/public
fi
PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-8}" php -S 127.0.0.1:8000 -t "$web" \
  > /tmp/moodle-server.log 2>&1 &
ready=0
code=000
for _ in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:8000/login/index.php || true)
  if [ "$code" = "200" ]; then
    ready=1
    break
  fi
  sleep 3
done
if [ "$ready" != "1" ]; then
  echo "Moodle did not become reachable (last HTTP status: $code). Server log:"
  tail -50 /tmp/moodle-server.log
  exit 1
fi
echo "Moodle test server is up on http://127.0.0.1:8000"
