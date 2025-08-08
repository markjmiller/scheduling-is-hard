import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import GuestPage from "./components/GuestPage.tsx";
import HostPage from "./components/HostPage.tsx";
import "./css/main.css";
import "@fortawesome/fontawesome-free/css/all.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/event/:eventId" element={<HostPage />} />
        <Route path="/guest/:guestId" element={<GuestPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
