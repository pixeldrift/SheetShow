import { ChangeEvent, DragEvent, PointerEvent, useMemo, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, BadgeCheck, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Copy, Crop, Database, Eye, FileImage,
  FileSearch, FileStack, FileText, Grid2X2, ImagePlus, Layers, Link2, ListFilter,
  Lock, LockKeyhole, Magnet, Minus, MousePointer2, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, Plus, Printer, Ruler, Search,
  Settings2, Shapes, SlidersHorizontal, Sparkles, Square, Trash2, Type, Unlock, Upload,
  WandSparkles, ZoomIn, ZoomOut
} from "lucide-react";
import Papa from "papaparse";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type RecordRow = Record<string, string>;
type DesignItem = {
  id: string;
  type: "text" | "rect" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  field?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  fill?: string;
  stroke?: string;
  src?: string;
  assetName?: string;
  visible?: boolean;
  locked?: boolean;
};

const starterRecords: RecordRow[] = [
  { name: "Pip", species: "Green-cheeked conure", band: "GC-1048", location: "Garden Room · Cage 03", diet: "Pellets, greens, fruit", hatch_date: "2022-04-18" },
  { name: "Juniper", species: "Blue-and-gold macaw", band: "BG-0217", location: "Aviary · Flight 01", diet: "Pellets, nuts, vegetables", hatch_date: "2018-09-02" },
  { name: "Mochi", species: "Cockatiel", band: "CK-3309", location: "Garden Room · Cage 08", diet: "Pellets, seed, greens", hatch_date: "2021-11-26" },
  { name: "Fig", species: "African grey", band: "AG-0084", location: "Sunroom · Perch 02", diet: "Pellets, vegetables", hatch_date: "2016-02-11" },
  { name: "Basil", species: "Indian ringneck", band: "IR-1742", location: "Garden Room · Cage 05", diet: "Pellets, fruit, greens", hatch_date: "2020-07-07" },
  { name: "Clover", species: "Lovebird", band: "LB-4421", location: "Nursery · Cage 02", diet: "Small pellets, seed, greens", hatch_date: "2023-03-14" },
];

const starterItems: DesignItem[] = [
  { id: "shape-1", type: "rect", x: 0.18, y: 0.18, w: 3.14, h: 1.64, fill: "#fbfaf7", stroke: "#e7e2d8", visible: true },
  { id: "shape-2", type: "rect", x: 0.18, y: 0.18, w: 0.09, h: 1.64, fill: "#e28b55", stroke: "none", visible: true },
  { id: "text-1", type: "text", x: 0.42, y: 0.55, w: 2.75, h: 0.28, text: "BIRD PROFILE", fontSize: 8, color: "#b16b3f", weight: 700, visible: true },
  { id: "text-2", type: "text", x: 0.42, y: 0.91, w: 2.75, h: 0.38, text: "Bird name", field: "name", fontSize: 22, color: "#26352f", weight: 700, visible: true },
  { id: "text-3", type: "text", x: 0.42, y: 1.23, w: 2.75, h: 0.22, text: "Species", field: "species", fontSize: 10, color: "#66736d", visible: true },
  { id: "text-4", type: "text", x: 0.42, y: 1.55, w: 1.3, h: 0.18, text: "BAND · ", fontSize: 7, color: "#9a9d91", weight: 700, visible: true },
  { id: "text-5", type: "text", x: 1.0, y: 1.55, w: 2.0, h: 0.18, text: "Band number", field: "band", fontSize: 8, color: "#47564f", visible: true },
];

type LabelPreset = { code: string; name: string; width: number; height: number; columns: number; rows: number; gapX: number; gapY: number; marginX: number; marginY: number };
const averyPresets: LabelPreset[] = [
  { code: "5160", name: "Address labels · 30 per sheet", width: 2.625, height: 1, columns: 3, rows: 10, gapX: 0.125, gapY: 0, marginX: 0.1875, marginY: 0.5 },
  { code: "5161", name: "Address labels · 20 per sheet", width: 4, height: 1, columns: 2, rows: 10, gapX: 0.1875, gapY: 0, marginX: 0.15625, marginY: 0.5 },
  { code: "5162", name: "Address labels · 14 per sheet", width: 4, height: 1.333, columns: 2, rows: 7, gapX: 0.1875, gapY: 0.167, marginX: 0.15625, marginY: 0.5 },
  { code: "5163", name: "Shipping labels · 10 per sheet", width: 4, height: 2, columns: 2, rows: 5, gapX: 0.1875, gapY: 0, marginX: 0.15625, marginY: 0.5 },
  { code: "5164", name: "Shipping labels · 6 per sheet", width: 4, height: 3.333, columns: 2, rows: 3, gapX: 0.1875, gapY: 0.167, marginX: 0.15625, marginY: 0.5 },
  { code: "5167", name: "Return address · 80 per sheet", width: 1.75, height: 0.5, columns: 4, rows: 20, gapX: 0.125, gapY: 0, marginX: 0.25, marginY: 0.5 },
  { code: "5260", name: "Easy Peel address · 30 per sheet", width: 2.625, height: 1, columns: 3, rows: 10, gapX: 0.125, gapY: 0, marginX: 0.1875, marginY: 0.5 },
  { code: "8160", name: "Inkjet address · 30 per sheet", width: 2.625, height: 1, columns: 3, rows: 10, gapX: 0.125, gapY: 0, marginX: 0.1875, marginY: 0.5 },
  { code: "8161", name: "Inkjet address · 20 per sheet", width: 4, height: 1, columns: 2, rows: 10, gapX: 0.1875, gapY: 0, marginX: 0.15625, marginY: 0.5 },
  { code: "8162", name: "Inkjet address · 14 per sheet", width: 4, height: 1.333, columns: 2, rows: 7, gapX: 0.1875, gapY: 0.167, marginX: 0.15625, marginY: 0.5 },
  { code: "8163", name: "Inkjet shipping · 10 per sheet", width: 4, height: 2, columns: 2, rows: 5, gapX: 0.1875, gapY: 0, marginX: 0.15625, marginY: 0.5 },
  { code: "8164", name: "Inkjet shipping · 6 per sheet", width: 4, height: 3.333, columns: 2, rows: 3, gapX: 0.1875, gapY: 0.167, marginX: 0.15625, marginY: 0.5 },
  { code: "5195", name: "File folder labels · 60 per sheet", width: 0.667, height: 3.438, columns: 3, rows: 20, gapX: 0.125, gapY: 0.0, marginX: 0.25, marginY: 0.25 },
  { code: "5390", name: "Name badges · 8 per sheet", width: 3.375, height: 2.333, columns: 2, rows: 4, gapX: 0.25, gapY: 0.25, marginX: 0.625, marginY: 0.5 },
  { code: "5392", name: "Name badges · 8 per sheet", width: 3.5, height: 2.25, columns: 2, rows: 4, gapX: 0.25, gapY: 0.25, marginX: 0.5, marginY: 0.75 },
  { code: "8371", name: "Business cards · 10 per sheet", width: 3.5, height: 2, columns: 2, rows: 5, gapX: 0.25, gapY: 0, marginX: 0.5, marginY: 0.5 },
  { code: "8871", name: "Business cards · 10 per sheet", width: 3.5, height: 2, columns: 2, rows: 5, gapX: 0.25, gapY: 0, marginX: 0.5, marginY: 0.5 },
  { code: "22806", name: "Shipping labels · 10 per sheet", width: 4, height: 2, columns: 2, rows: 5, gapX: 0.1875, gapY: 0, marginX: 0.15625, marginY: 0.5 },
];
const uid = () => Math.random().toString(36).slice(2, 9);
const valueFor = (item: DesignItem, record: RecordRow) => item.field ? (record[item.field] ?? "—") : (item.text ?? "");
const inches = (n: number) => Number(n.toFixed(2));

function App() {
  const [records, setRecords] = useState<RecordRow[]>(starterRecords);
  const [fileName, setFileName] = useState("bird-records.csv");
  const [items, setItems] = useState<DesignItem[]>(starterItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileLayers, setShowMobileLayers] = useState(false);
  const [dataDrawerOpen, setDataDrawerOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia("(min-width: 851px)").matches);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [presetSearch, setPresetSearch] = useState("");
  const [recordIndex, setRecordIndex] = useState(0);
  const [workspace, setWorkspace] = useState<"template" | "layout">("template");
  const [zoom, setZoom] = useState(1);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [pageWidth, setPageWidth] = useState(8.5);
  const [pageHeight, setPageHeight] = useState(11);
  const [templateWidth, setTemplateWidth] = useState(3.5);
  const [templateHeight, setTemplateHeight] = useState(2);
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(4);
  const [gapX, setGapX] = useState(0.18);
  const [gapY, setGapY] = useState(0.18);
  const [marginX, setMarginX] = useState(0.25);
  const [marginY, setMarginY] = useState(0.25);
  const [repeatMode, setRepeatMode] = useState<"same" | "next">("next");
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null);

  const fields = useMemo(() => Object.keys(records[0] ?? {}), [records]);
  const currentRecord = records[recordIndex] ?? {};
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const filteredFields = fields.filter((field) => field.toLowerCase().includes(search.toLowerCase()));
  const matchingPresets = useMemo(() => {
    const width = templateWidth || 0;
    const height = templateHeight || 0;
    const query = presetSearch.trim().toLowerCase();
    const scored = averyPresets.map((preset) => {
      const sizeError = Math.abs(preset.width - width) + Math.abs(preset.height - height);
      const textMatch = !query || `${preset.code} ${preset.name} ${preset.width}x${preset.height}`.toLowerCase().includes(query);
      return { preset, sizeError, textMatch };
    }).filter(({ sizeError, textMatch }) => textMatch && (query ? true : sizeError <= 1.25))
      .sort((x, y) => x.sizeError - y.sizeError);
    return scored.slice(0, 7).map(({ preset }) => preset);
  }, [templateWidth, templateHeight, presetSearch]);
  const totalSlots = columns * rows;
  const pageCount = repeatMode === "same" ? 1 : Math.max(1, Math.ceil(records.length / totalSlots));
  const currentPage = repeatMode === "same" ? 0 : Math.floor(recordIndex / totalSlots);

  const updateItem = (id: string, patch: Partial<DesignItem>) =>
    setItems((previous) => previous.map((item) => item.id === id ? { ...item, ...patch } : item));

  const addText = (field?: string, x = 0.5, y = 0.5) => {
    const item: DesignItem = {
      id: uid(), type: "text", x, y, w: 2.5, h: 0.28,
      text: field ? field.replaceAll("_", " ") : "Your text",
      field, fontSize: 12, color: "#34443d", weight: 500, visible: true,
    };
    setItems((previous) => [...previous, item]);
    setSelectedId(item.id);
    setWorkspace("template");
  };

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse<RecordRow>(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (result) => {
        const cleaned = result.data.filter((row) => Object.values(row).some((v) => String(v ?? "").trim()));
        if (cleaned.length) {
          setRecords(cleaned);
          setRecordIndex(0);
          setFileName(file.name);
        }
      },
    });
    event.target.value = "";
  };

  const addShape = () => {
    const item: DesignItem = { id: uid(), type: "rect", x: 0.35, y: 0.35, w: 1.1, h: 0.65, fill: "#e9eee9", stroke: "#cbd5cc", visible: true };
    setItems((previous) => [...previous, item]);
    setSelectedId(item.id);
  };

  const addImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    try {
      let src: string;
      let aspectRatio = 1;

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // PDFs are imported as a high-resolution image of their first page.
        const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(3, Math.max(2, 1800 / Math.max(baseViewport.width, baseViewport.height)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create an image for this PDF.");
        await page.render({ canvasContext: context, viewport }).promise;
        src = canvas.toDataURL("image/png");
        aspectRatio = viewport.width / viewport.height;
        await pdf.destroy();
      } else {
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("The image file could not be read."));
          reader.readAsDataURL(file);
        });
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("This image format could not be opened."));
          image.src = src;
        });
        aspectRatio = dimensions.width / dimensions.height;
      }

      const width = 1.2;
      const item: DesignItem = {
        id: uid(), type: "image", x: 2.1, y: 0.35, w: width,
        h: Math.max(0.25, Math.min(2.5, width / (aspectRatio || 1))),
        src, assetName: file.name, visible: true,
      };
      setItems((previous) => [...previous, item]);
      setSelectedId(item.id);
      setWorkspace("template");
    } catch (error) {
      console.error("Asset import failed:", error);
      window.alert(error instanceof Error ? error.message : "This file could not be imported.");
    }
  };

  const bindSelected = (field: string) => {
    setShowMobileLayers(false);
    if (selected?.type === "text") updateItem(selected.id, { field, text: field.replaceAll("_", " ") });
    else addText(field);
  };
  const applyPreset = (preset: LabelPreset) => {
    setTemplateWidth(preset.width); setTemplateHeight(preset.height);
    setColumns(preset.columns); setRows(preset.rows);
    setGapX(preset.gapX); setGapY(preset.gapY);
    setMarginX(preset.marginX); setMarginY(preset.marginY);
    setPresetSearch("");
  };

  const onDragStart = (event: DragEvent<HTMLButtonElement>, field: string) => {
    event.dataTransfer.setData("text/plain", field);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onCanvasDrop = (event: DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const field = event.dataTransfer.getData("text/plain");
    const svg = svgRef.current;
    if (!field || !svg) return;
    const target = (event.target as Element).closest("[data-item-id]");
    const targetId = target?.getAttribute("data-item-id");
    const targetItem = items.find((item) => item.id === targetId);
    if (targetItem?.type === "text") {
      updateItem(targetItem.id, { field, text: field.replaceAll("_", " ") });
      setSelectedId(targetItem.id);
      return;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const local = point.matrixTransform(matrix.inverse());
    addText(field, inches(local.x / 96), inches(local.y / 96));
  };

  const startMove = (event: PointerEvent<SVGGElement>, item: DesignItem) => {
    if (workspace !== "template" || showPrintPreview || item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    setShowMobileLayers(false);
    dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, itemX: item.x, itemY: item.y };
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
  };

  const moveItem = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = (templateWidth * 96 * zoom) / rect.width;
    const scaleY = (templateHeight * 96 * zoom) / rect.height;
    const deltaX = (event.clientX - dragRef.current.startX) * scaleX / 96;
    const deltaY = (event.clientY - dragRef.current.startY) * scaleY / 96;
    const step = snapToGrid ? 0.05 : 0.001;
    const nextX = Math.round((dragRef.current.itemX + deltaX) / step) * step;
    const nextY = Math.round((dragRef.current.itemY + deltaY) / step) * step;
    updateItem(dragRef.current.id, { x: Math.max(0, Number(nextX.toFixed(3))), y: Math.max(0, Number(nextY.toFixed(3))) });
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".canvas-object,button,input,select")) return;
    if (event.button !== 0) return;
    event.preventDefault();
    panRef.current = { startX: event.clientX, startY: event.clientY, panX: viewPan.x, panY: viewPan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    setViewPan({ x: panRef.current.panX + event.clientX - panRef.current.startX, y: panRef.current.panY + event.clientY - panRef.current.startY });
  };
  const endPan = () => { panRef.current = null; };

  const addPageSlot = (slot: number) => repeatMode === "same" ? recordIndex : Math.min(records.length - 1, currentPage * totalSlots + slot);
  const fitZoom = () => {
    const area = document.querySelector(".canvas-area");
    const width = Math.max(160, (area?.clientWidth ?? window.innerWidth) - 72);
    const height = Math.max(160, (area?.clientHeight ?? window.innerHeight) - 100);
    const targetWidth = workspace === "layout" ? pageWidth * 96 : templateWidth * 96;
    const targetHeight = workspace === "layout" ? pageHeight * 96 : templateHeight * 96;
    return Math.max(0.15, Math.min(2, width / targetWidth, height / targetHeight));
  };
  const toggleZoomPreset = () => setZoom((current) => Math.abs(current - 1) < 0.02 ? fitZoom() : 1);
  const printNow = () => {
    if (!showPrintPreview) setShowPrintPreview(true);
    window.setTimeout(() => window.print(), 180);
  };
  const moveLayer = (id: string, direction: -1 | 1) => setItems((previous) => {
    const index = previous.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= previous.length) return previous;
    const reordered = [...previous];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    return reordered;
  });

  const renderTemplate = (record: RecordRow, mini = false) => (
    <svg viewBox={`0 0 ${templateWidth * 96} ${templateHeight * 96}`} className={mini ? "mini-template" : "template-svg"} xmlns="http://www.w3.org/2000/svg">
      {showGrid && !mini && <defs><pattern id="smallGrid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e8ece8" strokeWidth="0.7"/></pattern></defs>}
      {showGrid && !mini && <rect width="100%" height="100%" fill="url(#smallGrid)"/>}
      {items.filter((item) => item.visible !== false).map((item) => {
        const isSelected = !mini && selectedId === item.id;
        return (
          <g key={item.id} data-item-id={item.id} transform={`translate(${item.x * 96} ${item.y * 96})`} onPointerDown={(event) => !mini && startMove(event, item)} onClick={(event) => { if (!mini) { event.stopPropagation(); setSelectedId(item.id); setShowMobileLayers(false); } }} className={!mini ? "canvas-object" : ""} style={{ cursor: mini ? "default" : "move" }}>
            {item.type === "rect" && <rect width={item.w * 96} height={item.h * 96} rx="0" fill={item.fill ?? "#e9eee9"} stroke={item.stroke ?? "none"} strokeWidth="1"/>}
            {item.type === "image" && item.src && <image href={item.src} width={item.w * 96} height={item.h * 96} preserveAspectRatio="xMidYMid slice"/>}
            {item.type === "text" && <text x={item.align === "center" ? item.w * 48 : item.align === "right" ? item.w * 96 : 0} y={(item.fontSize ?? 12) * 1.15 * 96 / 72} fontFamily={item.fontFamily ?? "Inter, Arial, sans-serif"} fontSize={(item.fontSize ?? 12) * 96 / 72} fontWeight={item.weight ?? 500} fill={item.color ?? "#34443d"} textAnchor={item.align === "center" ? "middle" : item.align === "right" ? "end" : "start"}>{valueFor(item, record)}</text>}
            {isSelected && <rect x="-4" y="-4" width={item.w * 96 + 8} height={item.h * 96 + 8} fill="none" stroke="#d77d4e" strokeWidth="1.4" strokeDasharray="4 3" pointerEvents="none"/>}
          </g>
        );
      })}
    </svg>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span className="brand-sheet"/><span className="brand-star">✦</span></div>
          <div className="brand-name">Sheet<span>Show</span><small>WHERE DATA TAKES THE STAGE</small></div>
        </div>
        <div className="topbar-center">
          <div className="document-title"><FileText size={15}/><span>Untitled bird card</span><span className="saved-dot"/></div>
          <div className="workspace-tabs">
            <button className={workspace === "template" ? "active" : ""} onClick={() => { setWorkspace("template"); setSelectedId(null); setShowMobileLayers(false); setShowPrintPreview(false); }} title="Individual template"><svg className="template-tab-icon" viewBox="0 0 48 32" aria-hidden="true"><rect x="2.5" y="2.5" width="43" height="27" rx="2.5"/><path d="M9 2.5v5M39 2.5v5M9 24.5v5M39 24.5v5M2.5 10h5M2.5 22h5M40.5 10h5M40.5 22h5"/></svg> <span>Template</span></button>
            <button className={workspace === "layout" ? "active" : ""} onClick={() => { setWorkspace("layout"); setSelectedId(null); setShowMobileLayers(false); setShowPrintPreview(false); }} title="Page layout"><svg className="page-tab-icon" viewBox="0 0 32 40" aria-hidden="true"><rect x="2" y="1.5" width="28" height="37" rx="1.5"/><rect x="6" y="6" width="9" height="6"/><rect x="17" y="6" width="9" height="6"/><rect x="6" y="15" width="9" height="6"/><rect x="17" y="15" width="9" height="6"/><rect x="6" y="24" width="9" height="6"/><rect x="17" y="24" width="9" height="6"/></svg> <span>Page layout</span></button>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-button" title="Help"><CircleHelp size={17}/></button>
          <button className="button button-light" onClick={printNow}><Printer size={15}/> Print</button>
          <button className="button button-primary make-button" onClick={printNow} aria-label="Make it" title="Make it"><Printer size={17}/></button>
        </div>
      </header>

      <main className="workspace">


        <section className="center-panel">
          <div className="canvas-toolbar">
            <div className="tool-group">
              <button className="tool-button active" title="Select"><MousePointer2 size={16}/></button>
              <button className="tool-button" title="Add text" onClick={() => addText()}><Type size={16}/></button>
              <button className="tool-button" title="Add shape" onClick={addShape}><Shapes size={16}/></button>
              <button className="tool-button" title="Add image" onClick={() => imageRef.current?.click()}><ImagePlus size={16}/></button>
              <input ref={imageRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf" hidden onChange={addImage}/>
            </div>
            <div className="toolbar-divider"/>
            <div className="tool-group">
              <button className={showGrid ? "tool-button active" : "tool-button"} title="Toggle grid" onClick={() => setShowGrid(!showGrid)}><Grid2X2 size={15}/></button>
              <button className={showRulers ? "tool-button active" : "tool-button"} title="Toggle rulers" onClick={() => setShowRulers(!showRulers)}><Ruler size={15}/></button>
              <button className={snapToGrid ? "tool-button active" : "tool-button"} title="Snap to 0.05 inch increments" onClick={() => setSnapToGrid(!snapToGrid)}><Magnet size={15}/></button>
              <button className={showPrintPreview ? "tool-button active" : "tool-button"} title="Toggle print preview" onClick={() => setShowPrintPreview(!showPrintPreview)}><FileSearch size={16}/></button>
            </div>
            <div className="toolbar-spacer"/>
            {workspace === "template" && <div className="dimension-chip"><span>{templateWidth.toFixed(2)}″</span><i>×</i><span>{templateHeight.toFixed(2)}″</span></div>}
            <div className="zoom-control"><button className="tool-button" title="Zoom out" onClick={() => setZoom(Math.max(0.25, Number((zoom - 0.1).toFixed(2))))}><ZoomOut size={15}/></button><input aria-label="Zoom level" className="zoom-slider" type="range" min="0.25" max="2" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}/><button className="zoom-percent" onClick={toggleZoomPreset} title="Toggle 100% / fit to screen">{Math.round(zoom * 100)}%</button><button className="tool-button" title="Zoom in" onClick={() => setZoom(Math.min(2, Number((zoom + 0.1).toFixed(2))))}><ZoomIn size={15}/></button></div>
          </div>
          <div className={`content-frame ${dataDrawerOpen ? "with-data" : ""} ${inspectorOpen ? "with-inspector" : ""}`}>
        <aside className="left-panel">
          <div className="panel-heading"><h2>Data fields</h2><button className="drawer-collapse" title="Collapse data fields" aria-label="Collapse data fields" onClick={() => setDataDrawerOpen(false)}><ChevronLeft size={17}/></button></div>
          <div className="panel-section">
            <div className="section-title"><Database size={14}/> DATA SOURCE <button className="text-action" onClick={() => fileRef.current?.click()}>Change</button></div>
            <div className="source-card">
              <div className="file-icon"><FileText size={17}/></div>
              <div className="source-meta"><strong>{fileName}</strong><span>{records.length} records · {fields.length} fields</span></div>
              <BadgeCheck size={15} className="success-icon"/>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={importFile}/>
            <div className="field-search"><Search size={14}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a field..."/><ListFilter size={14}/></div>
            <div className="field-group-label"><ChevronDown size={12}/> IMPORTED DATA <span>{fields.length}</span></div>
            <div className="field-list">
              {filteredFields.map((field) => (
                <button key={field} className="field-row" draggable onDragStart={(event) => onDragStart(event, field)} onClick={() => bindSelected(field)} title={selected?.type === "text" ? "Click to bind selected text" : "Click to add as a new text field"}>
                  <span className="field-grip">⠿</span><span className="field-type"><Type size={12}/></span><span className="field-name">{field.replaceAll("_", " ")}</span><span className="field-add"><Plus size={13}/></span>
                </button>
              ))}
            </div>
            <div className="drag-hint"><MousePointer2 size={13}/> Drag a field onto your design, or select text and click a field to link it.</div>
          </div>
                    <div className="left-footer"><div className="avatar">S</div><div><strong>Local project</strong><span>Saved in this session</span></div><Lock size={13}/></div>
        </aside>
            <div className="editor-content">
          <div className="canvas-area" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
            <button className={dataDrawerOpen ? "canvas-drawer-toggle left active" : "canvas-drawer-toggle left"} title={dataDrawerOpen ? "Hide data fields" : "Show data fields"} aria-label={dataDrawerOpen ? "Hide data fields" : "Show data fields"} onClick={() => setDataDrawerOpen((open) => !open)}>{dataDrawerOpen ? <PanelLeftClose size={16}/> : <PanelLeft size={16}/>}</button>
            <button className={inspectorOpen ? "canvas-drawer-toggle right active" : "canvas-drawer-toggle right"} title={inspectorOpen ? "Hide properties and layers" : "Show properties and layers"} aria-label={inspectorOpen ? "Hide properties and layers" : "Show properties and layers"} onClick={() => setInspectorOpen((open) => !open)}>{inspectorOpen ? <PanelRightClose size={16}/> : <PanelRight size={16}/>}</button>
            {workspace === "template" && (
              <div className="canvas-wrap" style={{ transform: `translate(${viewPan.x}px, ${viewPan.y}px)` }}>
                <div className="canvas-caption"><span>INDIVIDUAL TEMPLATE</span><span>{templateWidth.toFixed(2)} × {templateHeight.toFixed(2)} in · {showPrintPreview ? "Preview" : "Editing"}</span></div>
                <div className="ruler-stage">
                  {showRulers && <div className="ruler-corner"/>}
                  {showRulers && <div className="top-ruler" style={{width: templateWidth * 96 * zoom}}>{Array.from({length: Math.floor(templateWidth * 4) + 1}, (_, i) => <span key={i} style={{left: i * 24 * zoom}}>{i % 4 === 0 ? i / 4 : ""}</span>)}</div>}
                  {showRulers && <div className="left-ruler" style={{height: templateHeight * 96 * zoom}}>{Array.from({length: Math.floor(templateHeight * 4) + 1}, (_, i) => <span key={i} style={{top: i * 24 * zoom}}>{i % 4 === 0 ? i / 4 : ""}</span>)}</div>}
                  <div className="paper-shadow" style={{width: templateWidth * 96 * zoom, height: templateHeight * 96 * zoom}}>
                    <svg ref={svgRef} viewBox={`0 0 ${templateWidth * 96} ${templateHeight * 96}`} width={templateWidth * 96 * zoom} height={templateHeight * 96 * zoom} onPointerMove={moveItem} onPointerUp={() => { dragRef.current = null; }} onPointerLeave={() => { dragRef.current = null; }} onDragOver={(e) => e.preventDefault()} onDrop={onCanvasDrop} onClick={() => setSelectedId(null)} className="template-svg">
                      {showGrid && <defs><pattern id="gridPattern" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e9eee9" strokeWidth="0.7"/></pattern></defs>}
                      {showGrid && <rect width="100%" height="100%" fill="url(#gridPattern)"/>}
                      {items.filter((item) => item.visible !== false).map((item) => (
                        <g key={item.id} data-item-id={item.id} transform={`translate(${item.x * 96} ${item.y * 96})`} onPointerDown={(event) => startMove(event, item)} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} className="canvas-object">
                          {item.type === "rect" && <rect width={item.w * 96} height={item.h * 96} rx="2" fill={item.fill ?? "#e9eee9"} stroke={item.stroke ?? "none"} strokeWidth="1"/>}
                          {item.type === "image" && item.src && <image href={item.src} width={item.w * 96} height={item.h * 96} preserveAspectRatio="xMidYMid slice"/>}
                          {item.type === "text" && <text x={item.align === "center" ? item.w * 48 : item.align === "right" ? item.w * 96 : 0} y={(item.fontSize ?? 12) * 1.15 * 96 / 72} fontFamily={item.fontFamily ?? "Inter, Arial, sans-serif"} fontSize={(item.fontSize ?? 12) * 96 / 72} fontWeight={item.weight ?? 500} fill={item.color ?? "#34443d"} textAnchor={item.align === "center" ? "middle" : item.align === "right" ? "end" : "start"}>{valueFor(item, currentRecord)}</text>}
                          {selectedId === item.id && !showPrintPreview && <rect x="-4" y="-4" width={item.w * 96 + 8} height={item.h * 96 + 8} fill="none" stroke="#d77d4e" strokeWidth="1.4" strokeDasharray="4 3" pointerEvents="none"/>}
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
                <div className="canvas-footnote"><span><span className="orange-dot"/> {showPrintPreview ? "Print preview · editing paused" : selected ? "Object selected · drag to reposition" : "Select an object to edit"}</span><span>Measurements in inches</span></div>
              </div>
            )}

            {workspace === "layout" && (
              <div className="layout-editor" style={{ transform: `translate(${viewPan.x}px, ${viewPan.y}px)` }}>
                <div className="canvas-caption"><span>PAGE LAYOUT</span><span>{pageWidth} × {pageHeight} in · {totalSlots} items per sheet</span></div>
                <div className="layout-paper-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
                  <div className={showPrintPreview ? "layout-paper preview-active" : "layout-paper"} style={{width: `${pageWidth * 96}px`, height: `${pageHeight * 96}px`, padding: `${marginY * 96}px ${marginX * 96}px`, boxSizing: "border-box"}}>
                    <div className="layout-grid" style={{gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: `${gapY * 7}px ${gapX * 7}px`}}>
                      {Array.from({length: totalSlots}, (_, slot) => {
                        const idx = addPageSlot(slot);
                        return <div className={showGrid ? "layout-cell grid-visible" : "layout-cell"} key={slot}>{idx < records.length ? renderTemplate(records[idx], true) : <div className="empty-slot">Empty</div>}<span className="slot-number">{repeatMode === "same" ? `#${recordIndex + 1}` : `#${idx + 1}`}</span></div>;
                      })}
                    </div>
                  </div>
                </div>
                <div className="layout-note"><Sparkles size={14}/> {repeatMode === "same" ? `Every item repeats record ${recordIndex + 1}.` : `Items advance through your data, ${totalSlots} records per sheet.`}</div>
              </div>
            )}


          </div>

          <div className="record-bar">
            <div className="record-info"><div className="record-icon"><Database size={15}/></div><div><strong>Data preview</strong><span>Showing {recordIndex + 1} of {records.length} records</span></div></div>
            <div className="record-controls">
              <button className="tool-button" onClick={() => setRecordIndex(Math.max(0, recordIndex - 1))} disabled={recordIndex === 0}><ChevronLeft size={17}/></button>
              <div className="record-select"><span>Record</span><strong>{String(recordIndex + 1).padStart(2, "0")}</strong><span>/ {records.length}</span></div>
              <button className="tool-button" onClick={() => setRecordIndex(Math.min(records.length - 1, recordIndex + 1))} disabled={recordIndex >= records.length - 1}><ChevronRight size={17}/></button>
            </div>
            <div className="record-name"><span className="record-avatar">{String(currentRecord.name ?? "R").slice(0, 1).toUpperCase()}</span><strong>{currentRecord.name ?? "Current record"}</strong></div>
          </div>

            </div>
        <aside className="right-panel">
          <div className="inspector-heading"><span>{selected ? "Item properties" : workspace === "template" ? "Template setup" : "Page setup"}</span><button className="drawer-collapse" title="Collapse properties and layers" aria-label="Collapse properties and layers" onClick={() => setInspectorOpen(false)}><ChevronRight size={17}/></button></div><div className="right-tabs"><button className={!showMobileLayers ? "active" : ""} onClick={() => setShowMobileLayers(false)}><SlidersHorizontal size={14}/> Properties</button><button className={showMobileLayers ? "active" : ""} onClick={() => setShowMobileLayers(true)}><Layers size={14}/> Layers <span className="count-pill">{items.length}</span></button></div>
          {showMobileLayers ? (
            <div className="properties-content mobile-layer-list">
              <div className="section-title"><Layers size={14}/> STACK ORDER <span className="count-pill">{items.length}</span></div>
              {[...items].reverse().map((item) => (
                <div key={item.id} className={selectedId === item.id ? "layer-row selected" : "layer-row"} onClick={() => { setSelectedId(item.id); setShowMobileLayers(false); setWorkspace("template"); setShowPrintPreview(false); }}>
                  <span className="layer-kind">{item.type === "text" ? <Type size={13}/> : item.type === "image" ? <FileImage size={13}/> : <Square size={13}/>}</span>
                  <span className="layer-label">{item.field ?? item.text ?? item.assetName ?? "Shape"}</span>
                  <button className="layer-visibility" title={item.visible === false ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); updateItem(item.id, { visible: item.visible === false }); }}><Eye size={12}/></button>
                  <button className="layer-visibility" title={item.locked ? "Unlock" : "Lock"} onClick={(e) => { e.stopPropagation(); updateItem(item.id, { locked: !item.locked }); }}><LockKeyhole size={12}/></button>
                  <button className="layer-visibility" title="Move up" onClick={(e) => { e.stopPropagation(); moveLayer(item.id, 1); }}><ArrowUp size={12}/></button>
                  <button className="layer-visibility" title="Move down" onClick={(e) => { e.stopPropagation(); moveLayer(item.id, -1); }}><ArrowDown size={12}/></button>
                </div>
              ))}
            </div>
          ) : selected ? (
            <div className="properties-content">
              <div className="property-heading"><div className="property-icon">{selected.type === "text" ? <Type size={17}/> : selected.type === "image" ? <FileImage size={17}/> : <Square size={17}/>}</div><div><strong>{selected.type === "text" ? "Text object" : selected.type === "image" ? "Image object" : "Shape object"}</strong><span>{selected.field ? `Linked to ${selected.field}` : "Static content"}</span></div></div>
              {selected.type === "text" && <>
                <div className="property-section"><label>CONTENT</label><input className="property-input" value={selected.field ? (selected.field.replaceAll("_", " ")) : (selected.text ?? "")} onChange={(e) => updateItem(selected.id, { text: e.target.value, field: undefined })} placeholder="Enter text..."/><div className="binding-status" onClick={() => setSearch("")}><Link2 size={13}/>{selected.field ? `Connected to ${selected.field}` : "Choose a field on the left to link data"}</div></div>
                <div className="property-section"><label>TYPOGRAPHY</label><div className="property-two"><div><span>Font size</span><div className="number-input"><input type="number" min="4" max="96" value={selected.fontSize ?? 12} onChange={(e) => updateItem(selected.id, { fontSize: Number(e.target.value) })}/><small>pt</small></div></div><div><span>Weight</span><select value={selected.weight ?? 500} onChange={(e) => updateItem(selected.id, { weight: Number(e.target.value) })}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option></select></div></div><div className="align-buttons"><button className={(selected.align ?? "left") === "left" ? "active" : ""} onClick={() => updateItem(selected.id, { align: "left" })}><AlignLeft size={15}/></button><button className={selected.align === "center" ? "active" : ""} onClick={() => updateItem(selected.id, { align: "center" })}><AlignCenter size={15}/></button><button className={selected.align === "right" ? "active" : ""} onClick={() => updateItem(selected.id, { align: "right" })}><AlignRight size={15}/></button></div><div className="color-row"><span>Text color</span><input type="color" value={selected.color ?? "#34443d"} onChange={(e) => updateItem(selected.id, { color: e.target.value })}/></div></div>
              </>}
              {selected.type === "rect" && <div className="property-section"><label>APPEARANCE</label><div className="color-row"><span>Fill color</span><input type="color" value={selected.fill ?? "#e9eee9"} onChange={(e) => updateItem(selected.id, { fill: e.target.value })}/></div><div className="color-row"><span>Border color</span><input type="color" value={selected.stroke === "none" ? "#ffffff" : selected.stroke ?? "#cbd5cc"} onChange={(e) => updateItem(selected.id, { stroke: e.target.value })}/></div></div>}
              <div className="property-section"><label>POSITION & SIZE <span className="unit-label">INCHES</span></label><div className="position-grid">{([["X", "x"], ["Y", "y"], ["W", "w"], ["H", "h"]] as const).map(([label, key]) => <div key={key}><span>{label}</span><input type="number" step="0.01" value={selected[key].toFixed(2)} onChange={(e) => updateItem(selected.id, { [key]: Math.max(0.01, Number(e.target.value)) })}/></div>)}</div></div>
              <div className="property-actions"><button onClick={() => { const copy = { ...selected, id: uid(), x: selected.x + 0.12, y: selected.y + 0.12 }; setItems((prev) => [...prev, copy]); setSelectedId(copy.id); }}><Copy size={14}/> Duplicate</button><button onClick={() => updateItem(selected.id, { locked: !selected.locked })}>{selected.locked ? <Unlock size={14}/> : <LockKeyhole size={14}/>} {selected.locked ? "Unlock" : "Lock"}</button><button className="delete-action" onClick={() => { setItems((prev) => prev.filter((item) => item.id !== selected.id)); setSelectedId(null); }}><Trash2 size={14}/> Delete</button></div>
            </div>
          ) : (
            <div className="properties-content">
              {workspace === "template" ? (
                <>
                  <div className="document-summary"><div className="summary-icon"><Crop size={20}/></div><h3>Template setup</h3><p>Choose an Avery format or enter a custom size for one item.</p></div>
                  <div className="property-section"><label>INDIVIDUAL TEMPLATE SIZE · INCHES</label><div className="property-two"><div><span>Width</span><div className="number-input"><input type="number" step="0.01" value={templateWidth} onChange={(e) => setTemplateWidth(Math.max(0.1, Number(e.target.value)))}/><small>in</small></div></div><div><span>Height</span><div className="number-input"><input type="number" step="0.01" value={templateHeight} onChange={(e) => setTemplateHeight(Math.max(0.1, Number(e.target.value)))}/><small>in</small></div></div></div></div>
                  <div className="property-section"><label>AVERY LABEL TEMPLATES <span className="unit-label">{averyPresets.length} FORMATS</span></label><div className="preset-search"><Search size={13}/><input value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} placeholder="Search by number, name, or size"/><button onClick={() => setPresetSearch("")} aria-label="Clear preset search">×</button></div>
                    <button className="preset-option custom-preset" onClick={() => setPresetSearch("")}><span><strong>Custom</strong><small>{templateWidth.toFixed(3)} × {templateHeight.toFixed(3)} in · current size</small></span><BadgeCheck size={14}/></button>
                    {matchingPresets.length ? matchingPresets.map((preset) => <button key={preset.code} className="preset-option" onClick={() => applyPreset(preset)}><span><strong>Avery {preset.code}</strong><small>{preset.name}</small></span><em>{preset.width} × {preset.height}″</em></button>) : <p className="preset-empty">No close matches yet. Try entering a width or height, or search by Avery number.</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="document-summary"><div className="summary-icon"><FileText size={20}/></div><h3>Page setup</h3><p>Choose the sheet size and arrange repeated templates across it.</p></div>
                  <div className="property-section"><label>PAGE SIZE</label><select className="full-select" value={pageWidth === 8.5 && pageHeight === 11 ? "letter" : pageWidth === 8.27 && pageHeight === 11.69 ? "a4" : "custom"} onChange={(e) => { if (e.target.value === "letter") { setPageWidth(8.5); setPageHeight(11); } else if (e.target.value === "a4") { setPageWidth(8.27); setPageHeight(11.69); } }}><option value="letter">US Letter · 8.5 × 11 in</option><option value="a4">A4 · 8.27 × 11.69 in</option><option value="custom">Custom · {pageWidth} × {pageHeight} in</option></select></div>
                  <div className="property-section"><label>ITEMS PER PAGE</label><div className="property-two"><div><span>Columns</span><div className="number-input"><input type="number" min="1" max="8" value={columns} onChange={(e) => setColumns(Math.max(1, Math.min(8, Number(e.target.value))))}/></div></div><div><span>Rows</span><div className="number-input"><input type="number" min="1" max="12" value={rows} onChange={(e) => setRows(Math.max(1, Math.min(12, Number(e.target.value))))}/></div></div></div></div>
                  <div className="property-section"><label>PAGE MARGINS · INCHES</label><div className="property-two"><div><span>Left / Right</span><div className="number-input"><input type="number" min="0" step="0.05" value={marginX} onChange={(e) => setMarginX(Math.max(0, Number(e.target.value)))}/><small>in</small></div></div><div><span>Top / Bottom</span><div className="number-input"><input type="number" min="0" step="0.05" value={marginY} onChange={(e) => setMarginY(Math.max(0, Number(e.target.value)))}/><small>in</small></div></div></div></div>
                  <div className="property-section"><label>ITEM SPACING</label><div className="property-two"><div><span>Horizontal</span><div className="number-input"><input type="number" min="0" step="0.05" value={gapX} onChange={(e) => setGapX(Math.max(0, Number(e.target.value)))}/><small>in</small></div></div><div><span>Vertical</span><div className="number-input"><input type="number" min="0" step="0.05" value={gapY} onChange={(e) => setGapY(Math.max(0, Number(e.target.value)))}/><small>in</small></div></div></div></div>
                  <div className="property-section"><label>DATA ASSIGNMENT</label><div className="mode-options"><button className={repeatMode === "same" ? "mode-option active" : "mode-option"} onClick={() => setRepeatMode("same")}><span className="mode-icon"><Copy size={15}/></span><span><strong>Repeat same record</strong><small>Fill the sheet with one record</small></span><span className="mode-radio"/></button><button className={repeatMode === "next" ? "mode-option active" : "mode-option"} onClick={() => setRepeatMode("next")}><span className="mode-icon"><ListFilter size={15}/></span><span><strong>Next record each time</strong><small>Advance through your data</small></span><span className="mode-radio"/></button></div></div>
                  <div className="output-summary"><div><span>Items per sheet</span><strong>{totalSlots}</strong></div><div><span>Estimated sheets</span><strong>{pageCount}</strong></div></div>
                </>
              )}
            </div>
          )}
        </aside>
          </div>
        </section>


      </main>
      <footer className="statusbar"><span><span className="status-dot"/> All changes in this session</span><span>SheetShow Studio <i>·</i> Prototype 0.1</span><span>Inches <i>·</i> 96 DPI canvas</span></footer>
    </div>
  );
}

export default App;