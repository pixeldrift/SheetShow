# SheetShow

SheetShow turns a spreadsheet into printed labels, cards, badges and tags. You design **one** item, connect parts of it to your data, and SheetShow fills in a copy for every record and lays the copies out on the sheet.

> New here? Open the **Project menu** (the pill at the top left) and choose **New from template…** to start from a ready-made business card, address label, conference badge, cage card or price tag.

## The three views

The tabs at the top switch between three views of the same project.

- **Data**: your records as an editable table. Type in any cell, paste a block from a spreadsheet, add or sort columns, and tick which records should print.
- **Template**: the design of a single item. This is where you add text, shapes and pictures and link them to your data.
- **Page layout**: how copies of the template are arranged on the paper. This is where you pick your label stock, preview every sheet and print.

The **Project menu** (a pill with an arrow, left of the tabs) is different: it isn't a view. It holds New project, New from template, Open and Save.

## Quick start

1. Open the **Data** tab and import a CSV or TSV file, or edit the sample records.
2. Switch to **Template** and set the size of one item (or pick a label sheet).
3. Open the **Fields** drawer and tap a field to add it as linked text, or drag it onto the design.
4. Switch to **Page layout**, choose your label stock, and check the preview.
5. Press **Print**.

## Working with data

### Importing

Use the upload button in the Data tab (or **Change** in the Fields drawer). SheetShow asks what to do with the new records:

- **Replace** uses only the new file.
- **Add** puts the new records after your current ones.
- **Merge** combines both lists and keeps a record once if it appears in both.

If the new file's columns don't match yours, SheetShow lines up the ones that look the same (for example *Bird Name* and *name*) and lets you correct them. Columns it can't match become new columns; you can skip any you don't want. When merging, you choose which columns identify a duplicate (an ID, email or band number works best) and whether to keep your values, fill in blanks, or update with the new ones.

### Choosing what prints

Each row has a checkbox. Unticked records are skipped everywhere: the preview, the page layout and the printout. Click row numbers (Shift or Ctrl/⌘ for several) to select rows, then use **Include**, **Exclude**, **Only these**, **Duplicate** or **Delete**.

### Previewing records

The bar at the bottom of the canvas shows the current record's values on one line, so you can see that the template is really linked to your data. Tap the bar to open the full list of records, then tap a row to preview it. You can **drag a cell** from that list onto the template to add it as a linked text.

The **field names** button at the right of the bar swaps every linked text for its field name, such as `{name}`, so you can see at a glance what is variable and what is typed text.

## Designing a template

- **Add things** with the toolbar: **Text**, **Rectangle** and **Image**. Select a rectangle and use **This object is** in Properties to turn it into a text box or a photo placeholder, ready to link to your data. On a narrow screen the add buttons collapse into one **Add** menu.
- **Link text to data**: select a text object and tap a field in the **Fields** drawer. Or type your own wording with merge fields, such as `{city}, {state} {zip}` or `${price}`.
- **Properties**: the **Properties** drawer holds the settings for the selected object. Number fields have small arrows, and you can **drag a field's label** (or its unit) left and right to scrub the value. Hold Shift to go ten times faster, or Alt for fine steps.
- **Move, resize and rotate**: drag an object, use its square handles, or the round handle above it to rotate.
- **Align** with the bar at the bottom of the canvas. One object aligns to the template; several align to each other.
- **Group** objects with Ctrl/⌘+G so they move, turn and resize together. Alt-click or double-click picks a single member.
- **Layers** (in Properties) lists everything in stacking order, with show, hide, lock and reorder.
- **Undo and redo** cover everything: edits, new templates, page setup and data changes.

### Text that fits

For any text you can choose what happens when it is too long: let it spill, cut it off with “…”, shrink it to fit the box, or shrink it to fit one line. A **text outline** keeps words readable over pictures. In Page layout, **Check text fit** lists every record whose text doesn't fit.

### Corners and frames

Pictures, shapes and text boxes can have rounded corners, set by percent or by pixels, with a twirl-down for each corner on its own. **Circle** makes a shape perfectly round. Frame colour and thickness sit on one line.

## Pictures

Open **Add image** to drop in pictures, a folder or a .zip. They are kept in this browser's image library, and **Download all as ZIP** saves them.

A **data-driven picture** shows a different image for each record. Point it at a column that holds a filename, or build a pattern such as `{band}.jpg`. SheetShow finds the closest matching file, flags anything uncertain for you to review, and prints a warning before printing if any picture is missing. Web addresses work too.

## Making decisions from your data

- **Alternating templates**: make a second template (the **+** under the canvas) and say which records use it: odd, even, every third, or when a field equals something. Handy for alternating colours or different ticket types.
- **Conditions**: show, hide or restyle a single object depending on a field. For example, show a ribbon only for VIPs, or turn a price red when *sale* is *yes*.
- **Override mode**: in Page layout, turn on **Override** and click or double-click anything on a sheet to change just that record. Type a different name, drop in a different photo, or change a colour. Overridden records are marked in violet, and you can switch back to the template at any time.

## Page layout and printing

- **Label stock**: pick an Avery sheet in either the Template or the Page layout settings and both are set together. Change either one afterwards if you need something custom.
- **Sort** the sheets by any field, add **crop marks**, and preview with the toolbar's print preview button.
- **Printer calibration**: if your printer lands a little off, nudge the whole page in the Page layout settings. Save the setting for that printer, and print the calibration sheet to measure.
- **Printing** checks your pictures and text first. Choose **Save as PDF** in the print dialog to make a PDF.

## Saving your work

SheetShow saves automatically in this browser. Use **Save to file** in the Project menu to keep a copy (a .zip when you use pictures) and **Open from file** to bring it back, even on another device.

## Shortcuts

- <kbd>Ctrl/⌘</kbd> + <kbd>Z</kbd> undo, with <kbd>Shift</kbd> to redo
- <kbd>Ctrl/⌘</kbd> + <kbd>C</kbd> / <kbd>X</kbd> / <kbd>V</kbd> copy, cut, paste · <kbd>Ctrl/⌘</kbd> + <kbd>D</kbd> duplicate
- <kbd>Ctrl/⌘</kbd> + <kbd>G</kbd> group, with <kbd>Shift</kbd> to ungroup
- <kbd>Ctrl/⌘</kbd> + <kbd>A</kbd> select all · <kbd>Delete</kbd> remove
- Arrow keys nudge; <kbd>Shift</kbd> + arrows nudge further
- Zoom: tap the percentage to flip between fit and 100%, double-tap to type a value, drag it to scrub

## About

SheetShow is made by **pixeldrift**, with development help from Claude, an AI assistant from Anthropic. It is built to turn data into something you can hold, and is designed to grow alongside BirdBox.

Found a problem or have an idea? Please let the maker know.
