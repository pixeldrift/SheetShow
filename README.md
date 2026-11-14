# SheetShow

**Where data takes the stage.**

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

## Roadmap

- [x] App foundation and visual workspace
- [x] CSV/TSV import and field binding
- [x] Inch-based template canvas
- [x] Record preview and page layout modes
- [x] Editable data table with per-record include/exclude
- [x] Column mapping when importing a new data file
- [ ] **Variable images** — data-driven pictures (see design notes below)
  - [ ] Image library (batch upload) and image objects bound to a column or a filename pattern
  - [ ] Pattern builder: `{field}` variables with transforms (lower, slug, trim…) and fallbacks
  - [ ] Exact → normalised → fuzzy filename matching with a match-review screen and manual overrides
  - [ ] Web sources: URL patterns built from fields, with optional caching into the library
  - [ ] Project bundle export that includes images
- [ ] Scannable codes (QR, Code 128) generated from data fields
- [ ] Printer calibration offset and smart guides
- [ ] Persistent reusable template library
- [ ] Print-ready PDF export with embedded fonts
- [ ] Hierarchical data adapters and **BirdBox integration**
  - Codes and special fields that deep-link to a specific BirdBox record, or trigger an action
    (log a cage cleaning, a feeding, opening the last bag of pellets).
  - Designed as a general “action code” concept — a code carries a record reference plus an optional
    action — so the editor stays app-agnostic and BirdBox is one adapter among several.
- [ ] Curved text (low priority)

## License

To be determined.