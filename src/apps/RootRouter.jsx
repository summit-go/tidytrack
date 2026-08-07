import React, { useState, useEffect } from "react";
import { Splash } from "../components/Splash.jsx";
import { LandingPage } from "./LandingPage.jsx";
// Bridge import — StaffApp moves to src/apps/staff/StaffApp.jsx in A5b.
import { StaffApp } from "../App.jsx";

// Decides between LandingPage and StaffApp at the root URL based on remembered choice.
export function RootRouter() {
  const [view, setView] = useState(null); // 'staff' | 'landing'

  useEffect(() => {
    try {
      const choice = localStorage.getItem("tt_role_choice");
      if (choice === "staff") {
        setView("staff");
      } else {
        setView("landing");
      }
    } catch {
      setView("landing");
    }
  }, []);

  if (view === null) return <Splash text="" />;
  if (view === "staff") return <StaffApp />;

  // Landing page — let user pick
  return (
    <LandingPage
      onPickStaff={() => {
        try {
          localStorage.setItem("tt_role_choice", "staff");
        } catch {}
        setView("staff");
      }}
      onPickPortal={() => {
        // We don't remember the portal choice (PMs use it rarely, often shared devices).
        // Just navigate to the portal route.
        window.location.hash = "#/portal";
      }}
    />
  );
}
