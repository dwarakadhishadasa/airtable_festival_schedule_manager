# PDFForge for Airtable

Turn any Airtable base into polished, print-ready PDFs. Configure multiple views over any of your tables — grouped schedules, assignment lists, per-person breakdowns — and export with one click.

Built for festivals, conferences, religious events, community organizations, and any team that manages schedules in Airtable.

---

## Features

| Feature | Description |
|---|---|
| **Multiple tabs** | Configure any number of views, each pointing to a different table |
| **Grouped Table view** | Records grouped by 1–2 fields (e.g., by Date then Category) with sortable columns |
| **Linked Per Item view** | Per-person/per-item card showing all linked records from another table |
| **Stacked columns** | Stack multiple fields within a single column cell (e.g., name + timing badge) |
| **Highlight badge** | Display any text value as an amber badge — useful for timings, statuses, labels |
| **Row highlight** | Checkbox field marks the entire row in red — for flagging important entries |
| **Font controls** | Per-column and per-stacked-field font size and weight override |
| **PDF export** | Download any tab as a print-ready PDF |
| **Full report** | Combine selected tabs into one PDF, with optional attached image pages |
| **Header image** | Upload your organization logo or banner — embedded in all PDFs |
| **Search & filter** | (Linked Per Item) Search by name, filter by type, toggle Assigned/Unassigned |
| **Live sync** | Data refreshes in real time via Airtable's `useRecords` hook |

---

## Quick Start

1. Install PDFForge from the Airtable Marketplace into your base.
2. Click **Settings** (gear icon) to open the configuration panel.
3. Click **+ Add View** to configure your first tab.
4. Choose a view type, select your table, and configure columns.
5. Click **Save** — your view appears as a tab in the main screen.
6. Click **Download PDF** to export the current tab, or **Full Report** to combine multiple tabs.

---

## View Types

### Grouped Table

Displays records from a single table, optionally grouped by one or two fields.

**Use for:** schedules, service lists, event programs, run-of-show documents.

**Configuration options:**

| Option | Description |
|---|---|
| Table | Which Airtable table to read records from |
| Primary Group Field | Field to group records by (e.g., `Date`). Leave blank for no grouping. |
| Secondary Group Field | Second-level grouping within each primary group (e.g., `Category`). Optional. |
| Sort Field | Field to sort records within each group (e.g., `Start Time`). Optional. |
| Columns | List of columns to display (see [Column Configuration](#column-configuration)) |

**Example:** A festival schedule grouped by `Date` → `Session`, sorted by `Start Time`, with columns for Activity, Location, and Timing.

---

### Linked Per Item

Displays records from a **primary table** (e.g., team members), with each card showing their linked records from a **detail table** (e.g., services assigned to that member).

**Use for:** volunteer allocation sheets, speaker schedules, staff assignment lists.

**Configuration options:**

| Option | Description |
|---|---|
| Primary Table | Table whose records become the cards (e.g., `Team Members`) |
| Name Field | Field in the primary table used as the card heading |
| Type Field | Optional field for the type filter dropdown (e.g., `Role`, `Department`) |
| Detail Table | Table linked from the primary table (e.g., `Services`) |
| Link Fields | One or more linked-record fields in the primary table pointing to the detail table. Each gets a label (e.g., `Coordinator`, `Team Member`). |
| Detail Sort Field | Field in the detail table to sort rows by (e.g., `Start Time`) |
| Detail Group By Field | Optional field in the detail table to group rows within each card (e.g., `Category`) |
| Detail Columns | Columns shown in each card's table (see [Column Configuration](#column-configuration)) |

**Example:** `Team Members` primary table, linked to `Services` via three fields (`Coordinator`, `Team Member`, `Standby`). Each person's card shows a table of their assigned services with role badge, service name, and timing.

---

## Column Configuration

Both view types share a similar column editor.

| Option | Description |
|---|---|
| Field | Which Airtable field to display |
| Label | Column header text |
| Display as | How to render the field value (see [Display Treatments](#display-treatments)) |
| Alignment | Left / Center / Right |
| Width | Relative width weight (e.g., `2` is twice as wide as `1`) |
| Font size | Override the default font size in pixels. Leave blank to use the default. |
| Font weight | Normal or Bold |
| Show field name as prefix | (Linked Per Item only) Prepends the field name inline before the value |
| Stacked fields | Additional fields rendered below the primary value in the same cell |

### Display Treatments

| Treatment | Description |
|---|---|
| **Text** | Plain string value |
| **Linked Names** | Comma-joined names from a linked-record field |
| **Highlight** | Renders the value as an amber badge — ideal for timings, statuses, labels |
| **Row Highlight (checkbox)** | (Grouped Table only) Checkbox field that marks the entire row in red. Not shown as a visible column. |
| **Link Label** | (Linked Per Item stacked fields) Renders the link field's label (e.g., `Coordinator`) as a badge instead of a data field |

### Stacked Fields

Each column can have multiple stacked fields displayed below the primary value in the same cell. This is useful for combining related data — for example:

- Primary: service name (Text)
- Stacked 1: timing badge (Highlight)
- Stacked 2: location (Text, smaller font)

Stacked fields have their own Display as, Font size, Font weight, and (for Linked Per Item) Show field name as prefix settings.

---

## Header Image

Upload your organization's logo or banner in Settings. It is stored in Airtable GlobalConfig and embedded at the top of all PDFs.

- Recommended: PNG or JPEG, landscape orientation, max **140 kB** (the extension enforces this limit)
- The image is shared across all users of the extension in the base

---

## PDF Export

### Download PDF
Exports the currently active tab as a standalone PDF.

### Full Report
Opens a dialog where you can:
- Select which tabs to include
- Attach additional image pages (e.g., posters, maps, flyers)
- Download a single combined PDF

PDF generation uses [pdfmake](http://pdfmake.org/) and runs entirely in the browser. No data leaves Airtable.

---

## Screenshots

> Place screenshots in `pdf_forge/screenshots/` before submitting to the Marketplace.

| Filename | What to capture |
|---|---|
| `01-tabs-overview.png` | Main view with multiple tabs visible in the tab bar |
| `02-grouped-table.png` | Grouped Table view with date/category headers and rows |
| `03-linked-per-item.png` | Linked Per Item view with search toolbar and assignment cards |
| `04-settings-panel.png` | Settings panel showing the views list and Add View button |
| `05-column-editor.png` | Column card editor with stacked fields and font controls visible |
| `06-pdf-export.png` | Full Report dialog or a generated PDF open in browser |

Recommended size: **1920 × 1080** or **1280 × 800**, PNG format, max 5 MB each.

---

## Permissions

| Permission | Reason |
|---|---|
| Read records | Reads from whichever tables you configure in your views |
| Write GlobalConfig | Stores view configurations and header image |

No data is sent to any external server. All processing is client-side.

---

## Compatibility

- Requires Airtable **Team** plan or above (Extensions support)
- Works in all modern browsers (Chrome, Firefox, Edge, Safari)
- PDF download on mobile may vary by browser

---

## Changelog

### v1.0
- Generic multi-tab architecture — configure views over any table
- Grouped Table view with primary and secondary grouping
- Linked Per Item view with multi-link-field support
- Multi-level stacked fields per column
- Per-field font size and weight controls
- Highlight badge treatment for any text field
- Row highlight via checkbox field
- Full Report with image attachment pages
- Header image stored in GlobalConfig
