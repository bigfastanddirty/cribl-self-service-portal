#!/usr/bin/env bash
set -euo pipefail
mode=${1:---install}
case "$mode" in --install|--check) ;; *) echo 'Usage: sudo ./install.sh [--install|--check]' >&2; exit 2;; esac
bundle=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ -r /etc/os-release ]] || fail 'Cannot identify OS'
source /etc/os-release
[[ ${ID:-} == rhel && ${VERSION_ID:-} == 8.* ]] || fail 'This installer targets RHEL 8.10 with Node.js 22'
minor=${VERSION_ID#8.}; minor=${minor%%.*}
[[ $minor =~ ^[0-9]+$ && $minor -ge 10 ]] || fail 'Update to RHEL 8.10 first'
for cmd in node install cp sha256sum systemctl getent useradd chown; do command -v "$cmd" >/dev/null || fail "Missing command: $cmd"; done
node -e 'if(Number(process.versions.node.split(".")[0])!==22) process.exit(1)' || fail 'Install the nodejs:22 stream (see REQUIREMENTS.md)'
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
install -d -o root -g cribl-portal -m 0750 /etc/cribl-self-service
install -o root -g root -m 0600 "$bundle/config/portal.env" /etc/cribl-self-service/portal.env
install -o cribl-portal -g cribl-portal -m 0600 "$bundle/config/credentials.json.example" /etc/cribl-self-service/credentials.json
install -o root -g cribl-portal -m 0640 "$bundle/config/hec-targets.json.example" /etc/cribl-self-service/hec-targets.json
install -o root -g root -m 0600 "$bundle/config/smtp.json.example" /etc/cribl-self-service/smtp.json.example
install -d -o cribl-portal -g cribl-portal -m 0700 /var/lib/cribl-self-service /var/lib/cribl-self-service/hec-requests /var/lib/cribl-self-service/notifications
install -o root -g root -m 0644 "$bundle/cribl-self-service.service" /etc/systemd/system/cribl-self-service.service
if command -v restorecon >/dev/null; then restorecon -R /opt/cribl-self-service /etc/cribl-self-service /var/lib/cribl-self-service /etc/systemd/system/cribl-self-service.service; fi
systemctl daemon-reload
echo 'Installed. Service has NOT been started or enabled.'
echo 'Configure /etc/cribl-self-service/portal.env and credentials.json; see INSTALL.md.'
echo 'Then: sudo systemctl enable --now cribl-self-service'
