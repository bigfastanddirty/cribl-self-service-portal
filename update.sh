#!/usr/bin/env bash
# Offline application update; run git pull before invoking this script.
set -euo pipefail
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mode=${1:---update}
case "$mode" in --update|--check) ;; *) echo 'Usage: sudo ./update.sh [--update|--check]' >&2; exit 2;; esac
fail() { echo "ERROR: $*" >&2; exit 1; }
target=/opt/cribl-self-service
service=cribl-self-service
for cmd in tar sha256sum mktemp cp mv find flock; do command -v "$cmd" >/dev/null || fail "Missing tool: $cmd"; done
[[ $mode == --check || $EUID -eq 0 ]] || fail 'Run sudo ./update.sh'
[[ -f "$target/server.mjs" && -x "$target/runtime/bin/node" ]] || fail 'Existing offline installation not found. Use install.sh for a fresh installation.'
"$target/runtime/bin/node" --version | grep -q '^v22\.' || fail 'Installed private Node 22 runtime is required'
(cd "$repo/vendor" && sha256sum --check --quiet SHA256SUMS) || fail 'Vendor checksum verification failed'
if [[ $mode == --check ]]; then stage=$(mktemp -d); else
  exec 9>/opt/.cribl-self-service-update.lock
  flock -n 9 || fail 'Another update is running'
  stage=$(mktemp -d /opt/.cribl-portal-update.XXXXXX)
fi
cleanup() { rm -rf -- "$stage"; }
trap cleanup EXIT
tar -xzf "$repo/vendor/cribl-self-service-rhel8-0.1.0.tar.gz" -C "$stage"
bundle="$stage/cribl-self-service-rhel8-0.1.0"
(cd "$bundle" && sha256sum --check --quiet SHA256SUMS) || fail 'Application checksum verification failed'
app="$bundle/app"
[[ -f "$app/dist/index.html" && -f "$app/node_modules/nodemailer/package.json" && -f "$app/server.mjs" ]] || fail 'Incomplete application package'
for file in "$app"/*.mjs; do "$target/runtime/bin/node" --check "$file" >/dev/null; done
if [[ $mode == --check ]]; then echo 'Package, checksums, and installed runtime verified. No changes made.'; exit; fi
command -v systemctl >/dev/null || fail 'systemctl is required'
# Stage everything before interrupting the running application. Runtime is retained.
cp -a "$target/runtime" "$app/runtime"
chown -R root:root "$app"
chmod -R go-w "$app"
find "$app/dist" -type d -exec chmod 0755 {} +
find "$app/dist" -type f -exec chmod 0644 {} +
was_active=false
systemctl is-active --quiet "$service" && was_active=true
backup=$(mktemp -d /opt/cribl-self-service-backup.XXXXXX)
rmdir "$backup"
old_moved=false
rollback() {
  local result=$?
  trap - ERR
  if $old_moved; then
    systemctl stop "$service" || true
    if [[ -e $target ]]; then mv "$target" "$stage/failed-app"; fi
    mv "$backup" "$target"
    if command -v restorecon >/dev/null; then restorecon -R "$target" || true; fi
    echo 'Update failed; previous application restored. Review service logs.' >&2
  fi
  if $was_active; then systemctl start "$service" || true; fi
  exit "$result"
}
set -E
trap rollback ERR
# Wait for any active HEC setup to finish before running the updater.
# Configuration, credentials, and request journals are never replaced.
systemctl stop "$service"
mv "$target" "$backup"
old_moved=true
mv "$app" "$target"
if command -v restorecon >/dev/null; then restorecon -R "$target"; fi
if $was_active; then
  systemctl start "$service"
  sleep 2
  systemctl is-active --quiet "$service"
fi
trap - ERR
echo "Updated successfully. Previous application retained at: $backup"
if ! $was_active; then echo 'The service was stopped before this update and remains stopped.'; fi
echo 'Configuration, credentials, runtime, and request journals were preserved. Hard-refresh your browser.'
