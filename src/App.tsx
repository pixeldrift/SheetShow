import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Braces, ChevronLeft, ChevronRight, GripVertical, Hash, LayoutTemplate, PencilLine, Redo2, SlidersHorizontal, Type, Undo2 } from "lucide-react";
import Papa from "papaparse";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DesignItem, Guide, PageMeta, Placement, Plan, InstanceOverride, ItemPatch, LabelPreset, Project, RecordRow, Sheet, Variant, VariantRule, View, Workspace } from "./types";
import { tokenFields, upgradeProject } from "./lib/merge";
import { DEFAULT_SNAP_OPTIONS, type SnapOptions } from "./lib/smartSnap";
import { PX_PER_IN, clamp, fieldDisplayName, isPlaceholderData, isPlaceholderDesign, specialFields, starterItems, starterRecords, uid, valueFor } from "./lib/data";
import { applyOverride, hasEdits, pickVariant, toItemPatch } from "./lib/instances";
import { applyConditions } from "./lib/conditions";
import { cloneItems, expandToGroups, groupItems, moveLayerTo, reorderSelection, type ArrangeMode, nextGroupName, renameGroup as renameGroupIn, ungroupItems, unitsOf } from "./lib/groups";
import { instanceIssues, itemLabel, recordLabel, textProblem, type Issue, type TextProblemKind } from "./lib/audit";
import { checkImageUrls } from "./lib/webImages";
import { layoutText } from "./lib/text";
import { TextAuditDialog } from "./components/TextAuditDialog";
import { usePrinterCalibration } from "./hooks/usePrinterCalibration";
import { TemplateGalleryDialog } from "./components/TemplateGalleryDialog";
import { HelpDialog } from "./components/HelpDialog";
import { WelcomeDialog } from "./components/WelcomeDialog";
import { TapTips } from "./components/TapTips";
import { Spark } from "./components/Spark";
import { shouldWelcome, useGuide } from "./lib/guide";
import { OutputView } from "./components/OutputView";
import { TourOverlay } from "./components/TourOverlay";
import type { TourId } from "./lib/tours";
import { useHistory } from "./hooks/useHistory";
import { useFontLibrary } from "./hooks/useFontLibrary";
import { aabb, alignItems, boundsOf, centerOf, distributeItems, rotateAbout, type AlignMode, type Transform } from "./lib/align";
import { applyMapping, boundFields, suggestMapping } from "./lib/mapping";
import { MappingDialog } from "./components/MappingDialog";
import { ImportDialog } from "./components/ImportDialog";
import { bundleProject, downloadBlob, loadProject, projectFileName, readProjectAny, saveProject } from "./lib/storage";
import { useImageLibrary } from "./hooks/useImageLibrary";
import { ImageContext } from "./components/ImageContext";
import { ImageLibraryDialog } from "./components/ImageLibraryDialog";
import { MatchReviewDialog } from "./components/MatchReviewDialog";
import { defaultImageSource, isWebUrl } from "./lib/images";
import type { Asset } from "./types";
import { Topbar } from "./components/Topbar";
import { Toolbar } from "./components/Toolbar";
import { EditBar } from "./components/EditBar";
import { AlignBar } from "./components/AlignBar";
import { ArrangeBar } from "./components/ArrangeBar";
import { InlineTextEditor } from "./components/InlineTextEditor";
import { LayersPanel } from "./components/LayersPanel";
import { PasteDialog } from "./components/PasteDialog";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { useDrawerGestures } from "./hooks/useDrawerGestures";
import { SheetsDialog } from "./components/SheetsDialog";
import type { SortState } from "./components/columnDrag";
import type { PaletteState } from "./components/Palette";
import { DataPanel } from "./components/DataPanel";
import { Inspector } from "./components/Inspector";
import { RecordBar } from "./components/RecordBar";
import { RecordsDrawer } from "./components/RecordsDrawer";
import { MAX_ZOOM, MIN_ZOOM, Viewport } from "./components/Viewport";
import { TemplateStage } from "./components/TemplateStage";
import { LayoutStage, type InstanceInfo, type InstanceSelection } from "./components/LayoutStage";
import { itemFrame } from "./components/ItemShape";
import { DataTable } from "./components/DataTable";
import { ID, addColumn, blankRow, columnsOf, duplicateRows, isIncluded, keepOneRow, pasteGrid, removeColumn, renameColumn, reorderColumns, setCell, setIncluded, sortRows, toCsv, withIds } from "./lib/records";
import { PrintSheets } from "./components/PrintSheets";
import { matchedStock } from "./components/StockPicker";
import { buildSequence, defaultPlan, describePlan, perSheetOf, sheetIndexOf } from "./lib/packet";
import { footprint, freeSpot, gridPlacements, numbering, numberingMode, placementsOf, renumber } from "./lib/placements";
import { bleedLimits, effectiveBleed, gapsFor, maxBleed } from "./lib/bleed";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const WIDE_QUERY = "(min-width: 851px)";
const freshView = (): View => ({ zoom: 1, pan: { x: 0, y: 0 }, fitted: false });
const defaultSheet: Sheet = { pageWidth: 8.5, pageHeight: 11, columns: 2, rows: 4, gapX: 0.18, gapY: 0.18, marginX: 0.25, marginY: 0.25, repeatMode: "next", cropMarks: false };
const DEFAULT_NAME = "Untitled project";

/** Everything the undo history covers. */
type Doc = {
  items: Record<string, DesignItem[]>; variants: Variant[]; rules: VariantRule[]; template: Project["template"]; sheets: Record<string, Sheet>; pages: PageMeta[]; plan: Plan;
  records: RecordRow[]; fileName: string; overrides: Record<string, InstanceOverride>;
};
/** Applies a column mapping to the linked text and rules of every template. */
const mapAllTemplates = (map: Record<string, DesignItem[]>, mapping: Record<string, string | null>) =>
  Object.fromEntries(Object.entries(map).map(([id, list]) => [id, applyMapping(list, mapping)]));

function App() {
  // ── Document (restored from this browser's last session when available) ──
  const [initial] = useState(() => loadProject());
  // ONE undo history covers every document change: templates, alternate templates, rules, template size, page setup,
  // data, and per-record edits. The pieces below are thin views onto it, so the rest of the editor reads as before.
  const [startDoc] = useState<Doc>(() => {
    const vs = initial?.variants?.length ? initial.variants : [{ id: "a", name: "Template A", items: initial?.items ?? starterItems }];
    const pgs = initial?.pages?.length ? initial.pages : [{ id: "p1", name: "Page 1", sheet: initial?.sheet ?? defaultSheet }];
    return {
      items: Object.fromEntries(vs.map((v) => [v.id, v.items])), variants: vs.map(({ id, name }) => ({ id, name })), rules: initial?.rules ?? [],
      template: initial?.template ?? { width: 3.5, height: 2 },
      sheets: Object.fromEntries(pgs.map((p) => [p.id, p.sheet])), pages: pgs.map(({ id, name }) => ({ id, name })), plan: initial?.plan ?? defaultPlan(pgs[0].id),
      records: withIds(initial?.records ?? starterRecords), fileName: initial?.fileName ?? "people.csv", overrides: initial?.overrides ?? {},
    };
  });
  const doc = useHistory<Doc>(startDoc);
  const D = doc.value;
  /** A setter for one part of the document (accepts a value or an updater), recorded as an undo step. */
  const part = <K extends keyof Doc>(key: K, coalesce?: string) => (update: Doc[K] | ((value: Doc[K]) => Doc[K]), options?: { coalesce?: string }) =>
    doc.set((d) => { const next = typeof update === "function" ? (update as (v: Doc[K]) => Doc[K])(d[key]) : update; return next === d[key] ? d : { ...d, [key]: next }; }, { coalesce: options?.coalesce ?? coalesce });
  const shared = { undo: doc.undo, redo: doc.redo, breakGroup: doc.breakGroup, canUndo: doc.canUndo, canRedo: doc.canRedo };
  const records = D.records;
  const fileName = D.fileName;
  const variants = D.variants, rules = D.rules, template = D.template;
  /** The first page design holds the settings every page shares (record order, how alternating templates count). */
  const mainId = D.pages[0].id, mainSheet = D.sheets[mainId];
  const instanceOverrides = D.overrides;
  const setVariants = part("variants", "variants"), setRules = part("rules", "rules"), setTemplate = part("template", "template");
  const recordHistory = { value: records, set: part("records"), ...shared };
  const [dataSort, setDataSort] = useState<SortState>(null);
  const editRecords = (update: (rows: RecordRow[]) => RecordRow[], coalesce?: string) => recordHistory.set(update, { coalesce });
  const itemsDoc = { value: D.items, set: part("items"), ...shared };
  const overrideDoc = { value: instanceOverrides, set: part("overrides"), ...shared };
  const [docName, setDocName] = useState(initial?.name ?? DEFAULT_NAME);
  const [activeVariant, setActiveVariant] = useState(variants[0].id);
  const variantId = itemsDoc.value[activeVariant] ? activeVariant : variants[0].id; // the template being edited
  const items = itemsDoc.value[variantId] ?? [];
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /** Edits the template being shown, so the rest of the editor keeps working with one plain list of items. */
  const history = {
    set: (update: (list: DesignItem[]) => DesignItem[], options?: { coalesce?: string }) =>
      recMode ? setRecordEdits(update, options) : itemsDoc.set((map) => { const current = map[variantId] ?? []; const next = update(current); return next === current ? map : { ...map, [variantId]: next }; }, options),
    ...shared,
  };
  const [rawRecordIndex, setRecordIndex] = useState(0);
  /** Which sheet of the print run is on screen. The same record can sit on several sheets (a letter, then its back…), so this is kept apart from the record. */
  const [rawSheet, setSheetIndex] = useState(0);
  const fontLibrary = useFontLibrary(initial?.fonts ?? []);

  // ── UI state ────────────────────────────────────────────────────────────
  const [workspace, setWorkspace] = useState<Workspace>("template");
  const [showData, setShowData] = useState(false);
  /** The Output tab: every sheet that will print, together. */
  const [showOutput, setShowOutput] = useState(false);
  const away = showData || showOutput; // the editor is hidden while the Data or Output tab is showing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [clipboard, setClipboard] = useState<DesignItem[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "error">("saved");
  /** `grab` is where on the chip it was picked up, so it keeps that exact place under the finger as it travels (null for a table cell, which is shown as a small chip at the pointer). */
  const [fieldDrag, setFieldDrag] = useState<{ field: string; x: number; y: number; grab: { dx: number; dy: number; w: number } | null } | null>(null);
  /** The existing text object a dragged field would link to if dropped now. */
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const justDragged = useRef(false);
  // A freshly imported file waiting for the person to confirm how its columns map onto the template.
  const drawers = useDrawerGestures((side, open) => (side === "left" ? setDataOpen(open) : setInspectorOpen(open)));
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ records: RecordRow[]; fileName: string; stage: "choose" | "map" } | null>(null);
  const [dataOpen, setDataOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  // Tool palettes (edit, align, arrange): floating on the canvas or docked in the toolbar, remembered in this browser.
  const [palettes, setPalettes] = useState<Record<string, PaletteState>>(() => {
    try { return JSON.parse(localStorage.getItem("sheetshow.palettes") ?? "{}"); } catch { return {}; }
  });
  const palette = (id: string): PaletteState => palettes[id] ?? { docked: false };
  const setPalette = (id: string) => (state: PaletteState) => setPalettes((all) => {
    const next = { ...all, [id]: state };
    try { localStorage.setItem("sheetshow.palettes", JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });
  const canDock = window.matchMedia(WIDE_QUERY).matches;
  const [snap, setSnap] = useState(true);
  const [snapOptions, setSnapOptions] = useState<SnapOptions>(() => {
    try { return { ...DEFAULT_SNAP_OPTIONS, ...JSON.parse(localStorage.getItem("sheetshow.snapOptions") ?? "{}") }; } catch { return DEFAULT_SNAP_OPTIONS; }
  });
  const changeSnapOptions = (next: SnapOptions) => { setSnapOptions(next); try { localStorage.setItem("sheetshow.snapOptions", JSON.stringify(next)); } catch { /* storage unavailable */ } };
  const [preview, setPreview] = useState(false);
  const [printing, setPrinting] = useState<null | "sheets" | "calibration">(null);
  const printer = usePrinterCalibration();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => shouldWelcome(!!initial));
  const guide = useGuide();
  const [tour, setTour] = useState<TourId | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [showFieldNames, setShowFieldNames] = useState(false);
  const [instanceMode, setInstanceMode] = useState(false);
  const [instanceSel, setInstanceSel] = useState<InstanceSelection | null>(null);
  const [editingText, setEditingText] = useState<InstanceSelection | null>(null);
  const [auditDialog, setAuditDialog] = useState<null | { itemId?: string | null }>(null);
  const [status, setStatus] = useState<null | { text: string; kind: "info" | "ok" | "warn"; busy?: boolean; detail?: string[] }>(null);

  // Each workspace remembers its own zoom, pan and guides.
  const [views, setViews] = useState<Record<Workspace, View>>({ template: freshView(), layout: freshView() });
  const [guides, setGuides] = useState<Record<Workspace, Guide[]>>({ template: [], layout: [] });
  const view = views[workspace];

  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const library = useImageLibrary();
  // Which image dialog is open: inserting from the toolbar, choosing for an item, or reviewing a data-driven picture's matches.
  const [libraryDialog, setLibraryDialog] = useState<null | { kind: "insert"; reference?: boolean } | { kind: "pick"; itemId: string; target: "asset" | "fallback" }>(null);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const recordIndex = Math.min(rawRecordIndex, Math.max(0, records.filter(isIncluded).length - 1));
  const fields = useMemo(() => columnsOf(records), [records]);
  // Only records switched on in the Data table are previewed, laid out, counted and printed.
  const activeRecords = useMemo(() => {
    const included = records.filter(isIncluded);
    return mainSheet.sortField ? sortRows(included, mainSheet.sortField, mainSheet.sortDir ?? 1) : included;
  }, [records, mainSheet.sortField, mainSheet.sortDir]);
  const currentRecord = activeRecords[recordIndex] ?? {};
  // ── Sheets: every page that prints, in order. The sheet on screen decides which page design is being edited. ──
  const seq = useMemo(() => buildSequence(D.plan, D.sheets, D.template.width, D.template.height, activeRecords.length), [D.plan, D.sheets, D.template.width, D.template.height, activeRecords.length]);
  const perSheetFor = (pageId: string) => perSheetOf(D.sheets[pageId] ?? mainSheet, D.template.width, D.template.height);
  const sheetOf = (index: number) => Math.max(0, sheetIndexOf(seq, index, perSheetFor));
  const pageCount = Math.max(1, seq.length);
  const showsRecord = (i: number, K: number) => { const r = seq[K]; return !!r && i >= r.base && i < Math.min(r.limit, r.base + perSheetFor(r.pageId)); };
  const currentPage = showsRecord(recordIndex, rawSheet) ? rawSheet : sheetOf(recordIndex);
  const activeId = seq[currentPage]?.pageId ?? mainId;
  const sheet = D.sheets[activeId] ?? mainSheet;
  /** Edits one page design (as one undo step; repeated edits to the same thing merge). */
  const setSheetOf = (id: string) => (update: Sheet | ((s: Sheet) => Sheet), options?: { coalesce?: string }) =>
    doc.set((d) => { const cur = d.sheets[id]; if (!cur) return d; const next = typeof update === "function" ? update(cur) : update; return next === cur ? d : { ...d, sheets: { ...d.sheets, [id]: next } }; }, { coalesce: options?.coalesce ?? `sheet:${id}` });
  const setSheet = setSheetOf(activeId);
  const setMainSheet = setSheetOf(mainId);
  const setPlan = part("plan", "plan");
  /** Override mode on the template page: every edit below is kept for the record being previewed, and only that record. */
  const recMode = workspace === "template" && instanceMode && !preview;
  const recOverride = recMode ? instanceOverrides[currentRecord[ID]] : undefined;
  const liveItems = useMemo(() => (recMode ? applyOverride(items, recOverride) : items), [recMode, items, recOverride]);
  const selectedItems = useMemo(() => liveItems.filter((item) => selectedIds.includes(item.id)), [liveItems, selectedIds]);
  const selected = selectedItems.length === 1 ? selectedItems[0] : null;
  // The cards on a page come from the grid settings or, on a hand-arranged page, from `sheet.placements`.
  const placements = placementsOf(sheet, template.width, template.height);
  const slots = placements.length;
  const { perSheet } = numbering(placements);
  // Bleed: standard (Avery) sheets always hold it to what the gaps allow; custom ones follow the template's own policy.
  const standardStock = matchedStock(template.width, template.height, sheet);
  // With several page designs the bleed must fit every one that prints, so it is held to the tightest.
  const usedSheets = [...new Set(seq.map((r) => r.pageId))].map((id) => D.sheets[id]).filter(Boolean);
  const bleedHeld = usedSheets.some((s) => !!s.placements) || usedSheets.length > 1; // no "widen the gaps" on hand-arranged or multi-page documents
  const bleedIn = effectiveBleed(template, usedSheets, !!standardStock || bleedHeld);
  const bleedMax = maxBleed(usedSheets, template.width, template.height);
  const bleedLimit = bleedLimits(usedSheets, template.width, template.height);
  const changeBleed = (bleed: Project["template"]["bleed"]) => {
    setTemplate((t) => ({ ...t, bleed }));
    if (bleed && !standardStock && !bleedHeld && !bleed.auto && bleed.policy === "grow") setSheet((s) => ({ ...s, ...gapsFor(s, bleed.amount) }));
  };
  // ── Page layout: the cards on a sheet ──────────────────────────────────
  const [cardSel, setCardSel] = useState<{ page: string; id: string } | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  /** Hand-arranging the page: pick, drag, add and delete cards. (Override mode is the other thing you can do on a sheet.) */
  const arranging = workspace === "layout" && !instanceMode && !preview && !away;
  const selectedCard = cardSel ? placementsOf(D.sheets[cardSel.page] ?? sheet, template.width, template.height).find((c) => c.id === cardSel.id) ?? null : null;
  const cardPage = cardSel?.page ?? activeId;
  /** Any change to the cards turns that page into a hand-arranged one (starting from what the grid gave). */
  const editCards = (pageId: string, change: (list: Placement[]) => Placement[], coalesce?: string) =>
    setSheetOf(pageId)((s) => ({ ...s, placements: change(s.placements ?? gridPlacements(s, template.width, template.height)) }), { coalesce: coalesce ? `${pageId}:${coalesce}` : undefined });
  const moveCard = (pageId: string, id: string, x: number, y: number) => editCards(pageId, (list) => list.map((c) => (c.id === id ? { ...c, x, y } : c)), `card-move:${id}`);
  const numberCard = (pageId: string, id: string, number: number) => editCards(pageId, (list) => list.map((c) => (c.id === id ? { ...c, number: Math.max(1, Math.round(number)) } : c)), `card-number:${id}`);
  /** Turn a card by a quarter (or set it), keeping its center where it is. */
  const rotateCard = (pageId: string, id: string, turn: number | "next") => {
    const page = D.sheets[pageId] ?? sheet;
    editCards(pageId, (list) => list.map((c) => {
      if (c.id !== id) return c;
      const next = (turn === "next" ? ((c.rotation ?? 0) + 90) % 360 : turn) as 0 | 90 | 180 | 270;
      const was = footprint(c, template.width, template.height), now = footprint({ ...c, rotation: next }, template.width, template.height);
      const x = clamp(c.x + (was.w - now.w) / 2, 0, Math.max(0, page.pageWidth - now.w)), y = clamp(c.y + (was.h - now.h) / 2, 0, Math.max(0, page.pageHeight - now.h));
      return { ...c, rotation: next || undefined, x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
    }));
  };
  const cardVariant = (pageId: string, id: string, variantId: string | undefined) => editCards(pageId, (list) => list.map((c) => (c.id === id ? { ...c, variantId } : c)));
  const addCard = (variantId?: string, at?: { x: number; y: number }, pageId = activeId) => {
    const id = uid();
    const page = D.sheets[pageId] ?? sheet, list = placementsOf(page, template.width, template.height);
    const spot = at ?? freeSpot(list, template.width, template.height, page.pageWidth, page.pageHeight);
    const number = numberingMode(list) === "same" ? 1 : Math.max(0, ...list.map((c) => c.number)) + 1;
    editCards(pageId, (cards) => [...cards, { id, x: spot.x, y: spot.y, number, variantId }]);
    setCardSel({ page: pageId, id }); setInstanceMode(false); setInstanceSel(null); setInspectorOpen(true);
  };
  const duplicateCard = (pageId: string, id: string) => {
    const from = placementsOf(D.sheets[pageId] ?? sheet, template.width, template.height).find((c) => c.id === id);
    if (!from) return;
    const copy = uid();
    editCards(pageId, (list) => [...list, { ...from, id: copy, x: Number((from.x + 0.2).toFixed(3)), y: Number((from.y + 0.2).toFixed(3)) }]);
    setCardSel({ page: pageId, id: copy });
  };
  const deleteCard = (pageId: string, id: string) => {
    if (placementsOf(D.sheets[pageId] ?? sheet, template.width, template.height).length > 1) { editCards(pageId, (list) => list.filter((c) => c.id !== id)); setCardSel(null); }
  };
  const resetToGrid = (pageId = activeId) => { setSheetOf(pageId)((s) => ({ ...s, placements: undefined })); setCardSel(null); };
  const numberAll = (mode: "same" | "each") => {
    if (sheet.placements) editCards(activeId, (list) => renumber(list, mode));
    else setSheet((s) => ({ ...s, repeatMode: mode === "same" ? "same" : "next" }));
  };
  /** Pick a card. In a stack of sheets this also brings that sheet's page design into the editor. */
  const selectCard = (pageId: string, id: string | null, sheetIdx?: number) => {
    setCardSel(id ? { page: pageId, id } : null);
    if (id && sheetIdx !== undefined) { setSheetIndex(sheetIdx); setRecordIndex(Math.min(seq[sheetIdx]?.base ?? 0, Math.max(0, activeRecords.length - 1))); }
  };
  /** A template dropped from the Templates drawer: place a card where it landed (centered on the pointer). */
  const dropTemplate = (variantId: string, clientX: number, clientY: number) => {
    const el = document.elementsFromPoint(clientX, clientY).find((e) => e.classList.contains("layout-page"));
    if (!el) return;
    const pageId = el.getAttribute("data-page-id") ?? activeId, page = D.sheets[pageId] ?? sheet;
    const rect = el.getBoundingClientRect();
    const scale = PX_PER_IN * view.zoom;
    const x = clamp((clientX - rect.left) / scale - template.width / 2, 0, Math.max(0, page.pageWidth - template.width));
    const y = clamp((clientY - rect.top) / scale - template.height / 2, 0, Math.max(0, page.pageHeight - template.height));
    addCard(variantId, { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }, pageId);
  };

  // ── Page designs and the print plan ─────────────────────────────────────
  const goToPage = (pageId: string) => {
    const K = Math.max(0, seq.findIndex((r) => r.pageId === pageId));
    setSheetIndex(K); setRecordIndex(Math.min(seq[K]?.base ?? 0, Math.max(0, activeRecords.length - 1))); setCardSel(null);
  };
  /** After adding a page, show it as soon as the print run includes it. */
  const [wantPage, setWantPage] = useState<string | null>(null);
  useEffect(() => { if (wantPage && seq.some((r) => r.pageId === wantPage)) { goToPage(wantPage); setWantPage(null); } });
  /** Every page template shares one paper size: a print job can't mix paper sources. */
  const setPaperSize = (pageWidth: number, pageHeight: number) =>
    doc.set((d) => ({ ...d, sheets: Object.fromEntries(Object.entries(d.sheets).map(([id, s]) => [id, { ...s, pageWidth, pageHeight }])) }), { coalesce: "paper-size" });
  const newPageId = () => `p${uid().slice(0, 6)}`;
  const nextPageName = (base: string) => { let n = 2; const names = new Set(D.pages.map((p) => p.name)); while (names.has(`${base} ${n}`)) n++; return `${base} ${n}`; };
  /** Adds a page design (a copy of this one's settings, with an empty grid when `blank`) and makes it print after the others. */
  const addPage = (options: { name?: string; from?: Sheet; step?: boolean } = {}) => {
    const id = newPageId();
    const from = options.from ?? { ...sheet, placements: undefined };
    doc.set((d) => ({
      ...d, sheets: { ...d.sheets, [id]: { ...from } }, pages: [...d.pages, { id, name: options.name ?? nextPageName("Page") }],
      plan: options.step === false ? d.plan : { ...d.plan, steps: [...d.plan.steps, { id: uid(), pageId: id }] },
    }));
    setWantPage(id);
    return id;
  };
  const renamePage = (id: string, name: string) => doc.set((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, name } : p)) }), { coalesce: `page-name:${id}` });
  const deletePage = (id: string) => {
    if (D.pages.length < 2 || D.pages[0].id === id) return;
    doc.set((d) => {
      const { [id]: _gone, ...rest } = d.sheets;
      const steps = d.plan.steps.filter((s) => s.pageId !== id);
      return { ...d, sheets: rest, pages: d.pages.filter((p) => p.id !== id), plan: { ...d.plan, steps: steps.length ? steps : [{ id: uid(), pageId: d.pages[0].id }] } };
    });
    setCardSel(null); setRecordIndex(0); setSheetIndex(0);
  };
  /** The back of a page for double-sided printing: the same cards mirrored side to side (flip on the long edge), printed right after it, one back for each front. */
  const addBackSide = (id: string) => {
    const front = D.sheets[id];
    if (!front) return;
    const cards = placementsOf(front, template.width, template.height).map((c) => {
      const f = footprint(c, template.width, template.height);
      return { ...c, id: uid(), x: Number(Math.max(0, front.pageWidth - c.x - f.w).toFixed(3)) };
    });
    const backId = newPageId();
    const frontName = D.pages.find((p) => p.id === id)?.name ?? "Page";
    const perFront = perSheetOf(front, template.width, template.height);
    doc.set((d) => {
      const at = d.plan.steps.findIndex((s) => s.pageId === id);
      const steps = [...d.plan.steps];
      steps.splice(at < 0 ? steps.length : at + 1, 0, { id: uid(), pageId: backId });
      return { ...d, sheets: { ...d.sheets, [backId]: { ...front, placements: cards } }, pages: [...d.pages, { id: backId, name: `${frontName} (back)` }], plan: { group: d.plan.group > 0 ? d.plan.group : perFront, steps } };
    });
  };
  // "Repeat same record" prints one full sheet per record; "next record" fills each sheet with the following records.
  const overflow = placements.some((p) => { const f = footprint(p, template.width, template.height); return p.x + f.w > sheet.pageWidth + 0.005 || p.y + f.h > sheet.pageHeight + 0.005 || p.x < -0.005 || p.y < -0.005; });
  const pagedNav = workspace === "layout"; // in page view the arrows turn pages

  // ── Alternating templates + per-record edits ────────────────────────────
  /** The items one record renders: its template (chosen by the rules) with that record's hand edits applied. */
  const instanceFor = (record: RecordRow, index: number, slot: number, variantOverride?: string): InstanceInfo => {
    const id = variantOverride && variants.some((v) => v.id === variantOverride) ? variantOverride : pickVariant(rules, variants, record, index, slot, sheet.variantBasis ?? "record");
    const base = itemsDoc.value[id] ?? itemsDoc.value[variants[0].id] ?? [];
    const override = instanceOverrides[record[ID]];
    // Order: the template, then conditional rules for this record, then this record's hand edits (which win).
    return { variantId: id, items: applyOverride(applyConditions(base, record, metaFor(index)), override), override };
  };
  const metaFor = (index: number) => ({ recordNumber: index + 1, pageNumber: sheetOf(index) + 1, recordCount: activeRecords.length, pageCount });
  const indexOfRecord = (recordId: string) => activeRecords.findIndex((r) => r[ID] === recordId);

  const updateInstance = (recordId: string, change: (current: InstanceOverride) => InstanceOverride | null, coalesce?: string) =>
    overrideDoc.set((map) => {
      const next = change(map[recordId] ?? { items: {} });
      if (!next || !Object.keys(next.items).length) { const { [recordId]: _gone, ...rest } = map; return rest; }
      return { ...map, [recordId]: next };
    }, { coalesce });
  /** Edits one item on one record's copy. Editing while "off" switches the edits back on. */
  const setInstanceItem = (recordId: string, itemId: string, patch: ItemPatch, coalesce?: string) =>
    updateInstance(recordId, ({ off: _off, items: current }) => ({ items: { ...current, [itemId]: { ...(current[itemId] ?? {}), ...patch } } }), coalesce);
  /** The template editor's edits, redirected: work out what changed on each object and keep just that for the current record. */
  function setRecordEdits(update: (list: DesignItem[]) => DesignItem[], options?: { coalesce?: string }) {
    const recordId = currentRecord[ID];
    if (!recordId) return;
    const base = applyOverride(itemsRef.current, instanceOverrides[recordId]);
    const next = update(base);
    if (next === base) return;
    const was = new Map(base.map((i) => [i.id, i]));
    let structural = next.length !== base.length || next.some((n, i) => n.id !== base[i].id);
    for (const n of next) {
      const b = was.get(n.id);
      if (!b || n === b) continue;
      const patch: ItemPatch = {};
      for (const k of new Set([...Object.keys(n), ...Object.keys(b)])) {
        const a = (n as unknown as Record<string, unknown>)[k], o = (b as unknown as Record<string, unknown>)[k];
        if (JSON.stringify(a) !== JSON.stringify(o)) (patch as Record<string, unknown>)[k] = a === undefined ? null : a;
      }
      if ("groupId" in patch || "groupName" in patch) { structural = true; continue; }
      if (Object.keys(patch).length) setInstanceItem(recordId, n.id, patch, options?.coalesce);
    }
    if (structural) setStatus({ text: "Override mode changes one record only. To add, delete, group or reorder objects, turn Override off.", kind: "warn" });
  }
  const revertInstanceItem = (recordId: string, itemId: string) =>
    updateInstance(recordId, (o) => { const { [itemId]: _gone, ...rest } = o.items; return { ...o, items: rest }; });
  const toggleInstanceOff = (recordId: string) => updateInstance(recordId, (o) => (o.off ? { items: o.items } : { ...o, off: true }));
  const resetInstance = (recordId: string) => updateInstance(recordId, () => null);

  const instRecord = instanceSel ? activeRecords.find((r) => r[ID] === instanceSel.recordId) : undefined;
  const instIndex = instRecord ? activeRecords.indexOf(instRecord) : -1;
  const instItems = instRecord ? instanceFor(instRecord, instIndex, instIndex % slots).items : [];
  const instItem = instanceSel ? instItems.find((i) => i.id === instanceSel.itemId) : undefined;
  const instOverride = instRecord ? instanceOverrides[instRecord[ID]] : undefined;
  const inLayoutEdit = workspace === "layout" && !!instItem && !away;

  // ── Text-fit audit ──────────────────────────────────────────────────────
  const computeIssues = (indices: number[]): Issue[] => {
    const out: Issue[] = [];
    for (const index of indices) {
      const record = activeRecords[index];
      if (!record) continue;
      for (const { item, kind, atMin } of instanceIssues(instanceFor(record, index, index % slots).items, record, metaFor(index), { w: template.width, h: template.height }))
        out.push({ recordId: record[ID], recordIndex: index, recordLabel: recordLabel(record), itemId: item.id, itemLabel: itemLabel(item), kind, atMin });
    }
    return out;
  };
  const allIndices = () => activeRecords.map((_, i) => i);
  const issues = useMemo(() => (auditDialog ? computeIssues(allIndices()) : []), [auditDialog, items, itemsDoc.value, instanceOverrides, activeRecords, rules, variants, sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheetIssueCount = workspace === "layout" && !preview
    ? computeIssues(Array.from({ length: perSheet }, (_, k) => (seq[currentPage]?.base ?? 0) + k).filter((i) => i < Math.min(activeRecords.length, seq[currentPage]?.limit ?? 0))).length : 0;
  /**
   * For every text in the template being edited: the records (of those that use this template) where it will cause trouble, meaning
   * it is cut off, runs off the card, or spills out of a visible box. Drives the warning icons on the canvas and the note in Properties.
   */
  const cardSize = { w: template.width, h: template.height };
  const textTrouble = useMemo(() => {
    const byItem = new Map<string, { index: number; kind: TextProblemKind }[]>();
    let total = 0;
    if (workspace !== "template" || preview) return { byItem, total };
    const texts = items.filter((i) => i.type === "text" && i.visible !== false && !i.reference);
    for (let i = 0; i < Math.min(activeRecords.length, 600); i++) {
      if (pickVariant(rules, variants, activeRecords[i], i, i % slots, sheet.variantBasis ?? "record") !== variantId) continue;
      total++;
      const meta = metaFor(i);
      for (const item of texts) {
        const problem = textProblem(item, activeRecords[i], meta, cardSize);
        if (problem) { const list = byItem.get(item.id) ?? []; list.push({ index: i, kind: problem.kind }); byItem.set(item.id, list); }
      }
    }
    return { byItem, total };
  }, [items, activeRecords, rules, variants, variantId, sheet, template, workspace, preview]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitNote = (() => {
    if (!selected || selected.type !== "text" || workspace !== "template" || !textTrouble.total) return null;
    const bad = textTrouble.byItem.get(selected.id)?.length ?? 0;
    return { bad: bad > 0, text: bad ? `${bad} of ${textTrouble.total} record${textTrouble.total === 1 ? "" : "s"} ${bad === 1 ? "has" : "have"} text that is cut off or runs off the card.` : `All ${textTrouble.total} record${textTrouble.total === 1 ? "" : "s"} fit.` };
  })();
  /** The warning icon's popup: which records have trouble in this text. */
  const [warnPopup, setWarnPopup] = useState<{ itemId: string; x: number; y: number } | null>(null);

  // ── View: per-workspace zoom / pan / fit ───────────────────────────────
  // ── Page view: one sheet, or every sheet in a scrolling column or a grid ──
  const [pageView, setPageView] = useState<"single" | "scroll" | "grid">("single");
  const stack = workspace === "layout" && pageView !== "single";
  const GAP = 0.35; // inches between sheets
  const stackCols = pageView === "grid" ? (pageCount <= 1 ? 1 : pageCount <= 4 ? 2 : pageCount <= 9 ? 3 : 4) : 1;
  const stackRows = Math.ceil(pageCount / stackCols);
  /** Sheets may be different paper sizes; each sits in a cell big enough for the largest. */
  const cellW = Math.max(...Object.values(D.sheets).map((x) => x.pageWidth)), cellH = Math.max(...Object.values(D.sheets).map((x) => x.pageHeight));
  const stackW = stackCols * cellW + (stackCols - 1) * GAP;
  const stackH = stackRows * cellH + (stackRows - 1) * GAP;
  const pagePos = (k: number) => ({ x: (k % stackCols) * (cellW + GAP), y: Math.floor(k / stackCols) * (cellH + GAP) });
  /** The pan that brings sheet k into view: its top near the top of the window when it is taller than the window, else its middle. */
  const panForPage = (k: number, zoom: number) => {
    const scale = PX_PER_IN * zoom, pos = pagePos(Math.max(0, Math.min(pageCount - 1, k)));
    const vh = viewportRef.current?.clientHeight ?? 600;
    const x = -(pos.x + cellW / 2 - stackW / 2) * scale;
    const tall = cellH * scale > vh - 70;
    const y = tall ? 40 - vh / 2 - (pos.y - stackH / 2) * scale : -(pos.y + cellH / 2 - stackH / 2) * scale;
    return { x, y };
  };
  /** In a scrolling column or grid: the sheet nearest the middle of the window. */
  const visiblePage = (() => {
    if (!stack) return currentPage;
    const scale = PX_PER_IN * view.zoom;
    const cx = stackW / 2 - view.pan.x / scale, cy = stackH / 2 - view.pan.y / scale;
    const col = Math.max(0, Math.min(stackCols - 1, Math.floor(cx / (cellW + GAP))));
    const row = Math.max(0, Math.min(stackRows - 1, Math.floor(cy / (cellH + GAP))));
    return Math.min(pageCount - 1, row * stackCols + col);
  })();
  const patchView = useCallback((patch: Partial<View>) => setViews((v) => ({ ...v, [workspace]: { ...v[workspace], ...patch } })), [workspace]);
  const widthOf = (w: Workspace) => (w === "template" ? template.width : stack ? stackW : sheet.pageWidth);
  const heightOf = (w: Workspace) => (w === "template" ? template.height : stack ? stackH : sheet.pageHeight);

  const fitZoom = (w: Workspace) => {
    const el = viewportRef.current;
    const availW = Math.max(120, (el?.clientWidth ?? 800) - 110);
    const availH = Math.max(120, (el?.clientHeight ?? 600) - 150);
    // A scrolling column fits the sheet's width (you scroll for the rest); everything else fits whole.
    const fitH = w === "layout" && pageView === "scroll" ? Infinity : availH / (heightOf(w) * PX_PER_IN);
    return Number(clamp(Math.min(availW / (widthOf(w) * PX_PER_IN), fitH), MIN_ZOOM, MAX_ZOOM).toFixed(2));
  };

  // First visit to a workspace (or after its size changed from a preset): fit and center it.
  useLayoutEffect(() => {
    if (!view.fitted && viewportRef.current) { const zoom = fitZoom(workspace); patchView({ zoom, pan: pageView === "scroll" && stack ? panForPage(currentPage, zoom) : { x: 0, y: 0 }, fitted: true }); }
  }, [workspace, view.fitted]);
  // Changing how sheets are shown (or how many there are) refits.
  useEffect(() => { setViews((v) => ({ ...v, layout: { ...v.layout, fitted: false } })); }, [pageView, pageCount, sheet.pageWidth, sheet.pageHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  const setZoom = (zoom: number) => patchView({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
  const toggleZoomPreset = () => {
    const fit = fitZoom(workspace);
    const zoom = Math.abs(view.zoom - fit) < 0.02 ? 1 : fit;
    patchView({ zoom, pan: pageView === "scroll" && stack ? panForPage(visiblePage, zoom) : { x: 0, y: 0 } });
  };

  const switchWorkspace = (next: Workspace) => {
    setWorkspace(next);
    setSelectedIds([]);
    setInstanceSel(null);
    setEditingText(null);
    setPreview(false);
  };

  // ── Alternating template management ─────────────────────────────────────
  const addVariant = () => {
    const id = uid();
    const name = `Template ${String.fromCharCode(65 + variants.length)}`;
    // One undo step: the copy (same item ids, so hand edits carry over) and the new entry in the list.
    doc.set((d) => ({ ...d, items: { ...d.items, [id]: (d.items[variantId] ?? []).map((item) => ({ ...item })) }, variants: [...d.variants, { id, name }] }));
    setActiveVariant(id);
    setSelectedIds([]);
  };
  const deleteVariant = (id: string) => {
    if (variants.length < 2 || !window.confirm("Delete this template? Records that used it will fall back to the first template.")) return;
    doc.set((d) => { const { [id]: _gone, ...items } = d.items; return { ...d, items, variants: d.variants.filter((v) => v.id !== id), rules: d.rules.filter((r) => r.variantId !== id) }; });
    if (variantId === id) setActiveVariant(variants.find((v) => v.id !== id)!.id);
    setSelectedIds([]);
  };

  // ── Items ───────────────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, patch: Partial<DesignItem>, coalesce?: string) =>
    history.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)), { coalesce }), [history.set]);

  const addItem = (item: DesignItem) => {
    history.set((list) => [...list, item]);
    setSelectedIds([item.id]);
    setWorkspace("template");
    setPreview(false);
  };
  const addItems = (added: DesignItem[]) => {
    history.set((list) => [...list, ...added]);
    setSelectedIds(added.map((item) => item.id));
  };

  const addText = (field?: string, x = 0.5, y = 0.5) =>
    addItem({ id: uid(), type: "text", x, y, w: 2.5, h: 0.28, text: field ? fieldDisplayName(field) : "Your text", field, fontSize: 12, color: "#34443d", weight: 500, visible: true });

  /** Text with a white background, a thin frame and some padding: a ready-made box for notes and labels. */
  const addShape = () => addItem({ id: uid(), type: "rect", x: 0.35, y: 0.35, w: 1.1, h: 0.65, fill: "#e9eee9", stroke: "#cbd5cc", visible: true });

  const deleteSelected = () => {
    if (!selectedIds.length) return;
    history.set((list) => list.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };
  const copySelected = () => { if (selectedItems.length) setClipboard(selectedItems.map((item) => ({ ...item }))); };
  const cutSelected = () => { copySelected(); deleteSelected(); };
  const cloneOffset = (list: DesignItem[]) => cloneItems(list, 0.12, 0.12); // each copied group becomes its own new group
  const pasteItems = () => {
    if (!clipboard.length) return;
    const pasted = cloneOffset(clipboard);
    setClipboard(pasted); // successive pastes cascade
    addItems(pasted);
    setWorkspace("template");
  };
  const duplicateSelected = () => { if (selectedItems.length) addItems(cloneOffset(selectedItems)); };

  const moveMany = (updates: { id: string; x: number; y: number }[]) => history.set((list) => {
    const byId = new Map(updates.map((u) => [u.id, u]));
    return list.map((item) => (byId.has(item.id) ? { ...item, x: byId.get(item.id)!.x, y: byId.get(item.id)!.y } : item));
  }, { coalesce: "drag" });
  // ── Groups ──────────────────────────────────────────────────────────────
  const selectedGroupIds = [...new Set(selectedItems.flatMap((i) => (i.groupId ? [i.groupId] : [])))];
  /** The selection is exactly one whole group. */
  const wholeGroup = selectedGroupIds.length === 1 && selectedItems.length > 1 && items.filter((i) => i.groupId === selectedGroupIds[0]).length === selectedItems.length;
  const canGroup = selectedItems.length > 1 && !wholeGroup;
  const canUngroup = selectedGroupIds.length > 0;
  const groupSelected = () => { if (selectedItems.length > 1) history.set((list) => groupItems(list, selectedIds, nextGroupName(list))); };
  const ungroupSelected = () => history.set((list) => ungroupItems(list, selectedIds));
  const renameGroup = (groupId: string, name: string) => history.set((list) => renameGroupIn(list, groupId, name), { coalesce: `rename-group:${groupId}` });
  const updateMany = (ids: string[], patch: Partial<DesignItem>, coalesce?: string) => history.set((list) => list.map((item) => (ids.includes(item.id) ? { ...item, ...patch } : item)), coalesce ? { coalesce } : undefined);
  const selectGroupOf = (id: string) => { const item = items.find((i) => i.id === id); if (item) setSelectedIds(item.groupId ? items.filter((i) => i.groupId === item.groupId).map((i) => i.id) : [id]); };
  const scaleGroup = (updates: { id: string; x: number; y: number; w: number; h: number; fontSize?: number }[]) => history.set((list) => {
    const byId = new Map(updates.map((u) => [u.id, u]));
    return list.map((item) => { const u = byId.get(item.id); return u ? { ...item, x: u.x, y: u.y, w: u.w, h: u.h, ...(u.fontSize !== undefined ? { fontSize: u.fontSize } : {}) } : item; });
  }, { coalesce: "scale-group" });

  const resizeItem = (id: string, box: { x: number; y: number; w: number; h: number }) => updateItem(id, box, `resize:${id}`);
  const applyTransforms = (updates: Transform[], coalesce: string) => history.set((list) => {
    const byId = new Map(updates.map((u) => [u.id, u]));
    return list.map((item) => (byId.has(item.id) ? { ...item, ...byId.get(item.id)! } : item));
  }, { coalesce });
  const rotateGroup = (updates: Transform[]) => applyTransforms(updates, "rotate-group");
  const rotateSelectionBy = (delta: number) => {
    const members = framed(selectedItems);
    const movable = members.filter((item) => !item.locked);
    if (movable.length) applyTransforms(rotateAbout(movable, delta, centerOf(boundsOf(members))), `rotate-by:${Date.now()}`);
  };
  const rotateItem = (id: string, rotation: number) => updateItem(id, { rotation }, `rotate:${id}`);

  // Alignment, distribution, box-select and group rotation all work on each item's drawn frame (wrapped text can
  // be taller than its box), so they agree with the outlines on screen. Only positions are written back.
  const framed = (list: DesignItem[]) => list.map((item) => (item.type === "text" ? { ...item, h: itemFrame(item, currentRecord, meta).h / PX_PER_IN } : item));
  const keepPositions = (original: DesignItem[], moved: DesignItem[]) =>
    original.map((item, i) => (moved[i].x === item.x && moved[i].y === item.y ? item : { ...item, x: moved[i].x, y: moved[i].y }));

  /**
   * Alignment and distribution work on units: a group is one box, every other object its own. A single unit
   * aligns to the template; several align to each other. Only positions change.
   */
  const alignUnits = (arrange: (boxes: DesignItem[], keys: string[]) => DesignItem[], boxesWithin: "selection" | "template") => {
    history.set((list) => {
      const framedList = framed(list);
      const units = unitsOf(framedList, selectedIds);
      if (!units.length) return list;
      const boxes: DesignItem[] = units.map((u) => { const b = boundsOf(u.members); return { id: u.key, type: "rect", x: b.x, y: b.y, w: b.w, h: b.h, locked: u.members.every((m) => m.locked) } as DesignItem; });
      void boxesWithin;
      const moved = arrange(boxes, units.map((u) => u.key));
      const shift = new Map(units.map((u, i) => [u.key, { dx: moved[i].x - boxes[i].x, dy: moved[i].y - boxes[i].y }]));
      return list.map((item) => { const d = shift.get(item.groupId ?? item.id); return d && !item.locked && (d.dx || d.dy) ? { ...item, x: Number((item.x + d.dx).toFixed(3)), y: Number((item.y + d.dy).toFixed(3)) } : item; });
    });
  };
  const align = (mode: AlignMode) => {
    const unitCount = unitsOf(items, selectedIds).length;
    const within = unitCount > 1 ? boundsOf(framed(selectedItems)) : { x: 0, y: 0, w: template.width, h: template.height };
    alignUnits((boxes, keys) => alignItems(boxes, keys, mode, within), "selection");
  };
  const distribute = (axis: "x" | "y") => alignUnits((boxes, keys) => distributeItems(boxes, keys, axis), "selection");

  const onMarquee = (box: { x: number; y: number; w: number; h: number }, additive: boolean) => {
    const hits = framed(items)
      .filter((item) => item.visible !== false)
      .filter((item) => { const b = aabb(item); return b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y; })
      .map((item) => item.id);
    const withGroups = expandToGroups(items, hits);
    setSelectedIds((current) => (additive ? [...new Set([...current, ...withGroups])] : withGroups));
  };

  // ── Editing a text object in place ──
  const [inlineEdit, setInlineEdit] = useState<{ id: string; draft: string } | null>(null);
  const startInlineEdit = (id: string) => {
    const item = liveItems.find((i) => i.id === id);
    if (!item || item.type !== "text") return;
    // Linked text is edited as its tokens, so the preview pauses and field names can be typed or mixed with other words.
    setInlineEdit({ id, draft: item.field ? `{{${item.field.startsWith("__") ? fieldDisplayName(item.field) : item.field}}}` : item.text ?? "" });
  };
  const finishInlineEdit = (save: boolean) => {
    const edit = inlineEdit;
    setInlineEdit(null);
    const item = edit && liveItems.find((i) => i.id === edit.id);
    if (!edit || !item || !save) return;
    const whole = edit.draft.trim().match(/^\{\{\s*([^{}|#^/]+?)\s*\}\}$/); // exactly one field: keep it a real link
    const named = whole && [...fields, ...specialFields.map((f) => f.key)].find((f) => f === whole[1] || fieldDisplayName(f).toLowerCase() === whole[1].toLowerCase());
    const next = named ? { field: named, text: fieldDisplayName(named) } : { field: undefined, text: edit.draft };
    if (next.field === item.field && next.text === item.text) return;
    updateItem(item.id, next);
  };
  useEffect(() => { if (inlineEdit && workspace !== "template") finishInlineEdit(true); }); // leaving the template saves the edit
  const arrange = (mode: ArrangeMode) => history.set((list) => reorderSelection(list, selectedIds, mode));
  const reorderLayer = (id: string, targetId: string, above: boolean, asGroup: boolean) => history.set((list) => moveLayerTo(list, id, targetId, above, asGroup));

  const bindField = (field: string) => {
    if (justDragged.current) return;
    if (selected?.type === "text") updateItem(selected.id, { field, text: fieldDisplayName(field) });
    else addText(field);
    if (!window.matchMedia(WIDE_QUERY).matches) setDataOpen(false); // overlay drawer: reveal the result
  };

  // ── Data import ─────────────────────────────────────────────────────────
  const adoptData = (next: RecordRow[], name: string, mapping?: Record<string, string | null>) => {
    doc.set((d) => ({ ...d, records: withIds(next), fileName: name, items: mapping ? mapAllTemplates(d.items, mapping) : d.items }));
    setRecordIndex(0);
    setPendingImport(null);
  };

  /** Use the new records in place of the current ones, matching the template's links first if it needs columns they lack. */
  const replaceWith = (incoming: { records: RecordRow[]; fileName: string }) => {
    const norm = (k: string) => k.toLowerCase().replace(/[\s_]+/g, "_");
    const columns = new Set(Object.keys(incoming.records[0] ?? {}).map(norm));
    if (boundFields(items).some((field) => !columns.has(norm(field)))) setPendingImport({ ...incoming, stage: "map" });
    else adoptData(incoming.records, incoming.fileName);
  };
  const replaceWithImport = () => { if (pendingImport) replaceWith(pendingImport); };
  /**
   * New records are coming in. If the current ones are only the built-in sample (or nothing has been typed), there is nothing to
   * replace or merge with, so they simply arrive; the untouched sample card adapts to the new columns, or gives way to a blank design.
   */
  const beginImport = (incoming: RecordRow[], name: string) => {
    if (!isPlaceholderData(records)) { setPendingImport({ records: incoming, fileName: name, stage: "choose" }); return; }
    if (!isPlaceholderDesign(items)) { replaceWith({ records: incoming, fileName: name }); return; }
    const bound = boundFields(items);
    const suggestions = suggestMapping(bound, Object.keys(incoming[0] ?? {}));
    const mapping: Record<string, string | null> = Object.fromEntries(bound.map((f) => [f, suggestions[f].column]));
    const unmatched = new Set(bound.filter((f) => !mapping[f]));
    const adapt = bound.length - unmatched.size >= 2;
    doc.set((d) => ({
      ...d, records: withIds(incoming), fileName: name,
      items: adapt
        ? Object.fromEntries(Object.entries(mapAllTemplates(d.items, mapping)).map(([id, list]) => [id, list.filter((i) => !(i.field && unmatched.has(i.field)) && !(!i.field && tokenFields(i.text ?? "").some((f) => unmatched.has(f))))]))
        : Object.fromEntries(Object.keys(d.items).map((id) => [id, [] as DesignItem[]])),
    }));
    setRecordIndex(0);
  };
  /** "Add" or "Merge": the finished list, as one undo step. */
  const combineImport = (rows: RecordRow[]) => { recordHistory.set(() => rows); setPendingImport(null); };
  /** Records that came from somewhere other than a file (pasted cells, a Google Sheet): ask replace, add or merge. */
  const importRecords = (records: RecordRow[], name: string) => {
    setPasteOpen(false); setSheetsOpen(false);
    if (!records.length) { window.alert("No records were found."); return; }
    beginImport(records, name);
  };
  const importData = (file: File) => {
    Papa.parse<RecordRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data.filter((row) => Object.values(row).some((v) => String(v ?? "").trim()));
        if (!cleaned.length) { window.alert("No records were found in that file."); return; }
        beginImport(cleaned, file.name); // ask replace, add or merge, unless there is only sample data to replace
      },
      error: () => window.alert("That file could not be read."),
    });
  };

  // ── Pictures ────────────────────────────────────────────────────────────
  const pictureBox = (asset?: Asset) => {
    const w = 1.2;
    return { w, h: asset ? clamp(w / (asset.width / asset.height || 1), 0.25, 2.5) : w };
  };
  const insertPicture = (asset: Asset) => {
    if (libraryDialog?.kind === "insert" && libraryDialog.reference) {
      // A reference image: sized to the template, faded, locked and at the very bottom, and never printed.
      const aspect = (asset.width / asset.height) || 1; const w = Math.min(template.width, template.height * aspect), h = w / aspect;
      const item: DesignItem = { id: uid(), type: "image", x: (template.width - w) / 2, y: (template.height - h) / 2, w, h, assetId: asset.id, assetName: asset.name, visible: true, reference: true, locked: true, opacity: 0.5 };
      history.set((list) => [item, ...list]);
      setSelectedIds([item.id]); setWorkspace("template"); setPreview(false); setLibraryDialog(null);
      return;
    }
    addItem({ id: uid(), type: "image", x: 0.35, y: 0.35, ...pictureBox(asset), assetId: asset.id, assetName: asset.name, visible: true });
    setLibraryDialog(null);
  };
  const insertDataDriven = () => {
    addItem({ id: uid(), type: "image", x: 0.35, y: 0.35, ...pictureBox(), imageSource: defaultImageSource(fields), visible: true });
    setLibraryDialog(null);
  };
  const choosePicture = (itemId: string, target: "asset" | "fallback", asset: Asset) => {
    if (inLayoutEdit && instRecord) {
      setInstanceItem(instRecord[ID], itemId, target === "fallback" ? { fallbackAssetId: asset.id } : { assetId: asset.id, assetName: asset.name, imageSource: null, src: null });
      setLibraryDialog(null);
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (target === "fallback") updateItem(itemId, { fallbackAssetId: asset.id });
    else {
      // Keep the box's width and follow the new picture's proportions (static pictures only).
      const box = item.imageSource ? {} : { h: Number(clamp(item.w / (asset.width / asset.height || 1), 0.1, 6).toFixed(3)) };
      updateItem(itemId, { assetId: asset.id, assetName: asset.name, src: undefined, ...box });
    }
    setLibraryDialog(null);
  };
  const setOverrides = (itemId: string, changes: Record<string, string | null>) =>
    history.set((list) => list.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...(item.overrides ?? {}) };
      for (const [recordId, assetId] of Object.entries(changes)) { if (assetId) next[recordId] = assetId; else delete next[recordId]; }
      return { ...item, overrides: next };
    }));
  /** Distinct web addresses a data-driven picture would fetch, not yet saved in the library. */
  const webUrlsFor = (item: DesignItem) => {
    const urls = new Set<string>();
    for (const record of activeRecords) { const m = library.resolver.resolve(item, record); for (const x of [m, ...m.alternates]) if (x.url && isWebUrl(x.url)) urls.add(x.url); }
    return [...urls];
  };
  const cacheWebPictures = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const urls = webUrlsFor(item);
    if (!urls.length) { setStatus({ text: "Everything from the web is already saved in the library.", kind: "ok" }); return; }
    setStatus({ text: `Saving ${urls.length} web picture${urls.length === 1 ? "" : "s"} to the library…`, kind: "info", busy: true });
    const result = await library.addRemote(urls, (done, total) => setStatus({ text: `Saving web pictures… ${done} of ${total}`, kind: "info", busy: true }));
    setStatus(result.failed.length
      ? { text: `Saved ${result.added} of ${urls.length}. ${result.failed.length} couldn’t be downloaded; they’ll still load from the web when printing.`, kind: "warn", detail: [...new Set(result.failed.map((f) => f.reason))] }
      : { text: `Saved ${result.added} picture${result.added === 1 ? "" : "s"} to the library. They now work offline and travel with the project.`, kind: "ok" });
  };
  const checkWebPictures = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const urls = webUrlsFor(item);
    if (!urls.length) { setStatus({ text: "No web pictures to check (they’re all saved in the library or the rule has none).", kind: "ok" }); return; }
    setStatus({ text: `Checking ${urls.length} web address${urls.length === 1 ? "" : "es"}…`, kind: "info", busy: true });
    const result = await checkImageUrls(urls, (done, total) => setStatus({ text: `Checking web pictures… ${done} of ${total}`, kind: "info", busy: true }));
    setStatus(result.failed.size
      ? { text: `${result.loaded.size} loaded, ${result.failed.size} didn’t.`, kind: "warn", detail: [...result.failed].slice(0, 5) }
      : { text: `All ${result.loaded.size} web pictures loaded.`, kind: "ok" });
  };
  const imageTools = { webCount: (item: DesignItem) => webUrlsFor(item).length, onCacheWeb: cacheWebPictures, onCheckWeb: checkWebPictures, library, columns: fields, record: currentRecord, records: activeRecords, onChoose: (itemId: string, target: "asset" | "fallback") => setLibraryDialog({ kind: "pick", itemId, target }), onReview: (itemId: string) => setReviewItemId(itemId) };

  // ── Template / page setup ───────────────────────────────────────────────
  const applyPreset = (preset: LabelPreset) => {
    // Template size and page layout change together, as a single undo step.
    doc.set((d) => ({ ...d, template: { ...d.template, width: preset.width, height: preset.height }, sheets: { ...Object.fromEntries(Object.entries(d.sheets).map(([id, s]) => [id, { ...s, pageWidth: 8.5, pageHeight: 11 }])), [activeId]: { ...d.sheets[activeId], placements: undefined, pageWidth: 8.5, pageHeight: 11, columns: preset.columns, rows: preset.rows, gapX: preset.gapX, gapY: preset.gapY, marginX: preset.marginX, marginY: preset.marginY } } }));
    setViews((v) => ({ template: { ...v.template, fitted: false }, layout: { ...v.layout, fitted: false } }));
  };

  // ── Dragging a field from the drawer onto the canvas (mouse, touch long-press, pen) ──
  const dropField = (field: string, clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const element = document.elementFromPoint(clientX, clientY);
    if (workspace !== "template" || !svg || !element?.closest(".viewport")) return;
    const targetId = element.closest("[data-item-id]")?.getAttribute("data-item-id");
    const target = items.find((item) => item.id === targetId);
    if (target?.type === "text") { updateItem(target.id, { field, text: fieldDisplayName(field) }); setSelectedIds([target.id]); return; }
    const rect = svg.getBoundingClientRect();
    const scale = PX_PER_IN * view.zoom;
    addText(field, Number(((clientX - rect.left) / scale).toFixed(2)), Number(((clientY - rect.top) / scale).toFixed(2)));
  };

  const startFieldDrag = (field: string, event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const { pointerId, clientX: startX, clientY: startY } = event;
    const touch = event.pointerType !== "mouse";
    // A chip from the Fields drawer travels as itself, held at the same spot you grabbed it.
    const source = event.currentTarget as HTMLElement;
    const chip = source.classList.contains("field-row") ? source.getBoundingClientRect() : null;
    const grab = chip ? { dx: startX - chip.left, dy: startY - chip.top, w: chip.width } : null;
    let active = false;
    const begin = () => { active = true; setFieldDrag({ field, x: startX, y: startY, grab }); navigator.vibrate?.(8); };
    const timer = touch ? window.setTimeout(begin, 260) : undefined;
    const blockScroll = (e: TouchEvent) => { if (active) e.preventDefault(); };
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", blockScroll);
      setFieldDrag(null);
      setDropTargetId(null);
    };
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!active && Math.hypot(dx, dy) > (touch ? 8 : 5)) {
        // On a touch screen a mostly sideways swipe picks the chip up straight away (the list only scrolls up and down, so the browser
        // leaves a sideways gesture alone); moving up or down first means the person is scrolling the list.
        if (touch && !(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5)) { cleanup(); return; }
        begin();
      }
      if (active) {
        setFieldDrag({ field, x: e.clientX, y: e.clientY, grab });
        const over = document.elementFromPoint(e.clientX, e.clientY);
        const id = over?.closest(".viewport") ? over.closest("[data-item-id]")?.getAttribute("data-item-id") : null;
        setDropTargetId(!field.startsWith("@tpl:") && id && itemsRef.current.find((i) => i.id === id)?.type === "text" ? id : null);
      }
    }
    function end(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const wasActive = active;
      cleanup();
      if (!wasActive) return;
      if (e.type === "pointerup") {
        if (field.startsWith("@tpl:")) dropTemplate(field.slice(5), e.clientX, e.clientY);
        else dropField(field, e.clientX, e.clientY);
        if (!window.matchMedia(WIDE_QUERY).matches) { setDataOpen(false); setRecordsOpen(false); } // overlay drawers: reveal the result
      }
      justDragged.current = true; // swallow the click that follows a drag
      window.setTimeout(() => { justDragged.current = false; }, 60);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("touchmove", blockScroll, { passive: false });
  };

  // ── Projects: autosave to this browser, plus save / open as a file ──
  const snapshot = (): Project => ({
    version: 1, name: docName, fileName, records, items: itemsDoc.value[variants[0].id] ?? [], template, sheet: mainSheet, pages: D.pages.map((p) => ({ ...p, sheet: D.sheets[p.id] })), plan: D.plan, fonts: fontLibrary.fonts,
    variants: variants.map((v) => ({ ...v, items: itemsDoc.value[v.id] ?? [] })), rules, overrides: instanceOverrides,
  });
  useEffect(() => {
    const timer = window.setTimeout(() => setSaveState(saveProject(snapshot()) ? "saved" : "error"), 600);
    return () => window.clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const applyProject = async (raw: Project, images?: { asset: Asset; blob: Blob }[]) => {
    const project = upgradeProject(raw);
    if (images) await library.replaceAll(images);
    const vs = project.variants?.length ? project.variants : [{ id: "a", name: "Template A", items: project.items }];
    const pgs = project.pages?.length ? project.pages : [{ id: "p1", name: "Page 1", sheet: project.sheet }];
    doc.reset({
      items: Object.fromEntries(vs.map((v) => [v.id, v.items])), variants: vs.map(({ id, name }) => ({ id, name })), rules: project.rules ?? [],
      template: project.template, sheets: Object.fromEntries(pgs.map((p) => [p.id, p.sheet])), pages: pgs.map(({ id, name }) => ({ id, name })), plan: project.plan ?? defaultPlan(pgs[0].id), records: withIds(project.records), fileName: project.fileName, overrides: project.overrides ?? {},
    });
    setActiveVariant(vs[0].id); setInstanceSel(null); setEditingText(null); setDocName(project.name);
    fontLibrary.restore(project.fonts);
    setSelectedIds([]); setRecordIndex(0); setSheetIndex(0);
    setGuides({ template: [], layout: [] });
    setViews({ template: freshView(), layout: freshView() });
  };
  /** A blank project: an empty design at the chosen size, and a data table with one empty column to start filling in. */
  const createBlankProject = async (size: { width: number; height: number }, sheet: Sheet) => {
    setNewProjectOpen(false);
    await library.clear();
    setShowData(false); setWorkspace("template"); setPreview(false);
    await applyProject({ version: 1, name: "Untitled project", fileName: "data.csv", records: [{ Name: "" }], items: [], template: size, sheet, fonts: [] });
  };
  /** Starts a new project from a gallery template. The image library is kept. */
  const useTemplate = async (project: Project) => {
    if (!window.confirm(`Start from “${project.name}”? This replaces your current project (its design, data and page layout).`)) return;
    setGalleryOpen(false); setShowData(false); setWorkspace("template"); setPreview(false);
    await applyProject(project);
  };
  const openProject = async (file: File) => {
    try { const { project, images } = await readProjectAny(file); await applyProject(project, images); }
    catch (error) { window.alert(error instanceof Error ? error.message : "That project file could not be opened."); }
  };
  /** One .zip when the project uses pictures (they travel with it); a plain .json otherwise. */
  const saveToFile = async () => {
    const project = snapshot();
    if (!library.assets.length) { downloadBlob(new Blob([JSON.stringify(project)], { type: "application/json" }), projectFileName(docName, false)); return; }
    downloadBlob(await bundleProject(project, library.assets, library.blobOf), projectFileName(docName, true));
  };

  // ── Data table edits (all undoable with the Data view's own undo) ──
  const idSet = (ids: string[]) => new Set(ids);
  const dataActions = {
    onCell: (id: string, column: string, value: string) => editRecords((rows) => setCell(rows, id, column, value), `cell:${id}:${column}`),
    onInclude: (ids: string[], included: boolean) => editRecords((rows) => setIncluded(rows, idSet(ids), included)),
    onOnly: (ids: string[]) => editRecords((rows) => {
      const keep = idSet(ids);
      return setIncluded(setIncluded(rows, new Set(rows.filter((r) => !keep.has(r[ID])).map((r) => r[ID])), false), keep, true);
    }),
    onAddRow: () => editRecords((rows) => [...rows, blankRow(columnsOf(rows))]),
    onDuplicate: (ids: string[]) => editRecords((rows) => duplicateRows(rows, idSet(ids))),
    onDelete: (ids: string[]) => editRecords((rows) => keepOneRow(rows.filter((row) => !ids.includes(row[ID])), columnsOf(rows))),
    onAddColumn: () => {
      const name = window.prompt("New column name")?.trim();
      if (!name) return;
      if (fields.includes(name)) { window.alert(`There’s already a column called “${name}”.`); return; }
      editRecords((rows) => addColumn(rows, name));
    },
    onRenameColumn: (column: string) => {
      const name = window.prompt("Rename column", column)?.trim();
      if (!name || name === column) return;
      if (fields.includes(name)) { window.alert(`There’s already a column called “${name}”.`); return; }
      // One undo step: the column and everything linked to it in every template.
      doc.set((d) => ({ ...d, records: renameColumn(d.records, column, name), items: mapAllTemplates(d.items, { [column]: name }) }));
    },
    onDeleteColumn: (column: string) => {
      const used = items.some((item) => item.field === column);
      if (window.confirm(`Delete the “${column}” column?${used ? " Text linked to it will show “—”." : ""}`)) editRecords((rows) => removeColumn(rows, column));
    },
    onSort: (column: string, direction: 1 | -1) => { editRecords((rows) => sortRows(rows, column, direction)); setDataSort({ column, dir: direction }); },
    onReorderColumn: (column: string, target: string, after: boolean) => editRecords((rows) => reorderColumns(rows, column, target, after)),
    onPaste: (id: string, column: string, grid: string[][]) => editRecords((rows) => pasteGrid(rows, fields, id, column, grid)),
    onExport: () => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([toCsv(records, fields)], { type: "text/csv" }));
      link.download = fileName.replace(/\.[^.]+$/, "") + "-edited.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
  };

  // ── Page layout: editing one record's copy ──────────────────────────────
  const commitInstanceText = (value: string) => {
    if (editingText) { setInstanceItem(editingText.recordId, editingText.itemId, { field: null, text: value }); setInstanceSel(editingText); }
    setEditingText(null);
  };
  const dropPictureOnSlot = async (recordId: string, itemId: string | null, files: Parameters<typeof library.addFiles>[0]) => {
    const index = indexOfRecord(recordId);
    const list = index >= 0 ? instanceFor(activeRecords[index], index, index % slots).items : [];
    let target = list.find((i) => i.id === itemId && i.type === "image");
    if (!target) { const pictures = list.filter((i) => i.type === "image" && i.visible !== false); if (pictures.length === 1) target = pictures[0]; }
    if (!target) { setStatus({ text: "Drop the picture onto a picture box.", kind: "warn" }); return; }
    const result = await library.addFiles(files);
    const asset = result.assets[0];
    if (!asset) { setStatus({ text: "That file couldn’t be used as a picture.", kind: "warn", detail: result.skipped.map((s) => `${s.name}: ${s.reason}`).slice(0, 3) }); return; }
    setInstanceItem(recordId, target.id, { assetId: asset.id, assetName: asset.name, imageSource: null, src: null });
    setInstanceSel({ recordId, itemId: target.id });
  };
  /** From the text audit (or a badge): go to that record's sheet with the text selected, ready to fix. */
  const fixOnPage = (recordId: string, itemId: string) => {
    const index = indexOfRecord(recordId);
    if (index < 0) return;
    setAuditDialog(null); setShowData(false); setWorkspace("layout"); setPreview(false); setSelectedIds([]);
    setRecordIndex(index); setInstanceMode(true); setInstanceSel({ recordId, itemId }); setInspectorOpen(true);
  };
  const jumpToInstance = (recordId: string) => {
    const index = indexOfRecord(recordId);
    if (index >= 0) { setRecordIndex(index); setInstanceMode(true); setInstanceSel(null); }
  };
  const editedList = Object.entries(instanceOverrides).filter(([, o]) => hasEdits(o)).flatMap(([recordId, o]) => {
    const record = activeRecords.find((r) => r[ID] === recordId);
    return record ? [{ recordId, label: recordLabel(record), off: !!o.off }] : [];
  });
  const instanceBanner = inLayoutEdit && instRecord && instanceSel ? {
    recordLabel: recordLabel(instRecord),
    itemEdited: !!instOverride?.items[instanceSel.itemId],
    off: !!instOverride?.off,
    onRevertItem: () => revertInstanceItem(instRecord[ID], instanceSel.itemId),
    onToggleOff: () => toggleInstanceOff(instRecord[ID]),
    onResetInstance: () => { resetInstance(instRecord[ID]); setInstanceSel(null); },
  } : null;

  const recBanner = recMode && selected && currentRecord[ID] ? {
    recordLabel: recordLabel(currentRecord),
    itemEdited: !!recOverride?.items[selected.id],
    off: !!recOverride?.off,
    onRevertItem: () => revertInstanceItem(currentRecord[ID], selected.id),
    onToggleOff: () => toggleInstanceOff(currentRecord[ID]),
    onResetInstance: () => resetInstance(currentRecord[ID]),
  } : null;

  // ── Records ─────────────────────────────────────────────────────────────
  const stepRecord = (delta: number) => {
    if (pagedNav) {
      const page = clamp((stack ? visiblePage : currentPage) + delta, 0, pageCount - 1);
      setSheetIndex(page);
      setRecordIndex(Math.min(Math.max(0, activeRecords.length - 1), seq[page]?.base ?? 0));
      if (stack) patchView({ pan: panForPage(page, view.zoom) });
    }
    else setRecordIndex((index) => clamp(index + delta, 0, Math.max(0, activeRecords.length - 1)));
  };

  // ── Print: mount every sheet, print, then unmount ───────────────────────
  /**
   * Nothing prints until pictures and text have been checked: web pictures are actually loaded, picture rules that
   * match nothing are counted, and text that doesn't fit is counted. Problems need a confirmation.
   */
  const printNow = async () => {
    if (printing) { window.print(); return; }
    setStatus({ text: "Checking pictures and text before printing…", kind: "info", busy: true });
    const indices = allIndices();
    const urls = new Set<string>();
    const chains: { web: string[]; local: boolean; empty: boolean }[] = [];
    let textProblems = 0;
    for (const index of indices) {
      const record = activeRecords[index];
      const inst = instanceFor(record, index, index % slots);
      textProblems += instanceIssues(inst.items, record, metaFor(index), { w: template.width, h: template.height }).length;
      for (const item of inst.items) {
        if (item.type !== "image" || item.visible === false || !item.imageSource) continue;
        const match = library.resolver.resolve(item, record);
        const chain = [match, ...match.alternates].filter((m) => m.kind !== "none");
        const web = chain.filter((m) => m.url && isWebUrl(m.url)).map((m) => m.url!);
        web.forEach((u) => urls.add(u));
        chains.push({ web, local: chain.some((m) => m.asset) || !!item.fallbackAssetId, empty: chain.length === 0 });
      }
    }
    const check = await checkImageUrls([...urls], (done, total) => setStatus({ text: `Checking web pictures… ${done} of ${total}`, kind: "info", busy: true }));
    const noMatch = chains.filter((c) => c.empty && !c.local).length;
    const brokenWeb = chains.filter((c) => !c.local && c.web.length > 0 && c.web.every((u) => check.failed.has(u))).length;
    const problems = [
      brokenWeb && `${brokenWeb} web picture${brokenWeb === 1 ? "" : "s"} couldn’t be loaded`,
      noMatch && `${noMatch} picture${noMatch === 1 ? "" : "s"} ${noMatch === 1 ? "has" : "have"} no match`,
      textProblems && `${textProblems} text${textProblems === 1 ? "" : "s"} ${textProblems === 1 ? "doesn’t" : "don’t"} fit ${textProblems === 1 ? "its" : "their"} box`,
    ].filter(Boolean) as string[];
    setStatus(null);
    if (problems.length && !window.confirm(`Before printing:\n\n• ${problems.join("\n• ")}\n\nAffected pictures will print blank (or show the placeholder) and long text will spill or be cut off.\n\nPrint anyway?\n(Cancel, then use “Review matches”, “Check text fit” or “Save web pictures to the library”.)`)) return;
    setPrinting("sheets");
  };
  /** Test page for printer calibration (crosshairs 1" from each edge, outlines of every label). */
  const printCalibration = () => { if (printing) return; setPrinting("calibration"); };
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => { window.removeEventListener("afterprint", done); window.clearTimeout(timer); };
  }, [printing]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (event.target as HTMLElement).isContentEditable) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const has = selectedItems.length > 0;
      const target = doc; // one history for the whole document
      if (mod && key === "z") { event.preventDefault(); event.shiftKey ? target.redo() : target.undo(); }
      else if (mod && key === "y") { event.preventDefault(); target.redo(); }
      else if (workspace === "layout" && !away) {
        if (key === "escape") { setInstanceSel(null); setEditingText(null); setCardSel(null); }
        else if (arranging && selectedCard) {
          if (key === "delete" || key === "backspace") { event.preventDefault(); deleteCard(cardPage, selectedCard.id); }
          else if (key === "r" && !mod) { event.preventDefault(); rotateCard(cardPage, selectedCard.id, "next"); }
          else if (key.startsWith("arrow")) {
            event.preventDefault();
            const step = event.shiftKey ? 0.1 : 0.01;
            moveCard(cardPage, selectedCard.id, Number((selectedCard.x + (key === "arrowleft" ? -step : key === "arrowright" ? step : 0)).toFixed(3)), Number((selectedCard.y + (key === "arrowup" ? -step : key === "arrowdown" ? step : 0)).toFixed(3)));
          }
        }
      }
      else if (workspace !== "template" || away) return;
      else if (mod && key === "a") { event.preventDefault(); setSelectedIds(items.filter((i) => i.visible !== false).map((i) => i.id)); }
      else if (mod && key === "c") { if (has) { event.preventDefault(); copySelected(); } }
      else if (mod && key === "x") { if (has) { event.preventDefault(); cutSelected(); } }
      else if (mod && key === "v") { if (clipboard.length) { event.preventDefault(); pasteItems(); } }
      else if (mod && key === "d") { if (has) { event.preventDefault(); duplicateSelected(); } }
      else if (mod && (event.code === "BracketRight" || event.code === "BracketLeft")) { if (has) { event.preventDefault(); arrange(event.code === "BracketRight" ? (event.shiftKey ? "front" : "up") : (event.shiftKey ? "back" : "down")); } }
      else if (mod && key === "g") { event.preventDefault(); if (event.shiftKey) ungroupSelected(); else groupSelected(); }
      else if (key === "delete" || key === "backspace") { if (has) { event.preventDefault(); deleteSelected(); } }
      else if (key === "escape") setSelectedIds([]);
      else if (has && key.startsWith("arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 0.1 : snap ? 0.05 : 0.01;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        moveMany(selectedItems.filter((i) => !i.locked).map((i) => ({ id: i.id, x: Number((i.x + dx).toFixed(3)), y: Number((i.y + dy).toFixed(3)) })));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Render ──────────────────────────────────────────────────────────────
  const meta = { recordNumber: recordIndex + 1, pageNumber: currentPage + 1, recordCount: activeRecords.length, pageCount };
  /** The template as the previewed record sees it: conditional rules applied, rule-hidden objects kept (faded) so they stay selectable. */
  const displayItems = applyConditions(liveItems, currentRecord, meta, !preview);
  const toolDefs = workspace === "template" ? [
    { id: "edit", always: true, node: (
      <EditBar canGroup={canGroup} canUngroup={canUngroup} onGroup={groupSelected} onUngroup={ungroupSelected}
        hasSelection={selectedItems.length > 0} canPaste={clipboard.length > 0} canUndo={history.canUndo} canRedo={history.canRedo}
        onUndo={history.undo} onRedo={history.redo} onDelete={deleteSelected} onCut={cutSelected} onCopy={copySelected} onPaste={pasteItems}
        palette={palette("edit")} onPalette={setPalette("edit")} canDock={canDock} />) },
    { id: "align", always: false, node: <AlignBar units={unitsOf(items, selectedIds).length} onAlign={align} onDistribute={distribute} palette={palette("align")} onPalette={setPalette("align")} canDock={canDock} /> },
    { id: "arrange", always: false, node: <ArrangeBar onArrange={arrange} palette={palette("arrange")} onPalette={setPalette("arrange")} canDock={canDock} /> },
  ].filter((t) => !preview || t.id === "edit") : [];
  const dockedNow = (id: string) => palette(id).docked && canDock;
  // Floating palettes show when there is something to act on; docked ones stay put in the toolbar.
  const templateTools = {
    floating: toolDefs.filter((t) => !dockedNow(t.id) && (t.always || selectedItems.length > 0)).map((t) => <Fragment key={t.id}>{t.node}</Fragment>),
    docked: toolDefs.filter((t) => dockedNow(t.id)).map((t) => <Fragment key={t.id}>{t.node}</Fragment>),
  };
  const caption = workspace === "template"
    ? { title: variants.length > 1 ? `INDIVIDUAL TEMPLATE · ${variants.find((v) => v.id === variantId)?.name.toUpperCase()}` : "INDIVIDUAL TEMPLATE", detail: `${template.width.toFixed(2)} × ${template.height.toFixed(2)} in` }
    : { title: D.pages.length > 1 ? `PAGE LAYOUT · ${(D.pages.find((p) => p.id === activeId)?.name ?? "").toUpperCase()}` : "PAGE LAYOUT", detail: `${sheet.pageWidth} × ${sheet.pageHeight} in · ${slots} per sheet${printer.x || printer.y ? ` · printer offset ${printer.x >= 0 ? "+" : ""}${printer.x.toFixed(3)}, ${printer.y >= 0 ? "+" : ""}${printer.y.toFixed(3)} in` : ""}` };

  // The first time a tab opens, offer its tour (once; switch tours off, or replay them, in Help).
  const tourPlace: TourId = showData ? "data" : workspace;
  const tourOk = !showOutput;
  const quiet = !welcomeOpen && !helpOpen && !tour && !newProjectOpen && !pasteOpen && !sheetsOpen && !galleryOpen && !libraryDialog && !auditDialog;
  useEffect(() => {
    if (!guide.tours || guide.tourSeen[tourPlace] || !quiet || !tourOk) return;
    const timer = window.setTimeout(() => setTour(tourPlace), 900);
    return () => window.clearTimeout(timer);
  }, [tourPlace, guide.tours, guide.tourSeen, quiet, tourOk]);
  /** Output tab: open one sheet in the page layout. */
  const openSheet = (K: number) => {
    setShowOutput(false); setShowData(false); switchWorkspace("layout");
    setSheetIndex(K); setRecordIndex(Math.min(seq[K]?.base ?? 0, Math.max(0, activeRecords.length - 1)));
  };
  const outputIssues = useMemo(() => (showOutput ? computeIssues(activeRecords.map((_, i) => i)).length : 0), [showOutput, itemsDoc.value, instanceOverrides, activeRecords, rules, variants, D.sheets, template]); // eslint-disable-line react-hooks/exhaustive-deps
  /** One sheet of the print run: its own page design, showing the records its place in the plan gives it. */
  const renderSheet = (K: number) => {
    const ref = seq[K] ?? { pageId: mainId, base: 0, limit: 0, group: 0 };
    return (
      <LayoutStage bleed={bleedIn} pageId={ref.pageId} base={ref.base} limit={ref.limit} arrange={arranging} selectedCard={cardSel?.page === ref.pageId ? cardSel.id : null} onSelectCard={(id) => selectCard(ref.pageId, id, K)} onMoveCard={(id, x, y) => moveCard(ref.pageId, id, x, y)} onNumberCard={(id, n) => numberCard(ref.pageId, id, n)} onRotateCard={(id) => rotateCard(ref.pageId, id, "next")} onCardDragEnd={doc.breakGroup} showOrder={showOrder}
                    sheet={D.sheets[ref.pageId] ?? sheet} templateWidth={template.width} templateHeight={template.height} records={activeRecords} instanceFor={instanceFor}
                    pageNumber={K + 1} pageCount={pageCount} showGrid={showGrid} preview={preview}
                    offset={printer} edit={instanceMode} zoom={view.zoom} selected={instanceSel} editing={editingText}
                    onSelect={(sel) => { setInstanceSel(sel); setEditingText(null); if (sel) setInspectorOpen(true); }}
                    onStartEdit={(sel) => { const item = instanceFor(activeRecords[indexOfRecord(sel.recordId)], indexOfRecord(sel.recordId), 0).items.find((i) => i.id === sel.itemId); if (item?.type === "text") { setInstanceSel(sel); setEditingText(sel); } else if (item?.type === "image") { setInstanceSel(sel); setLibraryDialog({ kind: "pick", itemId: sel.itemId, target: "asset" }); } }}
                    onCommitText={commitInstanceText} onCancelEdit={() => setEditingText(null)}
                    onDropFiles={dropPictureOnSlot} onToggleOff={toggleInstanceOff} onResetInstance={(id) => { resetInstance(id); if (instanceSel?.recordId === id) setInstanceSel(null); }}
                  />
    );
  };

  return (
    <ImageContext.Provider value={{ resolver: library.resolver, urlFor: library.urlFor }}>
    <div className="app-shell">
      <Topbar workspace={showOutput ? "output" : showData ? "data" : workspace} onWorkspace={(tab) => { if (tab === "data") { setShowData(true); setShowOutput(false); setSelectedIds([]); } else if (tab === "output") { setShowOutput(true); setShowData(false); setSelectedIds([]); } else { setShowData(false); setShowOutput(false); switchWorkspace(tab); } }} onPrint={printNow} onHelp={() => setHelpOpen(true)} name={docName} onName={setDocName} saveState={saveState} onNew={() => setNewProjectOpen(true)} onGallery={() => setGalleryOpen(true)} onOpen={openProject} onSave={saveToFile} />

      {showData && (
        <main className="workspace">
          <DataTable
            rows={records} columns={fields} fileName={fileName}
            canUndo={recordHistory.canUndo} canRedo={recordHistory.canRedo} onUndo={recordHistory.undo} onRedo={recordHistory.redo}
            onImport={importData} onPasteData={() => setPasteOpen(true)} onGoogleSheet={() => setSheetsOpen(true)} sort={dataSort} {...dataActions}
          />
        </main>
      )}

      {showOutput && (
        <main className="workspace">
          <OutputView seq={seq} sheets={D.sheets} pages={D.pages} plan={D.plan} records={activeRecords} templateWidth={template.width} templateHeight={template.height} bleed={bleedIn}
            instanceFor={instanceFor} textIssues={outputIssues} onReviewText={() => setAuditDialog({ itemId: null })} onOpen={openSheet} onPrint={printNow} />
        </main>
      )}
      <main className="workspace" hidden={away}>
        <Toolbar
          workspace={workspace} instanceMode={instanceMode} onInstanceMode={() => { setInstanceMode((v) => !v); setInstanceSel(null); setEditingText(null); }}
          showGrid={showGrid} onGrid={() => setShowGrid((v) => !v)}
          showRulers={showRulers} onRulers={() => setShowRulers((v) => !v)}
          snap={snap} onSnap={() => setSnap((v) => !v)} snapOptions={snapOptions} onSnapOptions={changeSnapOptions}
          preview={preview} onPreview={() => setPreview((v) => !v)}
          multi={multiMode} onMulti={() => setMultiMode((v) => !v)}
          zoom={view.zoom} onZoom={setZoom} onZoomPreset={toggleZoomPreset}
          showOrder={showOrder} onShowOrder={() => setShowOrder((v) => !v)} onAddCard={() => addCard()} onAddText={() => addText()} onAddShape={addShape} onAddImage={() => setLibraryDialog({ kind: "insert" })} onAddReference={() => setLibraryDialog({ kind: "insert", reference: true })} docked={templateTools.docked} pageView={pageView} onPageView={setPageView} pageCount={pageCount}
        />

        <div className={`content-frame${dataOpen ? " data-open" : ""}${inspectorOpen ? " inspector-open" : ""}${drawers.live ? " drawer-live" : ""}`} style={drawers.vars}>
          <div className={`drawer-slot left${dataOpen ? " open" : ""}`} {...({ inert: dataOpen ? undefined : "" } as Record<string, unknown>)}>
            <DataPanel chrome={{ header: (e) => drawers.start("left", e, "swipe", 10), consumeSwipe: drawers.consumeSwipe }} onPasteData={() => setPasteOpen(true)} onGoogleSheet={() => setSheetsOpen(true)} fileName={fileName} fields={fields} recordCount={activeRecords.length} totalRecords={records.length} hasTextSelected={selected?.type === "text"} onImport={importData} onField={bindField} onFieldPointerDown={startFieldDrag} workspace={workspace} templates={variants.map((v, i) => ({ id: v.id, name: v.name, letter: String.fromCharCode(65 + i), count: placements.filter((c) => (c.variantId ?? "") === v.id).length }))} onAddTemplate={(id) => addCard(id)} cardCount={slots} perSheet={perSheet} dragging={!!fieldDrag} onClose={() => setDataOpen(false)}
              layerCount={(inLayoutEdit ? instItems : liveItems).length}
              layers={<LayersPanel items={inLayoutEdit ? instItems : liveItems} selectedItems={inLayoutEdit && instItem ? [instItem] : workspace === "layout" ? [] : selectedItems} flat={!!instanceBanner}
                onSelect={(ids) => (inLayoutEdit && instanceSel ? setInstanceSel({ recordId: instanceSel.recordId, itemId: ids[0] }) : setSelectedIds(ids))}
                onUpdate={inLayoutEdit && instRecord ? (id, patch) => setInstanceItem(instRecord[ID], id, toItemPatch(patch)) : updateItem}
                onUpdateMany={updateMany} onReorder={reorderLayer} onRenameGroup={renameGroup} multi={multiMode} />} />
          </div>

          <div className="editor-content">
            <div className="canvas-frame">
              {recMode && currentRecord[ID] && <div className="override-chip" role="status"><PencilLine size={13} /> Editing only <strong>{recordLabel(currentRecord)}</strong></div>}
              <Viewport
                containerRef={viewportRef}
                view={view}
                onView={patchView}
                widthIn={widthOf(workspace)}
                heightIn={heightOf(workspace)}
                showRulers={showRulers && !stack}
                bleedIn={workspace === "template" ? bleedIn : 0}
                guides={stack ? [] : guides[workspace]}
                onGuides={(update) => setGuides((g) => ({ ...g, [workspace]: update(g[workspace]) }))}
                onRulerDoubleClick={() => { setSelectedIds([]); setInspectorOpen(true); }}
                onBackgroundClick={() => { setSelectedIds([]); setInstanceSel(null); setCardSel(null); }}
                marqueeMode={multiMode && workspace === "template"}
                onMarquee={workspace === "template" ? onMarquee : undefined}
                paperClassName={`${preview ? "preview" : ""}${stack ? " stack" : ""}`}
              >
                {workspace === "template" ? (
                  <TemplateStage
                    items={inlineEdit ? displayItems.map((i) => (i.id === inlineEdit.id ? { ...i, text: "", field: undefined } : i)) : displayItems} record={currentRecord} meta={meta} width={template.width} height={template.height} zoom={view.zoom}
                    selectedIds={selectedIds} showGrid={showGrid} snap={snap} snapOptions={snapOptions} dropTargetId={dropTargetId} margins={template.margins} bleed={bleedIn} warnings={textTrouble.byItem} onWarning={(id, x, y) => setWarnPopup({ itemId: id, x, y })} guides={guides.template} multi={multiMode} preview={preview} rawFields={showFieldNames && !preview} svgRef={svgRef}
                    onSelect={setSelectedIds} onMove={moveMany} onResize={resizeItem} onRotate={rotateItem} onRotateGroup={rotateGroup} onScaleGroup={scaleGroup} onDragEnd={history.breakGroup} onEditText={startInlineEdit}
                  />
                ) : (
                  stack ? (
                    <div className="page-stack" style={{ width: stackW * PX_PER_IN, height: stackH * PX_PER_IN }}>
                      {Array.from({ length: pageCount }, (_, K) => {
                        const pos = pagePos(K);
                        const near = pageCount <= 10 || Math.abs(K - visiblePage) <= (pageView === "grid" ? stackCols * 2 : 2);
                        return (
                          <div key={K} className="stack-sheet" style={{ left: pos.x * PX_PER_IN, top: pos.y * PX_PER_IN }}>
                            {near ? (
                              renderSheet(K)
                            ) : <div className="layout-page placeholder" style={{ width: sheet.pageWidth * PX_PER_IN, height: sheet.pageHeight * PX_PER_IN }}>Sheet {K + 1}</div>}
                            <span className="sheet-label">Sheet {K + 1}{D.pages.length > 1 ? ` · ${D.pages.find((p) => p.id === seq[K]?.pageId)?.name ?? ""}` : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                  renderSheet(currentPage)
                  )
                )}
              </Viewport>

              {workspace === "layout" && !preview && (
                <div className="variant-bar" data-no-pan role="tablist" aria-label="Pages">
                  {D.pages.map((p, i) => <button key={p.id} role="tab" aria-selected={p.id === activeId} className={p.id === activeId ? "variant-chip active" : "variant-chip"} onClick={() => goToPage(p.id)} title={`Show ${p.name}`}>{D.pages.length > 1 ? `${String.fromCharCode(65 + i)} · ${p.name}` : p.name}</button>)}
                  <button className="variant-chip" onClick={() => addPage()} title="Add another page template: a letter, the back of a page, a second sheet style" aria-label="Add a page">+<Spark id="add-page" title="Add a page template" text="Make a second layout, like the back of a page or a letter, then choose what prints under What prints." /></button>
                </div>
              )}
              {workspace === "template" && !preview && (
                <div className="variant-bar" data-no-pan role="tablist" aria-label="Templates">
                  {variants.map((v, i) => <button key={v.id} role="tab" aria-selected={v.id === variantId} className={v.id === variantId ? "variant-chip active" : "variant-chip"} onClick={() => { setActiveVariant(v.id); setSelectedIds([]); }} title={`Edit ${v.name}`}>{variants.length > 1 ? `${String.fromCharCode(65 + i)} · ${v.name}` : v.name}</button>)}
                  <button className="variant-chip" onClick={addVariant} title="Add another template, e.g. to alternate colors between records" aria-label="Add a template">+<Spark id="add-template" title="Alternate templates" text="Add a second design, then set rules for when it applies, like every other record, or if a conference attendee is a presenter." /></button>
                </div>
              )}
              <div className="canvas-caption"><span>{caption.title}</span><span>{caption.detail}</span></div>

              {templateTools.floating}
              {inlineEdit && workspace === "template" && (() => { const it = items.find((i) => i.id === inlineEdit.id); return it ? <InlineTextEditor item={it} svgRef={svgRef} zoom={view.zoom} draft={inlineEdit.draft} onChange={(draft) => setInlineEdit({ id: inlineEdit.id, draft })} onCommit={() => finishInlineEdit(true)} onCancel={() => finishInlineEdit(false)} fields={fields} /> : null; })()}
            </div>

            <RecordsDrawer
              open={recordsOpen} records={activeRecords} fields={fields} current={recordIndex} excluded={records.length - activeRecords.length}
              onPick={(index) => { setRecordIndex(index); if (stack) patchView({ pan: panForPage(sheetOf(index), view.zoom) }); if (!window.matchMedia(WIDE_QUERY).matches) setRecordsOpen(false); }} onClose={() => setRecordsOpen(false)}
              onCellPointerDown={startFieldDrag} justDragged={() => justDragged.current} dragging={!!fieldDrag}
              pageOf={workspace === "layout" ? (index) => sheetOf(index) : undefined} currentPage={currentPage}
              sort={dataSort} onSort={dataActions.onSort} onReorderColumn={dataActions.onReorderColumn}
            />
          </div>

          <div className={`drawer-slot right${inspectorOpen ? " open" : ""}`} {...({ inert: inspectorOpen ? undefined : "" } as Record<string, unknown>)}>
            <Inspector
              chrome={{ header: (e) => drawers.start("right", e, "swipe", 10), consumeSwipe: drawers.consumeSwipe }}
              workspace={workspace}
              items={inLayoutEdit ? instItems : liveItems}
              selectedItems={inLayoutEdit && instItem ? [instItem] : workspace === "layout" ? [] : selectedItems}
              onSelect={(ids) => (inLayoutEdit && instanceSel ? setInstanceSel({ recordId: instanceSel.recordId, itemId: ids[0] }) : setSelectedIds(ids))}
              onUpdate={inLayoutEdit && instRecord ? (id, patch, coalesce) => setInstanceItem(instRecord[ID], id, toItemPatch(patch), coalesce) : updateItem}
              instance={instanceBanner ?? recBanner}
              fitNote={inLayoutEdit && instItem?.type === "text" && instRecord ? (() => { const p = textProblem(instItem, instRecord, metaFor(instIndex), cardSize); return p ? { bad: true, text: p.kind === "truncated" ? "This text is being cut off." : p.kind === "outside" ? "This text runs off the card." : "This text spills out of its box." } : { bad: false, text: "This text fits." }; })() : fitNote}
              fontLibrary={fontLibrary} onRotateBy={rotateSelectionBy} imageTools={imageTools}
              onDuplicate={duplicateSelected} onDelete={deleteSelected} onReorder={reorderLayer}
              groups={{ wholeGroup, canGroup, onGroup: groupSelected, onUngroup: ungroupSelected, onRename: renameGroup, onUpdateMany: updateMany, onSelectGroupOf: selectGroupOf }}
              templateWidth={template.width} templateHeight={template.height} onTemplateSize={(width, height) => setTemplate((t) => ({ ...t, width, height }))} bleed={template.bleed} bleedInfo={{ max: bleedMax, effective: bleedIn, standard: !!standardStock, custom: bleedHeld, edgeLimited: bleedLimit.edge < bleedLimit.gap }} onBleed={changeBleed} pages={{
                list: D.pages, activeId, plan: D.plan, summary: describePlan(D.plan, (id) => D.pages.find((x) => x.id === id)?.name ?? "Page", seq.length, activeRecords.length), sheetCount: seq.length, perSheet: Object.fromEntries(Object.keys(D.sheets).map((id) => [id, perSheetFor(id)])),
                onActivate: goToPage, onRename: renamePage, onDuplicate: (id) => { addPage({ name: nextPageName(D.pages.find((p) => p.id === id)?.name ?? "Page"), from: D.sheets[id] }); }, onBack: addBackSide, onDelete: deletePage,
                onAdd: () => addPage(), onPlan: setPlan,
              }} shared={mainSheet} onShared={(patch) => setMainSheet((s) => ({ ...s, ...patch }))}
              cards={{
                custom: !!sheet.placements, mode: numberingMode(placements), count: slots, perSheet, selected: arranging ? selectedCard : null, templates: variants.map((v) => ({ id: v.id, name: v.name })),
                onNumberAll: numberAll, onReset: () => resetToGrid(), onAdd: () => addCard(), onNumber: (n) => selectedCard && numberCard(cardPage, selectedCard.id, n), onTemplate: (id) => selectedCard && cardVariant(cardPage, selectedCard.id, id),
                onPosition: (x, y) => selectedCard && moveCard(cardPage, selectedCard.id, x, y), onDuplicate: () => selectedCard && duplicateCard(cardPage, selectedCard.id), onRotate: (turn) => selectedCard && rotateCard(cardPage, selectedCard.id, turn), onDelete: () => selectedCard && deleteCard(cardPage, selectedCard.id),
              }} templateMargins={template.margins} onTemplateMargins={(margins) => setTemplate((t) => ({ ...t, margins }))} onPreset={applyPreset}
              sheet={sheet} onSheet={(patch) => ("pageWidth" in patch || "pageHeight" in patch ? setPaperSize(patch.pageWidth ?? sheet.pageWidth, patch.pageHeight ?? sheet.pageHeight) : setSheet((s) => ({ ...s, ...patch })))} pageCount={pageCount} overflow={overflow}
              printer={printer} onCalibrationSheet={printCalibration}
              fields={fields} editedList={editedList} onJumpInstance={jumpToInstance} onResetInstanceById={(id) => { resetInstance(id); if (instanceSel?.recordId === id) setInstanceSel(null); }}
              onAudit={(itemId) => setAuditDialog({ itemId })} auditCount={sheetIssueCount}
              variants={{
                variants, activeId: variantId, rules, fields, records: activeRecords, basis: sheet.variantBasis ?? "record",
                onActivate: (id) => { setActiveVariant(id); setSelectedIds([]); }, onAdd: addVariant,
                onRename: (id, name) => setVariants((list) => list.map((v) => (v.id === id ? { ...v, name } : v))),
                onDelete: deleteVariant, onRules: setRules, onBasis: (variantBasis) => setSheet((sh) => ({ ...sh, variantBasis })),
              }}
              onClose={() => setInspectorOpen(false)}
            />
          </div>
          <button className="drawer-toggle left" title="Show the Fields and Layers drawer (your data columns, and every object in the design)" aria-label="Show fields" aria-pressed={dataOpen} onPointerDown={(e) => drawers.start("left", e, "open")} onClick={(e) => { if (e.detail === 0) setDataOpen(true); }}>
                <Braces size={15} /><span>Fields</span>
              </button>
          <button className="drawer-toggle right" title="Show the Properties drawer (settings, layers)" aria-label="Show properties" aria-pressed={inspectorOpen} onPointerDown={(e) => drawers.start("right", e, "open")} onClick={(e) => { if (e.detail === 0) setInspectorOpen(true); }}>
                <SlidersHorizontal size={15} /><span>Properties</span>
              </button>
          <div className="drawer-sliver left" onPointerDown={(e) => drawers.start("left", e, dataOpen ? "resize" : "open")} title={dataOpen ? "Drag to resize the drawer · flick it toward the edge to close" : "Drag to open the Fields and Layers drawer"} aria-hidden><span className="sliver-pill">{dataOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}</span></div>
          <div className="drawer-sliver right" onPointerDown={(e) => drawers.start("right", e, inspectorOpen ? "resize" : "open")} title={inspectorOpen ? "Drag to resize the drawer · flick it toward the edge to close" : "Drag to open the Properties drawer"} aria-hidden><span className="sliver-pill">{inspectorOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}</span></div>
        </div>

        {/* The data preview bar runs the full width of the window, under the drawers as well as the canvas. */}
        <RecordBar
          label={pagedNav ? "Sheet" : "Record"}
          position={pagedNav ? (stack ? visiblePage : currentPage) + 1 : recordIndex + 1}
          total={pagedNav ? pageCount : activeRecords.length}
          preview={fields.map((f) => (currentRecord[f] ?? "").trim()).filter(Boolean).join(" · ")}
          onStep={stepRecord}
          drawerOpen={recordsOpen} onToggleDrawer={() => setRecordsOpen((o) => !o)}
          showNames={showFieldNames} onToggleNames={workspace === "template" ? () => setShowFieldNames((v) => !v) : undefined}
        />
      </main>

      {libraryDialog && (
        <ImageLibraryDialog
          library={library}
          title={libraryDialog.kind === "insert" ? (libraryDialog.reference ? "Add a reference image" : "Add a picture") : libraryDialog.target === "fallback" ? "Choose a placeholder" : "Choose a picture"}
          onClose={() => setLibraryDialog(null)}
          onPick={(asset) => (libraryDialog.kind === "insert" ? insertPicture(asset) : choosePicture(libraryDialog.itemId, libraryDialog.target, asset))}
          onInsertDataDriven={libraryDialog.kind === "insert" && !libraryDialog.reference ? insertDataDriven : undefined}
        />
      )}
      {reviewItemId && items.find((i) => i.id === reviewItemId) && (
        <MatchReviewDialog item={items.find((i) => i.id === reviewItemId)!} records={activeRecords} library={library} onOverrides={(changes) => setOverrides(reviewItemId, changes)} onClose={() => setReviewItemId(null)} />
      )}

      {welcomeOpen && <WelcomeDialog onClose={() => setWelcomeOpen(false)} onGo={(place) => { if (place === "data") { setShowData(true); setSelectedIds([]); } else { setShowData(false); switchWorkspace(place); } }} />}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} onReplayWelcome={() => { setHelpOpen(false); setWelcomeOpen(true); }} onStartTour={(id) => { setHelpOpen(false); if (id === "data") { setShowData(true); setSelectedIds([]); } else { setShowData(false); switchWorkspace(id); } window.setTimeout(() => setTour(id), 350); }} />}
      {tour && <TourOverlay key={tour} tour={tour} onClose={() => setTour(null)} />}
      <TapTips />
      {galleryOpen && <TemplateGalleryDialog onUse={useTemplate} onClose={() => setGalleryOpen(false)} />}
      {auditDialog && <TextAuditDialog issues={issues} itemId={auditDialog.itemId} onFix={(issue) => fixOnPage(issue.recordId, issue.itemId)} onClose={() => setAuditDialog(null)} />}

      {status && (
        <div className={`toast ${status.kind}`} role="status">
          <div><span>{status.text}</span>{status.detail && <ul>{status.detail.map((d, i) => <li key={i}>{d}</li>)}</ul>}</div>
          {!status.busy && <button onClick={() => setStatus(null)} aria-label="Dismiss">Dismiss</button>}
        </div>
      )}

      {newProjectOpen && <NewProjectDialog baseSheet={sheet} onCreate={createBlankProject} onCancel={() => setNewProjectOpen(false)} />}
      {warnPopup && (() => {
        const list = textTrouble.byItem.get(warnPopup.itemId) ?? [];
        const item = items.find((i) => i.id === warnPopup.itemId);
        const WORDS = { truncated: "is cut off", outside: "runs off the card", spill: "spills out of its box" } as const;
        return (
          <>
            <div className="menu-scrim" onClick={() => setWarnPopup(null)} />
            <div className="warn-popup" role="dialog" aria-label="Records that don’t fit" style={{ left: Math.min(warnPopup.x, window.innerWidth - 290), top: Math.min(warnPopup.y + 8, window.innerHeight - 260) }}>
              <strong>{item ? itemLabel(item) : "This text"}: {list.length} record{list.length === 1 ? "" : "s"} won’t fit</strong>
              <ul>{list.slice(0, 6).map((p) => <li key={p.index}><span>Record {p.index + 1}</span> {recordLabel(activeRecords[p.index])} <em>{WORDS[p.kind as keyof typeof WORDS]}</em></li>)}</ul>
              {list.length > 6 && <small>…and {list.length - 6} more</small>}
              <div className="warn-actions">
                <button className="button" onClick={() => { setRecordIndex(list[0].index); setWarnPopup(null); }}>Preview record {list[0].index + 1}</button>
                <button className="button" onClick={() => { setAuditDialog({ itemId: warnPopup.itemId }); setWarnPopup(null); }}>Review all…</button>
              </div>
            </div>
          </>
        );
      })()}
      {pasteOpen && <PasteDialog onUse={importRecords} onCancel={() => setPasteOpen(false)} />}
      {sheetsOpen && <SheetsDialog onUse={importRecords} onPasteInstead={() => { setSheetsOpen(false); setPasteOpen(true); }} onCancel={() => setSheetsOpen(false)} />}
      {pendingImport?.stage === "choose" && (
        <ImportDialog
          fileName={pendingImport.fileName} incoming={pendingImport.records} existing={records} existingColumns={fields}
          onReplace={replaceWithImport} onCombine={combineImport} onCancel={() => setPendingImport(null)}
        />
      )}
      {pendingImport?.stage === "map" && (
        <MappingDialog
          fileName={pendingImport.fileName} records={pendingImport.records} templateFields={boundFields(items)}
          onApply={(mapping) => adoptData(pendingImport.records, pendingImport.fileName, mapping)}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {fieldDrag && (fieldDrag.grab
        ? (
          <div className={`field-row drag-ghost chip${fieldDrag.field.startsWith("__") ? " special" : ""}`} style={{ left: fieldDrag.x - fieldDrag.grab.dx, top: fieldDrag.y - fieldDrag.grab.dy, width: fieldDrag.grab.w }}>
            <span className="field-type">{fieldDrag.field.startsWith("@tpl:") ? <LayoutTemplate size={12} /> : fieldDrag.field.startsWith("__") ? <Hash size={12} /> : <Type size={12} />}</span>
            <span className="field-name">{fieldDrag.field.startsWith("@tpl:") ? variants.find((v) => v.id === fieldDrag.field.slice(5))?.name ?? "Template" : fieldDisplayName(fieldDrag.field)}</span>
            <span className="field-grip" aria-hidden><GripVertical size={14} /></span>
          </div>
        )
        : <div className="drag-ghost" style={{ left: fieldDrag.x, top: fieldDrag.y }}>{fieldDisplayName(fieldDrag.field)}</div>)}

      {printing && (
        <PrintSheets bleed={bleedIn} kind={printing} offset={printer} sheets={D.sheets} sequence={seq} firstPageId={mainId} records={activeRecords} templateWidth={template.width} templateHeight={template.height} instanceFor={instanceFor} />
      )}
    </div>
    </ImageContext.Provider>
  );
}

export default App;
