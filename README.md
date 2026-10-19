# Cribl Self-Service Portal

Internal customer portal for logging requests, with a simple form for requester
email, data location, collection method, and expected daily volume. The sample
upload workflow is currently deferred. The UI uses a dark theme and plain-language
request summaries.

## Current capabilities

- Read available Stream Worker Groups through the server-side Cribl adapter.
- List all configured Sources for the selected Worker Group, including disabled
  Sources, and validate required inputs.
- For explicitly mapped HEC targets, add an ingestion token, commit/deploy the
  scoped source change, display credentials immediately with pending status, and
  verify readiness. All other Source selections provide summaries only.
- Prepare summary notifications to the requester, CC zcars@allstate.com. Live email
  delivery remains paused until the internal relay is configured.
- Package a transfer bundle for RHEL 8.10 with Node.js 22 and systemd.

This remains a development prototype. Customer authentication, production HTTPS
origin handling, deployment coordination, and token lifecycle policy remain open.
See [project instructions](AGENTS.md) for scope and mutation boundaries.

## Install on RHEL without installing Node/npm manually

The repository includes the built application, Nodemailer, and private Node.js 22
runtimes with matching npm for x86_64 and ARM64. Download the source ZIP or clone
this repository, then run:

```bash
cd cribl-self-service-portal
sudo bash ./install.sh
```

No npm install, npm ci, dnf operation, or Internet access is required during setup.
Your existing system Node 10/npm 6 are left unchanged. Base RHEL tools/libraries
are still required; see [requirements](deployment/rhel8/REQUIREMENTS.md).
Installation is fresh-only. It leaves the service stopped until you configure the
Leader URL and private credentials in `/etc/cribl-self-service`. Then start it:

```bash
sudo systemctl enable --now cribl-self-service
```

See the [installation guide](deployment/rhel8/INSTALL.md) and
[bundled runtime notes](vendor/README.md). Native RHEL installation remains unverified;
offline archive checks and the extracted runtime are tested on Ubuntu.

## Develop

```bash
cd portal
npm ci
npm run build
npm test
npm run test:server
```

See [portal setup](portal/README.md) for server configuration and browser tests.
Cribl credentials and provisioning state belong in private paths outside this
repository. Never commit credentials, ingestion tokens, raw customer samples, or
runtime journals. Example configuration files contain placeholders only.

## RHEL installation bundle

```bash
./deployment/rhel8/build-bundle.sh
```

Generated archives are written to the ignored `outputs/` directory. Read the
[requirements](deployment/rhel8/REQUIREMENTS.md) and
[installation guide](deployment/rhel8/INSTALL.md). Native RHEL installation remains
unverified; the extracted runtime and package have been smoke-tested on Ubuntu.

## Design documents

- [Development target assessment](docs/cribl-development-target.md)
- [MVP domain model](docs/mvp-domain-model.md)

## Updating an existing installation

From your Git clone, after any HEC setup has finished:

```bash
git pull --ff-only && sudo ./update.sh
```

The offline updater verifies the package, preserves configuration/credentials/state
and the installed runtime, and restarts only the portal if it was already running.
It retains the previous application and rolls back on replacement/start failure.
Use `sudo ./update.sh --check` for a verification-only run. See
[installation and update details](deployment/rhel8/INSTALL.md). Native RHEL testing
is still required.
