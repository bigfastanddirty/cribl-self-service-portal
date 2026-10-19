# Local Cribl Stream development target

Assessed on 2026-10-04. This assessment used filesystem inspection, process and
service status, unauthenticated HTTP GET probes, and official Cribl documentation.
No configuration changes, service restarts, package installations, authenticated
sessions, or application implementation were performed. Credential stores were
not opened. Only this assessment document was created in the project.

## Installed version and topology

| Finding | Evidence and qualification |
| --- | --- |
| Installed Stream version | `/opt/cribl/package.json`: `4.20.1-590ec085` (package name `LogStream`). This is the installed package version; an authenticated runtime version response was not obtained. |
| Installation root | `/opt/cribl`, owned by the `cribl` account. |
| Topology | Standalone, on-premises. `/opt/cribl/default/cribl/cribl.yml` sets `system.installType: standalone`; startup logs explicitly describe standalone mode and on-prem operation. |
| Service | `cribl` systemd service was active/running. Main process invokes `/opt/cribl/bin/cribl server`. |
| Processing | Startup log reports 14 worker processes; process inspection observed one main Cribl process and 14 additional Cribl processes. Worker defaults are `count: -2`, `minimum: 2`, and `memory: 2048`. This is process parallelism on one instance, not evidence of a distributed Worker Group. |
| API/UI listener | Configured at `0.0.0.0:9000`; socket inspection found a listener there. Plain HTTP requests to `http://127.0.0.1:9000` received responses. TLS was not assessed. |
| Authentication | Default configuration specifies local authentication. No credentials were read, copied, or used. |
| Local topology overrides | No `local/cribl/cribl.yml` or installation-root `groups` directory was present. |

The auxiliary `/opt/cribl/default/cribl/package.json` reports `1.0.0`; this is
not the Stream product version. The package-root version is the relevant target.

## Local configuration representation

Cribl separates shipped defaults under `default/cribl` from local configuration
under `local/cribl`. Effective configuration should not be inferred solely by
listing local files. See [official configuration layout](https://docs.cribl.io/stream/4.18/configuration-files/).

### Routes

The documented routing configuration location is
`(default|local)/cribl/pipelines/routes.yml`. Neither file was present on this
installation, and `local/cribl/pipelines` was absent. No custom persisted routing
table was observed. This does **not** prove the effective runtime table is empty:
Cribl may supply implicit defaults, which could not be read without authentication.
No local Route values or effective destination references were verified.

The documented API resource is a routing table with `id` and an ordered `routes`
array. The normal supported table ID is `default`; each array entry has its own
Route ID. `GET /routes/{id}` addresses the table, not a single Route entry.
A Route proposal therefore needs both table context and entry identity.

### Pipelines

Local files use `(default|local)/cribl/pipelines/<pipeline-id>/conf.yml`.
The directory supplies the Pipeline identity; `conf.yml` supplies its configuration.
Nine shipped Pipeline directories were observed:

- `main`, `passthru`, `devnull`
- `cisco_asa`, `cisco_estreamer`, `palo_alto_traffic`, `wineventlogs`
- `cribl_metrics_rollup`, `prometheus_metrics`

No local Pipeline overrides were present. These are bundled definitions, not an
authenticated inventory of active resources.

Directly inspected examples:

- `main/conf.yml` contains one `eval` function, enabled with filter `"true"`,
  adding field `cribl` using expression string `'yes'`.
- `passthru/conf.yml` contains an empty `functions` array.
- `devnull/conf.yml` contains an enabled `drop` function with filter `"true"`.
- `cisco_asa/conf.yml` demonstrates ordered functions with `id`, `filter`,
  `disabled`, nested `conf`, optional `description`, and function-level `final`;
  the Pipeline also has `output` and `description`. Some legacy bundled entries
  contain `disabled: null`, so existing-file ingestion and new-proposal validation
  should be treated separately.

The API representation wraps this file configuration as `{ "id": "...", "conf":
{ ... } }`. Do not confuse the Pipeline wrapper's `conf` with the function-level
`conf` holding function-specific parameters.

### Function schemas

Bundled function definitions are under
`/opt/cribl/default/cribl/functions/<function-id>/`. Many include
`conf.schema.json` and `conf.ui-schema.json`; not every function has both.
Examples inspected:

| Function ID | Configuration properties observed |
| --- | --- |
| `eval` | `add`, `keep`, `remove`, `printUndefineds`; added values are expression strings. Schema disallows additional top-level properties. |
| `regex_filter` | `regex`, `regexList`, `field`. |
| `regex_extract` | `regex`, `regexList`, `source`, `iterations`, `fieldNameExpression`, `overwrite`; schema requires `regex`. |
| `rename` | `baseFields`, `rename`, `renameExpr`, `wildcardDepth`. |

This inventory does not select or authorize the portal's supported functions.
The allowlist remains a project decision. Schema validation alone does not verify
Cribl expression semantics or event-processing correctness.

## Read API capabilities and verification limits

The official API Reference page currently offers a downloadable **4.20.0**
OpenAPI specification. Its endpoints and schemas were inspected; it is a close
version reference, not proof of exact 4.20.1 behavior:
[Stream API Reference](https://docs.cribl.io/cribl-as-code/api-reference/control-plane/cribl-stream/)
and [4.20.0 OpenAPI specification](https://cdn.cribl.io/dl/4.20.0/cribl-apidocs-4.20.0-cee79842.yml).

For this standalone target, the candidate base is
`http://127.0.0.1:9000/api/v1`. In distributed deployments, resource context uses
`/api/v1/m/<group-id>`; do not add a Worker Group context to this target merely
because examples use one. Base URL semantics are described in the
[official API guide](https://docs.cribl.io/cribl-as-code/api/).

| Method and relative path | Read capability | Local verification |
| --- | --- | --- |
| `GET /routes` | List routing-table resources. | Unauthenticated request returned 401. |
| `GET /routes/default` | Read the default routing table and its Route entries. | Unauthenticated request returned 401. |
| `GET /pipelines` | List Pipeline resources. | Unauthenticated request returned 401. |
| `GET /pipelines/{id}` | Read one Pipeline, including its configuration; `main` was probed. | Unauthenticated request returned 401. |
| `GET /functions` | List function metadata. | Documented; not locally probed. |
| `GET /functions/{id}` | Read metadata for a particular function. | Documented; not locally probed. |

Documented detail responses use an `items` array and `count`, even for one
resource. List responses additionally support pagination metadata. An adapter
should extract resource objects rather than pass the response envelope to the
preview generator.

401 responses establish authentication is required before those paths can be
read; authentication middleware may reject requests before route resolution.
They do not independently prove endpoint existence or exact response schemas.
No login was attempted. Probes of `/system/info`, `/version`, `/docs`, and
`/swagger.json` also returned 401; none supplied runtime version or API schema.
No standalone API specification file was located by filename in the installation.
The in-product reference is documented at Settings → Global → API Reference.

Important boundary: the specification includes `GET /pipelines/__import__`,
which performs an import operation. It is not an allowed metadata read. A future
read-only adapter must allowlist specific endpoint patterns and reject reserved
action paths, regardless of HTTP method.

## Implications for the preview generator

1. Target the observed 4.20.1 installation while clearly labeling schema evidence
   as 4.20.0 until exact-version authenticated verification is available.
2. Keep customer intent, proposed resource objects, API response envelopes, and
   filesystem serialization as separate representations. Render JSON proposals
   without writing into `/opt/cribl` or invoking Cribl mutation endpoints.
3. Preserve Route order and function order. Do not sort arrays for deterministic
   output. Route `final` affects continued routing; function `final` affects
   Pipeline processing and must remain separate.
4. The 4.20.0 Route schema requires `id`, `name`, `pipeline`, and `final`. Include
   explicit filter, disabled state, and static destination selection where the
   MVP supports them; decide defaults deliberately. Distinguish Route IDs from
   Pipeline IDs and function type IDs. Repeated functions can share a type ID.
5. Use static output selection initially unless dynamic output expressions,
   clones, auto-parsing, and Pack contexts are explicitly included in scope.
   These features must not be silently introduced by generation.
6. Validate each function's nested `conf` against its selected schema, preserve
   expressions as strings, and never execute them inside the portal. Use explicit
   booleans for newly generated enabled/disabled state.
7. Resolve links between newly proposed Routes and Pipelines locally. Mark
   existing Pipeline and destination references as unverified when using fixtures;
   absent local override files are not an authoritative resource inventory.
8. Distinguish a proposed Route entry from a complete replacement table. Any
   future submission workflow must retrieve and preserve existing table state
   and address ordering/conflicts. The documented Route-table PATCH requires a
   full representation; omitted fields are removed. This assessment does not
   authorize that workflow. See [official resource configuration example](https://docs.cribl.io/cribl-as-code/api-configure-resources/).
9. Configuration preview means structural validation and display, not live Cribl
   simulation. Runtime expression validation, sample execution, and authenticated
   compatibility checks remain unverified and unnecessary for the initial draft.

## Outstanding decisions

- Choose the initial function allowlist and parameter subsets.
- Agree on Route ID generation, table context, insertion-position preview,
  filter constraints, and static destination handling.
- Select whether the customer sees a Route-entry proposal, a composed table
  proposal based on fixtures, or both, with clear labels.
- Decide how optional Pipeline settings and legacy null values are represented.
- If read-only integration is later requested, confirm exact-version API schemas,
  effective routing defaults, resource inventory, permission scopes, and pagination
  using an approved identity. Do not create accounts or inspect stored credentials
  merely to remove the current verification limits.

The MVP remains independent of the running instance and must not create, modify,
commit, deploy, or delete Cribl configuration.

## Authenticated Worker Group lookup (2026-10-04)

Using an owner-supplied Bearer token held in a private file outside the project,
read-only requests to `http://localhost:9000` produced:

- `GET /api/v1/system/info`: HTTP 200, confirming that authentication succeeds.
- `GET /api/v1/products/stream/groups`: HTTP 404.
- `GET /api/v1/master/groups`: HTTP 404.

Neither Worker Group listing endpoint is available on this observed standalone
target. No live Worker Group catalog could be verified; do not infer or invent a
default group. A Cribl Leader that exposes the Worker Group catalog is needed for
this workflow. During that integration iteration, the portal service referenced the supplied token file directly;
it does not copy the token into source, browser assets, or this document. The
service and its connection override remain transient for the current VM session.
No Cribl configuration, topology, or service was changed.

## Current portal boundary

The owner subsequently requested removal of Cribl API calls and a return to
fixture-based preview. The adapter and portal service connection settings have
been removed. The observations above are historical assessment findings; the
current application neither reads token files nor contacts Cribl.

## Authorized Leader conversion — 2026-10-05

The owner explicitly authorized converting this development instance to a Leader
and authenticating administrative API requests. This is separate from the portal,
which remains fixture-backed and makes no Cribl requests.

Before conversion, authenticated `GET /system/info` reported `distMode: single`
and `installType: standalone`; the Worker Group listing endpoint returned 404.
The license API reported a production license. No license keys or credentials
are copied into this document.

A private, root-readable backup of the local configuration was created and checked
under `/var/backups/cribl-before-leader-20261005/`, including a stopped-state
archive. Existing `local/cribl` configuration was preserved under
`groups/default/local/cribl`. Cribl's installed `mode-master` CLI configured the
Leader, with a generated private Leader/Worker authentication secret. The Cribl
service was restarted and is active. Git was already installed.

Verified after startup settled:

- Runtime distributed mode: `master` (Leader).
- UI/API: port 9000; distributed listener: port 4200.
- `GET /api/v1/products/stream/groups`: HTTP 200; the `default` group exists.
- `GET /api/v1/m/default/routes/default`: HTTP 200.
- `GET /api/v1/m/default/pipelines`: HTTP 200; nine Pipelines returned.
- `GET /api/v1/master/workers`: no connected Worker Nodes.

Group configuration endpoints initially returned 503 while config helpers were
starting, then returned 200. No additional named groups, Worker installations,
config commits, or deployments were performed. A connected Worker is needed to
process logs in the distributed topology. Installing one is not part of this
conversion. The portal continues serving its existing preview-only workflow.

Conversion reference:
https://docs.cribl.io/stream/deploy-convert-single-distributed/

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

## Authorized local Worker and HEC setup — 2026-10-05

A separate runtime at `/opt/cribl-worker` uses the installed 4.20.1 binaries and
runs as user `cribl` under enabled service `cribl-worker.service`. Its connection
is to the local Leader on 127.0.0.1:4200, assigned to `default`. Leader and Worker
have separate instance identities. The management API stays on loopback port 9001
using CRIBL_API_HOST/CRIBL_API_PORT service overrides so group deployments cannot
cause a collision with Leader port 9000. The deployed group controls processing
settings (currently the original 14 Worker Processes).

The existing source `in_splunk_hec`, type `splunk_hec`, was enabled with token
authentication. It listens on 0.0.0.0:8088, path `/services/collector`, without TLS
on this development VM. Its LAN endpoint is
`http://192.168.145.130:8088/services/collector`. Existing settings and tokens are
preserved when new tokens are added. No Route or Pipeline changes were required.

A root-private pre-change backup is at
`/var/backups/cribl-before-hec-20261005/config.tar.gz`. The Leader configuration was
not replaced; the new Worker is a separate service. Necessary group changes were
committed and deployed through the API. Confirmed: healthy connected Default Worker,
listening HEC port, invalid token rejected with HTTP 403 and valid token accepted
with HTTP 200 for empty-body requests (no sample events sent).

Relevant operations verified against the 4.20 API specification and this runtime:
- GET /api/v1/m/default/system/inputs/in_splunk_hec
- POST /api/v1/m/default/system/inputs/in_splunk_hec/hectoken
  with token, enabled, and description. This preserves existing tokens.
- PATCH /api/v1/m/default/system/inputs/in_splunk_hec with the full preserved source
  configuration for one-time enablement; a disabled-only partial body failed validation.
- GET /api/v1/m/default/version/status and GET /api/v1/m/default/version
- POST /api/v1/m/default/version/commit with a descriptive message and the scoped
  file groups/default/local/cribl/inputs.yml
- PATCH /api/v1/products/stream/groups/default/deploy with the commit hash as version
- GET /api/v1/master/workers; runtime revision is info.cribl.config.version.

A Worker can report the target revision before the listener finishes reloading.
The HEC health endpoint returns 200 even without authentication and cannot establish
token readiness. Provisioning therefore waits for a token-authenticated empty-body
POST to /services/collector/event before returning success. Failed or pending
requests retain private state and can resume without generating another token.

References: [HEC source](https://docs.cribl.io/stream/sources-splunk-hec/),
[commit/deploy](https://docs.cribl.io/cribl-as-code/commit-deploy/),
[Worker setup](https://docs.cribl.io/stream/setting-up-leader-and-worker-nodes/).

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
