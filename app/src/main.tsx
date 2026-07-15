import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WalletProviders } from "./components/WalletProviders";
import { App } from "./App";
import "./theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProviders>
        <App />
      </WalletProviders>
    </BrowserRouter>
  </StrictMode>
);
