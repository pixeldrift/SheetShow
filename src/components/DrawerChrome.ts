/** Pointer handlers a drawer uses for its gestures (see useDrawerGestures). */
export type DrawerChrome = {
  /** Pressing the drawer's inner edge: resize, or flick toward the screen edge to close. */
  grip: (event: React.PointerEvent) => void;
  /** Pressing the header: the same, once the pointer has moved a little (a plain press still clicks the tabs and buttons). */
  header: (event: React.PointerEvent) => void;
  /** True once, right after a drag, so the click that follows it can be ignored. */
  consumeSwipe: () => boolean;
};
