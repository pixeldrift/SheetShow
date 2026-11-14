import { useRef, useState } from "react";
import { ChevronDown, CircleHelp, Download, FilePlus, FileText, FolderOpen, LayoutTemplate, Printer, Table2 } from "lucide-react";
import type { Workspace } from "../types";
import { Logo } from "./Logo";

type Tab = Workspace | "data";
type Props = {
  workspace: Tab; onWorkspace: (tab: Tab) => void; onPrint: () => void; onHelp: () => void;
  name: string; onName: (name: string) => void; saveState: "saved" | "error";
  onNew: () => void; onGallery: () => void; onOpen: (file: File) => void; onSave: () => void;
};

export function Topbar({ workspace, onWorkspace, onPrint, onHelp, name, onName, saveState, onNew, onGallery, onOpen, onSave }: Props) {
  const [menu, setMenu] = useState(false);
  const openRef = useRef<HTMLInputElement>(null);
  const tab = (id: Tab, label: string, title: string, icon: React.ReactNode) => (
    <button role="tab" aria-selected={workspace === id} className={workspace === id ? "active" : ""} onClick={() => onWorkspace(id)} title={title}>{icon}<span>{label}</span></button>
  );
  return (
    <header className="topbar">
      <div className="brand">
        <Logo size={36} />
        <div className="brand-name">Sheet<span>Show</span></div>
      </div>
      <div className="topbar-center">
        {/* The project is a menu (New, Open, Save…), so it looks like one and sits apart from the three views. */}
        <div className="project-pill">
          <button className="pill-button" aria-label="Project menu" aria-haspopup="menu" aria-expanded={menu} title="Project menu: new, open, save, templates" onClick={() => setMenu((m) => !m)}><FileText size={15} /></button>
          <input className="title-input" value={name} onChange={(e) => onName(e.target.value)} aria-label="Project name" spellCheck={false} />
          <span className={saveState === "saved" ? "save-dot" : "save-dot error"} title={saveState === "saved" ? "Saved in this browser" : "Couldn’t save in this browser — use Save to file"} />
          <button className="pill-button caret" aria-label="Open project menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><ChevronDown size={14} /></button>
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
          <input ref={openRef} type="file" accept=".json,.zip,application/json,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onOpen(f); e.target.value = ""; }} />
        </div>
        <span className="topbar-divider" aria-hidden="true" />
        <div className="workspace-tabs" role="tablist" aria-label="Views">
          {tab("data", "Data", "Your records, as an editable table", <Table2 size={19} />)}
          {tab("template", "Template", "Design one label, card or badge", (
            <svg className="template-tab-icon" viewBox="0 0 48 32" aria-hidden="true"><rect x="2.5" y="2.5" width="43" height="27" rx="2.5" /><path d="M9 2.5v5M39 2.5v5M9 24.5v5M39 24.5v5M2.5 10h5M2.5 22h5M40.5 10h5M40.5 22h5" /></svg>
          ))}
          {tab("layout", "Page layout", "Arrange copies on the sheet and print", (
            <svg className="page-tab-icon" viewBox="0 0 32 40" aria-hidden="true"><rect x="2" y="1.5" width="28" height="37" rx="1.5" /><rect x="6" y="6" width="9" height="6" /><rect x="17" y="6" width="9" height="6" /><rect x="6" y="15" width="9" height="6" /><rect x="17" y="15" width="9" height="6" /><rect x="6" y="24" width="9" height="6" /><rect x="17" y="24" width="9" height="6" /></svg>
          ))}
        </div>
      </div>
      <div className="top-actions">
        <button className="icon-button" title="Help: how to use SheetShow" aria-label="Help" onClick={onHelp}><CircleHelp size={17} /></button>
        <button className="button button-primary" onClick={onPrint} title="Print all sheets"><Printer size={16} /><span>Print</span></button>
      </div>
    </header>
  );
}
