# SheetShow

**Where data takes the stage.**

SheetShow is a browser-based variable-data design and print tool. Create an individual item, connect its content to spreadsheet fields, arrange copies on a physical page, and preview the result across records.

## Current foundation

- React + TypeScript + Vite
- CSV and TSV import
- Inch-based document dimensions (96 CSS pixels per inch internally)
- Template canvas with text and shape objects
- Drag a data field onto the canvas to create a bound text object
- Select a text object and click a field to bind or replace its data source
- Live record preview and record navigation
- Page layout with repeated-record and sequential-record modes
- Browser print support

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

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