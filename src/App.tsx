import { ChangeEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";
import Papa from "papaparse";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DesignItem, Guide, LabelPreset, RecordRow, Sheet, View, Workspace } from "./types";
import { PX_PER_IN, clamp, fieldDisplayName, starterItems, starterRecords, uid } from "./lib/data";
import { useHistory } from "./hooks/useHistory";
import { Topbar } from "./components/Topbar";
import { Toolbar } from "./components/Toolbar";
import { EditBar } from "./components/EditBar";
import { DataPanel } from "./components/DataPanel";
import { Inspector } from "./components/Inspector";
import { RecordBar } from "./components/RecordBar";
import { MAX_ZOOM, MIN_ZOOM, Viewport } from "./components/Viewport";
import { TemplateStage } from "./components/TemplateStage";
import { LayoutStage } from "./components/LayoutStage";
import { PrintSheets } from "./components/PrintSheets";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const WIDE_QUERY = "(min-width: 851px)";
const freshView = (): View => ({ zoom: 1, pan: { x: 0, y: 0 }, fitted: false });
const defaultSheet: Sheet = { pageWidth: 8.5, pageHeight: 11, columns: 2, rows: 4, gapX: 0.18, gapY: 0.18, marginX: 0.25, marginY: 0.25, repeatMode: "next" };

function App() {
  // ── Document ────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<RecordRow[]>(starterRecords);
  const [fileName, setFileName] = useState("bird-records.csv");
  const history = useHistory<DesignItem[]>(starterItems);
  const items = history.value;
  const [template, setTemplate] = useState({ width: 3.5, height: 2 });
  const [sheet, setSheet] = useState<Sheet>(defaultSheet);
  const [recordIndex, setRecordIndex] = useState(0);

  // ── UI state ────────────────────────────────────────────────────────────
  const [workspace, setWorkspace] = useState<Workspace>("template");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<DesignItem | null>(null);
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
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const fields = useMemo(() => Object.keys(records[0] ?? {}), [records]);
  const currentRecord = records[recordIndex] ?? {};
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const slots = sheet.columns * sheet.rows;
  const pageCount = sheet.repeatMode === "same" ? 1 : Math.max(1, Math.ceil(records.length / slots));
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
    setSelectedId(null);
    setPreview(false);
  };

  // ── Items ───────────────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, patch: Partial<DesignItem>, coalesce?: string) =>
    history.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)), { coalesce }), [history.set]);

  const addItem = (item: DesignItem) => {
    history.set((list) => [...list, item]);
    setSelectedId(item.id);
    setWorkspace("template");
    setPreview(false);
  };

  const addText = (field?: string, x = 0.5, y = 0.5) =>
    addItem({ id: uid(), type: "text", x, y, w: 2.5, h: 0.28, text: field ? fieldDisplayName(field) : "Your text", field, fontSize: 12, color: "#34443d", weight: 500, visible: true });

  const addShape = () => addItem({ id: uid(), type: "rect", x: 0.35, y: 0.35, w: 1.1, h: 0.65, fill: "#e9eee9", stroke: "#cbd5cc", visible: true });

  const removeItem = (id: string) => { history.set((list) => list.filter((item) => item.id !== id)); setSelectedId(null); };
  const deleteSelected = () => { if (selected) removeItem(selected.id); };
  const copySelected = () => { if (selected) setClipboard({ ...selected }); };
  const cutSelected = () => { if (selected) { setClipboard({ ...selected }); removeItem(selected.id); } };
  const pasteItem = () => {
    if (!clipboard) return;
    const next = { ...clipboard, id: uid(), x: clipboard.x + 0.12, y: clipboard.y + 0.12 };
    setClipboard(next); // successive pastes cascade
    addItem(next);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    addItem({ ...selected, id: uid(), x: selected.x + 0.12, y: selected.y + 0.12 });
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
    if (selected?.type === "text") updateItem(selected.id, { field, text: fieldDisplayName(field) });
    else addText(field);
    if (!window.matchMedia(WIDE_QUERY).matches) setDataOpen(false); // overlay drawer: reveal the result
  };

  // ── Data import ─────────────────────────────────────────────────────────
  const importData = (file: File) => {
    Papa.parse<RecordRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data.filter((row) => Object.values(row).some((v) => String(v ?? "").trim()));
        if (!cleaned.length) { window.alert("No records were found in that file."); return; }
        setRecords(cleaned);
        setRecordIndex(0);
        setFileName(file.name);
      },
      error: () => window.alert("That file could not be read."),
    });
  };

  const importImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      let src: string;
      let aspect = 1;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // PDFs are imported as a high-resolution image of their first page.
        const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: clamp(1800 / Math.max(base.width, base.height), 2, 3) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create an image for this PDF.");
        await page.render({ canvasContext: context, viewport }).promise;
        src = canvas.toDataURL("image/png");
        aspect = viewport.width / viewport.height;
        await pdf.destroy();
      } else {
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("The image file could not be read."));
          reader.readAsDataURL(file);
        });
        const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("This image format could not be opened."));
          image.src = src;
        });
        aspect = size.width / size.height;
      }
      const w = 1.2;
      addItem({ id: uid(), type: "image", x: 0.35, y: 0.35, w, h: clamp(w / (aspect || 1), 0.25, 2.5), src, assetName: file.name, visible: true });
    } catch (error) {
      console.error("Asset import failed:", error);
      window.alert(error instanceof Error ? error.message : "This file could not be imported.");
    }
  };

  // ── Template / page setup ───────────────────────────────────────────────
  const applyPreset = (preset: LabelPreset) => {
    setTemplate({ width: preset.width, height: preset.height });
    setSheet((s) => ({ ...s, columns: preset.columns, rows: preset.rows, gapX: preset.gapX, gapY: preset.gapY, marginX: preset.marginX, marginY: preset.marginY }));
    setViews((v) => ({ template: { ...v.template, fitted: false }, layout: { ...v.layout, fitted: false } }));
  };

  // ── Records ─────────────────────────────────────────────────────────────
  const stepRecord = (delta: number) => {
    if (pagedNav) setRecordIndex(clamp(currentPage + delta, 0, pageCount - 1) * slots);
    else setRecordIndex((index) => clamp(index + delta, 0, records.length - 1));
  };

  // ── Print: mount every sheet, print, then unmount ───────────────────────
  const printNow = () => {
    if (printing) { window.print(); return; }
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
      if (mod && key === "z") { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); }
      else if (mod && key === "y") { event.preventDefault(); history.redo(); }
      else if (workspace !== "template") return;
      else if (mod && key === "c") { if (selected) { event.preventDefault(); copySelected(); } }
      else if (mod && key === "x") { if (selected) { event.preventDefault(); cutSelected(); } }
      else if (mod && key === "v") { if (clipboard) { event.preventDefault(); pasteItem(); } }
      else if (mod && key === "d") { if (selected) { event.preventDefault(); duplicateSelected(); } }
      else if (key === "delete" || key === "backspace") { if (selected) { event.preventDefault(); deleteSelected(); } }
      else if (key === "escape") setSelectedId(null);
      else if (selected && !selected.locked && key.startsWith("arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 0.1 : snap ? 0.05 : 0.01;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        updateItem(selected.id, { x: Number((selected.x + dx).toFixed(3)), y: Number((selected.y + dy).toFixed(3)) }, `nudge:${selected.id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Render ──────────────────────────────────────────────────────────────
  const meta = { recordNumber: recordIndex + 1, pageNumber: currentPage + 1, recordCount: records.length, pageCount };
  const caption = workspace === "template"
    ? { title: "INDIVIDUAL TEMPLATE", detail: `${template.width.toFixed(2)} × ${template.height.toFixed(2)} in` }
    : { title: "PAGE LAYOUT", detail: `${sheet.pageWidth} × ${sheet.pageHeight} in · ${slots} per sheet` };

  return (
    <div className="app-shell">
      <Topbar workspace={workspace} onWorkspace={switchWorkspace} onPrint={printNow} />

      <main className="workspace">
        <Toolbar
          showGrid={showGrid} onGrid={() => setShowGrid((v) => !v)}
          showRulers={showRulers} onRulers={() => setShowRulers((v) => !v)}
          snap={snap} onSnap={() => setSnap((v) => !v)}
          preview={preview} onPreview={() => setPreview((v) => !v)}
          zoom={view.zoom} onZoom={setZoom} onZoomPreset={toggleZoomPreset}
          onAddText={() => addText()} onAddShape={addShape} onAddImage={() => imageInputRef.current?.click()}
        />
        <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf" hidden onChange={importImage} />

        <div className={`content-frame${dataOpen ? " data-open" : ""}${inspectorOpen ? " inspector-open" : ""}`}>
          {dataOpen && (
            <DataPanel fileName={fileName} fields={fields} recordCount={records.length} hasTextSelected={selected?.type === "text"} onImport={importData} onField={bindField} onClose={() => setDataOpen(false)} />
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
                onRulerDoubleClick={() => { setSelectedId(null); setInspectorOpen(true); }}
                onBackgroundClick={() => setSelectedId(null)}
                paperClassName={preview ? "preview" : ""}
              >
                {workspace === "template" ? (
                  <TemplateStage
                    items={items} record={currentRecord} meta={meta} width={template.width} height={template.height} zoom={view.zoom}
                    selectedId={selectedId} showGrid={showGrid} snap={snap} guides={guides.template} preview={preview} svgRef={svgRef}
                    onSelect={setSelectedId}
                    onMove={(id, x, y) => updateItem(id, { x, y }, `drag:${id}`)}
                    onDragEnd={history.breakGroup}
                    onBind={(id, field) => { updateItem(id, { field, text: fieldDisplayName(field) }); setSelectedId(id); }}
                    onDropField={(field, x, y) => addText(field, x, y)}
                  />
                ) : (
                  <LayoutStage
                    sheet={sheet} templateWidth={template.width} templateHeight={template.height} items={items} records={records}
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
                  hasSelection={!!selected} canPaste={!!clipboard} canUndo={history.canUndo} canRedo={history.canRedo}
                  onUndo={history.undo} onRedo={history.redo} onDelete={deleteSelected} onCut={cutSelected} onCopy={copySelected} onPaste={pasteItem}
                />
              )}
            </div>

            <RecordBar
              label={pagedNav ? "Sheet" : "Record"}
              position={pagedNav ? currentPage + 1 : recordIndex + 1}
              total={pagedNav ? pageCount : records.length}
              name={String(currentRecord.name ?? "") || `Record ${recordIndex + 1} of ${records.length}`}
              onStep={stepRecord}
            />
          </div>

          {inspectorOpen && (
            <Inspector
              workspace={workspace} items={items} selected={selected} onSelect={setSelectedId} onUpdate={updateItem}
              onDuplicate={duplicateSelected} onDelete={deleteSelected} onMoveLayer={moveLayer}
              templateWidth={template.width} templateHeight={template.height} onTemplateSize={(width, height) => setTemplate({ width, height })} onPreset={applyPreset}
              sheet={sheet} onSheet={(patch) => setSheet((s) => ({ ...s, ...patch }))} pageCount={pageCount} overflow={overflow}
              onClose={() => setInspectorOpen(false)}
            />
          )}
        </div>
      </main>

      {printing && (
        <PrintSheets sheet={sheet} items={items} records={records} templateWidth={template.width} templateHeight={template.height} pageCount={pageCount} recordIndex={recordIndex} />
      )}
    </div>
  );
}

export default App;
