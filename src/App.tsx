import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";
import Papa from "papaparse";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DesignItem, Guide, LabelPreset, Project, RecordRow, Sheet, View, Workspace } from "./types";
import { PX_PER_IN, clamp, fieldDisplayName, starterItems, starterRecords, uid } from "./lib/data";
import { useHistory } from "./hooks/useHistory";
import { useFontLibrary } from "./hooks/useFontLibrary";
import { aabb, alignItems, boundsOf, centerOf, distributeItems, rotateAbout, type AlignMode, type Transform } from "./lib/align";
import { applyMapping, boundFields } from "./lib/mapping";
import { MappingDialog } from "./components/MappingDialog";
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
import { DataPanel } from "./components/DataPanel";
import { Inspector } from "./components/Inspector";
import { RecordBar } from "./components/RecordBar";
import { MAX_ZOOM, MIN_ZOOM, Viewport } from "./components/Viewport";
import { TemplateStage } from "./components/TemplateStage";
import { LayoutStage } from "./components/LayoutStage";
import { itemFrame } from "./components/ItemShape";
import { DataTable } from "./components/DataTable";
import { ID, addColumn, blankRow, columnsOf, duplicateRows, isIncluded, keepOneRow, pasteGrid, removeColumn, renameColumn, setCell, setIncluded, sortRows, toCsv, withIds } from "./lib/records";
import { PrintSheets } from "./components/PrintSheets";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const WIDE_QUERY = "(min-width: 851px)";
const freshView = (): View => ({ zoom: 1, pan: { x: 0, y: 0 }, fitted: false });
const defaultSheet: Sheet = { pageWidth: 8.5, pageHeight: 11, columns: 2, rows: 4, gapX: 0.18, gapY: 0.18, marginX: 0.25, marginY: 0.25, repeatMode: "next", cropMarks: false };
const DEFAULT_NAME = "Untitled bird card";

function App() {
  // ── Document (restored from this browser's last session when available) ──
  const [initial] = useState(() => loadProject());
  const recordHistory = useHistory<RecordRow[]>(withIds(initial?.records ?? starterRecords));
  const records = recordHistory.value;
  const setRecords = (next: RecordRow[]) => recordHistory.set(() => next);
  const editRecords = (update: (rows: RecordRow[]) => RecordRow[], coalesce?: string) => recordHistory.set(update, { coalesce });
  const [fileName, setFileName] = useState(initial?.fileName ?? "bird-records.csv");
  const [docName, setDocName] = useState(initial?.name ?? DEFAULT_NAME);
  const history = useHistory<DesignItem[]>(initial?.items ?? starterItems);
  const items = history.value;
  const [template, setTemplate] = useState(initial?.template ?? { width: 3.5, height: 2 });
  const [sheet, setSheet] = useState<Sheet>(initial?.sheet ?? defaultSheet);
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
  const [pendingImport, setPendingImport] = useState<{ records: RecordRow[]; fileName: string } | null>(null);
  const [dataOpen, setDataOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [snap, setSnap] = useState(false);
  const [preview, setPreview] = useState(false);
  const [printing, setPrinting] = useState(false);

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
  const activeRecords = useMemo(() => records.filter(isIncluded), [records]);
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
    setPreview(false);
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

  const addShape = () => addItem({ id: uid(), type: "rect", x: 0.35, y: 0.35, w: 1.1, h: 0.65, fill: "#e9eee9", stroke: "#cbd5cc", visible: true });

  const deleteSelected = () => {
    if (!selectedIds.length) return;
    history.set((list) => list.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };
  const copySelected = () => { if (selectedItems.length) setClipboard(selectedItems.map((item) => ({ ...item }))); };
  const cutSelected = () => { copySelected(); deleteSelected(); };
  const cloneOffset = (list: DesignItem[]) => list.map((item) => ({ ...item, id: uid(), x: item.x + 0.12, y: item.y + 0.12 }));
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

  const align = (mode: AlignMode) => {
    const within = selectedItems.length > 1 ? boundsOf(framed(selectedItems)) : { x: 0, y: 0, w: template.width, h: template.height };
    history.set((list) => keepPositions(list, alignItems(framed(list), selectedIds, mode, within)));
  };
  const distribute = (axis: "x" | "y") => history.set((list) => keepPositions(list, distributeItems(framed(list), selectedIds, axis)));

  const onMarquee = (box: { x: number; y: number; w: number; h: number }, additive: boolean) => {
    const hits = framed(items)
      .filter((item) => item.visible !== false)
      .filter((item) => { const b = aabb(item); return b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y; })
      .map((item) => item.id);
    setSelectedIds((current) => (additive ? [...new Set([...current, ...hits])] : hits));
  };

  const moveLayer = (id: string, direction: -1 | 1) => history.set((list) => {
    const index = list.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const bindField = (field: string) => {
    if (justDragged.current) return;
    if (selected?.type === "text") updateItem(selected.id, { field, text: fieldDisplayName(field) });
    else addText(field);
    if (!window.matchMedia(WIDE_QUERY).matches) setDataOpen(false); // overlay drawer: reveal the result
  };

  // ── Data import ─────────────────────────────────────────────────────────
  const adoptData = (next: RecordRow[], name: string, mapping?: Record<string, string | null>) => {
    if (mapping) history.set((list) => applyMapping(list, mapping));
    setRecords(withIds(next));
    setRecordIndex(0);
    setFileName(name);
    setPendingImport(null);
  };

  const importData = (file: File) => {
    Papa.parse<RecordRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data.filter((row) => Object.values(row).some((v) => String(v ?? "").trim()));
        if (!cleaned.length) { window.alert("No records were found in that file."); return; }
        // Only interrupt when the template uses columns the new file lacks; same-shaped files just load.
        const columns = new Set(Object.keys(cleaned[0]));
        const missing = boundFields(items).some((field) => !columns.has(field));
        if (missing) setPendingImport({ records: cleaned, fileName: file.name });
        else adoptData(cleaned, file.name);
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
  const imageTools = { library, columns: fields, record: currentRecord, records: activeRecords, onChoose: (itemId: string, target: "asset" | "fallback") => setLibraryDialog({ kind: "pick", itemId, target }), onReview: (itemId: string) => setReviewItemId(itemId) };

  // ── Template / page setup ───────────────────────────────────────────────
  const applyPreset = (preset: LabelPreset) => {
    setTemplate({ width: preset.width, height: preset.height });
    setSheet((s) => ({ ...s, columns: preset.columns, rows: preset.rows, gapX: preset.gapX, gapY: preset.gapY, marginX: preset.marginX, marginY: preset.marginY }));
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
        if (!window.matchMedia(WIDE_QUERY).matches) setDataOpen(false); // overlay drawer: reveal the result
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
  const snapshot = (): Project => ({ version: 1, name: docName, fileName, records, items, template, sheet, fonts: fontLibrary.fonts });
  useEffect(() => {
    const timer = window.setTimeout(() => setSaveState(saveProject(snapshot()) ? "saved" : "error"), 600);
    return () => window.clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const applyProject = async (project: Project, images?: { asset: Asset; blob: Blob }[]) => {
    if (images) await library.replaceAll(images);
    history.reset(project.items);
    recordHistory.reset(withIds(project.records)); setFileName(project.fileName); setDocName(project.name);
    setTemplate(project.template); setSheet(project.sheet);
    fontLibrary.restore(project.fonts);
    setSelectedIds([]); setRecordIndex(0);
    setGuides({ template: [], layout: [] });
    setViews({ template: freshView(), layout: freshView() });
  };
  const newProject = async () => {
    await library.clear();
    await applyProject({ version: 1, name: DEFAULT_NAME, fileName: "bird-records.csv", records: starterRecords, items: starterItems, template: { width: 3.5, height: 2 }, sheet: defaultSheet, fonts: [] });
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
      editRecords((rows) => renameColumn(rows, column, name));
      history.set((list) => applyMapping(list, { [column]: name })); // keep the template's linked text connected
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

  // ── Records ─────────────────────────────────────────────────────────────
  const stepRecord = (delta: number) => {
    if (pagedNav) setRecordIndex(clamp(currentPage + delta, 0, pageCount - 1) * slots);
    else setRecordIndex((index) => clamp(index + delta, 0, Math.max(0, activeRecords.length - 1)));
  };

  // ── Print: mount every sheet, print, then unmount ───────────────────────
  /** Picture rules that resolved to nothing, plus web pictures that must be fetched before the sheets can print. */
  const checkPictures = () => {
    let missing = 0;
    const web = new Set<string>();
    for (const item of items.filter((i) => i.type === "image" && i.imageSource && i.visible !== false)) {
      for (const record of activeRecords) {
        const match = library.resolver.resolve(item, record);
        if (match.kind === "none" && !item.fallbackAssetId) missing++;
        for (const m of [match, ...match.alternates]) if (m.url && isWebUrl(m.url)) web.add(m.url);
      }
    }
    return { missing, web: [...web] };
  };
  const printNow = async () => {
    if (printing) { window.print(); return; }
    const { missing, web } = checkPictures();
    if (missing && !window.confirm(`${missing} picture${missing === 1 ? " has" : "s have"} no match and will print blank. Print anyway?\n\nTip: open the picture’s “Review matches” to fix them.`)) return;
    if (web.length) {
      // Give web pictures a chance to load so they aren't missing from the printout.
      await Promise.race([
        Promise.allSettled(web.map((url) => new Promise<void>((resolve) => { const img = new Image(); img.onload = img.onerror = () => resolve(); img.src = url; }))),
        new Promise((resolve) => window.setTimeout(resolve, 20000)),
      ]);
    }
    setPrinting(true);
  };
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
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
      const target = showData ? recordHistory : history; // each view undoes its own edits
      if (mod && key === "z") { event.preventDefault(); event.shiftKey ? target.redo() : target.undo(); }
      else if (mod && key === "y") { event.preventDefault(); target.redo(); }
      else if (workspace !== "template" || showData) return;
      else if (mod && key === "a") { event.preventDefault(); setSelectedIds(items.filter((i) => i.visible !== false).map((i) => i.id)); }
      else if (mod && key === "c") { if (has) { event.preventDefault(); copySelected(); } }
      else if (mod && key === "x") { if (has) { event.preventDefault(); cutSelected(); } }
      else if (mod && key === "v") { if (clipboard.length) { event.preventDefault(); pasteItems(); } }
      else if (mod && key === "d") { if (has) { event.preventDefault(); duplicateSelected(); } }
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
  const caption = workspace === "template"
    ? { title: "INDIVIDUAL TEMPLATE", detail: `${template.width.toFixed(2)} × ${template.height.toFixed(2)} in` }
    : { title: "PAGE LAYOUT", detail: `${sheet.pageWidth} × ${sheet.pageHeight} in · ${slots} per sheet` };

  return (
    <ImageContext.Provider value={{ resolver: library.resolver, urlFor: library.urlFor }}>
    <div className="app-shell">
      <Topbar workspace={showData ? "data" : workspace} onWorkspace={(tab) => { if (tab === "data") { setShowData(true); setSelectedIds([]); } else { setShowData(false); switchWorkspace(tab); } }} onPrint={printNow} name={docName} onName={setDocName} saveState={saveState} onNew={newProject} onOpen={openProject} onSave={saveToFile} />

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
          showGrid={showGrid} onGrid={() => setShowGrid((v) => !v)}
          showRulers={showRulers} onRulers={() => setShowRulers((v) => !v)}
          snap={snap} onSnap={() => setSnap((v) => !v)}
          preview={preview} onPreview={() => setPreview((v) => !v)}
          multi={multiMode} onMulti={() => setMultiMode((v) => !v)}
          zoom={view.zoom} onZoom={setZoom} onZoomPreset={toggleZoomPreset}
          onAddText={() => addText()} onAddShape={addShape} onAddImage={() => setLibraryDialog({ kind: "insert" })}
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
                onBackgroundClick={() => setSelectedIds([])}
                marqueeMode={multiMode && workspace === "template"}
                onMarquee={workspace === "template" ? onMarquee : undefined}
                paperClassName={preview ? "preview" : ""}
              >
                {workspace === "template" ? (
                  <TemplateStage
                    items={items} record={currentRecord} meta={meta} width={template.width} height={template.height} zoom={view.zoom}
                    selectedIds={selectedIds} showGrid={showGrid} snap={snap} guides={guides.template} multi={multiMode} preview={preview} svgRef={svgRef}
                    onSelect={setSelectedIds} onMove={moveMany} onResize={resizeItem} onRotate={rotateItem} onRotateGroup={rotateGroup} onDragEnd={history.breakGroup}
                  />
                ) : (
                  <LayoutStage
                    sheet={sheet} templateWidth={template.width} templateHeight={template.height} items={items} records={activeRecords}
                    slotRecord={(slot) => (sheet.repeatMode === "same" ? recordIndex : currentPage * slots + slot)}
                    pageNumber={currentPage + 1} pageCount={pageCount} showGrid={showGrid} preview={preview}
                  />
                )}
              </Viewport>

              <div className="canvas-caption"><span>{caption.title}</span><span>{caption.detail}</span></div>

              <button className={dataOpen ? "drawer-toggle left active" : "drawer-toggle left"} title={dataOpen ? "Hide data fields" : "Show data fields"} aria-label={dataOpen ? "Hide data fields" : "Show data fields"} aria-pressed={dataOpen} onClick={() => setDataOpen((open) => !open)}>
                {dataOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
              </button>
              <button className={inspectorOpen ? "drawer-toggle right active" : "drawer-toggle right"} title={inspectorOpen ? "Hide properties and layers" : "Show properties and layers"} aria-label={inspectorOpen ? "Hide properties and layers" : "Show properties and layers"} aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>
                {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
              </button>

              {workspace === "template" && (
                <EditBar
                  hasSelection={selectedItems.length > 0} canPaste={clipboard.length > 0} canUndo={history.canUndo} canRedo={history.canRedo}
                  onUndo={history.undo} onRedo={history.redo} onDelete={deleteSelected} onCut={cutSelected} onCopy={copySelected} onPaste={pasteItems}
                />
              )}
            </div>

            <RecordBar
              label={pagedNav ? "Sheet" : "Record"}
              position={pagedNav ? currentPage + 1 : recordIndex + 1}
              total={pagedNav ? pageCount : activeRecords.length}
              name={String(currentRecord.name ?? "") || `Record ${recordIndex + 1} of ${activeRecords.length}`}
              onStep={stepRecord}
            />
          </div>

          {inspectorOpen && (
            <Inspector
              workspace={workspace} items={items} selectedItems={selectedItems} onSelect={setSelectedIds} onUpdate={updateItem}
              fontLibrary={fontLibrary} onAlign={align} onDistribute={distribute} onRotateBy={rotateSelectionBy} imageTools={imageTools}
              onDuplicate={duplicateSelected} onDelete={deleteSelected} onMoveLayer={moveLayer}
              templateWidth={template.width} templateHeight={template.height} onTemplateSize={(width, height) => setTemplate({ width, height })} onPreset={applyPreset}
              sheet={sheet} onSheet={(patch) => setSheet((s) => ({ ...s, ...patch }))} pageCount={pageCount} overflow={overflow}
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

      {pendingImport && (
        <MappingDialog
          fileName={pendingImport.fileName} records={pendingImport.records} templateFields={boundFields(items)}
          onApply={(mapping) => adoptData(pendingImport.records, pendingImport.fileName, mapping)}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {fieldDrag && <div className="drag-ghost" style={{ left: fieldDrag.x, top: fieldDrag.y }}>{fieldDisplayName(fieldDrag.field)}</div>}

      {printing && (
        <PrintSheets sheet={sheet} items={items} records={activeRecords} templateWidth={template.width} templateHeight={template.height} pageCount={pageCount} recordIndex={recordIndex} />
      )}
    </div>
    </ImageContext.Provider>
  );
}

export default App;
