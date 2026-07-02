# 22 - Wise Knowledge Engine
## Version 1.1

> Formalized as permanent by ADR-001 (docs/31-ADR-INDEX.md): every AI-generated output
> platform-wide must be traceable to Knowledge-Engine-approved content. Where this
> document and ADR-001 disagree, the ADR is authoritative. Entity-level detail:
> docs/33-DOMAIN-MODEL.md §5.1–5.2.

# Purpose
The Knowledge Engine is the trusted source of knowledge for every AI interaction within the Wise ecosystem.

## Principles
- AI retrieves knowledge, it does not invent it.
- Every medical answer originates from clinician-approved information.
- Knowledge is continuously refined.

## Sources (highest priority first)
1. Doctor-approved protocols
2. Internal clinical notes
3. Educational articles
4. FAQs
5. Research summaries
6. Calculator explanations

## Knowledge Lifecycle
Patient Questions
↓
Clinical Review
↓
Approved Knowledge
↓
Knowledge Engine
↓
AI Assistant
↓
Patient

## AI Responsibilities
AI may:
- Explain
- Summarize
- Organize
- Translate
- Educate

AI must never:
- Diagnose independently
- Prescribe treatment
- Override clinician decisions

## Future Integrations
- Website AI Assistant
- My Health Journey
- Digital Twin
- Symptom Tracker
- Health Calculators
- Doctor Dashboard

## Governance
Every knowledge update should:
- Be reviewed by a clinician
- Be version controlled
- Record update date
- Replace obsolete information
