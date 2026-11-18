export type TourStep = {
  /** CSS selectors, tried in order; the first visible match is highlighted. A step with no visible match is skipped. */
  target: string[];
  title: string;
  text: string;
};
export type TourId = "data" | "template" | "layout";

export const TOUR_NAMES: Record<TourId, string> = { data: "Data", template: "Template", layout: "Page layout" };

/** A short spotlight tour for each tab. Keep each to a handful of steps. */
export const TOURS: Record<TourId, TourStep[]> = {
  data: [
    { target: [".data-table"], title: "Your records", text: "Each row is a record. Click a cell to edit it, paste a block from a spreadsheet, or tick which records should print." },
    { target: [".data-toolbar"], title: "Bring in more data", text: "Import a file, paste from a spreadsheet, or open a Google Sheet by its link. Sorting and column order are right here too." },
    { target: [".workspace-tabs button:nth-child(2)", ".topbar-center button:nth-child(2)"], title: "Next: design a card", text: "When your records look right, open the Template tab to design one card." },
  ],
  template: [
    { target: ['button[aria-label="Add text"]', 'button[aria-label="Add"]'], title: "Add things to your card", text: "Add text, shapes, and pictures. Start with a text box." },
    { target: [".left-panel .field-list", ".left-panel"], title: "Link your data", text: "Drag a field onto the card, or onto a text box, to link it. The text then changes with every record." },
    { target: [".paper"], title: "Your card", text: "Click an object to select it, drag to move it, and use the handles to resize or turn it." },
    { target: [".right-panel"], title: "Properties", text: "Colors, fonts, size, and effects for whatever is selected. With nothing selected, it holds the card size, margins, and bleed." },
    { target: [".record-bar"], title: "Step through your records", text: "See every record on the card. Tap the name here to open the full list, or use the arrows." },
    { target: [".variant-bar"], title: "More than one template", text: "Press + to add an alternate template, then set rules so some records use it." },
  ],
  layout: [
    { target: [".stock-browse", ".right-panel"], title: "Choose a sheet", text: "Pick an Avery sheet and the layout is done for you. Or set your own columns, rows, and margins." },
    { target: [".layout-slot"], title: "Your cards on the sheet", text: "Drag a card to move it. The purple badge is its record number on this sheet; cards with the same number show the same record." },
    { target: [".left-panel"], title: "Add cards", text: "Drag a template onto the sheet, or press Add, to put another copy on the page." },
    { target: ['button[aria-label^="Override mode"]'], title: "Change one record", text: "Override lets you edit a single record's card, such as one misspelled name, without touching the rest." },
    { target: [".topbar .button-primary", ".topbar button:last-child"], title: "Print", text: "When the sheets look right, print. SheetShow checks that names fit and pictures match first." },
  ],
};
