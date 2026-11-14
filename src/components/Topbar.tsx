import { CircleHelp, FileText, Printer } from "lucide-react";
import type { Workspace } from "../types";

export function Topbar({ workspace, onWorkspace, onPrint }: { workspace: Workspace; onWorkspace: (w: Workspace) => void; onPrint: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><span className="brand-sheet" /><span className="brand-star">✦</span></div>
        <div className="brand-name">Sheet<span>Show</span><small>WHERE DATA TAKES THE STAGE</small></div>
      </div>
      <div className="topbar-center">
        <div className="document-title"><FileText size={15} /><span>Untitled bird card</span></div>
        <div className="workspace-tabs" role="tablist">
          <button role="tab" aria-selected={workspace === "template"} className={workspace === "template" ? "active" : ""} onClick={() => onWorkspace("template")} title="Individual template">
            <svg className="template-tab-icon" viewBox="0 0 48 32" aria-hidden="true"><rect x="2.5" y="2.5" width="43" height="27" rx="2.5" /><path d="M9 2.5v5M39 2.5v5M9 24.5v5M39 24.5v5M2.5 10h5M2.5 22h5M40.5 10h5M40.5 22h5" /></svg>
            <span>Template</span>
          </button>
          <button role="tab" aria-selected={workspace === "layout"} className={workspace === "layout" ? "active" : ""} onClick={() => onWorkspace("layout")} title="Page layout">
            <svg className="page-tab-icon" viewBox="0 0 32 40" aria-hidden="true"><rect x="2" y="1.5" width="28" height="37" rx="1.5" /><rect x="6" y="6" width="9" height="6" /><rect x="17" y="6" width="9" height="6" /><rect x="6" y="15" width="9" height="6" /><rect x="17" y="15" width="9" height="6" /><rect x="6" y="24" width="9" height="6" /><rect x="17" y="24" width="9" height="6" /></svg>
            <span>Page layout</span>
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
