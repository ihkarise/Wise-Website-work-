# Wise Homeopathy Phase 2 Architecture
## Version 2.0

> Blueprint for the patient ecosystem.

# Vision

Transform the relationship from single consultation to continuous digital care.

---

# Entry Point

Only verified patients receive access.

Authentication options:

- Patient ID + Password
or
- Mobile OTP

No public registration.

---

# Core Modules

## My Health Journey

Patient home.

Contains:

- Welcome
- Today's Care Plan
- Health Timeline
- Symptom Tracker
- Messages
- Follow-up

---

## Personal Care Plan

Displays:

- Current goals
- Medicines
- Lifestyle guidance
- Doctor instructions
- Next review

---

## Wise Digital Twin

AI-generated summary of the patient's journey.

Includes:

- Timeline
- Progress
- Consultation summaries
- Investigation history
- Symptom trends

AI organizes information only.
Doctors remain responsible for clinical decisions.

---

## Symptom Tracker

Patient logs:

- Severity
- Sleep
- Energy
- Stress
- Notes

Stored in Google Sheets.

---

## AI Summary

Converts doctor notes into patient-friendly updates.

No diagnosis.
No prescriptions.
No treatment changes.

---

# Doctor Workflow

Consultation
→ Notes
→ Google Sheets
→ AI Summary
→ Patient Timeline

---

# Technology

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Google Apps Script

Storage:
- Google Sheets

Hosting:
- Netlify

AI:
- OpenRouter

---

# Security

- Private patient records
- Role-based access
- Audit logs
- HTTPS
- Least-privilege access

---

# Roadmap

Phase 2A
- Login
- My Health Journey

Phase 2B
- Personal Care Plan
- Symptom Tracker

Phase 2C
- Wise Digital Twin
- AI Summaries

Phase 2D
- Advanced analytics and reminders
