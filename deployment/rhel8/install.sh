#!/usr/bin/env bash
set -euo pipefail
mode=${1:---install}
case "$mode" in --install|--check) ;; *) echo 'Usage: sudo ./install.sh [--install|--check]' >&2; exit 2;; esac
bundle=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Redirect the old source-tree entry point to the self-contained installer.
if [[ -f "$bundle/../../install.sh" && -f "$bundle/../../vendor/SHA256SUMS" ]]; then
  exec bash "$bundle/../../install.sh" "$mode"
fi
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ -r /etc/os-release ]] || fail 'Cannot identify OS'
source /etc/os-release
[[ ${ID:-} == rhel && ${VERSION_ID:-} == 8.* ]] || fail 'This installer targets RHEL 8.10 with Node.js 22'
minor=${VERSION_ID#8.}; minor=${minor%%.*}
[[ $minor =~ ^[0-9]+$ && $minor -ge 10 ]] || fail 'Update to RHEL 8.10 first'
for cmd in find install cp sha256sum systemctl getent useradd chown; do command -v "$cmd" >/dev/null || fail "Missing command: $cmd"; done
# BEGIN runtime validation
node_bin=/usr/bin/node
if [[ -f "$bundle/app/runtime/bin/node" ]]; then
  node_bin="$bundle/app/runtime/bin/node"
  [[ -x $node_bin ]] || fail "Bundled Node exists but cannot execute: $node_bin. Check execute permissions or a noexec mount. System Node will not be used."
fi
[[ -x $node_bin ]] || fail 'Node runtime missing. Run install.sh at the Git repository root, which includes vendor/.'
if ! node_version=$("$node_bin" --version 2>&1); then
  echo "$node_version" >&2
  fail "Unable to execute $node_bin. Check OS libraries, architecture, and mount permissions."
fi
[[ $node_version == v22.* ]] || fail "Selected $node_bin reports $node_version, but Node 22 is required. Use install.sh at the repository root (the directory containing vendor/)."
echo "Using Node $node_version from $node_bin"
# END runtime validation
(cd "$bundle" && sha256sum --check --quiet SHA256SUMS) || fail 'Bundle integrity check failed'
[[ -f "$bundle/app/dist/index.html" && -f "$bundle/app/node_modules/nodemailer/package.json" ]] || fail 'Incomplete runtime bundle'
if [[ $mode == --check ]]; then echo 'Prerequisites and bundle checks passed. No changes made.'; exit; fi
[[ $EUID -eq 0 ]] || fail 'Run the installer with sudo'
[[ ! -e /opt/cribl-self-service && ! -e /etc/cribl-self-service && ! -e /etc/systemd/system/cribl-self-service.service ]] || fail 'An installation already exists. Back up configuration/state and use a reviewed upgrade procedure; this installer does not overwrite it.'
getent passwd cribl-portal >/dev/null || useradd --system --user-group --home-dir /var/lib/cribl-self-service --shell /sbin/nologin cribl-portal
[[ $(id -u cribl-portal) -ne 0 ]] || fail 'Service account cannot be root'
install -d -m 0755 /opt/cribl-self-service
cp -a "$bundle/app/." /opt/cribl-self-service/
chown -R root:root /opt/cribl-self-service
chmod -R go-w /opt/cribl-self-service
find /opt/cribl-self-service/dist -type d -exec chmod 0755 {} +
find /opt/cribl-self-service/dist -type f -exec chmod 0644 {} +
install -d -o root -g cribl-portal -m 0750 /etc/cribl-self-service
install -o root -g root -m 0600 "$bundle/config/portal.env" /etc/cribl-self-service/portal.env
install -o cribl-portal -g cribl-portal -m 0600 "$bundle/config/credentials.json.example" /etc/cribl-self-service/credentials.json
install -o root -g cribl-portal -m 0640 "$bundle/config/hec-targets.json.example" /etc/cribl-self-service/hec-targets.json
install -o root -g root -m 0600 "$bundle/config/smtp.json.example" /etc/cribl-self-service/smtp.json.example
install -d -o cribl-portal -g cribl-portal -m 0700 /var/lib/cribl-self-service /var/lib/cribl-self-service/hec-requests /var/lib/cribl-self-service/notifications
install -o root -g root -m 0644 "$bundle/cribl-self-service.service" /etc/systemd/system/cribl-self-service.service
if [[ -x /opt/cribl-self-service/runtime/bin/node ]]; then
  sed -i 's|ExecStart=/usr/bin/node |ExecStart=/opt/cribl-self-service/runtime/bin/node |' /etc/systemd/system/cribl-self-service.service
  sed -i '/^ExecStart=/a Environment=PATH=/opt/cribl-self-service/runtime/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin' /etc/systemd/system/cribl-self-service.service
fi
if command -v restorecon >/dev/null; then restorecon -R /opt/cribl-self-service /etc/cribl-self-service /var/lib/cribl-self-service /etc/systemd/system/cribl-self-service.service; fi
systemctl daemon-reload
echo 'Installed. Service has NOT been started or enabled.'
echo 'Configure /etc/cribl-self-service/portal.env and credentials.json; see INSTALL.md.'
echo 'Then: sudo systemctl enable --now cribl-self-service'
