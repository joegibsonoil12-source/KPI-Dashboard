import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // keep even if empty so Vite has a css entry

const root = document.getElementById("root");
createRoot(root).render(<App />);
