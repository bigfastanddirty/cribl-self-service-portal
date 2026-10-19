#!/usr/bin/env bash
set -euo pipefail
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
version=0.1.0
name=cribl-self-service-rhel8-$version
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
(cd "$repo/portal" && npm run build)
mkdir -p "$stage/$name/app/node_modules" "$repo/outputs"
cp -a "$repo/deployment/rhel8/install.sh" "$repo/deployment/rhel8/cribl-self-service.service" "$repo/deployment/rhel8/config" "$repo/deployment/rhel8/INSTALL.md" "$repo/deployment/rhel8/REQUIREMENTS.md" "$stage/$name/"
cp -a "$repo/portal/dist" "$stage/$name/app/"
# Public images may originate as owner-only files. Installed static assets must
# be readable by the dedicated service user, without changing their contents.
find "$stage/$name/app/dist" -type d -exec chmod 0755 {} +
find "$stage/$name/app/dist" -type f -exec chmod 0644 {} +
for file in server.mjs diagnostics.mjs json-setup-service.mjs json-clone.mjs source-types.mjs cribl-client.mjs hec-service.mjs notification-service.mjs mail-transport.mjs; do cp "$repo/portal/$file" "$stage/$name/app/"; done
# The only runtime dependency is architecture-independent JavaScript. Never copy
# the whole development node_modules tree or any private VM configuration.
node --input-type=module - "$repo/portal" "$stage/$name/app" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const [source,destination]=process.argv.slice(2);
const manifest=JSON.parse(fs.readFileSync(path.join(source,'package.json')));
if(JSON.stringify(Object.keys(manifest.dependencies||{}))!==JSON.stringify(['nodemailer']))throw new Error('Runtime dependency list changed; review packaging');
const modulePath=path.join(source,'node_modules/nodemailer');
const dependency=JSON.parse(fs.readFileSync(path.join(modulePath,'package.json')));
if(Object.keys(dependency.dependencies||{}).length)throw new Error('New transitive dependencies require packaging review');
fs.cpSync(modulePath,path.join(destination,'node_modules/nodemailer'),{recursive:true});
fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify({name:manifest.name,version:manifest.version,private:true,type:'module',dependencies:{nodemailer:dependency.version}},null,2)+'\n');
JS
(cd "$stage/$name" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
tar -czf "$repo/outputs/$name.tar.gz" --owner=0 --group=0 -C "$stage" "$name"
(cd "$repo/outputs" && sha256sum "$name.tar.gz" > "$name.tar.gz.sha256")
cp "$repo/deployment/rhel8/REQUIREMENTS.md" "$repo/outputs/RHEL8-REQUIREMENTS.md"
cp "$repo/deployment/rhel8/INSTALL.md" "$repo/outputs/RHEL8-INSTALL.md"
echo "Bundle written: $repo/outputs/$name.tar.gz"
