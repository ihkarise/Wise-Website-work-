# 37 - Dashboard Shell Readiness Review
## Version 1.0 — 2026-07-03

> Pre-implementation review for **Batch PA-2** (docs/29 §13 Batch 5C: `assets/site.css`
> token extraction + the `/my-health-journey/` dashboard shell, wired to PA-1's session).
> Per this session's explicit instruction: **no code was written to produce this
> review**, and **no backend architecture is proposed or altered** — everything below
> is scoped strictly to the already-approved docs/29 §5 (Dashboard Architecture) and
> §13 (Batch 5C). This document does not authorize PA-2 to begin; implementation waits
> for separate approval, the same discipline docs/29 itself was held to before Batch 5A.

---

# 1. Dashboard Information Architecture

docs/29 §5 already locks the module list: Welcome header, Timeline preview (last 3
entries + "View full timeline"), Symptom Tracker card, Reports card, and explicit empty
states for Care Plan / Messages / Digital Twin. The one fact that should shape PA-2's
actual build is **what data is real right now**: the only authenticated data endpoint
that exists today is `get_profile` (IA-2). `ConsultationHistory`, `SymptomLogs`, and
`Reports` are Batches 5D/5E/5F — **not built yet**. So the honest information
architecture for PA-2 is:

- **Real, wired data:** Welcome header (patient name, from `get_profile`).
- **Placeholder cards, not yet wired to any endpoint:** Timeline preview, Symptom
  Tracker, Reports — each renders its card frame and an empty state today, becomes real
  the moment 5D/5E/5F ship, with no shell change needed.
- **Indefinite empty states:** Care Plan, Messages, Digital Twin — no architecture
  exists for any of them (docs/29 §2.2), so their empty state is not "coming soon in the
  next batch," it's "not part of this phase."

That distinction matters for §5 (Empty States) below — a patient who reads "coming
soon" for Timeline and Care Plan in identical wording will reasonably expect both next
week. They shouldn't.

# 2. Navigation Structure

docs/08-NAVIGATION-ARCHITECTURE.md defines the **public marketing nav** only (Home,
Online Consultation, Conditions, Doctors, Resources, Contact) plus a forward reference
to "Patient Login" as a future nav slot — it does not define an **authenticated** nav,
and per docs/29 §13 Batch 5G, "Patient Login" isn't added to primary nav until the very
last batch. That leaves a real gap: once a patient is inside `/my-health-journey/`,
what do they click?

Two existing precedents point in different directions and neither fits by itself:
- `login.html`/`verify.html` deliberately use a **minimal utility shell** (heading +
  card, no header/nav at all) — correct for a single-purpose page, wrong for a
  multi-card home a patient returns to repeatedly.
- `index.html`'s full marketing header (sticky, hamburger menu, mega-nav links to
  Blog/Gallery/Team, "Book Consultation" CTA) is built for acquisition, not for a
  signed-in interior page — it has no sign-out affordance and every link routes back
  to public marketing content.

**Recommendation:** the dashboard shell needs its own small, distinct authenticated
header — not the marketing nav, not the bare utility shell. Minimally: brand mark,
patient's name/greeting, and a sign-out control. No sub-navigation is needed yet for
PA-2 itself, since Timeline/Symptom/Reports are placeholder cards on one page, not
separate routed pages — but the header should be built as the one shared shell every
future Phase 2A page (`/timeline/`, symptom log, etc.) will also use, so it isn't
rebuilt three more times in 5D/5E/5F.

# 3. Authenticated Layout

The session model (docs/29 §3) is a `sessionStorage`-held HMAC token, short-lived
(60 min), no silent renewal, verified server-side on every call. Two things the shell
must get right that PA-1 didn't need to (verify.html only ever makes one call):

- **Presence of a token in `sessionStorage` is not the same as a valid session.** The
  shell must actually call an authenticated endpoint (`get_profile` is already the
  right one) on load and treat a rejected/expired token as "not logged in" — redirect
  to `/login.html`, not render a broken or empty dashboard.
- **A session can expire *while the dashboard is open.*** Because there's no silent
  renewal, a patient who leaves the tab open past 60 minutes and then interacts again
  will have any subsequent call rejected. The shell needs one shared handler for "this
  came back as an invalid/expired session" (distinct from a network-failure error) that
  sends the patient back to `/login.html` with a plain, non-alarming message — not a
  generic error state, and not a silent failure.

Both of these are layout/plumbing concerns, not visual design, but they gate everything
else — this is why item 9 below recommends building the session guard before any card.

# 4. Loading States

docs/04's rule (skeleton, not spinner) is already implemented once —
`verify.html`'s `.skeleton` shimmer block — and should be reused as-is rather than
re-invented. The dashboard shell's loading need is different in shape, though: instead
of one full-page loading state blocking a single action, the shell has multiple
independent regions (welcome header, and later each card) that can resolve at different
times. Each card should own its own skeleton rather than the whole page waiting on the
slowest call — otherwise a slow `get_profile` response blanks a page whose other cards
have no data dependency yet anyway (they're placeholders).

# 5. Empty States

docs/04's pattern (explain what's missing, offer the next action) is already correctly
modeled once, in `verify.html`'s success state ("My Health Journey ... is coming soon").
PA-2 needs this pattern generalized into a real, reusable component, because it will be
used at minimum six times on one page (Timeline, Symptom Tracker, Reports, Care Plan,
Messages, Digital Twin) — and, per item 1, in **two different tones**:

- **Temporary** ("coming in a future update") — Timeline, Symptom Tracker, Reports —
  these have a real batch number attached (5D/5E/5F) even if that number isn't shown to
  the patient.
- **Not-yet-designed / no promised date** — Care Plan, Messages, Digital Twin — docs/29
  §2.2 is explicit that no architecture exists for any of these; the copy should not
  imply an imminent date it can't back up.

# 6. Responsive Behavior

Login and verify are single centered cards (`max-width:480px`), so they've never
needed a breakpoint decision. The dashboard is the first Phase 2A page that is
genuinely multi-card, which means it needs an actual grid-to-stack breakpoint (desktop:
multi-column card grid; mobile: single column) that neither existing page has had to
define yet. docs/05's "Mobile First" and PA-1's own verification discipline (Playwright-
measured, zero horizontal overflow at 375px) should carry forward unchanged as the bar
for this page too — it's a stricter test than either existing Phase 2A page has had
to pass with a multi-card layout.

# 7. Component Reuse Opportunities

Directly reusable, unchanged, from `login.html`/`verify.html`/
`internal/consultation-summary.html`:
- The full `:root` design-token set (still duplicated three times today —
  extracting it into `assets/site.css` is PA-2's own named first step, docs/29 §5/§13,
  not a new decision this review is introducing).
- `.card`, `.status` (ok/err/loading), `.skeleton`/`@keyframes shimmer`,
  `:focus-visible` handling (the corrected version from `login.html`, not
  `internal/consultation-summary.html`'s unfixed `outline:none` — see §8).
- The `fetch()`-with-`text/plain`-no-preflight calling convention and
  response-envelope branching (`data.status`/`data.error.code`/`data.error.message`,
  never an HTTP status).

Reusable with adaptation:
- `index.html`'s `.journey`/`.j-step` vertical-timeline visual — docs/29 §5 already
  names this as the intended pattern for the Timeline preview card once it has real
  data (5D); for PA-2 itself it's only relevant as the shape the eventual populated
  card will take, worth keeping in mind so the empty-state card's dimensions don't
  fight the future real layout.

New, and worth building once as shared components rather than per-card markup:
- A generic **Empty State card** (icon/text/next-action slot), since it's needed
  six times with two tone variants (§5, §1).
- A minimal **authenticated header** (§2), reusable by every later Phase 2A page.

# 8. Accessibility Considerations

WCAG 2.2 AA (docs/14). Three concrete carry-forwards and one net-new concern:

- **Do not reintroduce the focus-visible bug.** PA-1's own build notes record that
  `.field input:focus{outline:none}` — copied originally from
  `internal/consultation-summary.html` — silently defeated keyboard focus visibility,
  and was fixed in `login.html`/`verify.html` but *not* in
  `internal/consultation-summary.html` itself (out of that batch's scope). If any
  dashboard markup is drafted by copying from `internal/consultation-summary.html`
  rather than `login.html`/`verify.html`, this bug will resurface. Copy from the fixed
  pages, not the unfixed one.
- **Skip link.** `index.html` has one (`<a class="skip" href="#main">`); `login.html`
  and `verify.html` don't need one (a single card, no nav to skip past). The dashboard
  shell, once it has a header (§2) plus multiple cards, is back in "needs a skip link"
  territory.
- **Heading hierarchy.** One `h1` for the dashboard title, one `h2` per card — not
  currently a pattern either existing Phase 2A page had to establish (both are
  single-`h1` pages).
- **Sign-out must be a real, keyboard-reachable, labeled control** — not an
  afterthought link, since it's the one authenticated-only action this shell adds that
  neither login nor verify had.

# 9. Which Dashboard Components Should Be Built First

In dependency order, not visual priority:

1. **Session guard** (§3) — calls `get_profile` on load, redirects to `/login.html` on
   any rejection. Nothing else on the page can be trusted to render correctly before
   this exists.
2. **Authenticated header** (§2) — greeting (real data, from the same `get_profile`
   call) + sign-out. This is the only card-like element with *real* data in PA-2, so it
   doubles as the proof that the session guard and data wiring both actually work.
3. **Generic Empty State card component** (§5/§7) — build it once, parameterized by
   tone (temporary vs. indefinite) and copy, then instance it six times rather than
   hand-writing six similar blocks.
4. **Timeline / Symptom Tracker / Reports card frames**, each rendering the Empty State
   component from step 3 — these are the bulk of the page visually but the least new
   logic, since they're placeholders until 5D/5E/5F.
5. **Care Plan / Messages / Digital Twin empty states** — same component, indefinite
   tone, lowest priority since they're least likely to confuse anyone about timing.

# 10. Recommended PA-2 Implementation Sequence

1. **`assets/site.css` extraction** — pull the shared `:root` tokens and
   `.card`/`.status`/`.skeleton`/`:focus-visible`/button rules out of `login.html`,
   `verify.html`, and `internal/consultation-summary.html`'s duplicated `<style>`
   blocks into one file; repoint all three existing pages at it. Doing this *before*
   the dashboard shell exists means the dashboard is the fourth consumer, not the page
   that finally forces the refactor under pressure — and it directly closes docs/20
   §5's long-flagged item.
2. **Session guard** — the `get_profile`-verified redirect-if-invalid check (§3, §9.1),
   built and tested in isolation before any dashboard markup depends on it.
3. **Dashboard shell layout** — authenticated header (§2/§9.2) + responsive card grid
   (§6), served from `/my-health-journey/index.html` (Netlify already serves clean
   directory URLs today — `/online-consultation/` works the same way — so no new
   routing configuration is needed).
4. **Generic Empty State component** (§7/§9.3), then the six card instances (§9.4/§9.5).
5. **Loading-state skeletons** (§4) for the header and any card with a pending future
   data call.
6. **Sign-out control** wired to clear `sessionStorage` and redirect to `/login.html`.
7. **Verification pass** mirroring PA-1's own discipline: Playwright-driven, keyboard-
   real (not simulated) focus checks, 375px no-horizontal-overflow measurement, and a
   confirmed session-expiry redirect path — before calling this batch done, not after.
8. **Documentation** — docs/04 (concrete dashboard-shell component entries, same
   treatment PA-1 gave Login Form/Verify), docs/24-ROADMAP.md (mark 5C shipped, name
   5D next), CHANGELOG.md.

---

# Open Questions Worth Resolving Before Implementation Starts

These are decisions, not defects — flagged here rather than silently assumed one way:

1. **Authenticated header design** (§2) has no existing precedent to copy verbatim,
   unlike everything else in this review. Worth a quick explicit confirmation of scope
   (brand + greeting + sign-out, nothing more for PA-2) before implementation.
2. **Session-expiry-mid-use messaging** (§3) — plain copy, tone to confirm, since
   nothing in docs/04's Error State examples covers "your session ended while you were
   using the page" specifically.
3. **Empty-state copy tone split** (§1/§5, temporary vs. indefinite) — worth confirming
   the two categories and their card assignments match this review before six near-
   identical blocks are written.

None of these require new architecture, new ADRs, or backend changes — they're
copy/UX decisions inside the already-approved docs/29 §5 scope.

---

**This review does not authorize Batch PA-2 to begin.** Per this session's explicit
instruction, implementation waits for separate approval.
