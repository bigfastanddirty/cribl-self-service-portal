# Cribl Stream Self-Service Portal

## Project charter

Build a web portal for internal customers to describe their logging requirements
through simple choices and a log sample. The portal validates customer intent,
supports analysis and preview, and eventually derives proposed Cribl configuration
from the answers. Customers do not directly construct Routes or Pipelines.

Success for the initial MVP is a clear, understandable preview of the customer's
request and any configuration that can be derived from approved rules, without
changing Cribl state. Missing requirements must be identified rather than guessed.
This charter supplies architectural guidance; implementation is limited to the
explicitly authorized iteration described below.

## Initial customer form

The requirements currently known are:

1. **Where does your data reside?** A dropdown of approved Cribl Worker Groups.
   Present descriptive labels; retain group identifiers internally.
2. **What methods are available to collect your logs?** A dropdown of approved
   collection methods. The production catalog is not yet defined. Treat it as
   versioned configurable data; do not invent final choices.
3. **Upload a sample of your logs.** A file upload control with a maximum size of
   1 MB. The sample is for analysis/preview; permanent storage is not assumed.

Use controlled catalogs for these choices. Do not infer approved Worker Groups
or collection methods from the presence of a local installation. Live catalog
lookup is not required. Empty catalogs must produce clear unavailable-choice
feedback rather than invented defaults.

Additional questions, requiredness rules, and collection-specific fields must be
explicitly defined before being added. The three known questions do not establish
all the information needed to derive valid Cribl configuration.

## MVP scope and release boundary

The initial MVP is preview-only:

- Collect logging intent through the known form controls.
- Validate selections, sample size, and any subsequently approved input fields.
- Analyze samples only using a separately defined, bounded analysis approach.
- Derive proposed Routes, Pipelines, filters, and other configuration only where
  approved mappings and sufficient input exist.
- Show a plain-language request summary, findings, missing information, and the
  proposed outcome. Optional technical details may show generated configuration.

The application must not create, modify, commit, deploy, or delete Cribl
configuration. Generation for review does not authorize applying proposals or
writing them into Cribl-managed directories. Do not provide active submission,
apply, commit, deployment, or deletion actions. Do not send samples into the live
Cribl instance or create collection resources for preview.

Future Cribl API submission requires separately agreed scope, authorization,
and explicit permission to mutate configuration. Production integration and
advanced processing are outside the initial scope.

## Customer UX philosophy

Simplicity is the primary requirement. Customers describe their logging needs
through a small number of dropdowns, radio buttons, uploads, and text fields.
They must not need to understand Routes, Pipelines, expressions, function schemas,
internal IDs, JSON, routing tables, or API concepts.

- Worker Group and collection-method selectors use approved, descriptive labels.
- Routes, Pipelines, filters, target IDs, and API representations are internal
  derivation details, not customer construction tasks.
- Do not add Route name, Pipeline selection, filter-builder, placement, or
  processing-action controls to the three known questions merely because earlier
  proposals included them. Beginning/End placement, if needed internally, is a
  policy decision; Stop After Match comes from approved policy, not a `final` UI.
- The only proposed initial processing capabilities remain Set Literal Field
  and Remove Fields. They are internal supported capabilities, not required
  form controls. Any future customer processing choices need explicit approval
  and inclusion in the self-service catalog.
- The primary preview explains the logging request and proposed outcome in plain
  language. Generated JSON may appear in a collapsed, optional advanced section.
- Use typed, versioned capability definitions internally so later approved
  capabilities can be added without exposing extensibility in the initial UI.

## Development environment and authorization

This disposable Ubuntu development VM has a local Cribl Stream installation at
`/opt/cribl`. It may eventually support development/testing and read-only metadata
lookup. Live integration is not required; use clearly labeled fixtures and local
validation. See `docs/cribl-development-target.md` for the observed standalone
installation and its verification limits. Its presence does not prove the approved
Worker Group catalog or a group-scoped deployment exists.

Codex has broad administrative access and may build, install dependencies,
configure development tooling, run tests, and manage the VM as necessary for
future authorized development. That access does not authorize Cribl configuration
changes. Keep portal tooling, samples, fixtures, and previews separate from
`/opt/cribl` and Cribl-managed configuration locations.

Current authorized scope is the first customer-experience UI prototype, per the
project owner's latest instruction. Implementation, dependencies, tests, and LAN
serving are authorized for this iteration. Use labeled development catalogs,
browser-only samples (maximum 1,000,000 bytes), and a plain-language selection
summary. Configuration derivation and live Cribl integration remain deferred.
Do not modify Cribl configuration or restart Cribl services.

## Proposed high-level architecture

Prefer a small web application with clear component boundaries. No stack is
selected yet.

1. **Customer form and catalogs:** render the three known questions using approved
   versioned data, descriptive labels, and actionable validation messages.
2. **Intent validation and sample handling:** validate catalog references and
   bounded uploads; associate an ephemeral sample with the request without
   assuming a permanent store. Enforce limits server-side as well as in the UI.
3. **Sample analysis:** a bounded, replaceable component that returns findings
   with limitations and provenance. Its implementation and output contract remain
   unresolved. Sample content is untrusted data, not code or configuration.
4. **Derivation planner and generator:** translate validated intent, approved
   policies, and supported findings into a typed internal plan. Report missing
   mappings or inputs. Generate Cribl-specific proposals only from sufficiently
   resolved plans; keep generation independent of network/filesystem mutation.
5. **Preview service:** render a plain-language summary and analysis limitations,
   with optional advanced configuration details. Invalidate previews after edits
   or sample replacement. Distinguish complete, incomplete, and invalid requests.
6. **Optional future read-only Cribl adapter:** obtain metadata only through
   explicitly allowed read endpoints. No live adapter is required in the MVP;
   any write integration belongs to a separately authorized release.

Flow: customer answers and sample → validation → bounded analysis → approved
intent-to-plan derivation → proposed configuration and plain-language preview.

No persistent database is assumed. Sample retention, analysis, and draft lifecycle
must be resolved before implementation. See `docs/mvp-domain-model.md` for the
revised domain proposal; it supersedes earlier resource-construction workflows.

## Development principles

- Preserve the preview-only boundary in all layers and tests.
- Keep customer intent separate from analysis findings, internal resource plans,
  and Cribl serialization. Never accept arbitrary JSON/YAML or expression source
  as customer configuration input.
- Reject unsupported catalog choices and parameters. Do not infer approval from
  installed Cribl functionality or silently fill missing collection requirements.
- Treat samples as potentially sensitive, untrusted data. Do not execute their
  contents, log raw samples, or send them to external services by default.
- Bound sample processing and define temporary cleanup. Permanent storage is not
  a requirement; an uploaded sample must not automatically become a saved dataset.
- Keep credentials out of the UI, previews, fixtures, logs, and source control.
- Preserve deterministic generation from the same resolved intent and versioned
  policies/catalogs. Keep uncertain analysis findings distinct from customer facts.
- Verify input validation, upload limits, incomplete-plan handling, reproducible
  generation, and the absence of Cribl mutation paths when implementation is
  separately authorized. Structural validity is not proof of runtime behavior.

## Decisions to resolve before implementation

- Approved Worker Groups, label/ID mappings, catalog ownership, and how their
  topology relates to the observed standalone development target.
- Approved collection-method catalog and any group/method compatibility rules.
- Whether each initial input is mandatory; sample formats, the exact byte meaning
  of 1 MB, temporary lifetime/cleanup, and analysis scope and resource bounds.
- Further logging requirements needed for derivation, such as destination,
  collection-specific settings, and matching/processing intent. These are open
  questions, not additional approved form controls.
- Approved intent-to-configuration mappings, target context, resource identity,
  placement, Stop After Match policy, and handling of incomplete requests.
- Technology stack, internal authentication/authorization, deployment exposure,
  draft lifecycle, and exact-version Cribl schema compatibility.
- Optional advanced preview content and any later export or read-only integration.

Resolve decisions before implementing dependent behavior. The current UI
prototype does not settle collection catalogs, analysis, or configuration mapping.
Further implementation beyond this UI iteration requires owner direction.

## Latest authorized catalog and workflow iteration

Sample upload must always be the final input step. The current form order is
Worker Group, collection method, then log sample. Worker Groups remain clearly
labeled development fixtures. Step 2 is hardcoded to HEC, API, and Other; external
catalog data must not add or replace those collection choices. These choices do
not authorize collection resources or establish configuration mappings.

The owner has authorized bounded browser-only log-type detection. After enforcing
the inclusive 1,000,000-byte limit, read the sample as UTF-8 and classify JSON
objects/arrays, line-delimited JSON objects/arrays, recognizable common syslog
headers, or Other. Show the type, explanation, and best-effort limitation in the
preview. Mixed/unrecognized data is Other; unreadable UTF-8 is Other with an
explicit limitation. Detection is not protocol validation or configuration
inference. Do not execute, transmit, persist, or log sample contents. Release
findings and sample references on removal/reset/replacement and ignore stale
asynchronous results. Future analysis beyond this scope requires owner direction.

The portal must not read token files or connect to Cribl. Configuration generation
and live integration remain deferred. Empty Worker Group catalogs show clear
unavailable-choice feedback. Do not modify Cribl configuration or restart services.

## Authorized daily-volume and log-type override iteration

Add expected daily volume before the final upload step. Use a required numerical
value and GB/TB dropdown. Decimal units apply: 1 TB = 1,000 GB; minimum 1 GB/day
is inclusive and also permits 0.001 TB/day. Reject unsupported units, missing,
non-finite, negative, and below-minimum values. Preserve the customer-entered unit
in the summary; this is an estimate, not a capacity commitment.

After detection, allow an optional log-type override: JSON, Syslog, Other, or use
the detected type (default). Retain the automatic finding separately from the
customer selection and identify overrides in the preview. Replacement/removal/
reset clears the override; changing it invalidates the preview. No additional
analysis, collection configuration, or Cribl integration is authorized.

Current input order: Worker Group, HEC/API/Other collection method, expected daily
volume, then sample upload (including its optional type correction).

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

## Authorized read-only Worker Group catalog (2026-10-05)

The owner authorized replacing fixture Worker Groups with available Stream Worker
Groups from the local Leader. The portal server reads only
`GET /api/v1/products/stream/groups`, returning identifiers internally and names
as dropdown labels. This supersedes earlier fixture-only/no-token/no-integration
requirements only for this metadata lookup. HEC/API/Other remain hardcoded, and
configuration generation and all Cribl configuration mutations remain deferred.

Server-only authentication uses `POST /api/v1/auth/login` with a private credential
file outside the project. Reuse the token in memory, refresh near its reported
expiry, share refresh across concurrent requests, and retry a read once after 401.
Failed logins back off for 30 seconds. Never return tokens, credentials, or full
upstream metadata to the browser. Empty catalogs block preview; failed reads show
retry feedback without invented choices. Sample contents remain browser-only.

## Authorized HEC provisioning and development Worker (2026-10-05)

The owner explicitly authorized a local Worker assigned to Default, enabling the
Splunk HEC source, and necessary commits/deployments. The portal now has a narrow
HEC credential provisioning action in step 2. This supersedes the preview-only
mutation prohibition only for this action and the development setup. HEC selection
alone and Review preview do not mutate Cribl. API and Other remain preview-only;
Route/Pipeline generation and all other mutations are deferred.

A server-controlled group/source/endpoint mapping selects the HEC target. Only
Default is currently mapped. The explicit Create HEC credentials button adds a
cryptographically random token using Cribl's additive HEC-token API, preserves
existing tokens/settings, selectively commits the group's inputs.yml, deploys,
and verifies both Worker version and token acceptance before showing the popup.
The popup displays only the HEC endpoint and newly created ingestion token, never
the administrative login token. It supports copying/manual selection and clears
visible secret text on close. Clearing the form or changing location/method removes
its browser-memory credentials; closing the popup does not revoke its token.

Provisioning requires a healthy mapped Worker and an enabled authenticated HEC
source. Missing mappings, disabled sources, and unrelated pending configuration
changes block mutation. Same-origin JSON POSTs have bounded input validation; there
is no arbitrary API proxy. Request IDs and private server-side state make retries
reuse the same token. A single server process serializes changes; multi-process
coordination and production user authentication/authorization remain unresolved.
Deployment failures may leave a pending token; retry the same request or request
administrator review. Do not automatically delete credentials on UI reset.

Uploaded sample contents remain browser-only. HEC readiness checks send an empty
body, not sample events. Server provisioning state and credentials stay outside
the application/public directories in owner-only files. Endpoint mapping, HTTPS,
customer access policy, token retention/revocation, and production deployment
coordination must be resolved before a production release.

## Authorized submit workflow and deferred sample step (2026-10-05)

All visible customer inputs are required and visibly marked: data location,
collection method, daily-volume value, and GB/TB units. The sample upload question
(step 4), its optional correction, and its summary fields are hidden until the
owner identifies a source requiring them. Hidden samples are not required for
validation or submission. Browser-only sample handling remains available internally
but its customer workflow is deferred.

There is one Submit request button. Remove the separate Create/View HEC credentials
button from step 2. Selecting HEC alone makes no mutations. A valid HEC form submission
invokes the already-authorized provisioning flow and shows the endpoint/token popup
after success. Repeated submissions reuse credentials/request IDs rather than
creating duplicate tokens. Invalid form inputs block provisioning. Pending HEC
submission disables visible controls and reset; failed submissions support retry
through the same Submit request action. API and Other submissions show only the
request summary. Closing the popup clears visible secret text, and reset or changes
to location/method discard browser credentials without revoking the Cribl token.

## Development HEC listener recovery (2026-10-05)

Observed: a new token was present and enabled in the deployed Worker configuration,
but HEC continued returning 403 until the development Worker restarted. A targeted
restart made the existing token work without creating another token. The mapped
Default development Worker may therefore be restarted once per request/revision
when five authenticated checks fail after the target revision is healthy. This
is an opt-in server mapping (restartWorkerId), not a general Worker restart action.
Only the specified Worker in the selected group at the deployed revision is eligible.
The portal waits up to 120 readiness checks and shows setup progress while pending.
The root cause inside Cribl is unresolved; do not generalize this workaround to
production or other Worker Groups. Tokens are reused through recovery and retry.

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

## Authorized requester email and summary notification (2026-10-05)

The owner requires a requester email as the first customer field, before location,
collection method, and daily volume. Sample upload remains hidden and, when enabled,
last. Validate a single bounded email address in the browser and server. Show it in
the request summary. Valid HEC submissions send their summary after provisioning
and token acceptance; API/Other send after validated submission, without Cribl writes.

Send plain-text summaries to the requester and CC zcars@allstate.com using
an owner-specified internal SMTP relay and approved sender address. The owner has
authorized these notifications. Include requester email, descriptive location,
method, daily volume, setup outcome, and request reference. Never email HEC tokens,
admin tokens, passwords, sample contents, or attachments. Transport credentials,
if needed, stay in an owner-only private configuration file outside the project.

Use a separate summary request ID and durable delivery state to suppress duplicate
emails on repeat submission. Email failure does not undo HEC setup or create another
token on retry. Uncertain or partially accepted deliveries require administrator
review instead of automatically resending. Relay acceptance is not proof of inbox
delivery. No mail delivery is active until relay hostname/port, sender, authentication,
and TLS settings are supplied. Existing Cribl permissions and restart restrictions
remain unchanged. Production portal access control and mail abuse controls remain
unresolved.

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

## Authorized RHEL 8 distribution packaging (2026-10-08)

Package the current portal for transfer to a RHEL 8.10 host with Node.js 22, with
an installer, dedicated systemd account/service, requirements list, configuration
examples, and checksums. Include only built UI/backend and pure JavaScript runtime
dependencies. Exclude private credentials, ingestion tokens, request journals,
VM-specific mappings, samples, and development dependencies. Preserve branding and
original error images. Do not alter Cribl configuration or restart its services.

Installation is fresh-only and deliberately leaves the service stopped/disabled
until the target administrator configures the Leader URL and credentials. HEC
mapping starts empty, mail stays paused, and no Worker restart mapping is included.
Documentation must distinguish packaging/smoke checks on Ubuntu from a native RHEL
installation, and retain the existing prototype's production integration limits.

## Offline Git installation with bundled runtimes (2026-10-19)

The owner authorized committing all application dependencies and Node.js/npm runtimes
into Git, with one top-level installer, because company packages provide only Node 10
and npm 6. Bundle official Node.js 22.22.1 distributions for x86_64 and ARM64 with their
licenses and verified upstream checksums, plus the built application and Nodemailer.
Do not use Git LFS pointers or require dependency downloads during installation.
The installer selects architecture, validates checksums, and uses a private runtime
without replacing system Node/npm. Base RHEL OS libraries and administrative tools
remain prerequisites. Preserve fresh-install-only, explicit configuration before
service start, no Worker restart mappings, and paused mail. Never include private
credentials or journals. Native RHEL installation is still unverified.

## Installer runtime-selection diagnostics (2026-10-19)

The source-tree deployment installer redirects to the offline root installer.
Root staging uses /opt rather than potentially noexec /tmp. If a bundled runtime
exists but cannot execute, fail with its path instead of falling back to system
Node 10. Preserve loader errors and report the selected Node version. Native RHEL
verification is still required; these diagnostics must not claim its root cause
has been established without target output.

## Static asset installation permissions (2026-10-19)

Public dist directories must be mode 755 and public asset files mode 644 in bundles
and installed copies. Preserve original image contents; normalize metadata only.
Earlier owner-only image permissions caused HTTP 500 under the dedicated service
account. Apply this policy only to static assets, never private configuration/state.

## Worker Group choice exclusions (2026-10-19)

Exclude Worker Groups whose identifier or descriptive name contains test, non-prod,
or npd, using case-insensitive substring matching. Filter server-side before returning
the catalog; do not modify groups in Cribl. Keep existing unavailable-choice feedback
if all groups are excluded. This is a choice-display rule, not a replacement for
production authorization controls.

## Required BarometerIT (2026-10-19)

Add a required BarometerIT text field immediately after requester email. Reject
blank/whitespace-only values, ASCII control characters, and values exceeding 128
characters; trim outer whitespace. No organization-specific ID pattern or external
Barometer lookup is defined. Include the ID in the request summary and summary
email, and incorporate it in notification deduplication. Reset clears it; edits
invalidate the preview. Hidden samples remain last/deferred. Both HEC submission
and notification endpoints require the ID before their respective side effects.
The ID is portal request information, not new Cribl configuration or HEC metadata.
Email delivery remains paused; no Cribl configuration changes are required.

## Dynamic configured-source choices (2026-10-19)

Replace the hardcoded HEC/API/Other choices with every configured Source instance
in the selected Worker Group, including disabled Sources. Preserve the existing
customer question label. Read only GET /api/v1/m/{group}/system/inputs with bounded
pagination; this is not the catalog of all potentially supported Source types.
Return only internal reference, friendly label, disabled state, and approved action.
Never expose raw Source configuration, credentials, tokens, schemas, or expressions.
Keep Worker Group exclusions and reject unlisted group references. Changing location
clears the selected source and ignores stale responses. Failures/empty results show
clear feedback without fixture fallback; disabled Sources remain selectable for a
summary and must not be enabled by selection or submission.

Only the enabled mapped Splunk HEC Source can use existing provisioning. HEC POSTs
must reference that exact mapped Source; all other Sources produce summaries only.
Summary notification validates current group/source references and derives labels
server-side. No Source creation, enabling, deletion, or additional Cribl mutation is
authorized. Live email delivery remains paused. Refresh or changing source/location
discards browser credentials but does not revoke ingestion tokens.
