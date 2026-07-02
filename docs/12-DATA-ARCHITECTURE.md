# Wise Homeopathy Data Architecture
## Version 2.0

Purpose: Define how data flows across the website and future patient ecosystem.

## Principles
- Single source of truth
- Minimal data collection
- Patient-owned journey
- Google Sheets as primary datastore
- Google Apps Script as backend API

## Phase 1
Public website:
- Contact forms
- Consultation requests
- Newsletter
- Analytics

## Phase 2
Patient records:
- Patient ID
- Timeline
- Personal Care Plan
- Symptom Tracker
- AI Summaries

## Data Flow
Website → Apps Script → Google Sheets → AI (when needed) → Patient View

## Future
Design for migration to SQL without changing frontend APIs.
