# Customer-intent UI prototype implementation plan

Goal: implement the user's authorized first prototype, with no Cribl connection.
Stack: TypeScript, Vite, native accessible form controls, Vitest, Playwright.
Design: navy enterprise header, a numbered white form, muted teal accents, and a
plain-language review panel; responsive single-column layout on narrow screens.

1. Add a versioned configurable JSON fixture catalog, labeled development-only.
2. Test exact 1,000,000-byte limit, invalid selections, missing fields, and sample
   replacement; implement a pure validation layer.
3. Build the three-question form and preview. Keep File objects only in browser
   memory; no content reads, upload endpoint, storage, analysis, or Cribl calls.
4. Test form completion, invalid upload, replacement, reset, stale preview,
   mobile layout, and absence of upload/network mutation requests in a real browser.
5. Build and serve static output on 0.0.0.0:4173; verify LAN address and HTTP response.

The latest user request authorizes implementation and stack installation, superseding
the prior documentation-only scope for this iteration. All three questions are
required to review this prototype; fixture entries are examples, not production
choices. Samples are not analyzed and complete configuration is not generated.
