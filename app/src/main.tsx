import { ProgressProvider } from "./features/progress/ProgressProvider";
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/States";
import "./styles/tokens.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <ProgressProvider><App /></ProgressProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
