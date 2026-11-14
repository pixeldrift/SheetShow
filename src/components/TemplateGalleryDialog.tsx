import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { Project } from "../types";
import { TEMPLATE_PRESETS } from "../templates";
import type { TemplatePreset } from "../templates/presets";
import { pickVariant } from "../lib/instances";
import { TemplateThumbnail } from "./ItemShape";

type Props = { onUse: (project: Project) => void; onClose: () => void };

/** What the card shows: one thumbnail per template, each drawn with the first record that uses it. */
function previews(preset: TemplatePreset) {
  const { project } = preset;
  const variants = project.variants?.length ? project.variants : [{ id: "a", name: "Template", items: project.items }];
  const rules = project.rules ?? [];
  const meta = { variants: variants.map(({ id, name }) => ({ id, name })) };
  return variants.flatMap((variant) => {
    const index = project.records.findIndex((record, i) => pickVariant(rules, meta.variants, record, i, i, "record") === variant.id);
    if (index < 0) return [];
    return [{ key: variant.id, label: variants.length > 1 ? variant.name : "", items: variant.items, record: project.records[index], index }];
  }).slice(0, 3);
}

/** Starting points to learn from: each comes with sample data, a page layout, and live thumbnails. */
export function TemplateGalleryDialog({ onUse, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const cards = useMemo(() => TEMPLATE_PRESETS.map((preset) => ({ preset, shots: previews(preset) })), []);

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog gallery-dialog" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
        <div className="dialog-head">
          <div><h2 id="gallery-title">Start from a template</h2><p>Each one comes with sample data and a page layout for common label stock, so you can see how it works, then change anything.</p></div>
          <button className="icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="dialog-body" data-scroll>
          <div className="gallery-grid">
            {cards.map(({ preset, shots }) => {
              const { project } = preset;
              return (
                <article className="gallery-card" key={preset.id}>
                  <div className="gallery-thumb">
                    {shots.map((shot) => (
                      <figure key={shot.key} className="gallery-shot" style={{ flexBasis: `${100 / shots.length}%`, maxWidth: shots.length === 1 ? "86%" : undefined }}>
                        <div className="gallery-paper">
                          <TemplateThumbnail items={shot.items} record={shot.record} width={project.template.width} height={project.template.height}
                            meta={{ recordNumber: shot.index + 1, pageNumber: 1, recordCount: project.records.length, pageCount: 1 }} />
                        </div>
                        {shot.label && <figcaption>{shot.label}</figcaption>}
                      </figure>
                    ))}
                  </div>
                  <div className="gallery-info">
                    <h3>{preset.name}</h3>
                    {preset.description && <p>{preset.description}</p>}
                    <small>{preset.stock} · {project.records.length} sample records</small>
                    <button className="button button-primary" onClick={() => onUse(project)}>Use this template</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="dialog-foot"><span className="map-status">Using one replaces your current project.</span><span className="spacer" /><button className="button" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
