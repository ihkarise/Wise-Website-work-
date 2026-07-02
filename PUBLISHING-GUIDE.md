# Wise Homeopathy — Complete Publishing Guide
### Written for a non-coder. Follow it top to bottom. You will not need to write any code.

---

## What you have

A complete website for **Wise Homeopathy Multispeciality Center**. It is a "static
site" — meaning the pages are pre-built files. There is no separate server program
running, no database, nothing that can be hacked or broken by outsiders. The site
only ever changes when **you** publish a change. That is the safest kind of website
to own.

### The pages
| Page | File | What it's for |
|---|---|---|
| Home / landing | `index.html` | First impression, conditions, how it works, booking |
| Online Consultation | `online-consultation/index.html` | Ranks worldwide; FAQ that AI search engines quote |
| Team | `team.html` | Doctor profiles with photos |
| Blog hub | `blog/index.html` | Lists all articles + newsletter signup |
| One post per article | `blog/<post-name>/index.html` | Each blog post |
| Gallery | `gallery.html` | Clinic photos with click-to-enlarge |
| Contact / Book | `contact.html` | Booking form, WhatsApp, map, hours |
| Thank-you | `thanks.html` | Shown after someone submits a form |

### The supporting files (don't delete these)
| File | What it does |
|---|---|
| `netlify.toml` | Security settings + speed/caching |
| `_redirects` | Forces everyone to `https://www.wisehomeopathy.com` |
| `sitemap.xml` | Tells Google every page that exists |
| `robots.txt` | Lets search engines (and ChatGPT) read the site |
| `assets/` | Your logo, favicon, photos live here |
| `admin/` | Optional no-code blog editor (Part 7) |
| `blog/post-template/` | Copy this to make a new post by hand (Part 6) |

---

## PART 1 — Add your images (do this first)

The site works even with no images (it shows a clean fallback logo and "Add photo"
tiles), but it looks finished once your real files are in. Put these exact files in
these exact folders. **Filenames must match exactly** (all lowercase).

| Put this file… | …in this folder | Size | Format |
|---|---|---|---|
| `logo.svg` | `assets/` | SVG (or PNG 1200×400) | SVG preferred |
| `logo-white.svg` | `assets/` | white version for dark areas | SVG |
| `favicon.ico` | `assets/` | 32×32 / 64×64 | ICO |
| `doctor-libin.jpg` | `assets/images/team/` | 1200×1500 (4:5) | JPG |
| `doctor-dhanya.jpg` | `assets/images/team/` | 1200×1500 (4:5) | JPG |
| `doctor-ansal.jpg` | `assets/images/team/` | 1200×1500 (4:5) | JPG |
| `doctor-merlin.jpg` | `assets/images/team/` | 1200×1500 (4:5) | JPG |
| `clinic-photo-01.jpg` … `06.jpg` | `assets/images/gallery/` | 1600×1200 (4:3) | JPG |

**Tip:** to make an ICO favicon or SVG from a PNG logo, use a free site like
favicon.io or cloudconvert.com. No software to install.

If you don't have a file yet, just skip it — the page keeps working.

---

## PART 2 — Put the site online (the simplest way)

This is "drag and drop." It takes about 3 minutes and needs no technical skill.

1. Make sure all your files are inside one folder called `wise` (they already are).
2. Go to **https://app.netlify.com/drop** in your browser.
3. Create a free Netlify account if asked (sign in with Google — easiest).
4. **Drag the entire `wise` folder** onto the page where it says "Drag and drop."
5. Wait about 30 seconds. Netlify gives you a live link like
   `random-name-12345.netlify.app`. Your site is now on the internet. 🎉

To update the site later with this method: drag the folder again. The new version
replaces the old one. (Part 7 shows a smarter way that auto-updates — optional.)

---

## PART 3 — Connect your real domain (www.wisehomeopathy.com)

Your domain is registered at **GoDaddy**. You'll point it to Netlify.

1. In Netlify, open your site → **Domain settings** → **Add a domain**.
2. Type `wisehomeopathy.com` and confirm you own it.
3. Netlify shows you DNS records (some name/value lines). Keep that tab open.
4. In a new tab, log in to **GoDaddy** → **My Products** → your domain → **DNS**.
5. Add the records Netlify gave you. Usually:
   - An **A record** for `@` pointing to Netlify's IP, and
   - A **CNAME** for `www` pointing to your Netlify address.
   Netlify shows the exact values — copy them in.
6. Save. Changes can take anywhere from a few minutes to a few hours.
7. Back in Netlify, click **Verify**. Once it's connected, turn on
   **HTTPS / SSL** (Netlify does this free, one click). Your padlock 🔒 appears.

The `_redirects` file already forces everyone to the `www.` version with `https`,
which keeps your SEO clean. Nothing to configure there.

> **Note on domain:** the whole site is built for `www.wisehomeopathy.com`. If you
> decide to use `wisehomeopathy.in` instead, tell your developer/assistant to swap
> the domain — it's a quick find-and-replace across the files. Don't run both as
> live sites; pick one so Google doesn't split your ranking.

---

## PART 4 — Turn on the form backend (booking + newsletter)

Your **Contact form** and **newsletter signup** are already built to work with
**Netlify Forms** — this is your "backend" for messages. No setup code needed.

Once the site is deployed on Netlify:
1. Netlify automatically detects the forms (named `consultation` and `newsletter`).
2. Every submission appears in Netlify → your site → **Forms**.
3. To get an **email each time someone books**: Netlify → **Forms** →
   **Form notifications** → **Add notification** → **Email notification** →
   enter `wisehomeopathy@outlook.com`. Done.

Spam is blocked automatically (there's a hidden honeypot field). You don't pay
anything for normal clinic volumes.

---

## PART 5 — Tell Google, Bing and ChatGPT you exist

This is what gets you found. Do it once after the domain is live.

**Google**
1. Go to **Google Search Console** → add `https://www.wisehomeopathy.com`.
2. Verify (Netlify supports the DNS or HTML method — Search Console walks you through).
3. Submit your sitemap: in Search Console → **Sitemaps** → enter `sitemap.xml` → Submit.

**Bing (this also feeds ChatGPT Search & Copilot)**
1. Go to **Bing Webmaster Tools** → add the site → you can import directly from
   Google Search Console in one click.
2. Submit `sitemap.xml` there too.

**IndexNow (faster AI/Bing indexing)** — optional, advanced. Your verification key
is on file (`0e85464a4da62cf9e9a873fdae3226e2`). Ask your assistant to wire it when
you're ready; it speeds up how fast new posts show in Bing/ChatGPT.

**Google Business Profile** — separately, claim/optimize your Google Business
listing with the **exact** same name, address and phone as the footer. This is the
single biggest driver of local "homeopathy near me" visibility.

---

## PART 6 — Publish a new blog post BY HAND (no tools)

Every blog post is one folder. To add one:

1. Open the `blog` folder. **Copy** the `post-template` folder.
2. **Rename** the copy to your post's web address — lowercase, words joined by
   hyphens, include your keyword. Example: `hashimotos-and-chronic-urticaria`.
3. Open the `index.html` inside it. Replace every spot marked **`CHANGE-ME`**
   (title, summary, date, the article text). Instructions are written inside the file.
4. Put your post image (1200×630 JPG) in `assets/images/blog/`.
5. Open `sitemap.xml` and add one line for the new post (copy the example line
   that's already commented in there, change the address).
6. Open `blog/index.html` and add a card linking to your new post so people can
   find it from the blog hub.
7. Re-publish (Part 2 drag-and-drop, or Part 7 auto-publish).

**This is the manual method.** If you'd rather write posts in a dashboard like
Word, set up Part 7 once.

---

## PART 7 — OPTIONAL: the no-code blog dashboard + auto-publishing

This upgrade lets you (a) write blog posts in a friendly editor at
`yoursite.com/admin/`, and (b) have the site rebuild itself automatically when you
publish — no more dragging folders. It needs a one-time setup with a free GitHub
account. If you'd like this, have your assistant do these steps with you:

1. Create a free **GitHub** account. Put the `wise` folder into a GitHub
   "repository" (your assistant can do this in 5 minutes).
2. In Netlify: **Add new site → Import from GitHub →** pick that repository.
   Now every change you save on GitHub auto-publishes.
3. In Netlify: enable **Identity** and **Git Gateway** (Site settings → Identity).
4. Invite **only your own email** as a user. That's your login — no one else can get in.
5. Visit `https://www.wisehomeopathy.com/admin/`, log in, and write posts. Click
   Publish and the live site updates on its own.

The editor files (`admin/index.html` and `admin/config.yml`) are already included
and ready.

---

## PART 8 — Security: what's already handled

You asked for "not too open, not too locked." Here's exactly what's in place, all
automatic:

- **HTTPS / SSL** — encrypted padlock, free, auto-renewing (Netlify).
- **Security headers** — set in `netlify.toml` (stops your site being framed by
  others, blocks content-type tricks, hides referrer data). Balanced, not paranoid.
- **Form spam protection** — hidden honeypot on both forms.
- **No database, no server, no admin password on the public site** — there is simply
  nothing for an attacker to break into. If anyone ever defaced a copy, you re-publish
  and it's instantly back.
- **Editor login (if you do Part 7)** — invite-only, just your email.

You do **not** need antivirus, a firewall, or a security plugin. Static hosting is
secure by design.

---

## Quick "I just want to..." index

- **Change a phone number or text** → open the page's `.html`, find the words, edit
  them, re-publish.
- **Swap a doctor photo** → drop a new JPG with the same filename into
  `assets/images/team/`, re-publish.
- **Add a clinic photo to the gallery** → add a JPG to `assets/images/gallery/` and
  copy one `<figure>` block in `gallery.html`.
- **Set the consultation fee** → open `online-consultation/index.html`, find
  `[ADD FEE]`, replace it.
- **Add a blog post** → Part 6 (by hand) or Part 7 (dashboard).
- **Update the site** → drag the `wise` folder to Netlify again, or save on GitHub
  if you did Part 7.

---

## ASSET CHECKLIST (give this to whoever prepares your images)

| Asset | File name | Size | Format | Where it shows |
|---|---|---|---|---|
| Full-colour logo | assets/logo.svg | SVG (fallback PNG 1200×400) | SVG | Header of every page |
| White logo | assets/logo-white.svg | SVG | SVG | Dark hero/footer areas |
| Favicon | assets/favicon.ico | 32×32 + 64×64 | ICO | Browser tab |
| Hero image | assets/hero-image.jpg | 1920×1080 (16:9) | JPG | Landing hero (optional) |
| Dr. Libin photo | assets/images/team/doctor-libin.jpg | 1200×1500 (4:5) | JPG | Team + Online Consultation |
| Dr. Dhanya photo | assets/images/team/doctor-dhanya.jpg | 1200×1500 (4:5) | JPG | Team |
| Dr. Ansal photo | assets/images/team/doctor-ansal.jpg | 1200×1500 (4:5) | JPG | Team |
| Dr. Merlin photo | assets/images/team/doctor-merlin.jpg | 1200×1500 (4:5) | JPG | Team |
| Clinic photos 1–6 | assets/images/gallery/clinic-photo-01..06.jpg | 1600×1200 (4:3) | JPG | Gallery |
| Blog post images | assets/images/blog/[post-name].jpg | 1200×630 (1.91:1) | JPG | Each blog post |
| OC social image | assets/images/online-consultation-og.jpg | 1200×630 (1.91:1) | JPG | Online Consultation share preview |

---

*Questions while publishing? Keep this guide open and work one Part at a time. The
site is forgiving — you can always re-publish to fix anything.*
