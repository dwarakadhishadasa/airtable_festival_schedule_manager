# Festival & Event Schedule Manager

An Airtable extension for non-profits, religious organizations (temples, churches, mosques, gurudwaras), and community groups to plan, view, and distribute event schedules. Turn your Airtable base into a polished schedule board with one-click PDF exports.

---

## Features

| Feature | Description |
|---|---|
| **Schedule View** | Date-grouped activity schedule with categories, locations, and timings |
| **Service List View** | Service-by-service breakdown showing coordinators, team members, and standbys |
| **Member-wise Service Allocation** | Per-member view of all assigned services with role badges (Coordinator / Team Member / Standby) |
| **PDF Export** | Download any view as a print-ready PDF with your organization's header image |
| **Full Report** | Combine all three sections into a single PDF, optionally attaching image pages |
| **Header Image** | Upload your organization's logo or banner — stored in GlobalConfig and embedded in all PDFs |
| **Live Sync** | Data updates in real time via Airtable's `useRecords` hook — no manual refresh needed |
| **Filter & Search** | Search by member name, filter by member type, and toggle Assigned / Unassigned status |

---

## Required Base Structure

The extension looks for **three specific table names**. The tables must exist with the field names listed below. Field types are indicated in parentheses.

### Table 1: `Activities`
The main event schedule.

| Field | Type | Notes |
|---|---|---|
| `Date` | Date or Text | e.g. `2025-01-15` or `15 Jan 2025` |
| `Category` | Single line text | Used to group rows (e.g. `Morning Program`, `Evening Program`) |
| `Activity` | Single line text | Name of the activity |
| `From` | Single line text | Start time, used for sorting (e.g. `08:00`) |
| `To` | Single line text | End time (optional) |
| `Location` | Single line text | Venue or hall (optional) |
| `Timings` | Single line text | Display timing string (e.g. `8:00 AM - 9:30 AM`) |
| `Select` | Checkbox | If checked, the row is highlighted in red in the PDF |

### Table 2: `Services`
The service allocation list.

| Field | Type | Notes |
|---|---|---|
| `Date` | Date or Text | Date of the service |
| `Category` | Single line text | Groups services (e.g. `Prasad`, `Security`) |
| `Service` | Single line text | Name of the service |
| `Timings` | Single line text | Display timing string |
| `Coordinator` | Linked record (→ Team Members) | One or more coordinators |
| `Team Members` | Linked record (→ Team Members) | Team members assigned |
| `Standby` | Linked record (→ Team Members) | Standby members (optional) |
| `Select` | Checkbox | Highlights the row in red if checked |

### Table 3: `Team Members`
The roster of volunteers or staff.

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text | Full name of the member |
| `Type` | Single select or text | Member category (e.g. `FTM`, `PTM`, `Staff`) — used for filtering |
| `Coordinator` | Linked record (→ Services) | Services where this member is coordinator |
| `Team Member` | Linked record (→ Services) | Services where this member is a team member |
| `Standby` | Linked record (→ Services) | Services where this member is on standby |

> **Tip:** The `Coordinator`, `Team Member`, and `Standby` fields in `Team Members` are the reverse-linked fields of the corresponding fields in `Services`. Airtable creates these automatically when you set up the link.

---

## Setup

1. Install the extension from the Airtable Marketplace into your base.
2. Make sure your base has the three tables named exactly as above.
3. The extension will display a clear error message if any table is missing.
4. Open **Settings** to:
   - Customize the PDF report titles for each view
   - Upload a header image (logo/banner) to embed in PDFs — keep under 140 kB

---

## Settings

All settings are stored in Airtable GlobalConfig (shared across all users of the extension in the base).

| Setting | Default | Description |
|---|---|---|
| Schedule PDF Title | `<BASE NAME> - SCHEDULE` | Title printed at the top of the Schedule PDF |
| Service List PDF Title | `<BASE NAME> - SERVICE LIST` | Title for the Service List PDF |
| Member-wise PDF Title | `<BASE NAME> - MEMBER-WISE SERVICES` | Title for the Member Allocation PDF |
| Header Image | None | Organization logo/banner embedded at the top of PDFs |

---

## PDF Export

- **Download PDF** — exports the currently active view (Schedule, Service List, or Member-wise).
- **Full Report** — opens a dialog to select which sections to include and optionally attach image pages (e.g. posters, maps). All sections are combined into one PDF file.

PDF generation uses [pdfmake](http://pdfmake.org/) and runs entirely in the browser — no data leaves Airtable.

---

## Screenshots

> Place screenshots in `extension/screenshots/` before submitting to the Marketplace.

| Filename | What to capture |
|---|---|
| `01-schedule-view.png` | Schedule tab with date groups and category headers visible |
| `02-service-list.png` | Service List tab showing coordinator and team columns |
| `03-member-allocation.png` | Member-wise tab with search/filter toolbar and assignment rows |
| `04-full-report-modal.png` | Full Report dialog open with section checkboxes |
| `05-settings-panel.png` | Settings panel showing PDF title fields and header image upload |
| `06-pdf-preview.png` | A generated PDF open in the browser (Schedule or Full Report) |

Recommended size: **1920 × 1080** or **1280 × 800**, PNG format, max 5 MB each.

---

## Permissions

This extension requires the following Airtable permissions:

- **Read** records from `Activities`, `Services`, and `Team Members` tables
- **Write** to GlobalConfig (to store PDF titles and header image)

No data is sent to any external server. PDF generation is entirely client-side.

---

## Compatibility

- Requires Airtable **Pro** plan or above (for Extensions support)
- Works in all modern browsers (Chrome, Firefox, Edge, Safari)
- Mobile-friendly layout; PDF download may vary on mobile browsers

---

## Changelog

### v1.0.0
- Initial marketplace release
- Schedule, Service List, and Member-wise Service Allocation views
- PDF export with custom titles and header image
- Full Report with optional image attachments
- Live data sync via Airtable SDK
