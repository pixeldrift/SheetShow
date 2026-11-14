import { useRef, useState } from "react";
import { FolderUp, ImagePlus, Loader } from "lucide-react";
import { incomingFromDrop, incomingFromFiles, type Incoming } from "../lib/importImages";

type Props = { onIncoming: (files: Incoming[]) => void; progress: { done: number; total: number } | null; compact?: boolean };

/** Drop images, a folder or a .zip here, or click to open the file browser. */
export function DropZone({ onIncoming, progress, compact }: Props) {
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`dropzone${over ? " over" : ""}${compact ? " compact" : ""}`}
      role="button" tabIndex={0} aria-label="Add images: drop files here or click to browse"
      onClick={() => !progress && fileRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => { e.preventDefault(); setOver(false); onIncoming(await incomingFromDrop(e.dataTransfer)); }}
    >
      {progress ? (
        <>
          <Loader size={22} className="spin" />
          <strong>Importing {progress.done} of {progress.total}…</strong>
          <div className="progress"><i style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>
        </>
      ) : (
        <>
          <ImagePlus size={compact ? 20 : 26} />
          <strong>Drop images, a folder, or a .zip here</strong>
          <span>or click to choose files{" "}
            <button type="button" className="link-button" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}><FolderUp size={12} /> Choose a folder</button>
          </span>
        </>
      )}
      <input ref={fileRef} type="file" hidden multiple accept="image/*,.zip,.pdf,application/zip,application/pdf" onChange={(e) => { if (e.target.files?.length) onIncoming(incomingFromFiles(e.target.files)); e.target.value = ""; }} />
      <input ref={folderRef} type="file" hidden multiple {...({ webkitdirectory: "", directory: "" } as object)} onChange={(e) => { if (e.target.files?.length) onIncoming(incomingFromFiles(e.target.files)); e.target.value = ""; }} />
    </div>
  );
}
