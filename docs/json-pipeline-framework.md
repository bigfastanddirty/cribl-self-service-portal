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

The caller supplies an internal proposed pipeline ID (letters, digits, underscore,
hyphen, maximum 128). This is a portal constraint, not a claim about all legal Cribl
names. Automated identity allocation and collision handling remain unresolved.
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
