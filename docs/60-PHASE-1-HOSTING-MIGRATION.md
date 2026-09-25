# 60 — Phase 1 Hosting Migration: Netlify → GitLab Pages + Cloudflare
## Version 1.0 — 2026-09-25 · Status: **PLANNED, not yet executed**

> Phase 1 (Public Website) work only. No backend phase is reopened; no
> `apps-script/*.gs`, schema, or registry file is touched. Companion to
> `docs/18-RELEASE-CHECKLIST.md` (the gate this migration must pass) and
> `docs/28-DEPLOYMENT-READINESS.md` (Phase 1.5's separate, already-complete
> operational checklist — **unaffected by this migration**).

---

## 1. Decision

Production serving moves from **Netlify** to **GitLab Pages, with Cloudflare in
front**. Approved by the project owner on 2026-09-25 after review of the
capability gaps in §2.

Cloudflare is **not optional** in this design. It is the only component that
supplies the canonical redirect and the security headers, both of which
GitLab Pages cannot provide and both of which the launch gate requires.

## 2. Why Cloudflare is required (the capability gap)

GitLab Pages cannot replace two things `netlify.toml` and `_redirects` do today.
This was verified against GitLab's own documentation, not assumed.

| Capability | Netlify (today) | GitLab Pages | Consequence |
|---|---|---|---|
| Forced cross-host redirect (apex → `www`) | `_redirects` with `301!` | **Not supported.** `_redirects` is path-level; files take priority over redirect rules, so canonicalization only fires on URLs that 404. The `force` (`!`) flag does not exist. | Without Cloudflare the canonical domain splits again — exactly `WEBSITE-AUDIT.md` finding **C1, "the single biggest SEO problem"** |
| Custom response headers | `netlify.toml` `[[headers]]` | **Not supported per project.** Custom headers are an open feature request; on self-managed they are instance-level admin config only. | HSTS and every security header silently disappear |
| Netlify Forms | 3 forms via `data-netlify="true"` | Does not exist | All 3 public forms stop submitting — see §5 |
| `404.html` at root | Automatic | Automatic | No change needed |
| TLS certificate | Automatic | Automatic (Let's Encrypt) | No change needed |

**Reference:** GitLab Pages redirects documentation, and
`gitlab-org/gitlab-pages` issues #1134 (force/canonicalization) and #50
(custom headers).

## 3. Cutover order (do not deviate)

Netlify keeps serving production until GitLab + Cloudflare is verified. Nothing
is deleted until step 8.

1. **Create the GitLab project** and mirror this repository to it. The
   repository currently lives on GitHub (`ihkarise/Wise-Website-work-`), and
   `.gitlab-ci.yml` **never executes on GitHub** — this step is what makes the
   pipeline run at all. Push mirroring (GitHub → GitLab) keeps GitHub as the
   place work happens.
2. **Confirm the `pages` job succeeds** and the artifact contains `index.html`,
   `404.html` and `sitemap.xml`. The job asserts all three (see
   `.gitlab-ci.yml`), so a missing file fails the pipeline rather than shipping
   a broken site.
3. **Verify the site on the GitLab Pages default domain** before any DNS change.
   Every page, the mobile nav, the legal pages, the gallery lightbox.
4. **Add Cloudflare** for `wisehomeopathy.com`: change the nameservers at the
   registrar to Cloudflare's, and let Cloudflare import existing DNS.
5. **Point DNS at GitLab Pages** and complete GitLab's custom-domain
   verification (a `TXT` record GitLab supplies, plus the `A`/`CNAME` records
   for apex and `www`). Set the Cloudflare records to **Proxied** — the rules in
   §4 only run on proxied traffic.
6. **Apply the Cloudflare rules in §4**, then re-verify §6's checks.
7. **Migrate the forms** per §5 and submit one real test through each.
8. **Only then** delete `netlify.toml` and `_redirects`, and disconnect the
   Netlify project (`dreamy-duckanoo-70dcc9`). Deleting them earlier removes the
   headers and canonical redirect from the site that is still live.

**Rollback at any point before step 8:** revert DNS to Netlify. Netlify's
configuration is still in the repository and still connected, so rollback is a
DNS change, not a rebuild.

## 4. Cloudflare configuration

Canonical host is **`https://www.wisehomeopathy.com`** — the host every
`rel="canonical"` tag and every `sitemap.xml` entry already declares. Do not
change the direction; it would invalidate both.

### 4.1 Canonical redirect (replaces `_redirects`)

**Rules → Redirect Rules**, or **Bulk Redirects** for an exact-match list.
A single dynamic rule covers every case:

- **If** hostname does not equal `www.wisehomeopathy.com`
- **Then** Static/Dynamic redirect to
  `concat("https://www.wisehomeopathy.com", http.request.uri.path)`
- **Status** 301, **preserve query string** enabled

This must cover `wisehomeopathy.com`, `http://` for both hosts, and — once
`wisehomeopathy.in` is pointed here — that domain too (see §7).

### 4.2 Security headers (replaces `netlify.toml` `[[headers]]`)

**Rules → Transform Rules → Modify Response Header**, one rule, all requests.
These values are copied verbatim from the current `netlify.toml`; do not
weaken them:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

HSTS can alternatively be enabled under **SSL/TLS → Edge Certificates → HSTS**.
Enable it only after §6 confirms HTTPS is correct on every hostname — HSTS is
cached by browsers for a year and is painful to unwind.

### 4.3 Caching (replaces the `/assets/*` cache header)

**Caching → Cache Rules**: for URI path starting with `/assets/`, set Edge TTL
and Browser TTL to **7 days** (604800s), matching today's
`Cache-Control: public, max-age=604800`.

## 5. Forms migration

All three forms currently depend on Netlify Forms and **will silently stop
working** the moment Netlify stops serving:

| Form | File | `name` |
|---|---|---|
| Consultation request | `contact.html` | `consultation` |
| Blog booking | `blog/index.html` | `blog-consultation` |
| Newsletter | `blog/index.html` | `newsletter` |

Approved replacement: a **third-party form endpoint** (Formspree / Web3Forms).
Chosen over adding dispatch cases to `FoundationRouter.gs` specifically to avoid
reopening frozen Phase 2/3 backend.

Per form, the change is small and local:
- Replace `data-netlify="true"` and `netlify-honeypot="bot-field"` with the
  provider's `action` URL and its own honeypot field name.
- Keep `method="POST"`, every existing field `name`, and the existing
  `action=` success page (`booking-received.html` / `thanks.html`) as the
  provider's redirect target, so the thank-you flow is unchanged.

Two things to settle before this is wired up:
- **Privacy policy.** Patient-submitted symptom detail would transit a third
  party. `privacy.html` currently describes no such processor. It needs a line
  naming the provider and its role, and that is a content/compliance decision,
  not a code change.
- **Note on the blog forms.** Two of the three live on `blog/index.html`, which
  is currently unlinked and `noindex` pending the blog launch decision. Only
  `contact.html`'s form is reachable by a patient today, so it is the one that
  must be verified before launch.

## 6. Verification (run against production, after step 6 and again after step 8)

```
# canonical + HTTPS: each must land on https://www.wisehomeopathy.com with one 301
curl -sSI http://wisehomeopathy.com/        | grep -Ei 'HTTP/|^location'
curl -sSI https://wisehomeopathy.com/       | grep -Ei 'HTTP/|^location'
curl -sSI http://www.wisehomeopathy.com/    | grep -Ei 'HTTP/|^location'
curl -sSI https://www.wisehomeopathy.com/   | grep -Ei 'HTTP/'

# security headers present on the canonical host
curl -sSI https://www.wisehomeopathy.com/ | grep -Ei 'strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'

# asset caching
curl -sSI https://www.wisehomeopathy.com/assets/site.css | grep -i cache-control

# 404 must return status 404, not 200
curl -sSI https://www.wisehomeopathy.com/no-such-page | head -1

# every sitemap URL must return 200
curl -s https://www.wisehomeopathy.com/sitemap.xml \
  | grep -oE 'https://[^<]+' \
  | while read -r u; do printf '%s %s\n' "$(curl -so /dev/null -w '%{http_code}' "$u")" "$u"; done
```

Then re-run Lighthouse against production on all 10 public pages.
`docs/16-PERFORMANCE-STANDARDS.md` targets 95+. The only Lighthouse evidence on
record is a Netlify deploy preview of the **homepage only**, measured with **no
images present** — it is not a production baseline and must not be treated as one.

## 7. Second domain

`wisehomeopathy.in` is live and indexed; `wisehomeopathy.com` is not indexed.
Approved handling: **301 `.in` → `.com`**, to consolidate existing search
authority onto the canonical domain. Once `.in` is on the same Cloudflare
account, §4.1's rule covers it; otherwise it needs its own redirect at
whatever currently serves `.in`.

## 8. What this migration does not change

- `apps-script/` and the Apps Script Web App `/exec` endpoint — the patient
  portal, doctor dashboard and Phase 1.5 consultation-summary pipeline all keep
  calling the same URL and are unaffected by where static files are served from.
- Phase 1.5's operational status per `docs/28`. That deployment lives in Google
  Apps Script, not in the web host.
- Any page's markup, styling, navigation, canonical tag or structured data.

## 9. Open items before this document can move to EXECUTED

- [ ] GitLab project created and mirroring from GitHub
- [ ] `pages` pipeline green, artifact asserts passing
- [ ] Cloudflare active for `wisehomeopathy.com`
- [ ] §4.1 canonical redirect rule live and verified
- [ ] §4.2 header rule live and verified
- [ ] §4.3 cache rule live and verified
- [ ] Forms endpoint provisioned, all 3 forms migrated, one real submission
      received per form
- [ ] `privacy.html` updated to name the form processor
- [ ] §6 verification passing end to end
- [ ] `netlify.toml` and `_redirects` deleted, Netlify project disconnected
- [ ] `wisehomeopathy.in` → `.com` 301 in place
