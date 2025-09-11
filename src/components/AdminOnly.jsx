// src/components/AdminOnly.jsx
import { useEffect, useState } from "react";
import { getUserRole } from "../lib/getUserRole";

export default function AdminOnly({ children, fallback = null }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getUserRole().then(({ role }) => {
      if (mounted) setAllowed(role === "admin");
    });
    return () => (mounted = false);
  }, []);

  return allowed ? children : fallback;
}
