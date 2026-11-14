import { createContext, useContext } from "react";
import type { ImageLibrary } from "../hooks/useImageLibrary";
import { createResolver } from "../lib/images";

/** Lets any ItemShape (editor, page layout, print) resolve library pictures without prop-drilling. */
const none = { resolver: createResolver([]), urlFor: (_id: string | undefined): string | undefined => undefined };
export const ImageContext = createContext<Pick<ImageLibrary, "resolver" | "urlFor">>(none);
export const useImages = () => useContext(ImageContext);
