# Cribl customer-experience prototype

TypeScript + Vite, native accessible HTML controls, Vitest and Playwright.
Cribl integration provides Worker Group lookup and explicitly requested HEC token provisioning. There is no configuration generator, upload endpoint, external analysis,
or persistent sample store. File selections remain only in browser memory.

## Run

From `portal/`:

- `npx npm@11 ci` installs locked dependencies (npm 11 avoids a peer-dependency
  resolution issue observed with the VM's bundled npm 9).
- `npm run dev` starts development on all interfaces, normally port 5173.
- `npm test` runs validation tests.
- `npm run test:server` checks HTTP error responses against the built server.
- `npm run test:e2e` runs Chromium workflow tests (`npx playwright install chromium` first).
- `npm run build` typechecks and builds static output.
- `npm start` serves the build read-only on all interfaces at port 4173.

This LAN development prototype has no login; it is not a production deployment.
The server accepts GET/HEAD plus a bounded same-origin JSON POST to /api/hec. It has no endpoints to receive samples.
The 1 MB policy is inclusive 1,000,000 bytes. All four request answers are required to
review the prototype; empty samples are rejected. Sample contents are read only in browser memory for bounded log-type detection.

## Catalog configuration

The server provides `/catalog.json` from `GET /api/v1/products/stream/groups`.
Only group identifiers and descriptive names are returned. Empty catalogs block
preview; lookup failures show the existing error illustration and retry control.
There is no fixture fallback. Test fixtures are stored under `tests/fixtures/`.
Collection methods remain hardcoded to HEC, API, Other.

Set `CRIBL_URL` and `CRIBL_CREDENTIALS_FILE` on the server. The latter points to a
private JSON file with `username` and `password`, readable only by its owner
(mode 600). Never put credentials in the application or public files. Tokens are
cached in server memory, refreshed near expiry, and renewed once following a 401.
Concurrent requests share a login; failed logins have a 30-second backoff. Each
catalog request reads current groups. Requests have a 10-second timeout.
The server has no general-purpose API proxy. Only the explicit HEC credential action can update its mapped source and commit/deploy its input file.
An optional `CRIBL_TOKEN_FILE` seeds an existing token until a 401; automatic
renewal still requires the credential file. Fresh tokens are never sent to browsers.
Run the built server on 4173 alongside Vite when using `npm run dev`; Vite proxies
`/catalog.json` and `/api/hec` to that server.

New questions belong in the intent model and form; keep validation, catalogs,
and rendering separate. Do not add configuration generation without defining
its approved requirements first.

## Current LAN service

The read-only build is running as the user systemd unit
`cribl-self-service-portal.service` on port 4173. Check it with
`systemctl --user status cribl-self-service-portal`. It is a transient development
service, not configured to start at boot. Rebuild after catalog/source edits.

HTTP failures display the supplied error image. Failed catalog loads support a
retry; server error pages retain their HTTP status and link back to the portal.
Ordinary field validation continues to show actionable messages.

### Preview-only workflow

Form order: Worker Group → collection method → expected daily volume → sample.
Reviewing the request remains read-only. Step 2 has a separate explicit HEC credential
action; API/Other have no provisioning action. Samples remain in the browser.

### Branding assets

The complete supplied ZC branding pack is stored in `public/branding/`, preserving
its originals, transparent/black variants, sizes, and manifests (118 image assets).
The header uses the transparent header mark with higher-resolution alternatives;
all page footers use the transparent wide signature at a restrained display size.
Browser favicons and Apple touch icons use their dedicated small/square assets.
Banner, avatar, black-background, and original variants remain available for future
appropriate uses; they are not loaded unnecessarily by the current workflow.
The supplied Pepe error illustration remains unchanged on error pages and catalog
failure screens. No external asset folder is required when serving the application.

### Browser-only sample detection

After size validation (up to 1,000,000 bytes), the browser reads the sample as
UTF-8. JSON objects/arrays and line-delimited JSON objects/arrays are JSON; common
traditional or modern syslog header shapes are Syslog; mixed, unrecognized, or
non-UTF-8 data is Other with an explanation. Detection uses content rather than
the filename or MIME type. Findings are estimates, not full protocol validation.
Only type/explanation are retained alongside the selected File reference; decoded
text is not persisted, displayed, logged, or sent anywhere. Replacement/removal/
reset invalidates the preview and discards stale asynchronous read results.

Syslog header references: https://www.rfc-editor.org/rfc/rfc3164 and
https://www.rfc-editor.org/rfc/rfc5424 . The detector supports common patterns,
not the complete RFC grammars or arbitrary vendor extensions.

### Daily volume and log-type override

Enter a daily-volume number and choose GB or TB. Minimum 1 GB/day is inclusive;
1 TB = 1,000 GB, so 0.001 TB/day is also valid. Unsupported units, missing/
non-finite values, and smaller volumes are rejected before preview.

The optional log-type override appears after analysis: use detected type, JSON,
Syslog, Other. Preview distinguishes the customer choice from automatic detection.
Replacing/removing the sample or clearing the request resets the override;
changing either volume field or the override invalidates the previous preview.

## XML log-type detection

XML is now a supported detected type and manual override. Within the existing
1,000,000-byte browser-only UTF-8 sample limit, detect one well-formed XML document
using the browser XML parser, including declarations, namespaces, and CDATA.
Malformed XML and multiple unwrapped document roots remain Other. Documents
containing DOCTYPE or ENTITY declarations remain Other with an explicit limitation;
do not resolve external resources or expand declared entities. No schema validation
or configuration inference is performed. Parsed nodes stay in a detached document
and are never inserted into the page. Only type and explanation are retained.
Cribl integration, sample transmission, and permanent storage remain disabled.

## Sample drag-and-drop

The final sample step supports dropping one file onto the upload area as well as
the accessible native file picker. Both paths share size validation, browser-only
analysis, detection/override state, and preview invalidation. Reject multiple-file
or non-file drops with clear feedback; do not silently select the first file.
Oversized/invalid drops clear the previous sample, consistent with invalid picker
selections. The drop zone highlights during a file drag and clears after exit or
drop. Dropping a file elsewhere does not navigate the browser away from the form.
No server upload, sample persistence, or Cribl integration is added.

## HEC development provisioning

Set `HEC_TARGETS_FILE` to a private JSON mapping of group IDs to
`{ "source": "in_splunk_hec", "endpoint": "http://worker:8088/services/collector" }`.
Set `HEC_STATE_DIR` to an owner-only directory (700) outside the application; request
records are written with mode 600. These records contain ingestion tokens and
must not be copied into public assets or logs. The current mapping is Default at
http://192.168.145.130:8088/services/collector. Group names alone cannot establish
an ingestion endpoint; new locations require an explicit mapping.

Create HEC credentials adds a random token, selectively commits inputs.yml, deploys
the latest committed configuration, and waits for a healthy Worker at that revision
and an authenticated empty-body HEC check. Review preview and changing the dropdown
never create credentials. Close clears visible text; View reopens credentials held
in memory. Clear/reset/location/method changes release browser credentials without
revoking the existing token. Clipboard access may be unavailable on LAN HTTP; manual
text selection remains available.

Retries use the same request ID, preserving tokens across partial failures and
server restarts. The private journal is bounded to 1,000 records; retention and
revocation are administrator tasks for now. Changes are serialized in one server
process. Unrelated pending configuration blocks provisioning. Production user
authentication, TLS, token lifecycle, cross-process locking and concurrent external
administrator edits remain future scope. This remains a disposable LAN development
prototype. No arbitrary source/endpoint/payload can be chosen by the browser.

## Current three-question submission workflow

The owner has deferred sample upload (step 4), its validation requirement, and its
summary. All visible fields are marked Required: location, method, volume value,
and units. One Submit request action validates these fields; HEC submissions invoke
credential provisioning and then open the dialog, while API/Other show a summary.
No separate Create/View token button remains. Repeat/retry keeps the same credentials
or request ID. Hidden sample functionality and its previous browser workflow tests
are retained but deferred; current browser tests cover the active submission flow.
This section supersedes the earlier upload-required and separate-button descriptions.

### Local HEC listener reload workaround

This development Worker continued rejecting a newly deployed token while its API
showed that token enabled. A Worker restart made the same token work. The server
mapping can opt into `restartWorkerId` for that specific development node. After
five rejected checks at the deployed revision, provisioning requests one targeted
restart, records it privately, and waits for authenticated acceptance. Other nodes
are not restarted. Readiness has up to 120 checks; the UI shows a setup-in-progress
message. This workaround is specific to the observed local installation; its
internal Cribl cause and suitability for production remain unresolved.

## HEC first-token correction (2026-10-05)

An enabled mapped HEC source with an empty authTokens list can receive its first
token through the authorized additive provisioning flow. Require a valid token
list, preserve existing entries, and retain deployment and acceptance checks.
The active development mapping no longer enables automatic Worker restarts.
Unaccepted tokens remain pending; production Workers must not be restarted by
the portal.

## Slow HEC deployment completion (2026-10-05)

Deployed version alone does not establish token acceptance. Readiness exhaustion
returns HTTP 202 pending; the browser keeps progress visible and rechecks the same
request ID after five seconds, for up to ten minutes between readiness rounds.
Once accepted, credentials appear automatically. Exhausted waiting or actual
errors allow manual retry of the same request. No duplicate token or Worker restart
is required by this recovery. Keep the page open; refresh loses browser request state.

## Requester email and internal SMTP relay

The first field is a required requester email. Submission emails the validated
summary to the requester, with **zcars@allstate.com** in CC. HEC must complete
before notification; API and Other summarize only. Tokens and log samples are never
included. Email failure leaves HEC credentials available, and repeating the same
request reuses the token and notification ID.

Set `SMTP_CONFIG_FILE` to an owner-only JSON file outside the application and
`NOTIFICATION_STATE_DIR` to an owner-only state directory. Example settings (replace
with the approved internal relay and sender; this is not a configured live relay):

```json
{
  "host": "smtp.internal.example",
  "port": 587,
  "from": "cribl-portal@example.com",
  "secure": false,
  "requireTLS": true
}
```

`secure` means immediate TLS (normally port 465); otherwise use STARTTLS. TLS is
required by default. Set `requireTLS: false` only for an explicitly approved relay
without TLS. If authentication is required, add `username` and `password` in this
private file. Use permissions 600. Do not use the Cribl admin credentials for mail.
Restart the **portal** after configuring it; do not restart Cribl Workers.

`POST /api/summary` accepts only requestId, email, group, method, dailyVolume and
an optional hecRequestId. It enforces same-origin JSON, a 4096-byte body limit,
server catalog/volume/email validation, and completed HEC state for HEC requests.
No configurable customer recipients or attachments are accepted. Sent state avoids
normal duplicate submissions; partial or uncertain relay acceptance deliberately
blocks automatic resend and requires administrator review. A relay accepting both
recipients confirms SMTP handoff, not inbox delivery. There is no background mail
queue or multi-process coordination in this development prototype.

With no SMTP settings, the form reports that email delivery is unavailable and does
not claim the notification was sent. Worker Group lookup and HEC setup retain their
existing behavior. Keep this development portal on a trusted LAN; production user
authentication and notification abuse controls are not implemented.

## Early HEC credential display (2026-10-05)

The owner authorized displaying the ingestion token immediately after Cribl
confirms creation, before commit/deployment/readiness finishes. The first response
may be HTTP 202 with endpoint/token and pending status. Deployment continues in
the server process; subsequent checks reuse the request and token. The popup
explicitly says deployment is pending and not to send logs until ready. It updates
to ready only after deployed revision and token acceptance are verified. Closing
the popup clears visible secrets and does not cancel deployment; readiness does
not reopen a popup the customer already closed. Failures retain the token and
show deployment unconfirmed. Summary emails still require HEC completion; live
email setup remains paused. No Worker restarts are enabled.

## RHEL 8 distribution

Run `../deployment/rhel8/build-bundle.sh` from this project to generate the archive,
requirements list, installation guide, and checksums in `../outputs/`. The builder
uses an explicit allowlist; private VM settings and journals are excluded. The
installer targets RHEL 8.10 and Node.js 22, creates a dedicated systemd service,
and leaves it stopped until configured. No target npm/build step is needed.
See `../deployment/rhel8/REQUIREMENTS.md` and `INSTALL.md` for deployment limitations.
