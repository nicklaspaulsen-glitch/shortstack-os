import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
