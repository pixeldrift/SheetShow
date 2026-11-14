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
