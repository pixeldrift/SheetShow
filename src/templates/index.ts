import type { Project } from "../types";
import { BUILT_IN_PRESETS, type TemplatePreset } from "./presets";

/**
 * Presets you add yourself: save a project with “Save to file” (a .json with no pictures) and drop it into
 * src/templates/. An optional "description" and "stock" in the file are shown on its card.
 */
const files = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, Project & { description?: string; stock?: string }>;

const fromFiles: TemplatePreset[] = Object.entries(files)
  .filter(([, p]) => p && p.version === 1 && Array.isArray(p.items) && p.template && p.sheet)
  .map(([path, p]) => {
    const id = path.replace(/^\.\//, "").replace(/\.json$/, "");
    const slots = p.sheet.columns * p.sheet.rows;
    return {
      id, name: p.name || id,
      description: p.description ?? "",
      stock: p.stock ?? `${p.template.width} × ${p.template.height} in · ${slots} per sheet`,
      project: p,
    };
  });

export const TEMPLATE_PRESETS: TemplatePreset[] = [...BUILT_IN_PRESETS, ...fromFiles];
