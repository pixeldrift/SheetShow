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
  underline?: boolean;
  /** Shown in capital letters (the text itself is left as typed). */
  caps?: boolean;
  /** A name you gave this object in the Layers list. */
  name?: string;
  /** Tracking: extra space between letters, in thousandths of an em (negative tightens). */
  letterSpacing?: number;
  /** Pair kerning (the font's built-in adjustments between certain letters). On unless set to false. */
  kerning?: boolean;
  lineHeight?: number;
  /** Wrap text to the box width (default true). */
  wrap?: boolean;
  /** Degrees clockwise, about the item's centre. */
  rotation?: number;
  /** Text scaling: shrink to fit the box, shrink to fit one line's width, or fit exactly (grow or shrink). */
  autoFit?: "off" | "shrink" | "width" | "fit";
  /** What happens to text that still doesn't fit: spill past the box (default), clip at the box edge, cut whole words/lines off, or cut off with an ellipsis ("truncate"). */
  overflow?: "spill" | "clip" | "cut" | "truncate";
  /** Floor (pt) for the shrinking modes. */
  minFontSize?: number;
  /** Space (inches) between the text and the edge of its box; useful when the text has a background or frame. */
  padding?: number;
  /** Individual paddings (top, right, bottom, left) in inches; overrides `padding`. */
  paddings?: [number, number, number, number];
  /** Outline around the letters, in points, drawn outside the fill so text stays readable on busy backgrounds. */
  textStroke?: { color: string; width: number };
  imageFit?: "cover" | "contain";
  /** Colour treatment for a picture: hue, saturation, brightness, black and white, a tint or recolour, and a cutout. */
  imageFx?: ImageFx;
  /** A picture from the image library. */
  assetId?: string;
  /** Makes the picture data-driven: each record resolves its own image. */
  imageSource?: ImageSource;
  /** Shown when a data-driven picture finds no match. */
  fallbackAssetId?: string;
  /** Manual per-record choices for a data-driven picture, keyed by record id. */
  overrides?: Record<string, string>;
  /** Corner radius: a percentage of the shorter side (50 = fully round) or CSS pixels, per `radiusUnit` (default %). */
  radius?: number;
  radiusUnit?: "pct" | "px";
  /** Individual corners (top-left, top-right, bottom-right, bottom-left) in the same unit; overrides `radius`. */
  radii?: [number, number, number, number];
  /** Frame / border thickness in points. */
  strokeWidth?: number;
  opacity?: number;
  shadow?: Shadow;
  /** Objects sharing a groupId move, rotate and scale together. The name is repeated on every member. */
  groupId?: string;
  groupName?: string;
  /** Conditional formatting: show/hide this object or restyle it depending on a record's values. */
  rules?: ConditionalRule[];
  /** When several rules match: apply only the first (default) or all of them, later ones winning. */
  rulesMode?: "first" | "all";
  /** Derived while editing, never saved: hidden by a rule for the record being previewed (drawn faded so it stays selectable). */
  _ruleHidden?: boolean;
  align?: "left" | "center" | "right";
  fill?: string;
  stroke?: string;
  src?: string;
  assetName?: string;
  visible?: boolean;
  locked?: boolean;
  /** A guide for the designer (a scan, a mock-up): shown while designing, never printed. Usually semi-transparent. */
  reference?: boolean;
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
  /** Output order: sort records by this field (unset = the data table's order). */
  sortField?: string;
  sortDir?: 1 | -1;
  /** Alternating-template rules count by record order (default) or by position on each sheet. */
  variantBasis?: "record" | "slot";
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
  /** Extra templates that rules can assign to records. `items` stays the first template for older files. */
  variants?: { id: string; name: string; items: DesignItem[] }[];
  rules?: VariantRule[];
  overrides?: Record<string, InstanceOverride>;
};

/** Picture colour effects. Saturation, brightness and contrast are percentages where 100 leaves the picture unchanged; hue is in degrees. */
export type ImageFx = {
  hue?: number; saturation?: number; brightness?: number; contrast?: number;
  grayscale?: boolean;
  /** multiply: tint, like a coloured filter; solid: fill, every visible pixel becomes this colour (keeping the picture's shape), by `amount`. */
  overlay?: { mode: "multiply" | "solid"; color: string; amount: number };
  /** Make black or white (and what is close to it) transparent. `amount` is how much of the dark or light range goes. */
  cutout?: { remove: "black" | "white"; amount: number };
};
export type ImageSource = { mode: "column"; column: string } | { mode: "pattern"; pattern: string };
/** Offsets and blur in points. A glow is a shadow with no offset. */
export type Shadow = { x: number; y: number; blur: number; color: string; opacity: number };

/** Image library entry. The pixels live in IndexedDB. */
export type Asset = { id: string; name: string; path: string; width: number; height: number; bytes: number; /** Where a downloaded web picture came from. */ sourceUrl?: string };

/** One of several templates that can be combined into a single output (e.g. alternating colours). */
export type Variant = { id: string; name: string };
/** Which template a record uses: every n-th record starting at `start` (CSS-style 2n+1), or when a field equals a value. First match wins. */
export type VariantRule = { id: string; variantId: string } & (
  | { kind: "nth"; every: number; start: number }
  | { kind: "field"; field: string; equals: string }
);

/** A patch where `null` means "remove this property" (so it survives being saved as JSON). */
export type ItemPatch = { [K in keyof DesignItem]?: DesignItem[K] | null };
/** Hand edits to one record's copy of the template. `off` keeps them but shows the template version. */
export type InstanceOverride = { off?: boolean; items: Record<string, ItemPatch> };

export type ConditionOp =
  | "equals" | "notEquals" | "contains" | "notContains" | "startsWith" | "endsWith" | "oneOf"
  | "empty" | "notEmpty" | "gt" | "gte" | "lt" | "lte";
export type Condition = { id: string; field: string; op: ConditionOp; value: string };
/** `all` = AND, `any` = OR, `none` = NOT (any of them). */
export type ConditionGroup = { match: "all" | "any" | "none"; conditions: Condition[] };
/** The properties a rule is allowed to change. */
export type RuleStyle = Partial<Pick<DesignItem, "color" | "fill" | "stroke" | "opacity" | "weight" | "italic" | "fontSize" | "text" | "radius">>;
/** `when: null` is an "otherwise" rule: it applies when no earlier rule matched. */
export type ConditionalRule = { id: string; when: ConditionGroup | null; effects: { visible?: boolean; set?: RuleStyle } };
