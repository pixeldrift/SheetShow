export type RecordRow = Record<string, string>;
export type Workspace = "template" | "layout";

export type DesignItem = {
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
  italic?: boolean;
  lineHeight?: number;
  /** Wrap text to the box width (default true). */
  wrap?: boolean;
  /** Degrees clockwise, about the item's centre. */
  rotation?: number;
  /** Text scaling: shrink to fit the box, or fit it exactly (grow or shrink). */
  autoFit?: "off" | "shrink" | "fit";
  imageFit?: "cover" | "contain";
  /** A picture from the image library. */
  assetId?: string;
  /** Makes the picture data-driven: each record resolves its own image. */
  imageSource?: ImageSource;
  /** Shown when a data-driven picture finds no match. */
  fallbackAssetId?: string;
  /** Manual per-record choices for a data-driven picture, keyed by record id. */
  overrides?: Record<string, string>;
  /** Corner radius as a percentage of the shorter side (50 = fully round). */
  radius?: number;
  /** Frame / border thickness in points. */
  strokeWidth?: number;
  opacity?: number;
  shadow?: Shadow;
  align?: "left" | "center" | "right";
  fill?: string;
  stroke?: string;
  src?: string;
  assetName?: string;
  visible?: boolean;
  locked?: boolean;
};

export type Guide = { id: string; axis: "x" | "y"; position: number };

/** Pan is the offset (px) of the page centre from the viewport centre. */
export type View = { zoom: number; pan: { x: number; y: number }; fitted: boolean };

export type Sheet = {
  pageWidth: number;
  pageHeight: number;
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
  marginX: number;
  marginY: number;
  repeatMode: "same" | "next";
  cropMarks: boolean;
};

export type LabelPreset = {
  code: string; name: string; width: number; height: number;
  columns: number; rows: number; gapX: number; gapY: number; marginX: number; marginY: number;
};

export type RecordMeta = { recordNumber: number; pageNumber: number; recordCount: number; pageCount: number };

export type FontEntry = { family: string; source: "google" | "local" | "custom" };

export type Project = {
  version: 1;
  name: string;
  fileName: string;
  records: RecordRow[];
  items: DesignItem[];
  template: { width: number; height: number };
  sheet: Sheet;
  fonts: FontEntry[];
};

export type ImageSource = { mode: "column"; column: string } | { mode: "pattern"; pattern: string };
/** Offsets and blur in points. A glow is a shadow with no offset. */
export type Shadow = { x: number; y: number; blur: number; color: string; opacity: number };

/** Image library entry. The pixels live in IndexedDB. */
export type Asset = { id: string; name: string; path: string; width: number; height: number; bytes: number };
