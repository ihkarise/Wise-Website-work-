# Static Analysis

Structural analysis of every `apps-script/*.gs` file — introduced during Foundation
Batch F3 by explicit requirement, and now a standing step in every Foundation batch's
process, run **before** validation (docs/29-PHASE-2A-TECHNICAL-PLAN.md §14).

## What it checks

- Duplicate global names
- Duplicate constants
- Duplicate function names
- Unused exported helpers
- Circular dependencies
- Apps Script namespace collisions

Full detail on each check's mechanism, and why two pairs of these six labels report
the same underlying finding (duplicate global names / namespace collisions; duplicate
function names + duplicate constants are that same finding set, filtered by kind), is
in `analyze.js`'s own header comment — not duplicated here.

## Why this exists

Apps Script gives every file in one project a single, flat global namespace — there is
no `import`/`export`, no per-file scoping. Since Foundation batch F1's decision to
share Phase 1.5's existing project (docs/29 §14) rather than deploy separately, a
same-named function or constant in a new file **silently overwrites** an existing one,
with no error, no warning, at load time. Batch F2 caught exactly this by hand before
writing `FoundationUtils.gs`'s `escapeHtml()` — a literal port of the shared reference
implementation would have collided with Phase 1.5's own `Utils.gs` `escapeHtml_()`.
This tool makes that check repeatable and automatic instead of relying on a human
remembering to grep first every time.

## Run it

```
node validation/static-analysis/analyze.js
```

No dependencies beyond Node's standard library, matching `validation/phase-1-5/`.
Exit code `0` if no findings, `1` otherwise.

## A finding is not automatically a bug

This tool's job is to surface facts, not to decide what's acceptable. Foundation
batches F2 and F3 both produced real "unused exported helpers" findings for
infrastructure that was deliberately built ahead of its first consumer (e.g.
`escapeFoundationHtml_()`, part of the shared `core.reference.js` contract's three
functions, with no HTML-rendering need yet in Foundation as of F3). Every finding is
triaged by a human before a batch ships — fixed if it's a real problem, or reviewed and
documented if it's an accepted, deliberate case — and that triage is recorded in
`docs/29-PHASE-2A-TECHNICAL-PLAN.md` §14 and the corresponding `CHANGELOG.md` entry for
each batch. A clean run (0 findings) is not required to ship; an *un-triaged* finding
is what's not allowed.

## Known limitations

Plain regex/text analysis, not a real parser — deliberately dependency-free, matching
this repo's other validation tooling. Two adjustments already made after real false
positives (comment/string-literal awareness; Apps Script's `menu.addItem('label',
'fnName')` string-reference pattern counts as usage) are documented in `analyze.js`'s
header comment. Neither adjustment makes this a substitute for actually running the
code or for `validation/phase-1-5/`'s and (from F5) `validation/phase-2a-foundation/`'s
behavioral validation — it narrows false positives, it does not eliminate every
possible one.
