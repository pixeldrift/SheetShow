/** Pointer handlers a drawer uses for its gestures (see useDrawerGestures). */
export type DrawerChrome = {
  /** Pressing the header: a swipe toward the screen edge closes the drawer once the pointer has moved a little (a plain press still clicks the tabs and buttons). It never changes the width. */
  header: (event: React.PointerEvent) => void;
  /** True once, right after a drag, so the click that follows it can be ignored. */
  consumeSwipe: () => boolean;
};
