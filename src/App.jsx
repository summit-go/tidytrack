import React, { useState, useEffect } from "react";
import { TranslationProvider } from "./contexts/LocaleContext.jsx";
import { RootRouter } from "./apps/internal/RootRouter.jsx";
import { StaffApp } from "./apps/internal/StaffApp.jsx";
import { PortalApp } from "./apps/client/PortalApp.jsx";

// =================================================================
// Top-level App — hash routing + TranslationProvider wrapper only.
// =================================================================
export default function App() {
  const [route, setRoute] = useState(() => window.location.hash || "");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const id = "tt-mobile-scale";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = "@media (max-width: 640px){ html{ font-size: 14.5px; } }";
    document.head.appendChild(st);
  }, []);

  let inner;
  if (route.startsWith("#/portal") || route.startsWith("#portal")) {
    inner = <PortalApp />;
  } else if (route.startsWith("#/staff") || route.startsWith("#staff")) {
    inner = <StaffApp />;
  } else {
    inner = <RootRouter />;
  }
  return <TranslationProvider>{inner}</TranslationProvider>;
}
