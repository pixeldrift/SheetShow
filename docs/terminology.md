# SheetShow terminology

One name per idea, used everywhere in the interface, the help, and the code comments. When two words seem to fit, use the one in **bold**.

## Your data
| Say | Means | Avoid |
|---|---|---|
| **record** | One row of the spreadsheet; one person, product, or badge | row, entry, item |
| **field** | One column of the spreadsheet | column (except in the Data table itself), variable |
| **data source** | The file, pasted text, or Google Sheet the records came from | dataset |

## Designing
| Say | Means | Avoid |
|---|---|---|
| **template** (individual template) | The design of one printed piece, such as a card, label, or badge. Code: `variant` | design, layout, label (unless it really is a label) |
| **alternate template** | A second (third…) template in the same project; rules say which records use which | variant, version |
| **object** | One thing inside a template: text, shape, picture. Listed under **Layers** | item, element |
| **link** / **linked field** | A text object or picture tied to a field | bind, bound |
| **rule** / **condition** | "When this field has this value, change this object" | formatting rule |
| **override** | A change made to one record only, not the template | exception, per-record edit |

## Laying out the page
| Say | Means | Avoid |
|---|---|---|
| **card** | One copy of a template placed on a sheet (even if it is a label or a letter) | item, slot, cell |
| **sheet** | One piece of paper that prints. "Sheet 3 of 6" | page (for the paper) |
| **page layout** | The tab, and the activity: arranging cards on sheets | |
| **page template** | A reusable arrangement of cards on a sheet: a letter, a badge sheet, the back of a page. Code: `pages` | sheet design, page design |
| **record number** (on a sheet) | Which record of the sheet a card shows: cards with the same number show the same record | item number, slot |
| **packet** | The group of sheets printed for a group of records ("one packet per person") | bundle, set (except "a set of records") |
| **plan** / **What prints** | The ordered steps that say which page templates print for each packet | pipeline |
| **bleed** | Artwork that runs past the cut edge | |
| **trim** | The cut edge of a card (the template's own size) | |
| **safe area** (margins) | The dashed guide inside a template's edge | padding |

## Interface words
- Tabs: **Data**, **Template**, **Page layout**. Print is a button, not a tab.
- Drawers: left is **Fields** (Template tab) or **Templates** (Page layout tab), plus **Layers**; right is **Properties**.
- Spell out units in labels: "Width (inches)", "Border size (points)".
- American spelling everywhere (see CLAUDE.md).
- Button and menu labels are verbs ("Add alternate", "Add back side"), titles are nouns.
