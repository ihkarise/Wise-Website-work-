# CLAUDE.md

## Project Identity
Wise is a Digital Healthcare Platform, not just a website.

## Read Order
1. docs/00-PROJECT-GOVERNANCE.md
2. docs/21-WISE-PRODUCT-VISION.md
3. docs/20-PRODUCT-ARCHITECTURE-REVIEW.md
4. docs/01-WEBSITE-MASTER-PLAN.md
5. docs/02-WEBSITE-AUDIT.md
6. Remaining documentation as required.

The Product Vision overrides implementation details.

If implementation conflicts with Product Vision:
- Stop
- Explain the conflict
- Recommend the best solution

## Architecture Freeze

Once Phase 2A implementation begins:

- ADRs are authoritative.
- Architecture Principles are authoritative.
- Domain Model is authoritative.

Claude must not redesign the architecture unless explicitly instructed.

Implementation should conform to the approved architecture.

Architectural changes require an explicit architecture review before implementation.

## Core Principles
- Refine, don't rebuild.
- Preserve branding.
- Preserve SEO.
- Preserve accessibility.
- Preserve performance.
- Prefer reusable components.

## Documentation First
Update documentation whenever implementation changes architecture, UX, navigation, AI, data, security, performance or content.

Always update CHANGELOG after user-visible changes.

## AI Principles
AI assists.
Doctors decide.
Knowledge Engine is the trusted source.
Never invent medical facts.

## Workflow
Read docs → Explain plan → Implement → Test → Update docs → Update changelog → Summarize.

## Repository Goal
Leave the repository better than you found it.
