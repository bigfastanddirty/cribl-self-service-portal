# Offline application and Node.js distribution

These archives are intentionally tracked in Git (not Git LFS) so a standard clone
or GitHub source ZIP includes the runtime and application without later downloads.

- `cribl-self-service-rhel8-0.1.0.tar.gz`: built portal, branding/error assets,
  backend modules, Nodemailer with its license, configuration examples, and installer.
- `node-v22.22.1-linux-x64.tar.gz`: official Node.js/npm distribution for x86_64.
- `node-v22.22.1-linux-arm64.tar.gz`: official Node.js/npm distribution for ARM64.
- `NODE-SHASUMS256.txt`: upstream checksum manifest from
  https://nodejs.org/dist/v22.22.1/SHASUMS256.txt . Downloaded runtime archives were
  checked against it before packaging. Each runtime includes Node and bundled
  third-party license notices. The npm/npx commands are included, but application
  installation does not invoke npm or contact the registry.
- `SHA256SUMS`: committed checksum manifest for all install archives.

The top-level `install.sh` selects the architecture and installs the runtime under
`/opt/cribl-self-service/runtime`. It does not replace `/usr/bin/node` or system npm.
Runtime version is pinned for reproducibility; updates require regenerating the
archives/checksums and testing. Do not assume a pinned runtime stays security-current.

Maintainers regenerate the application archive with
`deployment/rhel8/build-bundle.sh`, copy the result here, and regenerate SHA256SUMS.
Never package local configuration, passwords, ingestion tokens, journals, or samples.
The source tree and vendored application must be updated together for shipped changes.
