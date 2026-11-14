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
- Resize handles, multi-select (shift-click or box-select), align and distribute
- Multi-line, wrapping text with Google Fonts, installed fonts (Chromium) or any typed font name
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
- [ ] Persistent projects and reusable templates
- [ ] Rich typography and image handling
- [ ] Print-ready PDF export and crop marks
- [ ] Hierarchical data adapters and BirdBox integration

## License

To be determined.