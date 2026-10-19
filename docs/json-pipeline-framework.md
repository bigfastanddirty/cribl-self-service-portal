# JSON pipeline proposal framework

First recipe: `json-with-barometer-v1`. This is proposal generation only; it does
not create, commit, deploy, or delete any Cribl resource and adds no API write path.
Existing HEC provisioning is unchanged. No new customer inputs are added yet.

`portal/src/configuration-preview.ts` separates an explicit JSON-processing intent
from a versioned internal plan, plain-language preview, unresolved Route plan, and
Cribl serialization. Its exported functions have no network/filesystem side effects.
The framework is available to wire into the customer experience after the workflow
for choosing JSON processing is agreed; it does not assume every source is JSON.

## Recipe

1. Parse JSON from `_raw` using Serde (`mode: extract`, `type: json`).
2. Set `BarometerIT` to the existing request field as a literal string.
3. Remove `_raw` using Eval, matching the supplied example.

The generator combines steps 2 and 3 in one Eval function. Both functions use the
fixed filter `true`. Customers cannot supply expressions, function schemas, or
arbitrary configuration. BarometerIT retains current validation: trim outer spaces,
reject blank/control characters, maximum 128 characters. JavaScript string-literal
encoding uses JSON quoting, with Unicode line separators escaped; quotes and
backslashes cannot turn customer input into executable expression source.

The proposed pipeline uses the owner-approved fixed name `pl_json`. The internal
caller must supply this approved name; other names are rejected. Collision
handling for an existing `pl_json` remains unresolved; generation does not authorize
overwriting it.
The generated envelope reproduces the user's example: output `default`, empty
streamtags/groups, 1,000 ms async timeout, and empty description. Single vs double
quotes around the literal value differ syntactically but represent the same string.

The local installed Serde and Eval schemas confirm the referenced configuration
fields. No live pipeline was executed or changed. Malformed JSON handling, arrays,
field collisions (especially an incoming BarometerIT), and `_raw` removal on parse
failure still require dedicated runtime validation before applying this recipe.
Do not claim that raw removal happens only after successful parsing: the supplied
Eval uses `filter: true`. A safe failure-retention policy is still open.

## Route boundary

A Route proposal is explicitly unresolved until these are defined:

- Approved rule identifying this customer's events (a selected source may be shared).
- Destination and valid reference mapping.
- Beginning/End placement and approved Stop After Match policy.
- Resource naming, uniqueness, and collision handling.

Do not fabricate a catch-all Route, destination, or active deployment. A pipeline's
`output: default` is not a customer-approved Route destination. Future Route
serialization should consume a resolved typed plan, with reads/writes in a separate
adapter, rather than accepting customer JSON.

## Preview and next integration decision

The framework returns a plain-language list of parsing, tagging, and raw-message
removal steps plus limitations and missing Route decisions. Generated JSON belongs
in optional advanced details. Agree how the user explicitly chooses JSON processing
before connecting this recipe to submission. Sample upload remains hidden; neither
HEC selection nor a JSON-looking sample silently authorizes this recipe or a write.

Verification covers the supplied shape, deterministic generation, validation, and
literal quoting. It does not establish runtime behavior in Cribl.

## Owner-directed template cloning (2026-10-19)

The workflow now collects a required Application / log name after BarometerIT,
up to 100 characters with no ASCII controls. It appears in the request summary
and notification payload. The draft clone builder (`portal/json-clone.mjs`) reads
an owner-maintained `pl_json` template, deep-clones its configuration, and changes
only its identity and exactly one active Eval BarometerIT assignment. Missing or
ambiguous assignments block cloning. The template itself is never edited.

Example: `Akamai Audit` maps to `pl_Akamai_Audit` (spaces/punctuation become
underscores; ASCII letters, digits, underscores and hyphens remain). Names that
normalize to the same identifier must be treated as collisions, never overwritten.
The reserved template name cannot be reused as a clone name.

The proposed Route name is the entered application name, its pipeline is the new
clone, filter is `true`, and output is `devnull`. No HEC-specific match expression
is inferred: `true` matches all events reaching the Route. Route placement and
Stop After Match must be explicitly approved before any Route write. The builder
requires an explicit policy and does not infer one.

Local read-only assessment found `pl_json` missing in Default (HTTP 404), and a
final enabled default Route with filter `true`. Appending an enabled Route after
it would be unreachable; inserting a final catch-all before it would redirect all
traffic to devnull. These block live creation. The clone builder is not connected
to Submit yet; existing HEC behavior is unchanged. No new pipeline, Route, commit,
deployment, or Worker restart was performed. The pending placement decision and
owner-supplied template are needed before enabling this submission integration.

## Authorized creation flow (2026-10-19)

The owner has created `pl_json` and approved an enabled `true` Route immediately
before the final `default` Route. This supersedes the earlier missing-template and
placement blockers. The application Route uses Stop After Match (`final: true`)
and `devnull`. It matches all events that reach this position, not just one HEC
token. Nothing is committed/deployed by the new processing service.

After the existing enabled mapped HEC setup finishes, Submit invokes a bounded,
same-origin JSON processing endpoint. It validates current group/source references,
completed HEC request state, application name, BarometerIT, requester email and
volume. Other source types remain summary-only. No raw config is accepted.

The server reads and clones the selected group's template, creates a new pipeline,
then reads/preserves the complete route table and inserts one enabled Route before
`default`. Existing pipelines/routes with the requested identity cause a collision
error, rather than overwrite. The default Route must exist exactly once and be last.
Cribl's local API requires a complete Route table PATCH; comments, groups, existing
Route order, and existing settings are retained. A second read before PATCH detects
intervening changes, but there is no established compare-and-swap guarantee: avoid
concurrent administrative edits and multiple portal processes during this prototype.

Private journals persist intent and the original Route table before writes. Retry
uses the same request ID, checks existing pipeline/Route content and placement,
and recovers partial creation without duplicate resources. Changed requests or
ambiguous state require administrator review. No automatic deletion/rollback of
Cribl resources is attempted. A pipeline may remain if Route creation fails.

State defaults to `json-requests` next to the configured HEC journal directory;
`JSON_SETUP_STATE_DIR` can override it. It must remain owner-only and outside the
app/public directories. No credentials, tokens, or raw template config are returned
to the browser. Pipeline/Route setup is uncommitted and undeployed, even though HEC
credentials may already be ready. Further HEC submissions may be blocked by these
pending changes until an administrator reviews and handles them. The updater must
not interrupt an active provisioning/processing request.

Validation uses mocked Cribl writes and local read-only template verification.
No arbitrary demonstration BarometerIT or application was invented to create live
resources. A real customer submission provides those values. Native RHEL and Cribl
runtime processing verification remain outstanding.
