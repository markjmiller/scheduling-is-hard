import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Turnstile from "react-turnstile";
import { ApiService } from "./services/api";
import App from "./App";
import GuestPage from "./components/GuestPage.tsx";
import HostPage from "./components/HostPage.tsx";
import "./css/main.css";
import "@fortawesome/fontawesome-free/css/all.css";

function AppWithVerification() {
  const [isVerified, setIsVerified] = useState(false);

  if (!isVerified) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <Turnstile
          // @ts-ignore
          sitekey={import.meta.env.VITE_CF_TURNSTILE_SITE_KEY}
          onVerify={(token: string) => {
            ApiService.setTurnstileToken(token);
            setIsVerified(true);
          }}
        />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/event/:eventId" element={<HostPage />} />
        <Route path="/guest/:guestId" element={<GuestPage />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWithVerification />
  </React.StrictMode>,
);
