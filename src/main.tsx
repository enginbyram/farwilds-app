import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Fonts are bundled with the app (no Google Fonts needed — works offline / on the homelab).
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/inter";
import "@fontsource/cascadia-code/400.css";
import "./styles/tokens.css";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
