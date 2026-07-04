# Wise Homeopathy Navigation Architecture
## Version 2.0

> Defines how users move through the website.

# Navigation Philosophy

Navigation should follow patient intent, not organizational structure.

Every click should naturally lead to the next helpful step.

---

# Primary Navigation

- Home
- Conditions
- Online Consultation
- Doctors
- Resources
- Contact

Patient Login is a separate action link, live in primary nav since Batch PA-6
(docs/29 §13 Batch 5G), pointing to `/login.html`. It sits last, immediately
before the Book Now/Book Consultation CTA — a plain nav link, deliberately not
styled as the accent CTA, so it reads as a distinct action rather than a
second "book" button.

---

# Resources Menu

- Articles
- FAQs
- Downloads
- Research
- Gallery

---

# Footer Navigation

## Explore
- Home
- Conditions
- Doctors

## Services
- Online Consultation
- Contact

## Learn
- Articles
- FAQs
- Downloads

## Legal
- Privacy
- Terms
- Disclaimer

---

# User Journeys

## New Visitor

Google
→ Homepage
→ Condition
→ Doctor
→ Consultation
→ Booking

## International Patient

Search
→ Online Consultation
→ FAQ
→ Booking

## Existing Patient

Homepage
→ Patient Login
→ My Health Journey

---

# Internal Linking

Every page should include:

- Related Conditions
- Related Articles
- Related FAQs
- Meet the Doctor
- Book Consultation

No orphan pages.

---

# Floating Page Guide

For long pages:

- Overview
- Symptoms
- Treatment
- FAQ
- Research
- Book Consultation

Desktop: sticky side panel

Mobile: expandable bottom button

---

# Breadcrumbs

Home → Section → Page

Use Breadcrumb schema.

---

# Mobile Navigation

- Single-level drawer
- Thumb-friendly spacing
- Persistent access to Book Consultation

---

# Success Metrics

- Fewer dead ends
- Higher page depth
- Better conversion
- Lower bounce rate
