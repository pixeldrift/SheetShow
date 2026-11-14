import type { Project } from "../types";

const KEY = "sheetshow:project:v1";

const isProject = (value: unknown): value is Project => {
  const p = value as Project;
  return !!p && p.version === 1 && Array.isArray(p.items) && Array.isArray(p.records) && !!p.template && !!p.sheet;
};

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isProject(parsed) ? { ...parsed, fonts: parsed.fonts ?? [], sheet: { ...parsed.sheet, cropMarks: parsed.sheet.cropMarks ?? false } } : null;
  } catch { return null; }
}

/** Returns false when the browser refused (private mode, or quota exceeded by large images). */
export function saveProject(project: Project): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(project)); return true; } catch { return false; }
}

export function downloadProject(project: Project) {
  const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "sheetshow"}.sheetshow.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export async function readProjectFile(file: File): Promise<Project> {
  const parsed = JSON.parse(await file.text());
  if (!isProject(parsed)) throw new Error("That file isn’t a SheetShow project.");
  return { ...parsed, fonts: parsed.fonts ?? [], sheet: { ...parsed.sheet, cropMarks: parsed.sheet.cropMarks ?? false } };
}
