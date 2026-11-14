import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Braces, Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import Papa from "papaparse";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DesignItem, Guide, InstanceOverride, ItemPatch, LabelPreset, Project, RecordRow, Sheet, Variant, VariantRule, View, Workspace } from "./types";
import { PX_PER_IN, clamp, fieldDisplayName, starterItems, starterRecords, uid, valueFor } from "./lib/data";
import { applyOverride, hasEdits, pickVariant, toItemPatch } from "./lib/instances";
import { applyConditions } from "./lib/conditions";
import { cloneItems, expandToGroups, groupItems, moveLayer as moveLayerIn, nextGroupName, renameGroup as renameGroupIn, ungroupItems, unitsOf } from "./lib/groups";
import { instanceIssues, itemLabel, recordLabel, type Issue } from "./lib/audit";
import { checkImageUrls } from "./lib/webImages";
import { layoutText } from "./lib/text";
import { TextAuditDialog } from "./components/TextAuditDialog";
import { usePrinterCalibration } from "./hooks/usePrinterCalibration";
import { TemplateGalleryDialog } from "./components/TemplateGalleryDialog";
import { HelpDialog } from "./components/HelpDialog";
import { useHistory } from "./hooks/useHistory";
import { useFontLibrary } from "./hooks/useFontLibrary";
import { aabb, alignItems, boundsOf, centerOf, distributeItems, rotateAbout, type AlignMode, type Transform } from "./lib/align";
import { applyMapping, boundFields } from "./lib/mapping";
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
import { DataPanel } from "./components/DataPanel";
import { Inspector } from "./components/Inspector";
import { RecordBar } from "./components/RecordBar";
import { RecordsDrawer } from "./components/RecordsDrawer";
import { MAX_ZOOM, MIN_ZOOM, Viewport } from "./components/Viewport";
import { TemplateStage } from "./components/TemplateStage";
import { LayoutStage, type InstanceInfo, type InstanceSelection } from "./components/LayoutStage";
import { itemFrame } from "./components/ItemShape";
import { DataTable } from "./components/DataTable";
import { ID, addColumn, blankRow, columnsOf, duplicateRows, isIncluded, keepOneRow, pasteGrid, removeColumn, renameColumn, setCell, setIncluded, sortRows, toCsv, withIds } from "./lib/records";
import { PrintSheets } from "./components/PrintSheets";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const WIDE_QUERY = "(min-width: 851px)";
const freshView = (): View => ({ zoom: 1, pan: { x: 0, y: 0 }, fitted: false });
const defaultSheet: Sheet = { pageWidth: 8.5, pageHeight: 11, columns: 2, rows: 4, gapX: 0.18, gapY: 0.18, marginX: 0.25, marginY: 0.25, repeatMode: "next", cropMarks: false };
const DEFAULT_NAME = "Untitled bird card";

/** Everything the undo history covers. */
type Doc = {
  items: Record<string, DesignItem[]>; variants: Variant[]; rules: VariantRule[]; template: { width: number; height: number }; sheet: Sheet;
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
    return {
      items: Object.fromEntries(vs.map((v) => [v.id, v.items])), variants: vs.map(({ id, name }) => ({ id, name })), rules: initial?.rules ?? [],
      template: initial?.template ?? { width: 3.5, height: 2 }, sheet: initial?.sheet ?? defaultSheet,
      records: withIds(initial?.records ?? starterRecords), fileName: initial?.fileName ?? "bird-records.csv", overrides: initial?.overrides ?? {},
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
  const variants = D.variants, rules = D.rules, template = D.template, sheet = D.sheet;
  const instanceOverrides = D.overrides;
  const setVariants = part("variants", "variants"), setRules = part("rules", "rules"), setTemplate = part("template", "template"), setSheet = part("sheet", "sheet");
  const recordHistory = { value: records, set: part("records"), ...shared };
  const editRecords = (update: (rows: RecordRow[]) => RecordRow[], coalesce?: string) => recordHistory.set(update, { coalesce });
  const itemsDoc = { value: D.items, set: part("items"), ...shared };
  const overrideDoc = { value: instanceOverrides, set: part("overrides"), ...shared };
  const [docName, setDocName] = useState(initial?.name ?? DEFAULT_NAME);
  const [activeVariant, setActiveVariant] = useState(variants[0].id);
  const variantId = itemsDoc.value[activeVariant] ? activeVariant : variants[0].id; // the template being edited
  const items = itemsDoc.value[variantId] ?? [];
  /** Edits the template being shown, so the rest of the editor keeps working with one plain list of items. */
  const history = {
    set: (update: (list: DesignItem[]) => DesignItem[], options?: { coalesce?: string }) =>
      itemsDoc.set((map) => { const current = map[variantId] ?? []; const next = update(current); return next === current ? map : { ...map, [variantId]: next }; }, options),
    ...shared,
  };
  const [rawRecordIndex, setRecordIndex] = useState(0);
  const fontLibrary = useFontLibrary(initial?.fonts ?? []);

  // ── UI state ────────────────────────────────────────────────────────────
  const [workspace, setWorkspace] = useState<Workspace>("template");
  const [showData, setShowData] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [clipboard, setClipboard] = useState<DesignItem[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "error">("saved");
  const [fieldDrag, setFieldDrag] = useState<{ field: string; x: number; y: number } | null>(null);
  const justDragged = useRef(false);
  // A freshly imported file waiting for the person to confirm how its columns map onto the template.
  const [pendingImport, setPendingImport] = useState<{ records: RecordRow[]; fileName: string; stage: "choose" | "map" } | null>(null);
  const [dataOpen, setDataOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [snap, setSnap] = useState(false);
  const [preview, setPreview] = useState(false);
  const [printing, setPrinting] = useState<null | "sheets" | "calibration">(null);
  const printer = usePrinterCalibration();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const [libraryDialog, setLibraryDialog] = useState<null | { kind: "insert" } | { kind: "pick"; itemId: string; target: "asset" | "fallback" }>(null);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const recordIndex = Math.min(rawRecordIndex, Math.max(0, records.filter(isIncluded).length - 1));
  const fields = useMemo(() => columnsOf(records), [records]);
  // Only records switched on in the Data table are previewed, laid out, counted and printed.
  const activeRecords = useMemo(() => {
    const included = records.filter(isIncluded);
    return sheet.sortField ? sortRows(included, sheet.sortField, sheet.sortDir ?? 1) : included;
  }, [records, sheet.sortField, sheet.sortDir]);
  const currentRecord = activeRecords[recordIndex] ?? {};
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const selected = selectedItems.length === 1 ? selectedItems[0] : null;
  const slots = sheet.columns * sheet.rows;
  const pageCount = sheet.repeatMode === "same" ? 1 : Math.max(1, Math.ceil(activeRecords.length / slots));
  const currentPage = sheet.repeatMode === "same" ? 0 : Math.floor(recordIndex / slots);
  const overflow =
    sheet.marginX + sheet.columns * template.width + (sheet.columns - 1) * sheet.gapX > sheet.pageWidth + 0.005 ||
    sheet.marginY + sheet.rows * template.height + (sheet.rows - 1) * sheet.gapY > sheet.pageHeight + 0.005;
  const pagedNav = workspace === "layout" && sheet.repeatMode === "next";

  // ── Alternating templates + per-record edits ────────────────────────────
  /** The items one record renders: its template (chosen by the rules) with that record's hand edits applied. */
  const instanceFor = (record: RecordRow, index: number, slot: number): InstanceInfo => {
    const id = pickVariant(rules, variants, record, index, slot, sheet.variantBasis ?? "record");
    const base = itemsDoc.value[id] ?? itemsDoc.value[variants[0].id] ?? [];
    const override = instanceOverrides[record[ID]];
    // Order: the template, then conditional rules for this record, then this record's hand edits (which win).
    return { variantId: id, items: applyOverride(applyConditions(base, record, metaFor(index)), override), override };
  };
  const metaFor = (index: number) => ({ recordNumber: index + 1, pageNumber: sheet.repeatMode === "same" ? 1 : Math.floor(index / slots) + 1, recordCount: activeRecords.length, pageCount });
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
  const revertInstanceItem = (recordId: string, itemId: string) =>
    updateInstance(recordId, (o) => { const { [itemId]: _gone, ...rest } = o.items; return { ...o, items: rest }; });
  const toggleInstanceOff = (recordId: string) => updateInstance(recordId, (o) => (o.off ? { items: o.items } : { ...o, off: true }));
  const resetInstance = (recordId: string) => updateInstance(recordId, () => null);

  const instRecord = instanceSel ? activeRecords.find((r) => r[ID] === instanceSel.recordId) : undefined;
  const instIndex = instRecord ? activeRecords.indexOf(instRecord) : -1;
  const instItems = instRecord ? instanceFor(instRecord, instIndex, instIndex % slots).items : [];
  const instItem = instanceSel ? instItems.find((i) => i.id === instanceSel.itemId) : undefined;
  const instOverride = instRecord ? instanceOverrides[instRecord[ID]] : undefined;
  const inLayoutEdit = workspace === "layout" && !!instItem && !showData;

  // ── Text-fit audit ──────────────────────────────────────────────────────
  const computeIssues = (indices: number[]): Issue[] => {
    const out: Issue[] = [];
    for (const index of indices) {
      const record = activeRecords[index];
      if (!record) continue;
      for (const { item, kind, atMin } of instanceIssues(instanceFor(record, index, index % slots).items, record, metaFor(index)))
        out.push({ recordId: record[ID], recordIndex: index, recordLabel: recordLabel(record), itemId: item.id, itemLabel: itemLabel(item), kind, atMin });
    }
    return out;
  };
  const allIndices = () => (sheet.repeatMode === "same" ? [recordIndex] : activeRecords.map((_, i) => i));
  const issues = useMemo(() => (auditDialog ? computeIssues(allIndices()) : []), [auditDialog, items, itemsDoc.value, instanceOverrides, activeRecords, rules, variants, sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheetIssueCount = workspace === "layout" && !preview
    ? computeIssues(sheet.repeatMode === "same" ? [recordIndex] : Array.from({ length: slots }, (_, k) => currentPage * slots + k)).length : 0;
  /** For the selected text in the template: does it fit for the records that use this template? */
  const fitNote = (() => {
    if (!selected || selected.type !== "text" || workspace !== "template") return null;
    let bad = 0, total = 0;
    for (let i = 0; i < Math.min(activeRecords.length, 1500); i++) {
      if (pickVariant(rules, variants, activeRecords[i], i, i % slots, sheet.variantBasis ?? "record") !== variantId) continue;
      total++;
      if (layoutText(selected, valueFor(selected, activeRecords[i], metaFor(i)), selected.w * PX_PER_IN, selected.h * PX_PER_IN).issue) bad++;
    }
    return total ? { bad: bad > 0, text: bad ? `${bad} of ${total} record${total === 1 ? "" : "s"} ${bad === 1 ? "doesn’t" : "don’t"} fit this box.` : `All ${total} record${total === 1 ? "" : "s"} fit.` } : null;
  })();

  // ── View: per-workspace zoom / pan / fit ───────────────────────────────
  const patchView = useCallback((patch: Partial<View>) => setViews((v) => ({ ...v, [workspace]: { ...v[workspace], ...patch } })), [workspace]);
  const widthOf = (w: Workspace) => (w === "template" ? template.width : sheet.pageWidth);
  const heightOf = (w: Workspace) => (w === "template" ? template.height : sheet.pageHeight);

  const fitZoom = (w: Workspace) => {
    const el = viewportRef.current;
    const availW = Math.max(120, (el?.clientWidth ?? 800) - 110);
    const availH = Math.max(120, (el?.clientHeight ?? 600) - 150);
    return Number(clamp(Math.min(availW / (widthOf(w) * PX_PER_IN), availH / (heightOf(w) * PX_PER_IN)), MIN_ZOOM, MAX_ZOOM).toFixed(2));
  };

  // First visit to a workspace (or after its size changed from a preset): fit and centre it.
  useLayoutEffect(() => {
    if (!view.fitted && viewportRef.current) patchView({ zoom: fitZoom(workspace), pan: { x: 0, y: 0 }, fitted: true });
  }, [workspace, view.fitted]); // eslint-disable-line react-hooks/exhaustive-deps

  const setZoom = (zoom: number) => patchView({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
  const toggleZoomPreset = () => {
    const fit = fitZoom(workspace);
    patchView({ zoom: Math.abs(view.zoom - fit) < 0.02 ? 1 : fit, pan: { x: 0, y: 0 } });
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
  const addTextBox = () => addItem({ id: uid(), type: "text", x: 0.4, y: 0.4, w: 1.8, h: 0.7, text: "Text box", fontSize: 11, color: "#34443d", weight: 500, visible: true, fill: "#ffffff", stroke: "#cbd5cc", strokeWidth: 1, radius: 8, radiusUnit: "px", padding: 0.08, wrap: true });
  /** A picture box that each record fills from your data (a column or a filename pattern). */
  const addPhotoPlaceholder = () => addItem({ id: uid(), type: "image", x: 0.4, y: 0.4, w: 1.2, h: 1.2, radius: 6, imageSource: defaultImageSource(fields), visible: true });
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
  const updateMany = (ids: string[], patch: Partial<DesignItem>) => history.set((list) => list.map((item) => (ids.includes(item.id) ? { ...item, ...patch } : item)));
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

  const moveLayer = (id: string, direction: -1 | 1, asGroup = false) => history.set((list) => moveLayerIn(list, id, direction, asGroup));

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

  /** The person chose "Replace": use the new file, matching the template's links first if it needs columns the file lacks. */
  const replaceWithImport = () => {
    if (!pendingImport) return;
    const columns = new Set(Object.keys(pendingImport.records[0] ?? {}));
    if (boundFields(items).some((field) => !columns.has(field))) setPendingImport({ ...pendingImport, stage: "map" });
    else adoptData(pendingImport.records, pendingImport.fileName);
  };
  /** "Add" or "Merge": the finished list, as one undo step. */
  const combineImport = (rows: RecordRow[]) => { recordHistory.set(() => rows); setPendingImport(null); };
  const importData = (file: File) => {
    Papa.parse<RecordRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data.filter((row) => Object.values(row).some((v) => String(v ?? "").trim()));
        if (!cleaned.length) { window.alert("No records were found in that file."); return; }
        setPendingImport({ records: cleaned, fileName: file.name, stage: "choose" }); // ask: replace, add, or merge
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
    doc.set((d) => ({ ...d, template: { width: preset.width, height: preset.height }, sheet: { ...d.sheet, pageWidth: 8.5, pageHeight: 11, columns: preset.columns, rows: preset.rows, gapX: preset.gapX, gapY: preset.gapY, marginX: preset.marginX, marginY: preset.marginY } }));
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
    let active = false;
    const begin = () => { active = true; setFieldDrag({ field, x: startX, y: startY }); navigator.vibrate?.(8); };
    const timer = touch ? window.setTimeout(begin, 260) : undefined;
    const blockScroll = (e: TouchEvent) => { if (active) e.preventDefault(); };
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", blockScroll);
      setFieldDrag(null);
    };
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) > (touch ? 8 : 5)) {
        if (touch) { cleanup(); return; } // finger moved first: the user is scrolling the list
        begin();
      }
      if (active) setFieldDrag({ field, x: e.clientX, y: e.clientY });
    }
    function end(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const wasActive = active;
      cleanup();
      if (!wasActive) return;
      if (e.type === "pointerup") {
        dropField(field, e.clientX, e.clientY);
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
    version: 1, name: docName, fileName, records, items: itemsDoc.value[variants[0].id] ?? [], template, sheet, fonts: fontLibrary.fonts,
    variants: variants.map((v) => ({ ...v, items: itemsDoc.value[v.id] ?? [] })), rules, overrides: instanceOverrides,
  });
  useEffect(() => {
    const timer = window.setTimeout(() => setSaveState(saveProject(snapshot()) ? "saved" : "error"), 600);
    return () => window.clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const applyProject = async (project: Project, images?: { asset: Asset; blob: Blob }[]) => {
    if (images) await library.replaceAll(images);
    const vs = project.variants?.length ? project.variants : [{ id: "a", name: "Template A", items: project.items }];
    doc.reset({
      items: Object.fromEntries(vs.map((v) => [v.id, v.items])), variants: vs.map(({ id, name }) => ({ id, name })), rules: project.rules ?? [],
      template: project.template, sheet: project.sheet, records: withIds(project.records), fileName: project.fileName, overrides: project.overrides ?? {},
    });
    setActiveVariant(vs[0].id); setInstanceSel(null); setEditingText(null); setDocName(project.name);
    fontLibrary.restore(project.fonts);
    setSelectedIds([]); setRecordIndex(0);
    setGuides({ template: [], layout: [] });
    setViews({ template: freshView(), layout: freshView() });
  };
  const newProject = async () => {
    await library.clear();
    await applyProject({ version: 1, name: DEFAULT_NAME, fileName: "bird-records.csv", records: starterRecords, items: starterItems, template: { width: 3.5, height: 2 }, sheet: defaultSheet, fonts: [] });
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
    onSort: (column: string, direction: 1 | -1) => editRecords((rows) => sortRows(rows, column, direction)),
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

  // ── Records ─────────────────────────────────────────────────────────────
  const stepRecord = (delta: number) => {
    if (pagedNav) setRecordIndex(clamp(currentPage + delta, 0, pageCount - 1) * slots);
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
      textProblems += instanceIssues(inst.items, record, metaFor(index)).length;
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
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const has = selectedItems.length > 0;
      const target = doc; // one history for the whole document
      if (mod && key === "z") { event.preventDefault(); event.shiftKey ? target.redo() : target.undo(); }
      else if (mod && key === "y") { event.preventDefault(); target.redo(); }
      else if (workspace === "layout" && !showData) { if (key === "escape") { setInstanceSel(null); setEditingText(null); } }
      else if (workspace !== "template" || showData) return;
      else if (mod && key === "a") { event.preventDefault(); setSelectedIds(items.filter((i) => i.visible !== false).map((i) => i.id)); }
      else if (mod && key === "c") { if (has) { event.preventDefault(); copySelected(); } }
      else if (mod && key === "x") { if (has) { event.preventDefault(); cutSelected(); } }
      else if (mod && key === "v") { if (clipboard.length) { event.preventDefault(); pasteItems(); } }
      else if (mod && key === "d") { if (has) { event.preventDefault(); duplicateSelected(); } }
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
  const displayItems = applyConditions(items, currentRecord, meta, !preview);
  const caption = workspace === "template"
    ? { title: variants.length > 1 ? `INDIVIDUAL TEMPLATE · ${variants.find((v) => v.id === variantId)?.name.toUpperCase()}` : "INDIVIDUAL TEMPLATE", detail: `${template.width.toFixed(2)} × ${template.height.toFixed(2)} in` }
    : { title: "PAGE LAYOUT", detail: `${sheet.pageWidth} × ${sheet.pageHeight} in · ${slots} per sheet${printer.x || printer.y ? ` · printer offset ${printer.x >= 0 ? "+" : ""}${printer.x.toFixed(3)}, ${printer.y >= 0 ? "+" : ""}${printer.y.toFixed(3)} in` : ""}` };

  return (
    <ImageContext.Provider value={{ resolver: library.resolver, urlFor: library.urlFor }}>
    <div className="app-shell">
      <Topbar workspace={showData ? "data" : workspace} onWorkspace={(tab) => { if (tab === "data") { setShowData(true); setSelectedIds([]); } else { setShowData(false); switchWorkspace(tab); } }} onPrint={printNow} onHelp={() => setHelpOpen(true)} name={docName} onName={setDocName} saveState={saveState} onNew={newProject} onGallery={() => setGalleryOpen(true)} onOpen={openProject} onSave={saveToFile} />

      {showData && (
        <main className="workspace">
          <DataTable
            rows={records} columns={fields} fileName={fileName}
            canUndo={recordHistory.canUndo} canRedo={recordHistory.canRedo} onUndo={recordHistory.undo} onRedo={recordHistory.redo}
            onImport={importData} {...dataActions}
          />
        </main>
      )}

      <main className="workspace" hidden={showData}>
        <Toolbar
          workspace={workspace} instanceMode={instanceMode} onInstanceMode={() => { setInstanceMode((v) => !v); setInstanceSel(null); setEditingText(null); }}
          showGrid={showGrid} onGrid={() => setShowGrid((v) => !v)}
          showRulers={showRulers} onRulers={() => setShowRulers((v) => !v)}
          snap={snap} onSnap={() => setSnap((v) => !v)}
          preview={preview} onPreview={() => setPreview((v) => !v)}
          multi={multiMode} onMulti={() => setMultiMode((v) => !v)}
          zoom={view.zoom} onZoom={setZoom} onZoomPreset={toggleZoomPreset}
          onAddText={() => addText()} onAddShape={addShape} onAddTextBox={addTextBox} onAddPhoto={addPhotoPlaceholder} onAddImage={() => setLibraryDialog({ kind: "insert" })}
        />

        <div className={`content-frame${dataOpen ? " data-open" : ""}${inspectorOpen ? " inspector-open" : ""}`}>
          {dataOpen && (
            <DataPanel fileName={fileName} fields={fields} recordCount={activeRecords.length} totalRecords={records.length} hasTextSelected={selected?.type === "text"} onImport={importData} onField={bindField} onFieldPointerDown={startFieldDrag} dragging={!!fieldDrag} onClose={() => setDataOpen(false)} />
          )}

          <div className="editor-content">
            <div className="canvas-frame">
              <Viewport
                containerRef={viewportRef}
                view={view}
                onView={patchView}
                widthIn={widthOf(workspace)}
                heightIn={heightOf(workspace)}
                showRulers={showRulers}
                guides={guides[workspace]}
                onGuides={(update) => setGuides((g) => ({ ...g, [workspace]: update(g[workspace]) }))}
                onRulerDoubleClick={() => { setSelectedIds([]); setInspectorOpen(true); }}
                onBackgroundClick={() => { setSelectedIds([]); setInstanceSel(null); }}
                marqueeMode={multiMode && workspace === "template"}
                onMarquee={workspace === "template" ? onMarquee : undefined}
                paperClassName={preview ? "preview" : ""}
              >
                {workspace === "template" ? (
                  <TemplateStage
                    items={displayItems} record={currentRecord} meta={meta} width={template.width} height={template.height} zoom={view.zoom}
                    selectedIds={selectedIds} showGrid={showGrid} snap={snap} guides={guides.template} multi={multiMode} preview={preview} rawFields={showFieldNames && !preview} svgRef={svgRef}
                    onSelect={setSelectedIds} onMove={moveMany} onResize={resizeItem} onRotate={rotateItem} onRotateGroup={rotateGroup} onScaleGroup={scaleGroup} onDragEnd={history.breakGroup}
                  />
                ) : (
                  <LayoutStage
                    sheet={sheet} templateWidth={template.width} templateHeight={template.height} records={activeRecords} instanceFor={instanceFor}
                    slotRecord={(slot) => (sheet.repeatMode === "same" ? recordIndex : currentPage * slots + slot)}
                    pageNumber={currentPage + 1} pageCount={pageCount} showGrid={showGrid} preview={preview}
                    offset={printer} edit={instanceMode} zoom={view.zoom} selected={instanceSel} editing={editingText}
                    onSelect={(sel) => { setInstanceSel(sel); setEditingText(null); if (sel) setInspectorOpen(true); }}
                    onStartEdit={(sel) => { const item = instanceFor(activeRecords[indexOfRecord(sel.recordId)], indexOfRecord(sel.recordId), 0).items.find((i) => i.id === sel.itemId); if (item?.type === "text") { setInstanceSel(sel); setEditingText(sel); } else if (item?.type === "image") { setInstanceSel(sel); setLibraryDialog({ kind: "pick", itemId: sel.itemId, target: "asset" }); } }}
                    onCommitText={commitInstanceText} onCancelEdit={() => setEditingText(null)}
                    onDropFiles={dropPictureOnSlot} onToggleOff={toggleInstanceOff} onResetInstance={(id) => { resetInstance(id); if (instanceSel?.recordId === id) setInstanceSel(null); }}
                  />
                )}
              </Viewport>

              {workspace === "template" && !preview && (
                <div className="variant-bar" data-no-pan role="tablist" aria-label="Templates">
                  {variants.map((v, i) => <button key={v.id} role="tab" aria-selected={v.id === variantId} className={v.id === variantId ? "variant-chip active" : "variant-chip"} onClick={() => { setActiveVariant(v.id); setSelectedIds([]); }} title={`Edit ${v.name}`}>{variants.length > 1 ? `${String.fromCharCode(65 + i)} · ${v.name}` : v.name}</button>)}
                  <button className="variant-chip" onClick={addVariant} title="Add another template, e.g. to alternate colours between records" aria-label="Add a template">+</button>
                </div>
              )}
              <div className="canvas-caption"><span>{caption.title}</span><span>{caption.detail}</span></div>

              <button className="drawer-toggle left" title={dataOpen ? "Hide the Fields drawer (your data columns)" : "Show the Fields drawer (your data columns)"} aria-label={dataOpen ? "Hide fields" : "Show fields"} aria-pressed={dataOpen} onClick={() => setDataOpen((open) => !open)}>
                <Braces size={15} /><span>Fields</span>
              </button>
              <button className="drawer-toggle right" title={inspectorOpen ? "Hide the Properties drawer" : "Show the Properties drawer (settings, layers)"} aria-label={inspectorOpen ? "Hide properties" : "Show properties"} aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>
                <SlidersHorizontal size={15} /><span>Properties</span>
              </button>
              {workspace === "template" && !preview && selectedItems.length > 0 && <AlignBar units={unitsOf(items, selectedIds).length} onAlign={align} onDistribute={distribute} />}
              {workspace === "template" && (
                <EditBar
                  canGroup={canGroup} canUngroup={canUngroup} onGroup={groupSelected} onUngroup={ungroupSelected}
                  hasSelection={selectedItems.length > 0} canPaste={clipboard.length > 0} canUndo={history.canUndo} canRedo={history.canRedo}
                  onUndo={history.undo} onRedo={history.redo} onDelete={deleteSelected} onCut={cutSelected} onCopy={copySelected} onPaste={pasteItems}
                />
              )}
            </div>

            <RecordsDrawer
              open={recordsOpen} records={activeRecords} fields={fields} current={recordIndex} excluded={records.length - activeRecords.length}
              onPick={(index) => { setRecordIndex(index); if (!window.matchMedia(WIDE_QUERY).matches) setRecordsOpen(false); }} onClose={() => setRecordsOpen(false)}
              onCellPointerDown={startFieldDrag} justDragged={() => justDragged.current} dragging={!!fieldDrag}
            />
            <RecordBar
              label={pagedNav ? "Sheet" : "Record"}
              position={pagedNav ? currentPage + 1 : recordIndex + 1}
              total={pagedNav ? pageCount : activeRecords.length}
              preview={fields.map((f) => (currentRecord[f] ?? "").trim()).filter(Boolean).join(" · ")}
              onStep={stepRecord}
              drawerOpen={recordsOpen} onToggleDrawer={() => setRecordsOpen((o) => !o)}
              showNames={showFieldNames} onToggleNames={workspace === "template" ? () => setShowFieldNames((v) => !v) : undefined}
            />
          </div>

          {inspectorOpen && (
            <Inspector
              workspace={workspace}
              items={inLayoutEdit ? instItems : items}
              selectedItems={inLayoutEdit && instItem ? [instItem] : workspace === "layout" ? [] : selectedItems}
              onSelect={(ids) => (inLayoutEdit && instanceSel ? setInstanceSel({ recordId: instanceSel.recordId, itemId: ids[0] }) : setSelectedIds(ids))}
              onUpdate={inLayoutEdit && instRecord ? (id, patch, coalesce) => setInstanceItem(instRecord[ID], id, toItemPatch(patch), coalesce) : updateItem}
              instance={instanceBanner}
              fitNote={inLayoutEdit && instItem?.type === "text" && instRecord ? (() => { const l = layoutText(instItem, valueFor(instItem, instRecord, metaFor(instIndex)), instItem.w * PX_PER_IN, instItem.h * PX_PER_IN); return l.issue ? { bad: true, text: l.issue === "truncated" ? "This text is being cut off." : "This text runs past its box." } : { bad: false, text: "This text fits." }; })() : fitNote}
              fontLibrary={fontLibrary} onRotateBy={rotateSelectionBy} imageTools={imageTools}
              onDuplicate={duplicateSelected} onDelete={deleteSelected} onMoveLayer={moveLayer}
              groups={{ wholeGroup, canGroup, onGroup: groupSelected, onUngroup: ungroupSelected, onRename: renameGroup, onUpdateMany: updateMany, onSelectGroupOf: selectGroupOf }}
              templateWidth={template.width} templateHeight={template.height} onTemplateSize={(width, height) => setTemplate({ width, height })} onPreset={applyPreset}
              sheet={sheet} onSheet={(patch) => setSheet((s) => ({ ...s, ...patch }))} pageCount={pageCount} overflow={overflow}
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
          )}
        </div>
      </main>

      {libraryDialog && (
        <ImageLibraryDialog
          library={library}
          title={libraryDialog.kind === "insert" ? "Add a picture" : libraryDialog.target === "fallback" ? "Choose a placeholder" : "Choose a picture"}
          onClose={() => setLibraryDialog(null)}
          onPick={(asset) => (libraryDialog.kind === "insert" ? insertPicture(asset) : choosePicture(libraryDialog.itemId, libraryDialog.target, asset))}
          onInsertDataDriven={libraryDialog.kind === "insert" ? insertDataDriven : undefined}
        />
      )}
      {reviewItemId && items.find((i) => i.id === reviewItemId) && (
        <MatchReviewDialog item={items.find((i) => i.id === reviewItemId)!} records={activeRecords} library={library} onOverrides={(changes) => setOverrides(reviewItemId, changes)} onClose={() => setReviewItemId(null)} />
      )}

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {galleryOpen && <TemplateGalleryDialog onUse={useTemplate} onClose={() => setGalleryOpen(false)} />}
      {auditDialog && <TextAuditDialog issues={issues} itemId={auditDialog.itemId} onFix={(issue) => fixOnPage(issue.recordId, issue.itemId)} onClose={() => setAuditDialog(null)} />}

      {status && (
        <div className={`toast ${status.kind}`} role="status">
          <div><span>{status.text}</span>{status.detail && <ul>{status.detail.map((d, i) => <li key={i}>{d}</li>)}</ul>}</div>
          {!status.busy && <button onClick={() => setStatus(null)} aria-label="Dismiss">Dismiss</button>}
        </div>
      )}

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

      {fieldDrag && <div className="drag-ghost" style={{ left: fieldDrag.x, top: fieldDrag.y }}>{fieldDisplayName(fieldDrag.field)}</div>}

      {printing && (
        <PrintSheets kind={printing} offset={printer} sheet={sheet} records={activeRecords} templateWidth={template.width} templateHeight={template.height} pageCount={pageCount} recordIndex={recordIndex} instanceFor={instanceFor} />
      )}
    </div>
    </ImageContext.Provider>
  );
}

export default App;
