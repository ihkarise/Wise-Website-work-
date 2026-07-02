# CLAUDE.md
# Wise Homeopathy Project Instructions

> This file contains project-specific instructions for Claude Code.
> Read this file before making any changes.

## Mission

You are contributing to the Wise Homeopathy website.

This is an **evolution project**, not a rewrite.

Your objective is to refine, improve, and extend the existing website while preserving its strengths.

---

## Read First

Before writing code, read these documents in order:

1. /docs/00-PROJECT-GOVERNANCE.md
2. /docs/01-WEBSITE-MASTER-PLAN.md
3. /docs/02-WEBSITE-AUDIT.md
4. Read the remaining files in /docs as needed for the task.

Treat the documentation as the product specification.

---

## Core Rules

- Refine, don't rebuild.
- Preserve branding.
- Preserve SEO.
- Preserve accessibility.
- Preserve performance.
- Prefer incremental improvements.
- Keep commits small and reviewable.

Do not introduce new frameworks unless explicitly approved.

Current stack:

- HTML
- CSS
- JavaScript
- Google Apps Script
- Google Sheets
- Netlify

---

## Working Process

For every task:

1. Understand the request.
2. Review affected documentation.
3. Review affected files.
4. Explain the intended approach.
5. Implement the smallest safe change.
6. Test for regressions.
7. Update documentation if required.
8. Update CHANGELOG.md when behavior changes.

Never skip documentation updates.

---

## Living Documentation

Documentation is part of the product.

Whenever implementation changes:

- Architecture
- Navigation
- UX
- UI
- Components
- Content
- SEO
- AI
- Data flow
- Security
- Accessibility
- Performance

Update the corresponding document inside /docs before considering the task complete.

If documentation becomes outdated, update it immediately.

---

## Audit Before Build

Before adding new functionality, first check whether:

- An existing component can be reused.
- Existing CSS can be reused.
- Existing JavaScript can be extended.
- Existing patterns already solve the problem.

Avoid duplication.

---

## Definition of Done

A task is complete only when:

- Code works.
- Existing functionality is preserved.
- Documentation is synchronized.
- CHANGELOG.md is updated (when applicable).
- No console errors remain.
- Mobile experience is verified.

---

## Future Vision

Phase 1:
Refine the public website.

Phase 2:
Build My Health Journey including:

- Personal Care Plan
- Wise Digital Twin
- Symptom Tracker
- AI Summaries

Do not prematurely implement Phase 2 unless requested.

---

## AI Guidelines

AI may:

- Summarize
- Organize
- Explain
- Improve UX
- Improve documentation

AI must not:

- Invent medical facts.
- Make diagnoses.
- Prescribe treatment.
- Remove working functionality without justification.

---

## Repository Philosophy

Leave the repository better than you found it.

Improve:

- Code quality
- Documentation
- Consistency
- Readability
- Maintainability

Never sacrifice stability for novelty.

