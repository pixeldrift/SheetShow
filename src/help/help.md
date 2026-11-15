# SheetShow

SheetShow turns a spreadsheet into printed labels, cards, badges and tags. You design **one** item, connect parts of it to your data, and SheetShow fills in a copy for every record and lays the copies out on the sheet.

> New here? Open the **Project menu** (the pill at the top left) and choose **New from template…** to start from a ready-made business card, address label, conference badge, cage card or price tag.

## The three views

The tabs at the top switch between three views of the same project.

- **Data**: your records as an editable table. Type in any cell, paste a block from a spreadsheet, and tick which records should print. **Click a column heading to sort by it, click again to reverse it, and drag a heading to move the column**, which is handy when the column you use most (a last name, say) isn't first. The records list under the canvas has the same sortable, movable headings.
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

Use the upload button in the Data tab (or **Change** in the Fields drawer). You can also **paste cells** copied from Google Sheets, Excel or Numbers into the Paste data box (the clipboard button), or import a **Google Sheet** by its address (the sheet button). A sheet shared with “anyone with the link” comes straight in; for a private one, copy its cells in Google Sheets and paste them. A plain list with no headings comes in as a single column that you name.

You can also paste straight into the table: click a cell and paste. A whole **column** (lines) pastes downward and a whole **row** (tabs) pastes across, adding records or columns as needed. SheetShow asks what to do with the new records:

- **Replace** uses only the new file.
- **Add** puts the new records after your current ones.
- **Merge** combines both lists and keeps a record once if it appears in both.

If the new file's columns don't match yours, SheetShow lines up the ones that look the same (for example *Bird Name* and *name*) and lets you correct them. Columns it can't match become new columns; you can skip any you don't want. When merging, you choose which columns identify a duplicate (an ID, email or band number works best) and whether to keep your values, fill in blanks, or update with the new ones.

### Choosing what prints

Each row has a checkbox. Unticked records are skipped everywhere: the preview, the page layout and the printout. Click row numbers (Shift or Ctrl/⌘ for several) to select rows, then use **Include**, **Exclude**, **Only these**, **Duplicate** or **Delete**.

### Previewing records

The bar at the bottom of the canvas shows the current record's values on one line, so you can see that the template is really linked to your data. Tap the bar to open the full list of records, then tap a row to preview it. You can **drag a cell** from that list onto the template to add it as a linked text.

The **field names** button at the right of the bar swaps every linked text for its field name, such as `{{name}}`, so you can see at a glance what is variable and what is typed text.

## Designing a template

- **Add things** with the toolbar: **Text**, **Rectangle**, **Image** and **Reference image**. Select a rectangle and use **Convert to…** in Properties to turn it into a text box or a photo placeholder, ready to link to your data. On a narrow screen the add buttons collapse into one **Add** menu.
- **Link text to data**: drag a field from the **Fields** drawer. Over an existing text object it highlights with a link badge, and dropping links it; over empty canvas it adds a new linked text. Or select a text object and tap a field. Or type your own wording with fields in double braces, such as `{{city}}, {{state}} {{zip}}` or `${{price}}`. **Double-tap a text object** to edit it right on the canvas; linked text shows its `{{field}}` tokens while you edit, and tapping outside saves.
- **Conditions in text**: a missing value shouldn’t leave stray punctuation. `{{?title}}, {{title}}{{/}}` shows the comma and title only when there is a title. A `?` opens a condition and `{{/}}` closes it (you can name the closer, `{{/title}}`, and SheetShow checks it matches). Compare with `=`, `!=`, `contains`, `starts` and `ends`, put `!` in front of a word to negate it (`!contains`), use a comma for “any of these” (`= "VIP", "Staff"`), join conditions with `and` or `or`, and add `{{else}}` for the other case. Text to compare with goes in quotes and ignores capital letters and stray spaces; put `~` before it to also ignore spaces, punctuation and accents, so `= ~"very important"` matches “Very_Important” and “veryImportant”. `?name` is always a field: `{{?type = "VIP" and ?band starts "GC"}}★{{else}}·{{/}}`. `{{?name}}` on its own, with no `{{/}}` in the text, just inserts the value, like `{{name}}`. Extra spaces tidy themselves, so `{{first}} {{middle}} {{last}}` has no gap when the middle name is blank.
- **Editing tokens**: in a text box, tokens show as chips (a field gets a small database icon, a condition shows its `?` and an `end` chip). The token you are working in turns back into plain text so you can edit it: click a chip, or arrow into it, and type; backspace next to a chip deletes the whole token. The small icon in the corner of the text box switches between chips and colour-coded plain text, where everything stays text.
- **Properties**: the **Properties** drawer holds the settings for the selected object. Number fields have small arrows, and you can **drag a field's label** (or its unit) left and right to scrub the value. Hold Shift to go ten times faster, or Alt for fine steps.
- **Reference objects**: switch on **Reference only** for any object (or add a **Reference image**) to use it as a guide: a scan to trace, a mock-up to match. Reference objects are faded to 50% (change it if you like), never print, and a reference image is added locked at the bottom.
- **Move, resize and rotate**: drag an object, use its square handles, or the round handle above it to rotate.
- **Smart snapping** is on by default (the magnet button). As you drag or resize, an object’s edges and centre snap to the edges and centres of other objects, the page and your guides, and a pink line shows what lines up. **Equal spacing** also snaps an object midway between two others, or repeats the gap between two objects beside it, with the gaps marked. Hold <kbd>Ctrl/⌘</kbd> to move freely. The magnet turns all snapping on or off; the small arrow beside it lets you pick what snaps: other objects, equal spacing, the page, guides, and the grid (while it is showing).
- **Arrange** the stacking order with the arrow buttons (send to back, back one, forward one, bring to front), or Ctrl/⌘ + [ and ] (add Shift to go all the way). Layers can also be dragged by their handle.
- **Move the tool bars**: the edit, align and arrange tools float on the canvas. Drag one by its handle to put it anywhere, or drop it on the toolbar at the top (or press its pin) to dock it; drag the divider before a docked group down to float it again.
- **Align** with the bar at the bottom of the canvas. One object aligns to the template; several align to each other.
- **Group** objects with Ctrl/⌘+G so they move, turn and resize together. Alt-click or double-click picks a single member.
- **Layers** (the second tab in the left drawer, beside Fields) lists every object in stacking order, with show, hide, lock, and a handle to drag it up or down. It is the way to select something you have made fully transparent.
- **Undo and redo** cover everything: edits, new templates, page setup and data changes.

### Text that fits

Text that gets its words from your data (a linked field, or wording with `{{fields}}` in it) shows a small **database icon** at its corner while you design. The field-names view shows each one on a single line clipped to its box, so a narrow box for a two-digit page number stays narrow even though `{{Page number}}` is longer.

**Tracking** spaces the letters out (or tightens them, with a negative number) in thousandths of an em, and **Pair kerning** turns the font's own letter-pair adjustments on or off.

**Autoscale** shrinks text to fit the box (or one line, or fills the box). **Overflow** says what happens if it still doesn’t fit: **Spill over** the edge, **Clip** at the edge, **Truncate** by dropping the words that don’t fit, or **Truncate…** with an ellipsis. A **text outline** keeps words readable over pictures. In Page layout, **Check text fit** lists every record whose text doesn't fit.

### Corners and frames

Background, border and border size sit on one line. **Padding** and **Rounding** are single numbers you can drag to scrub or tap to type; rounding switches between percent and pixels, and each has a twirl-down for every side or corner on its own. **Circle** makes a shape perfectly round.

## Pictures

Open **Add image** to drop in pictures, a folder or a .zip. They are kept in this browser's image library, and **Download all as ZIP** saves them.

A **data-driven picture** shows a different image for each record. Point it at a column that holds a filename, or build a pattern such as `{{band}}.jpg`. SheetShow finds the closest matching file, flags anything uncertain for you to review, and prints a warning before printing if any picture is missing. Web addresses work too.

## Making decisions from your data

- **Alternating templates**: make a second template (the **+** under the canvas) and say which records use it: odd, even, every third, or when a field equals something. Handy for alternating colours or different ticket types.
- **Conditions**: show, hide or restyle a single object depending on a field. For example, show a ribbon only for VIPs, or turn a price red when *sale* is *yes*.
- **Override mode**: in Page layout, turn on **Override** and click or double-click anything on a sheet to change just that record. Type a different name, drop in a different photo, or change a colour. Overridden records are marked in violet, and you can switch back to the template at any time.

## Page layout and printing

- **Label stock**: pick an Avery sheet in either the Template or the Page layout settings and both are set together. Change either one afterwards if you need something custom.
- **Sort** the sheets by any field, add **crop marks**, and preview with the toolbar's print preview button.
- **Printer calibration**: if your printer lands a little off, nudge the whole page in the Page layout settings. Save the setting for that printer, and print the calibration sheet to measure.
- **See every sheet**: beside the toolbar buttons in Page layout, switch between one sheet, all sheets in a scrolling column, or a grid. The arrows under the canvas turn to the next sheet in any of them.
- **One record per sheet**: in Page layout settings choose “One record per sheet” to fill each sheet with copies of a single record, with a sheet for every record, handy for a page of return-address labels per person. The arrows under the canvas turn sheets, and picking a record in the records list jumps to its sheet.
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

SheetShow is made by **Nathan D. B. Pizar**, with development help from Claude, an AI assistant from Anthropic. It turns data into something you can hold, and is designed to grow alongside BirdBox.

Found a problem or have an idea? Write to me at [nathan@pizar.net](mailto:nathan@pizar.net).

**If you found this app useful, send me a tip!** My email is linked with Venmo, Cash App, Apple Pay and Chime, so sending to nathan@pizar.net works with any of them.
