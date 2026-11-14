import { useEffect, useMemo, useState } from "react";
import { Download, Search, Trash2, X } from "lucide-react";
import type { Asset } from "../types";
import type { ImageLibrary, ImportReport } from "../hooks/useImageLibrary";
import type { Incoming } from "../lib/importImages";
import { DropZone } from "./DropZone";

type Props = {
  library: ImageLibrary;
  /** When set, clicking a picture chooses it (and a single dropped image is chosen automatically). */
  onPick?: (asset: Asset) => void;
  title?: string;
  /** Offered in the footer when inserting from the toolbar. */
  onInsertDataDriven?: () => void;
  onClose: () => void;
};

const formatBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** The shared image library: add (drop / browse / folder / zip), browse, remove, download everything as a zip. */
export function ImageLibraryDialog({ library, onPick, title = "Image library", onInsertDataDriven, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? library.assets.filter((a) => a.path.toLowerCase().includes(q)) : library.assets;
  }, [library.assets, query]);
  const total = library.assets.reduce((sum, a) => sum + a.bytes, 0);

  const add = async (files: Incoming[]) => {
    if (!files.length) return;
    const result = await library.addFiles(files);
    setReport(result);
    if (onPick && result.assets.length === 1 && library.assets.length === 0) onPick(result.assets[0]);
  };

  const download = async () => {
    setZipping(true);
    try {
      const blob = await library.exportZip();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "sheetshow-images.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    } finally { setZipping(false); }
  };

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog library-dialog" role="dialog" aria-modal="true" aria-labelledby="lib-title">
        <div className="dialog-head">
          <div><h2 id="lib-title">{title}</h2><p>{library.assets.length ? `${library.assets.length} pictures · ${formatBytes(total)} · stored in this browser` : "Add the pictures your records will use. They stay in this browser and go with the project when you save it."}</p></div>
          <button className="icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="dialog-body" data-scroll>
          <DropZone onIncoming={add} progress={library.progress} compact={library.assets.length > 0} />
          {report && (
            <div className="import-report" role="status">
              <span>{report.added ? `Added ${report.added}` : "Nothing new added"}{report.replaced ? ` · replaced ${report.replaced}` : ""}{report.skipped.length ? ` · skipped ${report.skipped.length}` : ""}</span>
              <button className="link-button" onClick={() => setReport(null)}>Dismiss</button>
              {report.skipped.length > 0 && <ul>{report.skipped.slice(0, 6).map((s, i) => <li key={i}><strong>{s.name}</strong> — {s.reason}</li>)}{report.skipped.length > 6 && <li>and {report.skipped.length - 6} more</li>}</ul>}
            </div>
          )}

          {library.assets.length > 0 && (
            <>
              <div className="field-search library-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pictures…" aria-label="Search pictures" /></div>
              <div className="thumb-grid">
                {shown.map((asset) => (
                  <div key={asset.id} className="thumb-card">
                    <button className="thumb" title={onPick ? `Use ${asset.path}` : asset.path} onClick={() => onPick?.(asset)} disabled={!onPick} aria-label={onPick ? `Use ${asset.path}` : asset.path}>
                      <img src={library.urlFor(asset.id)} alt="" loading="lazy" draggable={false} />
                    </button>
                    <span className="thumb-name" title={asset.path}>{asset.name}</span>
                    <button className="thumb-remove" aria-label={`Remove ${asset.name}`} title="Remove from library" onClick={() => library.remove(asset.id)}><X size={12} /></button>
                  </div>
                ))}
                {!shown.length && <p className="empty-note">No pictures match “{query}”.</p>}
              </div>
            </>
          )}
        </div>

        <div className="dialog-foot">
          {library.assets.length > 0 && (
            <>
              <button className="button" onClick={download} disabled={zipping}><Download size={14} /> {zipping ? "Zipping…" : "Download all as ZIP"}</button>
              <button className="button danger" onClick={() => { if (window.confirm(`Remove all ${library.assets.length} pictures from the library? Pictures that use them will go blank.`)) library.clear(); }}><Trash2 size={14} /> Remove all</button>
            </>
          )}
          <span className="spacer" />
          {onInsertDataDriven && <button className="button button-primary" onClick={onInsertDataDriven}>Insert data-driven picture</button>}
          {!onInsertDataDriven && <button className="button" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}
