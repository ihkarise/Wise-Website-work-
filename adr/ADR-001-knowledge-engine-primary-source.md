# ADR-001: Knowledge Engine Is the Primary Knowledge Source

## Status
Accepted

## Context
docs/21-WISE-PRODUCT-VISION.md and docs/22-WISE-KNOWLEDGE-ENGINE.md already establish
the Knowledge Engine as "the trusted source of knowledge for every AI interaction" and
CLAUDE.md repeats it as a core AI principle. What has not existed until now is a
permanent, binding architectural decision that every future AI feature is measured
against — without one, each new AI feature (Digital Twin, AI Summaries, a future public
AI assistant) risks quietly inventing its own notion of "grounded enough."

Phase 1.5 already produced the first concrete, working example of this principle:
`apps-script/Ai.gs`'s summarization step is not allowed to add anything not present in
`staff_submitted_note`, enforced two independent ways (prompt + `flagDrift_()` code
check), per docs/13-AI-GUIDELINES.md's worked example.

## Decision
Every AI-generated or AI-assisted output anywhere on the platform must originate from,
or be directly traceable to, Knowledge-Engine-approved content: doctor-approved
protocols, internal clinical notes, educational articles, FAQs, research summaries, or
calculator logic (docs/22's source-priority list). AI must retrieve or rephrase this
content — it must never invent medical facts, fill gaps by inference, or answer from
general model knowledge alone.

Phase 1.5's pattern — a source note, a normalization-only prompt, and an independent
code-level traceability check — is the reference implementation for this decision, not
a one-off. Any future AI feature that cannot point to a specific Knowledge-Engine-backed
source for its output is out of scope until the Knowledge Engine covers that content.

## Consequences
- Every future AI integration must explicitly plumb its "source content" — there is no
  general-purpose, ungrounded Q&A feature anywhere on the platform.
- New AI features are slower to build (grounding is a hard requirement, not a
  nice-to-have) but carry materially less risk of fabricated medical content.
- A formal Knowledge Engine retrieval system does not exist yet — today "the Knowledge
  Engine" is doctor-approved text passed inline per request (Phase 1.5's
  `staff_submitted_note`). This ADR does not require building a retrieval system now;
  it requires that whatever is built later still satisfies this traceability rule.

## Future Considerations
A real Knowledge Engine implementation (structured storage, versioning, retrieval) is
future work, likely triggered when Phase 2C (Digital Twin / AI Summaries) or a future
public AI assistant is designed. When that happens, revisit this ADR only to add
implementation detail — the traceability requirement itself should not change.
