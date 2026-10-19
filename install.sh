#!/usr/bin/env bash
# Offline installer: no dnf, npm install, curl, or system Node dependency.
set -euo pipefail
mode=${1:---install}
case "$mode" in --install|--check) ;; *) echo 'Usage: sudo ./install.sh [--install|--check]' >&2; exit 2;; esac
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
for cmd in tar gzip sha256sum uname mktemp; do command -v "$cmd" >/dev/null || { echo "Missing base OS tool: $cmd" >&2; exit 1; }; done
case $(uname -m) in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; *) echo 'Supported CPUs: x86_64 and aarch64' >&2; exit 1;; esac
(cd "$repo/vendor" && sha256sum --check --quiet SHA256SUMS)
# Enterprise /tmp is often mounted noexec. Root installation stages on the same
# filesystem as the installed runtime instead of silently using system Node.
if [[ $EUID -eq 0 ]]; then
  stage=$(mktemp -d /opt/.cribl-portal-stage.XXXXXX)
else
  [[ $mode == --check ]] || { echo 'Run this installer with sudo' >&2; exit 1; }
  stage=$(mktemp -d)
fi
trap 'rm -rf "$stage"' EXIT
tar -xzf "$repo/vendor/cribl-self-service-rhel8-0.1.0.tar.gz" -C "$stage"
bundle="$stage/cribl-self-service-rhel8-0.1.0"
# Verify the pristine application before adding the matching private runtime.
(cd "$bundle" && sha256sum --check --quiet SHA256SUMS)
mkdir -p "$bundle/app/runtime"
tar -xzf "$repo/vendor/node-v22.22.1-linux-$arch.tar.gz" --strip-components=1 -C "$bundle/app/runtime"
# The application checksum list describes the original application; runtime archive
# integrity was independently verified above against the committed vendor manifest.
bash "$bundle/install.sh" "$mode"
