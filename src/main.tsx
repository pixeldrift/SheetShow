import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// Only real text fields may start a native text selection: no stray selection handles or highlights over the interface.
document.addEventListener("selectstart", (event) => {
  const node = event.target as Node | null;
  const el = node instanceof Element ? node : node?.parentElement;
  if (!el?.closest("input, textarea, [contenteditable=\"true\"], .selectable, .help-body")) event.preventDefault();
});
