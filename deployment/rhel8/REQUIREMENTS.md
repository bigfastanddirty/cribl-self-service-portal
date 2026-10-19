# RHEL 8 installation requirements

## Required on the target

- RHEL 8.10, maintained with current security updates; systemd and SELinux supported.
- Bundled Node.js **22.22.1** and matching npm are supplied in Git for x86_64 and
  ARM64. The top-level installer uses a private runtime; system Node/npm can remain
  unchanged. Base RHEL glibc and libraries must support the official Node 22 binary.
- Root/sudo for installation; a dedicated `cribl-portal` account runs the application.
- Bash, tar, gzip, coreutils (install/cp/chown/sha256sum), shadow-utils (useradd),
  and systemd. No npm, compiler, Python, browser, or Cribl installation is required
  on the portal host. The bundled runtime dependency is pure JavaScript.
- Recommended initial allocation: 1 CPU, 512 MB RAM, 1 GB free disk (including runtime and installer temporary extraction) plus retained
  provisioning state and OS logs. This is a starting estimate, not a load-tested sizing claim.
- A browser supporting native dialog, fetch, and Web Crypto.

Use `sudo bash ./install.sh` at the repository root for offline installation. This
path needs no company Node/npm package, npm registry access, compiler, or build tools.
Bash, GNU tar with gzip, coreutils, shadow-utils, systemd, and their normal RHEL system
libraries are OS prerequisites. Runtime archives include npm, but no npm dependency
installation runs during setup. Do not use system Node 10 to build/run this project.

The standalone application-only archive is also retained for administrators who
already have Node.js 22 at `/usr/bin/node`; use its internal install.sh only for that
path. It does not contain the separate runtime archives from the Git repository.

## Integration and network requirements

- Portal clients: inbound TCP 4173, default listen address 0.0.0.0. Restrict access
  to the trusted internal network. The installer does not change firewall rules.
- Portal to Leader: the configured HTTP(S) API port (commonly 9000), reachable URL,
  private login credentials, and permission to read Stream Worker Groups.
- HEC, only if explicitly enabled: approved group/source/endpoint mapping; enabled
  Splunk HEC source; healthy Worker; permissions for additive token creation and
  scoped commit/deploy, plus Worker monitoring; outbound access to the mapped HEC
  port (commonly 8088). Source creation and Worker installation are not performed.
- Mail: remains disabled. When resumed, supply the approved internal SMTP relay,
  sender, TLS/auth settings, and outbound connectivity. Never reuse Cribl credentials.
- DNS and trusted CA certificates for configured hostnames/HTTPS/SMTP TLS.
- Keep SELinux enforcing. Check audit logs if local policy blocks access; do not
  disable SELinux as an installation step.

## Current release limitations

This is the existing development prototype packaged for transfer, not a production
security release. It has no customer login/authorization, listens using HTTP, and
POST origin checks currently expect HTTP. Do not expose it publicly. An HTTPS reverse
proxy alone does not fix those origin checks; HTTPS origin handling and access control
need a separate implementation before production use.

One Node process serializes HEC operations. Do not run multiple replicas sharing its
state directory. There is no automatic state retention/revocation policy or background
job resume after service restart; retry the same browser request while its ID remains
available. Preserve state during upgrades, and avoid restarting the portal while a
provisioning operation is pending. Workers must not be restarted by the portal; no
restart mapping is included. Cribl version compatibility was observed against 4.20.1;
other versions need validation. Native installation on RHEL has not been performed
in this Ubuntu workspace.

## Runtime dependency

Nodemailer is bundled at the version recorded in `app/node_modules/nodemailer/package.json`.
Its license is included. Build/test tools are excluded from the installation bundle.

References:
- [Red Hat RHEL 8.10 Node.js 22 stream](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/8.10_release_notes/new-features)
- [Node.js platform compatibility](https://github.com/nodejs/node/blob/v22.x/BUILDING.md)
