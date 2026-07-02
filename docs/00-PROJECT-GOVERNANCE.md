# 00 - PROJECT GOVERNANCE
## Wise Homeopathy Repository Governance
### Version 2.0

> This document is the highest-priority document in the repository.
> Every contributor, developer, AI assistant, and automation must read this document before making any changes.

---

# Purpose

This repository follows a **Documentation-First Development** methodology.

Documentation is considered part of the product.

No implementation is complete until both the code and documentation are updated together.

---

# Repository Philosophy

We are not building a collection of web pages.

We are building a long-term healthcare platform.

Every decision must improve at least one of:

- Patient trust
- Patient understanding
- User experience
- Performance
- Accessibility
- Maintainability
- Security
- SEO
- Long-term scalability

---

# Single Source of Truth

The `/docs` directory is the official product specification.

When documentation and implementation disagree:

1. Stop.
2. Identify the conflict.
3. Update documentation if the implementation is the intended direction.
4. Otherwise update the implementation.

Never ignore inconsistencies.

---

# Required Startup Workflow

Before beginning any task:

1. Read every document in `/docs`.
2. Understand the existing architecture.
3. Review the current implementation.
4. Check the CHANGELOG.
5. Confirm the requested change fits the project vision.

Only then begin implementation.

---

# Living Documentation Policy

Every completed task must review whether documentation needs updating.

If a task changes any of the following, update the corresponding document.

| Change | Update |
|--------|--------|
| Product vision | 01-WEBSITE-MASTER-PLAN.md |
| Audit findings | 02-WEBSITE-AUDIT.md |
| Visual language | DESIGN-SYSTEM.md |
| Components | COMPONENT-LIBRARY.md |
| UX | 05-UX-GUIDELINES.md |
| Content | 06-CONTENT-GUIDELINES.md |
| SEO | 07-SEO-STANDARDS.md |
| Navigation | 08-NAVIGATION-ARCHITECTURE.md |
| Patient Platform | 09-PHASE-2-ARCHITECTURE.md |
| Development process | 10-DEVELOPMENT-STANDARDS.md |
| Git workflow | 11-GITHUB-WORKFLOW.md |
| Data flow | 12-DATA-ARCHITECTURE.md |
| AI behaviour | 13-AI-GUIDELINES.md |
| Accessibility | 14-ACCESSIBILITY-STANDARDS.md |
| Security | 15-SECURITY-STANDARDS.md |
| Performance | 16-PERFORMANCE-STANDARDS.md |
| Components checklist | 17-COMPONENT-CHECKLIST.md |
| Release process | 18-RELEASE-CHECKLIST.md |
| History | CHANGELOG.md |

---

# Documentation Rules

Documentation must always:

- Match the implementation.
- Avoid duplication.
- Remove obsolete information.
- Cross-reference related documents.
- Stay concise and current.

Documentation is never optional.

---

# Implementation Rules

Never:

- Rebuild working systems unnecessarily.
- Introduce frameworks without approval.
- Break existing SEO.
- Reduce accessibility.
- Ignore mobile experience.

Always:

- Preserve branding.
- Preserve performance.
- Preserve architecture where possible.
- Make incremental improvements.

---

# Definition of Done

A task is complete only when:

- Code is implemented.
- Tests are complete.
- Documentation is updated.
- CHANGELOG is updated.
- No contradictions remain.
- Repository remains buildable.

---

# Continuous Improvement

Every session should leave the repository better than it was found.

This includes:

- Better code
- Better documentation
- Better structure
- Better consistency

---

# Final Principle

The repository is a living product.

Code and documentation evolve together.

If they diverge, the repository is considered incomplete.
