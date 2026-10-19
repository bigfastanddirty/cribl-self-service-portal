#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
# Exercise the production validation block independently of the host OS.
sed -n '/^# BEGIN runtime validation$/,/^# END runtime validation$/p' "$here/install.sh" > "$stage/validation.sh"
mkdir -p "$stage/app/runtime/bin"
cat > "$stage/app/runtime/bin/node" <<'NODE'
#!/bin/sh
echo v22.22.1
NODE
chmod +x "$stage/app/runtime/bin/node"
check() { bash -c 'bundle=$1; fail(){ echo "$*" >&2; exit 1; }; source "$2"' bash "$stage" "$stage/validation.sh"; }
check > "$stage/result"
grep -q 'Using Node v22.22.1' "$stage/result"
chmod -x "$stage/app/runtime/bin/node"
if check > "$stage/result" 2>&1; then echo 'FAIL: accepted non-executable runtime'; exit 1; fi
grep -q 'System Node will not be used' "$stage/result"
chmod +x "$stage/app/runtime/bin/node"
printf '#!/bin/sh\necho v10.24.1\n' > "$stage/app/runtime/bin/node"
if check > "$stage/result" 2>&1; then echo 'FAIL: accepted Node 10'; exit 1; fi
grep -q 'reports v10.24.1' "$stage/result"
printf '#!/bin/sh\necho "GLIBC_TEST not found" >&2\nexit 1\n' > "$stage/app/runtime/bin/node"
if check > "$stage/result" 2>&1; then echo 'FAIL: accepted failed runtime'; exit 1; fi
grep -q 'GLIBC_TEST not found' "$stage/result"
echo 'PASS: bundled Node selected; no silent fallback; wrong version and loader errors reported'
