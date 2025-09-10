import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthLayout from "./AuthLayout.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthLayout>
      <App />
    </AuthLayout>
  </React.StrictMode>
);
