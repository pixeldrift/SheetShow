# Template presets

Everything here appears in **File menu → New from template…**.

## Adding your own

1. Design it in SheetShow (template, page layout, and a few sample records in the Data tab).
2. **File menu → Save to file**. If the project has no pictures this downloads a plain `.json`.
3. Drop that file into this folder. It shows up in the gallery on the next build.

Optional extras inside the JSON (top level):

```json
{ "description": "One sentence shown under the name", "stock": "Avery 5160 · 30 per sheet" }
```

Pictures live in the browser's image library, not in the JSON, so presets shouldn't depend on them
(a data-driven picture simply shows nothing until the person adds photos).

The built-in presets are written in code in `presets.ts`, which is also the easiest place to see the format.
