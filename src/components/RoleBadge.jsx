// src/components/RoleBadge.jsx
import { useEffect, useState } from "react";
import { getUserRole } from "../lib/getUserRole";

export default function RoleBadge() {
  const [state, setState] = useState({ user: null, role: null, full_name: "" });

  useEffect(() => {
    getUserRole().then(setState);
  }, []);

  if (!state.user) return null;

  const isAdmin = state.role === "admin";

  return (
    <div style={{ position: "absolute", top: 12, right: 16, zIndex: 10 }}>
      <span
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 12,
          background: isAdmin ? "#DCFCE7" : "#E5E7EB",
          color: isAdmin ? "#166534" : "#111827",
          border: "1px solid #D1D5DB",
        }}
        title={state.full_name || ""}
      >
        {isAdmin ? "Role: admin" : "Role: user"}
      </span>
    </div>
  );
}
