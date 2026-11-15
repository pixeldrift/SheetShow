# SheetShow

SheetShow is a browser-based variable-data design and print tool. Create an individual item, connect its content to spreadsheet fields, arrange copies on a physical page, and preview the result across records.

## Current foundation

- React + TypeScript + Vite
- CSV and TSV data import
- PNG, JPG/JPEG, and SVG artwork import
- PDF artwork import (first page rasterized at high resolution)
- Inch-based document dimensions (96 CSS pixels per inch internally)
- Template canvas with text and shape objects
- Drag a data field onto the canvas to create a bound text object
- Select a text object and click a field to bind or replace its data source
- Live record preview and record navigation
- Page layout with repeated-record and sequential-record modes
- Rotation (drag the handle, Shift or Snap for 15° steps) and auto-scaling text/images to their box
- Resize handles, multi-select (shift-click or box-select), align and distribute
- Multi-line, wrapping text with Google Fonts, installed fonts (Chromium) or any typed font name
- Data table: edit cells in place, paste from a spreadsheet, add/rename/sort columns, and choose which records print (checkboxes, range select, “only these”)
- Text that stays readable and fits: outline, shrink-to-fit (box or one line) with a minimum size, truncate with “…”, and a text-fit audit
- Alternating templates (“odd/even”, every n-th, or by a field’s value) combined into one output, with output sorting by any field
- Override mode on the printed sheets: change a name, drop in a different photo or restyle one item for a single record. Overridden records are flagged and can be switched back to the template
- Web pictures are checked before printing and can be saved into the library
- Printer calibration: nudge the whole page in thousandths of an inch, save named printer settings on this device, and print a calibration sheet
- Template gallery (File menu → New from template…) with live thumbnails; drop your own `.json` projects into `src/templates/` to add more
- Groups: select several objects and group them (Ctrl/⌘+G). A group moves, turns, resizes (text included), aligns and copies as one; Alt-click or double-click picks a single member; collapsible rows in Layers
- Conditional objects: show, hide or restyle any object by rule (e.g. a ribbon only for VIPs, a symbol by meal choice), with AND / OR / NOT conditions
- Merge fields inside text in double braces, e.g. `{{city}}, {{state}} {{zip}}` or `${{price}}`, with conditions (`{{?title}}, {{title}}{{/}}`, `=`, `!=`, `contains`, `starts`, `ends`, `and`/`or`, `{{else}}`) and automatic space tidying
- Sortable, movable data columns (click a heading to sort, click again to reverse, drag to reorder); tracking and pair-kerning controls for text
- A token-aware text editor: `{{tokens}}` show as chips (the one under the caret turns into editable text) or as colour-coded plain text, switchable from a corner icon
- Double-tap a text object to edit it right on the canvas (linked text switches to its `{{field}}` tokens while you edit)
- Movable, dockable tool palettes (edit, align, arrange) and stacking-order shortcuts (Ctrl/⌘+[ and ])
- One full sheet per record ("return address page for everyone in the class")
- Scrubbable number fields (drag a label), stepper arrows, corner radius by % or px with per-corner values, text boxes and photo placeholders
- One undo history for everything, an alignment bar on the canvas, a records drawer with a live linked-data preview, and a field-names view
- Importing data asks whether to replace, add to, or merge (with duplicate removal and column matching)
- Help dialog (user guide in `src/help/help.md`)
- Picture library with drag-and-drop, folder and zip import; data-driven pictures matched from a column or filename pattern
- Import a new CSV/TSV and auto-match its columns to the template's linked fields
- Autosave in the browser, plus save/open project files
- Drag fields onto the design with mouse, pen or touch (long-press)
- Crop marks in the page margins and printing of every sheet
- Browser print support (use “Save as PDF” in the print dialog for a PDF)

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Source layout

```
src/App.tsx              state + wiring (document, per-workspace view state, shortcuts, print)
src/components/Viewport  pan / pinch / wheel zoom, rulers, guides (page is centred; pan 0,0 = centred)
src/components/*Stage    template editor (SVG) and page layout (true physical slot positions)
src/components/Inspector properties, layers, template + page setup
src/lib, src/hooks       presets and data helpers, undo/redo history
```

Shortcuts: Ctrl/⌘ + Z / Shift+Z undo/redo, C / X / V / D copy, cut, paste, duplicate; arrows nudge (Shift = 0.1″); Delete removes.

## Product architecture

The application keeps three concepts separate:

1. **Data source** — imported records and their fields.
2. **Template** — the design of one printed item.
3. **Page layout** — how instances of the template are arranged on physical sheets.

The initial CSV/TSV adapter is intentionally replaceable. Future data adapters can expose hierarchical BirdBox entities and relationships without coupling the editor to BirdBox.

## Importing data

- **File:** a CSV or TSV, from the Data tab or the Fields drawer.
- **Paste:** copy cells in Google Sheets, Excel or Numbers and paste them into the Paste data box. Tabs, commas, semicolons and bars are detected, and the first row is treated as the column names (switchable).
- **Google Sheets by address:** a sheet shared as “anyone with the link can view” is read directly. A private sheet can be read after “Sign in with Google”, which asks for **read-only** access (`spreadsheets.readonly`) and keeps the token in memory only.

All three finish with the same choice: replace your records, add to them, or merge without duplicates.

### Enabling “Sign in with Google” (optional)

The button only appears when the build has an OAuth client ID:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project and enable the **Google Sheets API**.
2. Under *OAuth consent screen*, set it up (External). While it is in *Testing*, add the Google accounts that should be allowed as test users. Making it public for everyone needs Google’s verification, because the Sheets scope is a sensitive one.
3. Under *Credentials*, create an **OAuth client ID** of type *Web application* and add the site as an authorized JavaScript origin (for example `https://pixeldrift.github.io`, and `http://localhost:5173` for development).
4. Give the client ID to the build: set it as the repository variable `VITE_GOOGLE_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables) for the Pages deploy, or put `VITE_GOOGLE_CLIENT_ID=…` in a local `.env.local` file.

Without a client ID, private sheets can still be brought in by copying the cells and pasting them.

## Roadmap

- [x] App foundation and visual workspace
- [x] CSV/TSV import and field binding
- [x] Inch-based template canvas
- [x] Record preview and page layout modes
- [x] Editable data table with per-record include/exclude
- [x] Column mapping when importing a new data file
- [x] **Variable images**
  - [x] Image library: drop / browse / folder / zip / multi-select (stored in the browser), download all as a ZIP
  - [x] Picture objects bound to a column or a filename/URL pattern, with `{{field|transform}}` variables and `||` fallbacks
  - [x] Exact → normalised → fuzzy matching, a match-review screen with manual overrides, placeholder picture
  - [x] Web sources via URL patterns (hotlinked, falling back to library pictures if a download fails)
  - [x] Project bundle (.zip) that carries the pictures; pre-print warning for pictures with no match
  - [x] Download web pictures into the library (when the site allows it) and a print-time check that every web picture loads
  - [ ] Focus-point cropping, picture thumbnails in the data table
- [x] Corner radius (circles), frames, opacity, drop shadow and glow on pictures and shapes (shadow and opacity on text too)
- [x] Text outline, overflow policies (shrink / truncate), and a text-fit audit
- [x] Alternating templates and rule-based assignment; sort output by a field
- [x] Per-record overrides on the page layout, with flags and revert
- [ ] Scannable codes (QR, Code 128) generated from data fields
- [x] Printer calibration offset with saved printer settings and a calibration sheet
- [x] Template gallery with built-in examples
- [x] **Conditional objects and formatting** — rules on individual objects, in the spirit of conditional formatting in a spreadsheet
  - [x] Show or hide any object based on a field; “Show only when…”, “Hide when…” and “Change its look when…” quick starts
  - [x] Change colour, fill, frame, opacity, bold/italic, font size, corner radius or replace the text based on a field
  - [x] Conditions: is / is not / contains / doesn't contain / starts with / ends with / is one of / is empty / is not empty / greater, less (numbers, dates), combined with all (AND), any (OR) or none (NOT)
  - [x] Several rules per object, “first match wins” or “all matches apply”, and “Otherwise”; live “applies to N of M records” counts
  - [x] An override on one record beats a rule; renaming or re-mapping a column keeps rules connected
  - [ ] Rules that swap a picture, or compare one field to another
  - [ ] Conditions on a whole layer or group (when groups exist)
- [x] Group and ungroup objects (single-level groups; resize scales text proportionally)
  - [ ] Nested groups, and conditional rules that apply to a whole group
- [ ] **Responsive layout with pinning** — objects that react to each other
  - Pin an object to another (or to the template edge) with a gap, so when text grows or wraps the object below it moves down with it, and a short name pulls its neighbours in
  - Stretch, hug-contents and fill behaviours for boxes, similar to auto-layout / constraints in design tools
  - Pins respect groups and work together with text auto-fit and conditions
- [ ] **More shapes**: lines, polygons, ellipses and arrows, with stroke styles (dashed, dotted) and fills
- [ ] **Icon library**: pick from a library of icons and set their color; icons can be driven by data like any other object
- [ ] Smart guides (snap to other items' edges)
- [ ] “My templates”: save your own designs into the gallery from inside the app
- [ ] Print-ready PDF export with embedded fonts
- [ ] Hierarchical data adapters and **BirdBox integration**
  - Codes and special fields that deep-link to a specific BirdBox record, or trigger an action
    (log a cage cleaning, a feeding, opening the last bag of pellets).
  - Designed as a general “action code” concept — a code carries a record reference plus an optional
    action — so the editor stays app-agnostic and BirdBox is one adapter among several.
- [ ] Curved text (low priority)

## License

To be determined.
- [ ] **Rework the per-record override interface** (the data is fine; the UI for finding, making and reviewing overrides needs a rethink)
- [x] Page view showing every sheet in a scrolling column or a grid, as well as one sheet at a time
