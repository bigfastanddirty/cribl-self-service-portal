# Customer-intent domain model for the preview-only MVP

Status: revised requirements and proposed internal design. The project owner has
authorized a first UI prototype only. No Cribl changes are authorized.

## Implemented UI iteration

The first prototype lives in `../portal/`. It uses TypeScript and Vite, configurable
public development fixture catalogs, three required answers, and a plain-language
selection summary. Its inclusive upload limit is 1,000,000 bytes. Files remain in
browser memory and are never transmitted to the server or
stored persistently. Empty samples are rejected. These are prototype choices;
broader analysis and configuration derivation remain
unresolved. Earlier design-only restrictions below apply to those deferred
capabilities, not to the explicitly authorized UI iteration.

## Direction and evidence

This document follows `../AGENTS.md` and `cribl-development-target.md`. It replaces
the earlier Route/Pipeline construction workflow. Customers describe a logging
requirement; Routes, Pipelines, filters, internal IDs, and API objects are eventual
outputs of derivation, not customer input concepts.

The local assessment found Stream 4.20.1 installed in standalone mode and used
4.20.0 API schema evidence. Live authenticated reads and runtime compatibility
were not verified. A local standalone installation does not establish the actual
approved Worker Groups for customers.

The initial form has only three known questions. Do not retain the earlier Route
name, match-option, destination, Pipeline-building, or Beginning/End controls as
initial requirements. Additional customer questions need explicit definition.

## Known customer form requirements

| Customer question | Control | Known requirement |
| --- | --- | --- |
| Where does your data reside? | Dropdown | Approved Cribl Worker Groups, presented with descriptive labels. IDs remain internal. |
| Upload a sample of your logs | File upload | Maximum 1 MB; used for analysis/preview. Permanent storage is not assumed. |
| What methods are available to collect your logs? | Dropdown | Approved collection methods. Final production choices are undefined and must be configurable. |

The overall UI uses a small number of dropdowns, radio buttons, uploads, and text
fields. No additional radio buttons or text fields are mandated by the currently
known form. Do not add them to expose the generator's capabilities.

Requiredness is not yet specified. Proposed policy is to request all three before
analysis, subject to owner confirmation. If a partial draft is allowed, missing
answers must be represented explicitly. They must not become guessed defaults.

## Controlled catalogs

Use versioned project-owned data with stable catalog keys, customer labels,
optional descriptions, approval status, and provenance. Customers select keys
through labels; they do not enter Cribl IDs or arbitrary collection types.
Catalogs are configuration data, not executable customer code.

### Approved Worker Groups

Each entry contains a catalog key, customer label, approved target binding
(including the Cribl group ID where applicable), and provenance. Bindings are
internal. Do not assume a `default` Worker Group or expose the local standalone
instance as a Worker Group without an explicitly approved binding.

A future metadata reader may inform the catalog, but discovering a group does
not automatically approve it for customer use. The first draft can use labeled,
owner-approved fixtures; it requires no live integration.

### Approved collection methods

Each entry contains a stable key, label, description, approval status, and an
optional reference to a separately reviewed derivation capability. The actual
catalog entries are unresolved. Do not enumerate invented production choices or
infer them from installed Source/Collector types.

If group/method compatibility restrictions are later approved, express them as
catalog data and filter available choices accordingly. Until defined, record
compatibility as unknown rather than assuming every method works everywhere.
A method can be an approved input choice while its configuration mapping is
still missing; that request remains incomplete for configuration generation.

Empty catalogs show plain-language unavailable-choice feedback. Preserve draft
answers where possible, but block use of unapproved, missing, or withdrawn entries.
Development example entries must be labeled as examples, not live production
availability. No fixtures are created by this documentation task.

## Sample upload and lifecycle

Known requirement: one sample upload control, maximum size 1 MB, for analysis and
preview. Use an ephemeral sample reference rather than a persistent file location
in the customer-intent model.

Proposed handling, to confirm before implementation:

- Interpret 1 MB as 1,000,000 bytes, inclusive, unless the owner chooses 1 MiB
  (1,048,576 bytes). The exact convention remains unresolved; UI and server must
  use the same approved limit. No implementation may silently choose a larger cap.
- Enforce actual uploaded byte count server-side while receiving data, including
  clients bypassing the form. Reject over-limit samples before analysis; do not
  silently truncate them. Multipart transport overhead is not sample content.
- Permit one active sample per request; replacement invalidates earlier analysis
  and derived previews. Single-file policy and empty-file rejection are proposals
  pending confirmation, not additional known customer requirements.
- Define supported formats and encodings before implementation. Filename and MIME
  claims alone are not proof of format. Archive support, decompression, binary
  formats, parser behavior, and unsupported-format messages are unresolved.
- Prefer bounded temporary handling; no database, permanent sample repository,
  or durable draft store is required. If temporary disk storage is needed, keep
  it outside Cribl, use server-generated names, and define expiration and cleanup
  on replacement, cancellation, expiry, errors, and abandoned requests.
- Never treat the supplied filename as a path or execute file contents. Bound
  analysis time, memory, and parser work independently of file size.
- Do not log raw sample content or include it automatically in configuration
  output. Samples may contain sensitive customer data. External analysis services
  and full-sample display are not assumed requirements.

Temporary lifetime, cleanup mechanism, session ownership, and whether sample
metadata may persist are unresolved. An expired sample requires re-upload for
further sample-dependent analysis; no silent permanent retention is permitted.

## Intent model and internal boundaries

The following is design notation, not implementation code:

```text
LoggingRequestDraft
  modelVersion
  draftKey
  revision
  workerGroupSelection?: WorkerGroupCatalogKey
  collectionMethodSelection?: CollectionMethodCatalogKey
  sampleRef?: EphemeralSampleKey
  catalogRevision

SampleDescriptor (separate from customer intent)
  sampleKey, ownerDraftKey, sampleRevision
  byteSize, displayFilename
  availability: available | expired | rejected
  expiresAt? (per approved lifecycle policy)

AnalysisResult
  draftRevision, sampleRevision, analyzerVersion
  findings: typed observations with evidence and limitations
  status: notRun | complete | unsupported | failed

DerivationResult
  draftRevision, catalogRevision, policyRevision, derivationVersion
  status: incomplete | invalid | previewAvailable
  missingRequirements, validationFindings, assumptions
  resourcePlan? (only when sufficiently resolved)

ResourcePlan (internal, not a form model)
  approved target binding
  proposed resources and their typed settings
  resource references and stable identities
  placement intent? and approved processing policy
```

Keep request selections, sample bytes, analysis findings, internal plans, and
Cribl serialization separate. The form accepts catalog keys and the uploaded
sample—not resource arrays, expression source, or arbitrary configuration maps.
Missing selections are distinct from unsupported or expired inputs.

Generated identities are internal, stable within a proposal, and not reservations
in Cribl. Their exact naming rules remain to be verified. An internal plan may
ultimately include Routes, Pipelines, or collection resources, but this document
does not define unverified collection settings or require every request to
produce every resource type.

Use small typed capability definitions for validation, derivation, plain-language
summary rendering, and generation. Adding future capability variants should not
require rewriting the customer-intent model or exposing technical controls.
Installed schemas must not automatically expand the supported catalog.

## Derivation and completeness

Proposed flow:

Customer answers and sample → input validation → bounded sample analysis →
approved derivation rules → internal resource plan → configuration preview.

The three known questions do not determine a destination, all collection-specific
settings, a routing filter, or processing requirements. Sample findings alone
are not authorization to invent these settings. Sample analysis scope and the
mapping from collection methods to configuration have not yet been defined.

Separate these outcomes:

- **Invalid input:** unapproved/missing catalog reference, exceeded upload limit,
  unsupported input, or an invalid combination under approved rules.
- **Incomplete derivation:** input is acceptable, but a mapping or required
  logging requirement is missing. Show the request summary and what remains to
  be determined; do not invent deployable-looking configuration.
- **Preview available:** approved rules and sufficient resolved facts permit
  generation of proposed configuration. Show limitations and provenance. This
  does not mean Cribl runtime validation occurred.

Do not add guessed follow-up fields to solve incompleteness. Record the questions
for owner review first. Any proposed follow-up form must remain simple and speak
in terms of the logging requirement.

Preview edits, sample replacement, catalog changes, and policy changes invalidate
prior dependent results. For a fixed resolved request, findings, and versioned
rules, generation must be deterministic. Analysis reproducibility and uncertainty
must be specified separately; never present inferred observations as customer
answers without an approved confirmation approach.

## Internal Cribl capabilities retained from earlier design

These are generator constraints, not initial customer form requirements:

- Initial processing capability types remain **Set Literal Field** and
  **Remove Fields**. They may be used only when approved derivation rules establish
  the need and parameters. No Pipeline action builder belongs in the initial form.
- Set Literal Field requires a simple top-level field name and a string literal.
  Remove Fields requires a nonempty list of explicit simple top-level names.
  The earlier small policy proposal was a 256-character literal limit, 1–10
  removal names, and no more than 10 ordered actions; confirm these limits before
  implementation rather than confusing them with Cribl platform limits.
- Both capabilities map internally to `eval`: literal addition uses
  `conf.add` entries with `name` and serialized expression-literal `value`;
  removal uses `conf.remove`. Function `filter: "true"` and `disabled: false`
  were the proposed fixed settings. No arbitrary Eval, regex, Rename, Drop,
  nested paths, wildcards, or function-specific expressions are enabled.
- Proposed field policy is `[A-Za-z][A-Za-z0-9_]{0,63}`, excluding reserved names
  `constructor`, `prototype`, and `__proto__`. Generated literals must be safely
  serialized, not interpolated as executable source. Exact-version behavior
  remains subject to the assessment's verification limits.
- Route filters must come from reviewed typed derivation rules, not customer
  expressions. The earlier bounded string-equality/AND compiler is a candidate
  only; no actual filter can be inferred from the three answers until its mapping
  and event-field semantics are established.
- Keep Pipeline `id/conf` wrappers, Route entries, routing tables, and API response
  envelopes distinct. Preserve function and Route order. An individual Route
  does not carry an insertion-position API field.
- If placement is needed, retain Beginning/End as the initial internal vocabulary.
  The owner must approve its derivation/default policy; there is no placement
  question in the known form. Stop After Match is approved policy, not a customer
  switch; the earlier recommendation to stop is still unapproved.
- A Worker Group selection is not itself a complete routing or API context.
  Target topology and group binding must be resolved before generation. Do not
  invent `/m/<group>` bindings for the standalone development instance.

No additional capability becomes customer-visible without explicit inclusion in
an approved self-service catalog and a defined customer-intent question. None of
these retained proposals authorize resource creation or mutation.

## Validation and preview

Validate catalog selections against the pinned approved revision. Reject unknown
keys, wrong types, and raw configuration fields. Apply only defined compatibility
rules, check sample limits/availability, and produce findings tied to the customer
question. An analysis failure must not be disguised as a configuration success.

The primary preview shows:

1. “Proposal only — nothing has been created or changed.”
2. The selected data location/Worker Group label and collection-method label.
3. Sample receipt, size, analysis status, and approved findings/limitations.
   Uploading a sample must not imply it has been analyzed or stored permanently.
4. A plain-language proposed collection/processing outcome when one can be derived.
5. Missing logging requirements or unavailable mappings, with actionable messages.
6. “Availability and behavior in Cribl have not been verified,” where applicable.

Do not require customers to inspect Routes, Pipelines, IDs, schemas, JSON, or API
concepts. An optional collapsed Advanced Details section can show generated
Cribl configuration when available, its target version, and technical provenance.
When derivation is incomplete, show that status instead of fabricated resource
JSON. Raw JSON/YAML editing and submission controls remain unavailable.

This is analysis/configuration preview, not a promise of live event simulation.
No sample replay into Cribl, remote collection, service creation, configuration
mutation, commit, deployment, or deletion is part of this MVP.

## Decisions still required

- Approved Worker Group entries and their target bindings/topology.
- The actual collection-method catalog and compatibility restrictions.
- Input requiredness, precise 1 MB byte convention, sample formats, bounded
  analysis approach, lifecycle, cleanup, and handling of sensitive data.
- Whether further customer intent is needed, and its exact simple questions,
  before destination, collection settings, matching, and processing can be derived.
- Approved derivation mappings, resource identity rules, placement, and Stop After
  Match policy. No mapping is authorized merely because Cribl supports it.
- Exact 4.20.1 behavior and schemas, including fields, literal handling, omitted
  settings, and effective resource inventory noted in the local assessment.
- Authentication, deployment, draft retention, technology stack, and the scope
  of optional advanced details.

Resolve these before implementing dependent behavior. The earlier assumption
that customers directly create one Route and optionally a Pipeline is superseded
by this intent-first workflow. Further implementation beyond the authorized UI iteration requires owner direction.

## Current UI iteration: ordered questions and fixture preview

The customer answers Worker Group first, collection method second, and selects
the log sample last. All future input questions must precede upload. Samples
remain browser-only, ephemeral, and bounded at 1,000,000 bytes.

The latest owner direction removes live Cribl API calls. Worker Groups and
collection methods both use clearly labeled, configurable development fixtures.
The portal does not read authentication material or connect to Cribl. Preview
shows a plain-language selection summary without generating configuration.
Empty or malformed catalogs block preview with actionable feedback. Catalog
labels do not assert that example groups exist or methods are approved for
production. Live lookup and configuration derivation remain deferred.

## Authorized sample detection and fixed collection choices

Step 2 is now hardcoded to HEC, API, Other. Internal keys are `hec`, `api`,
and `other`. Ignore collection-method values from external catalog data. The
choice does not imply endpoint settings, transport compatibility, or a Cribl
configuration mapping. Worker Groups continue to use labeled development fixtures.

Sample detection is authorized only as a bounded local format assessment after
size validation (maximum 1,000,000 bytes). Decode UTF-8 in browser memory; recognize
JSON objects/arrays or line-delimited JSON objects/arrays, common syslog header
patterns, or Other. All non-empty records must match the chosen format; otherwise
report Other. A syslog header match is not proof of full RFC compliance. Invalid
UTF-8 reports Other with an explicit unreadable-text limitation. Filename and MIME
type are not classification evidence. No derived Cribl configuration is implied.

The finding contract is `{type: JSON | Syslog | Other, explanation: string}`.
Keep findings separate from customer selections and raw sample contents. Show
the finding beneath the selected file and in the summary with best-effort wording.
Do not execute sample data, expose its text in the DOM, persist it, log it, or
transmit it. Removal/reset/replacement clears findings; a generation counter
prevents stale asynchronous file reads from restoring removed results. File-read
failures require reselection and do not permit preview of an unanalyzed sample.

Sources for the supported header heuristics: RFC 3164 and RFC 5424 at
https://www.rfc-editor.org/rfc/rfc3164 and https://www.rfc-editor.org/rfc/rfc5424 .
The current detector is deliberately narrower than a complete syslog parser.

## Expected daily volume and customer log-type correction

The authorized form now has four input steps: Worker Group, collection method,
expected daily volume, and finally sample upload. Daily volume is a required
`{value: decimal input string, unit: GB | TB}` field pair. Validate both inputs
against the inclusive minimum of 1 GB/day using decimal conversion (1 TB = 1,000
GB), including 0.001 TB/day. Reject missing/non-finite values, unsupported units,
and values below the minimum. Summary preserves the selected unit. No upper
capacity limit or automatic sizing recommendation is inferred.

After sample detection, expose one optional dropdown for correction: use detected
type (default), JSON, Syslog, Other. Store the override separately from the
`LogFinding`. Effective preview type is the override when present, otherwise the
automatic finding. The preview states when the customer selected the type and
retains the originally detected type as context. This does not change the
analysis result or validate protocol compliance. Sample replacement/removal/reset
clears the override, and changes to volume or override invalidate the preview.

No Cribl calls, configuration generation, persistent storage, or transmission of
sample contents is added by this iteration.

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

## Requester email and summary delivery (2026-10-05)

The first required question is Your email address. Retain one trimmed email with a
maximum of 254 characters, reject whitespace/control characters and multiple-address
input, and validate both in the browser and notification endpoint. The active form
has four visible questions: email, location, method, and daily volume. The sample
step remains deferred and last. Email is customer intent, not a Cribl parameter.

After successful submission, notify the requester with zcars@allstate.com
in CC. HEC summaries wait for completed setup and token acceptance; other methods
report the validated request only. The plain-text summary includes email, descriptive
location, method, entered daily volume/unit, setup outcome, and request reference.
Credentials and samples are excluded. Notify through a server-controlled internal
SMTP transport; customers cannot choose recipients, sender, subject, message content,
or SMTP settings. Report email failure separately from HEC completion.

A separate notification UUID is retained for identical browser submissions. Durable
owner-only delivery records contain a request digest and delivery status, avoiding
retention of raw sample or email body. Reusing a UUID with different input is rejected.
Sent records are not resent; unknown or partial SMTP acceptance requires administrator
review. Multi-process coordination, record retention, production authorization, and
relay configuration remain deployment decisions. Refresh/reset loses browser IDs.

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

## BarometerIT (2026-10-19)

Customer intent now includes required barometerId, presented as BarometerIT after
email and before data location. It is trimmed text of 1–128 characters, excluding
ASCII control characters. No approved business-specific format, ownership lookup,
or existence check is currently defined. This validates presence and safe bounded
text only; it does not certify that an ID exists in Barometer. Include it in the
plain-language summary and summary email, and in notification identity. It is not
translated into Cribl routing configuration, token descriptions, or source metadata.

## Configured-source choices (2026-10-19)

Keep the existing collection-method question wording. Its values now identify
configured Source instances in the selected Worker Group, fetched from Cribl,
including disabled instances. Internal key is the Source identifier; customers see
a friendly source label and disabled marker. Multiple instances stay separate.
The catalog does not represent unconfigured Source types or Collector jobs.

The portal emits only key, label, disabled, and provisioning policy (HEC or summary).
It does not return raw Source configuration. Groups remain filtered by the approved
exclusions. Reference validation is scoped to the selected group; changes clear the
previous choice, and stale asynchronous responses cannot restore old choices.
An unavailable or empty catalog supplies no fabricated choices.

Disabled instances can be selected for a summary. Selection does not enable a Source.
Existing HEC provisioning applies only to the exact enabled Source in the private
mapping. Other Source choices do not create or deploy configuration. Notifications
resolve the current Source label from Cribl server-side rather than trusting browser
text. Existing input validation, BarometerIT, upload deferral, and secret handling
remain in force.
