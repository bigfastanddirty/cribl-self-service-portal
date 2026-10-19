# Cribl Self-Service Portal

Internal customer portal for logging requests, with a simple form for requester
email, data location, collection method, and expected daily volume. The sample
upload workflow is currently deferred. The UI uses a dark theme and plain-language
request summaries.

## Current capabilities

- Read available Stream Worker Groups through the server-side Cribl adapter.
- Collect HEC, API, or Other requests and validate required inputs.
- For explicitly mapped HEC targets, add an ingestion token, commit/deploy the
  scoped source change, display credentials immediately with pending status, and
  verify readiness. API and Other provide summaries only.
- Prepare summary notifications to the requester, CC zcars@allstate.com. Live email
  delivery remains paused until the internal relay is configured.
- Package a transfer bundle for RHEL 8.10 with Node.js 22 and systemd.

This remains a development prototype. Customer authentication, production HTTPS
origin handling, deployment coordination, and token lifecycle policy remain open.
See [project instructions](AGENTS.md) for scope and mutation boundaries.

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
