# Development Worker and HEC provisioning

Goal: connect a separate local Worker to Default, deploy authenticated HEC, and let
customers explicitly create a HEC token and see its endpoint in a dialog.

Scope: this owner-authorized iteration supersedes preview-only rules only for HEC
source token creation, source enablement, scoped commit/deploy, and Worker setup.
Route/Pipeline derivation and other methods remain preview-only. Samples stay local.

- [x] Back up Leader configuration privately; copy installed runtime to a fresh
  /opt/cribl-worker without Leader identities, auth state, or processing state.
- [x] Use installed mode-worker CLI with private cluster secret and Default group;
  configure a distinct loopback management port and small process count. Start a
  dedicated system service; verify Leader sees its group and connection.
- [x] Preserve existing HEC settings and tokens, enable source with a generated
  initial auth token, selectively commit inputs and deploy Default. Verify Worker
  version and HEC authentication without sending sample logs.
- [x] Extend cached-auth client with fixed HEC-only read/update/commit/deploy paths.
  Group/source/endpoint mapping is server-controlled. Serialize changes, deduplicate
  request IDs, refuse unrelated pending changes and unavailable mapped targets.
- [x] Add bounded same-origin POST endpoint; validate inputs/content type/body limit.
  Secrets never enter logs or persistent browser storage. No arbitrary API proxy.
- [x] Add explicit Create HEC credentials action only for HEC, disable while pending,
  show endpoint/token only after successful deployment in accessible dialog. Clear
  visible secrets on close/reset/selection change. Preview remains a separate action.
- [x] Test auth reuse, token preservation, commit/deploy success/failures, duplicate
  submissions, POST controls and popup behavior; verify live Worker and portal.

Verification: TypeScript/Vite build passed; 21 unit tests, 20 server/client/service
tests, and 18 browser tests passed. Live provisioning and resuming pending requests
returned 200 after deployment and authentication readiness. Worker is healthy in
Default; group working tree is clean. Dialog checked at 320px and 1440px.
