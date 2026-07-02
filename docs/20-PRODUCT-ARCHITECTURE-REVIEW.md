# 20 - PRODUCT ARCHITECTURE REVIEW
## Wise Homeopathy → WiseOS: Long-Term Product Architecture
### Version 1.0 — 2026-07-02

> Strategic review only. No code changes, no page implementation, no visual redesign.
> Written from a Product Architect / CPO perspective: how does every future implementation
> fit one long-term vision instead of just completing roadmap items.

---

# 0. Grounding — where the product actually is

Batches 1–2 closed the technical debt from launch (canonical domain, mobile nav, fake
booking form, condition-card routing, testimonial claims, og:image scaffolding). The
site is now technically sound. This review starts from a finding that affects every
section below:

**The documented information architecture and the live information architecture have
already diverged**, in both directions:

| Element | `docs/08-NAVIGATION-ARCHITECTURE.md` says | Live site actually has |
|---|---|---|
| Primary nav | Home · Conditions · Online Consultation · **Doctors** · **Resources** · Contact | Home · Online Consultation · Conditions · **Team** · **Blog** · **Gallery** (+ Book Now CTA) |
| Resources | A top-level menu (Articles, FAQs, Downloads, Research) | Does not exist — Blog and Conditions FAQ stand alone |
| Footer Legal | Privacy · Terms · Disclaimer | **Does not exist anywhere on the site** |
| Patient Login | A separate, always-visible action | Does not exist (correctly — Phase 2 isn't built) |
| Gallery | Not mentioned anywhere in nav docs | Lives permanently in primary nav |

None of this is a crisis — the docs were written as a target, the implementation is
mid-transition. But it means **Information Architecture can't be answered by re-reading
docs/08 as settled fact**; it has to be re-decided here, deliberately, before Resources
or My Health Journey add more pressure to a nav that's already inconsistent with its own
spec.

---

# 1. Information Architecture

## Is the current sitemap still correct?

Partially. Home, Conditions, Online Consultation, Team, Contact are all correctly
scoped and should not move. Three things are wrong or missing:

1. **No legal/compliance pages exist.** A healthcare site collecting name, email,
   phone, condition, and free-text medical history through two forms, with zero
   Privacy Policy, Terms, or Disclaimer page, is a real gap — not a nice-to-have.
   `docs/08` already reserves footer space for this; it was never built.
2. **Blog and Conditions are siblings that should be a hierarchy.** Both are
   "education" content competing for the same visitor intent ("can you help me /
   what is this") without a shared parent that signals *this is where you learn,
   as opposed to where you book.*
3. **Gallery has no defined long-term home.** It's not in the documented nav model
   at all, yet occupies permanent primary-nav real estate today.

## Should Resources become a top-level section?

Yes — but not yet, and not as a rename. Introducing "Resources" today, with only a
3-post blog and an 8-anchor condition page behind it, would be a label change with
nothing new underneath. Resources should be introduced **after** Batch B (dedicated
condition pages) and Batch A (root-cause article series) exist — at that point there's
real content depth to justify a new top-level container, and the container becomes the
natural roof over Conditions + Blog + FAQ, rather than a fourth thing to maintain.

## Should Conditions remain one page or evolve into a knowledge hub?

Evolve, in stages — this was the substance of last turn's recommended Batch B. Short
version: `/conditions/` today is 8 anchors sharing one URL, one `<title>`, one canonical.
The top 3 (Hashimoto's, MCAS, CSU) should become dedicated pages first, because they
already have supporting article content and real search intent. The other 5 stay as
anchors until they earn the same treatment. "Knowledge hub" is the *eventual* shape;
getting there is incremental, not a relaunch.

## How should Blog, Conditions, Resources and Online Consultation connect?

Proposed model — a hub-and-spoke, not a flat list:

```
                     ┌────────────┐
                     │  Resources │  (new top-level, introduced after Batch A+B)
                     └─────┬──────┘
              ┌────────────┼────────────┐
        ┌─────▼─────┐ ┌────▼────┐  ┌────▼────┐
        │ Conditions │ │  Blog   │  │   FAQ   │  (consolidated, see Content Strategy)
        └─────┬──────┘ └────┬────┘  └─────────┘
              └──────┬───────┘
                      │ interlinked (Q3 from last turn's review)
                      ▼
            ┌─────────────────────┐
            │ Online Consultation │  ← stays OUTSIDE Resources.
            └─────────┬───────────┘     It is the transactional/conversion page,
                      │                 not an educational one — mixing it into
                      ▼                 Resources would blur "learn" vs "act."
                 Contact / Book
```

Online Consultation deliberately stays a peer of Resources, not a child of it — its job
is "how does this work / am I ready to commit," which is a different mode than
"educate me." Collapsing it into Resources would undo the exact nav-consistency fix
Batch 1 already made.

---

# 2. Product Roadmap

## What should Phase 1 end with?

No document currently defines a Phase 1 "done" bar — `docs/01-WEBSITE-MASTER-PLAN.md`
lists Phase 1 activities (audit, nav, SEO, UI, content) but not an exit condition. I'm
proposing one, since Phase 2 work (auth, patient data) shouldn't start against a moving
target:

**Phase 1 Definition of Done:**
- Dedicated pages for the top-tier conditions (Batch B)
- Root-cause article series published, schema-consistent (Batch A)
- FAQ consolidated to one canonical source
- Legal/Privacy/Terms/Disclaimer pages live
- Resources introduced as a top-level nav section
- Real assets (logo, doctor photos, clinic photos, og:images) uploaded — the one item
  on this list that isn't in my control; it's a standing client dependency
- Nav renamed to match `docs/08` (Team → Doctors) or `docs/08` updated to match the
  live site — whichever direction is chosen, the two must agree

## What should Phase 2 begin with?

`docs/09-PHASE-2-ARCHITECTURE.md`'s own sequencing (2A: Login + My Health Journey
shell, before Care Plan/Tracker) is correct and I'd keep it as-is — you cannot build a
Symptom Tracker or Care Plan before there's an authenticated place to put them, and
`docs/15-SECURITY-STANDARDS.md` already requires "authenticated access only, session
expiration, role-based permissions" for the patient portal, none of which exists yet.

I'd add one thing *before* Phase 2A that isn't in the current plan: a **Phase 1.5**,
non-authenticated proof of the data pipeline. Concretely: use the existing
Apps-Script-to-Sheets pattern (already specified for Phase 2 in `docs/12`) for something
low-stakes first — e.g. emailing a patient a PDF visit summary after a consultation.
This validates the data flow, the Sheets structure, and the Apps Script integration
under real (if low-stakes) conditions before any authentication or PHI is involved.
Cheaper to find data-architecture problems here than after login exists.

## What belongs in My Health Journey?

`docs/09`'s module list (Welcome, Today's Care Plan, Health Timeline, Symptom Tracker,
Messages, Follow-up) is sound and doesn't need revision here.

## What should never appear on the public website?

- Any authenticated or patient-specific data (obviously — but worth stating as a hard
  boundary, not an assumption)
- AI-generated diagnosis, prescription, or treatment-change language — `docs/13-AI-GUIDELINES.md`
  already forbids this for the platform generally; it applies with extra force to
  anything public-facing and unsupervised
- Unverified aggregate claims ("5000+ patients," "40+ countries") unless the clinic
  confirms the numbers — flagged in the prior content review, still open
- Downloads or Research resources that don't exist — `docs/08` names this category;
  nothing should populate it until real, clinic-approved material exists
- Any PHI, even in anonymized-looking form (case study specifics, lab values) — the
  Batch 2 testimonial softening was step one of this; the principle should extend to
  all future content, not just what already existed

---

# 3. Patient Journey — full map

```
Google / AI search
      │
      ▼
Landing (condition page, blog article, or Home)
      │  ← TRUST BUILT HERE: credentials, testimonials, journey timeline
      ▼
Education (Conditions / Resources / Blog)
      │  ← interlinking should never dead-end (docs/07, docs/08: "no orphan pages")
      ▼
Decision support (Online Consultation FAQ — "how does this work")
      │
      ▼
Booking (Contact form / WhatsApp)
      │
      ▼
Confirmation (booking-received.html)
      │
      ▼
╔═══════════════════════════════════════════════╗
║  TREATMENT HAPPENS ENTIRELY OFF-WEBSITE TODAY  ║
║  (WhatsApp, video call, courier — real world)  ║
╚═══════════════════════════════════════════════╝
      │
      ▼
  ??? ← THE GAP
      │
      ▼
Phase 2 invite → Patient Login → My Health Journey
      │
      ▼
Long-term patient (Care Plan, Digital Twin, Symptom Tracker, Follow-up loop)
      │
      ▼
Re-engagement (newsletter, new articles) → refers others → back to top of funnel
```

**The gap is the single biggest architectural finding of this review.** Once a visitor
becomes a patient, the website currently has *zero* further role until Phase 2 exists —
everything from "first WhatsApp reply" to "second follow-up" happens entirely outside
any system the site touches. The Phase 1.5 proposal in Section 2 (a simple post-visit
email touchpoint) is specifically designed to put one foothold in that gap now, so
Phase 2 isn't trying to connect two completely disconnected experiences later.

---

# 4. Content Strategy

Covered in depth in the prior turn's Content & Authority Strategy review — summarized
here for completeness, not repeated in full:

- **Pillar pages:** the top 3 dedicated condition pages (Hashimoto's, MCAS, CSU)
- **Cluster content:** the root-cause article series (2 of 5 causes currently teased
  in live copy; the other 3 aren't named anywhere and shouldn't be invented)
- **Cornerstone content:** the Hashimoto's–CSU connection article — already positioned
  as "featured," already interlinks two conditions, already cites external clinical
  guidelines
- **Reusable content:** FAQ (currently duplicated across Conditions and Online
  Consultation — should consolidate to one source), doctor credentials, the Home
  journey timeline
- **Recommended next batch (reaffirmed):** Batch B — dedicated condition pages —
  remains correct. It requires no new clinical authorship (reuses existing,
  already-approved copy) and produces the architecture Resources will eventually sit on
  top of.

---

# 5. Future WiseOS Integration — building today without a future redesign

Going module by module against `docs/09-PHASE-2-ARCHITECTURE.md`:

**Personal Care Plan.** The Home page's 4-step "How It Works" journey timeline
(`.journey` / `.j-step` component) is already the correct visual pattern — a
progression with a status/highlight state. Recommend this be explicitly documented in
`docs/04-COMPONENT-LIBRARY.md` as the reusable "progress timeline" component *now*, so
Phase 2's Care Plan UI reuses it instead of a future designer reinventing the same
pattern under time pressure.

**Wise Digital Twin.** This needs a consistent condition taxonomy to organize a
patient's timeline against. The condition anchor IDs already in use today
(`mcas`, `hashimotos-thyroiditis`, `chronic-urticaria`, etc.) should be treated as the
canonical condition identifiers going forward — including inside Phase 2 data
structures. If Phase 2 invents a *different* internal condition taxonomy later, every
public page and every patient record will need remapping. Deciding now that "the slug
is the ID" costs nothing today and avoids that entirely.

**Symptom Tracker.** `docs/12-DATA-ARCHITECTURE.md` specifies Google Sheets as the
Phase 2 datastore; `docs/15-SECURITY-STANDARDS.md` requires authenticated,
role-based, session-expiring access for anything patient-facing. No authentication
exists today. Building a Symptom Tracker before Login (Phase 2A) would be
architecturally backwards — confirms `docs/09`'s existing 2A→2B ordering is correct
and should not be reshuffled for expedience.

**Patient Dashboard.** Reuse today's design tokens (`--color-brand`, `--font-display`,
etc. — currently duplicated per-page rather than shared) rather than let Phase 2 invent
a second design language. This turns Roadmap item 17 ("extract shared design tokens
into `assets/site.css`") from a "someday hygiene" item into a **soft prerequisite** for
Phase 2: it's far cheaper to consolidate two copies of the same tokens now than to
un-fork two diverging design systems after a Patient Dashboard has shipped against one
of them.

**Data architecture ceiling.** `docs/12` already says "design for migration to SQL
without changing frontend APIs" — right now that's an aspiration, not an enforced
constraint. Recommend treating it as a hard rule starting now: any Phase 1.5/2A Sheets
structure should be designed as if a SQL migration were a certainty, not a possibility
(normalized-ish columns, stable IDs, no ad-hoc per-patient tabs) — because retrofitting
that discipline after real patient data exists in Sheets is much harder than starting
with it.

---

# 6. Navigation Strategy — will it still make sense in 2 years?

**No, not as it stands.** Three specific reasons:

1. **Team vs. Doctors is an unresolved naming conflict** between the live site and
   `docs/08`. This needs to be resolved (pick one, update the other) *before* Resources
   adds a second point of nav pressure — better to fix one naming inconsistency now
   than two at once later.
2. **There's no reserved nav slot for Patient Login.** `docs/05` and `docs/08` both
   specify it as "always separate," which is right, but it doesn't exist today because
   Phase 2 doesn't exist. That's correct *for now* — but it means the nav's future
   shape (an extra persistent CTA-style element, distinct from "Book Now") isn't
   visible in any current design. Worth keeping in mind before Book Now's styling
   forecloses the visual slot Patient Login will eventually need.
3. **Gallery has no long-term nav strategy.** It's permanent primary nav today with
   zero photos in production (a Batch 1/2-era finding that's still true). Once
   Resources exists, Gallery is a natural Resources sub-item, not a permanent top-level
   link competing with Conditions and Online Consultation for attention.

**Recommended 2-year nav shape** (a target to grow into via the batches above, not an
instruction to build now):

```
Home · Conditions · Online Consultation · Resources · Doctors · Contact     [Patient Login]
                                            ↳ Blog, FAQ, Gallery
```

This collapses Blog and Gallery under Resources, resolves Team→Doctors, and reserves —
without yet building — the Patient Login slot.

---

# 7. Growth Strategy — highest-value work, next 12 months

| Quarter | Focus | Why this order |
|---|---|---|
| Q1 | Legal/compliance pages (Privacy, Terms, Disclaimer) + FAQ consolidation + Batch B (top-3 condition pages) | Legal pages are a standing compliance/trust gap that should exist *before* more data collection expands, not after. Batch B is pure structural work, no new clinical content needed. |
| Q2 | Batch A (root-cause article series) + Resources introduced as top-level nav | Now there's enough content depth to justify the new section — sequencing matters here. |
| Q3 | Real asset upload (logo, doctor/clinic photos, og:images) + Team→Doctors nav resolution | Client-dependent item scheduled once content work isn't competing for review bandwidth. |
| Q4 | Phase 1 Definition of Done formally verified against Section 2's checklist; Phase 2A (Login + My Health Journey shell) begins only once it's met | Prevents Phase 2 starting against an undefined "finished enough" Phase 1. |

## Single highest-value recommendation for the next 12 months

**Legal/Privacy/Terms/Disclaimer pages — not a content or SEO item, a trust and
compliance one.** It's easy to deprioritize because it doesn't move rankings or
conversion directly, but it's the one gap that gets *harder*, not easier, to fix later:
right now the site collects name/email/phone/condition/medical-history text through two
forms with no stated privacy policy. Phase 2 will collect materially more — authenticated
patient records, symptom logs, AI-generated summaries. Retrofitting legal/privacy
infrastructure after real patient data already flows through the system is the wrong
order of operations. It costs little to build now and is a genuine blocker for doing
Phase 2 responsibly.

---

# Summary of decisions this review makes (for the Changelog / audit cross-reference)

- Confirms Batch B (dedicated condition pages) as the correct next implementation step
- Adds Legal/Privacy/Terms/Disclaimer as a newly-identified, previously undocumented gap
- Defines an explicit Phase 1 Definition of Done (did not exist before this review)
- Proposes a "Phase 1.5" data-pipeline proof-of-concept ahead of Phase 2A
- Identifies the "condition slug = canonical ID" decision as a now-cost-nothing,
  later-expensive migration risk
- Recommends `docs/04-COMPONENT-LIBRARY.md` document the journey-timeline component
  and treat design-token extraction (existing roadmap item 17) as a Phase-2
  soft-prerequisite, not hygiene
- Recommends resolving the Team/Doctors naming conflict between the live site and
  `docs/08-NAVIGATION-ARCHITECTURE.md`
