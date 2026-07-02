# ADR-009: Every Module Must Be Independently Replaceable

## Status
Accepted

## Context
Phase 1.5 already enforced this structurally without naming it as a formal rule:
`Send.gs` never calls `MailApp`/`GmailApp` directly — only `Email.gs` does — and
`Retention.gs` is structurally independent of `Review.gs`, `Send.gs`, and `Email.gs`
(neither calls them nor is called by them). docs/27 §4's Lessons Learned credits this
layering explicitly: "a future provider swap only touches `Email.gs`" and "the pattern
... is now documented ... as the reference implementation for future AI usage on this
platform, not a one-off." This ADR elevates that concrete, working pattern into a
binding rule for every future module, not just the ones that happened to need it in
Phase 1.5.

## Decision
Every backend module — and, where practical, every frontend component — has exactly
one responsibility and depends on the modules beneath it only through a narrow,
explicit interface. A module must be replaceable (a different mail provider, a
different AI provider, a different datastore per ADR-006) by rewriting only that
module, never by touching its callers. Concretely, for Phase 2A and beyond: the
authorization/authentication gate must be swappable independent of whatever it
protects; the AI/summarization layer must be swappable independent of the doctor-review
gate that sits in front of it (ADR-005); the datastore access layer must be swappable
independent of every module that reads or writes through it (ADR-006).

## Consequences
- More files/modules than a monolithic script would require — deliberately. Module
  boundaries are decided as an architecture step before code is written, not discovered
  mid-implementation.
- Makes ADR-006 ("Sheets is an implementation detail") actually achievable in practice,
  since swapping a datastore only requires rewriting one data-access module.
- Easier to verify in isolation (supports ADR-008/testability) and easier to reason
  about which module a given bug or security issue could possibly originate in.

## Future Considerations
Phase 1.5's Batch 4A repository-structure review deferred moving shared logic
(condition-slug validation, `escapeHtml_`, audit-logging helpers) into a genuinely
shared location, for lack of a second real consumer at the time. Phase 2A introduces a
second, separate Apps Script project (docs/29) — this is the first point where that
deferred question has a second real consumer and should be revisited concretely, not
speculatively.
