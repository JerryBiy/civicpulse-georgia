import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CivicProvider } from "./context/CivicContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <CivicProvider>
        <App />
      </CivicProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
