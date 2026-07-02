# Wise Homeopathy Website — Netlify Package

Drag this entire folder into https://app.netlify.com/drop (or connect via Git).
Everything works immediately; missing images show safe fallbacks until you add them.

## Folder structure
```
/                      index.html (landing), team.html, gallery.html, thanks.html
/blog/                 index.html (blog hub) + one folder per post
/blog/post-template/   copy this folder to publish a new post (instructions inside)
/assets/               logo, favicon, hero image
/assets/images/team/   doctor photos
/assets/images/gallery/  clinic photos
/assets/images/blog/   one image per blog post
netlify.toml           security headers + caching
_redirects             forces https://www.wisehomeopathy.com
sitemap.xml, robots.txt
```

## Publishing a new blog post (no coding)
1. Copy `/blog/post-template/` → rename to your keyword URL (e.g. `hashimotos-csu-connection`)
2. Replace every `CHANGE-ME` in its index.html
3. Add post image (1200×630 JPG) to `/assets/images/blog/`
4. Add the URL to `sitemap.xml` and a card on `/blog/index.html`
5. Re-deploy (drag folder again, or git push)

## Newsletter
The "Weekly root-cause insights" form on the blog page uses Netlify Forms —
submissions appear in Netlify dashboard → Forms. Add email notifications there.

## Security (already done)
- HTTPS automatic (Netlify SSL)
- Security headers in netlify.toml
- Honeypot spam protection on forms
- Static site = no database, no server, nothing to hack

## ASSET CHECKLIST
| Asset Name | File Name | Recommended Size | Format | Placement Location |
|---|---|---|---|---|
| Full-colour logo | assets/logo.svg | SVG (fallback PNG 1200×400) | SVG | Header of every page; watermark backgrounds |
| White logo | assets/logo-white.svg | SVG (fallback PNG 1200×400) | SVG | Dark footer/CTA sections (future use) |
| Favicon | assets/favicon.ico | 32×32 + 64×64 | ICO | Browser tab, all pages |
| Hero image | assets/hero-image.jpg | 1920×1080 (16:9) | JPG | Landing page hero (optional slot) |
| Dr. Libin photo | assets/images/team/doctor-libin.jpg | 1200×1500 (4:5) | JPG | team.html — Chief Physician card |
| Dr. Dhanya photo | assets/images/team/doctor-dhanya.jpg | 1200×1500 (4:5) | JPG | team.html — Psychologist card |
| Dr. Ansal photo | assets/images/team/doctor-ansal.jpg | 1200×1500 (4:5) | JPG | team.html — Junior Doctor card |
| Dr. Merlin photo | assets/images/team/doctor-merlin.jpg | 1200×1500 (4:5) | JPG | team.html — Digital Team Manager card |
| Clinic photo 1 | assets/images/gallery/clinic-photo-01.jpg | 1600×1200 (4:3) | JPG | gallery.html — Reception |
| Clinic photo 2 | assets/images/gallery/clinic-photo-02.jpg | 1600×1200 (4:3) | JPG | gallery.html — Consultation room |
| Clinic photo 3 | assets/images/gallery/clinic-photo-03.jpg | 1600×1200 (4:3) | JPG | gallery.html — Dispensary |
| Clinic photo 4 | assets/images/gallery/clinic-photo-04.jpg | 1600×1200 (4:3) | JPG | gallery.html — Dr. Libin in consultation |
| Clinic photo 5 | assets/images/gallery/clinic-photo-05.jpg | 1600×1200 (4:3) | JPG | gallery.html — Team |
| Clinic photo 6 | assets/images/gallery/clinic-photo-06.jpg | 1600×1200 (4:3) | JPG | gallery.html — Online consultations |
| Blog post images | assets/images/blog/[post-name].jpg | 1200×630 (1.91:1) | JPG | Each blog post hero + social preview |
| OC social image | assets/images/online-consultation-og.jpg | 1200×630 (1.91:1) | JPG | Online Consultation — social share preview |
