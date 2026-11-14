import { useRef, useState } from "react";
import { CircleHelp, Download, FilePlus, FileText, FolderOpen, LayoutTemplate, Printer, Table2 } from "lucide-react";
import type { Workspace } from "../types";

type Props = {
  workspace: Workspace | "data"; onWorkspace: (w: Workspace | "data") => void; onPrint: () => void;
  name: string; onName: (name: string) => void; saveState: "saved" | "error";
  onNew: () => void; onGallery: () => void; onOpen: (file: File) => void; onSave: () => void;
};

export function Topbar({ workspace, onWorkspace, onPrint, name, onName, saveState, onNew, onGallery, onOpen, onSave }: Props) {
  const [menu, setMenu] = useState(false);
  const openRef = useRef<HTMLInputElement>(null);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><span className="brand-sheet" /><span className="brand-star">✦</span></div>
        <div className="brand-name">Sheet<span>Show</span><small>WHERE DATA TAKES THE STAGE</small></div>
      </div>
      <div className="topbar-center">
        <div className="document-title">
          <button className="icon-button small" aria-label="Project menu" title="Project" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><FileText size={16} /></button>
          <input className="title-input" value={name} onChange={(e) => onName(e.target.value)} aria-label="Project name" spellCheck={false} />
          <span className={saveState === "saved" ? "save-dot" : "save-dot error"} title={saveState === "saved" ? "Saved in this browser" : "Couldn’t save in this browser — use Save to file"} />
          {menu && (
            <>
              <div className="menu-scrim" onClick={() => setMenu(false)} />
              <div className="menu" role="menu">
                <button role="menuitem" onClick={() => { setMenu(false); onGallery(); }}><LayoutTemplate size={15} /> New from template…</button>
                <button role="menuitem" onClick={() => { setMenu(false); if (window.confirm("Start a new project? Unsaved changes in this browser will be replaced.")) onNew(); }}><FilePlus size={15} /> New project</button>
                <button role="menuitem" onClick={() => { setMenu(false); openRef.current?.click(); }}><FolderOpen size={15} /> Open from file…</button>
                <button role="menuitem" onClick={() => { setMenu(false); onSave(); }}><Download size={15} /> Save to file</button>
              </div>
            </>
          )}
          <input ref={openRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onOpen(f); e.target.value = ""; }} />
        </div>
        <div className="workspace-tabs" role="tablist">
          <button role="tab" aria-selected={workspace === "template"} className={workspace === "template" ? "active" : ""} onClick={() => onWorkspace("template")} title="Individual template">
            <svg className="template-tab-icon" viewBox="0 0 48 32" aria-hidden="true"><rect x="2.5" y="2.5" width="43" height="27" rx="2.5" /><path d="M9 2.5v5M39 2.5v5M9 24.5v5M39 24.5v5M2.5 10h5M2.5 22h5M40.5 10h5M40.5 22h5" /></svg>
            <span>Template</span>
          </button>
          <button role="tab" aria-selected={workspace === "layout"} className={workspace === "layout" ? "active" : ""} onClick={() => onWorkspace("layout")} title="Page layout">
            <svg className="page-tab-icon" viewBox="0 0 32 40" aria-hidden="true"><rect x="2" y="1.5" width="28" height="37" rx="1.5" /><rect x="6" y="6" width="9" height="6" /><rect x="17" y="6" width="9" height="6" /><rect x="6" y="15" width="9" height="6" /><rect x="17" y="15" width="9" height="6" /><rect x="6" y="24" width="9" height="6" /><rect x="17" y="24" width="9" height="6" /></svg>
            <span>Page layout</span>
          </button>
          <button role="tab" aria-selected={workspace === "data"} className={workspace === "data" ? "active" : ""} onClick={() => onWorkspace("data")} title="Edit your data as a table">
            <Table2 size={19} />
            <span>Data</span>
          </button>
        </div>
      </div>
      <div className="top-actions">
        <button className="icon-button" title="Help" aria-label="Help"><CircleHelp size={17} /></button>
        <button className="button button-primary" onClick={onPrint} title="Print all sheets"><Printer size={16} /><span>Print</span></button>
      </div>
    </header>
  );
}
