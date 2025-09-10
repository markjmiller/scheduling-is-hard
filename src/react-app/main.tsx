import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Turnstile from "react-turnstile";
import { ApiService } from "./services/api";
import { AuthErrorBoundary } from "./components/AuthErrorBoundary";
import App from "./App";
import GuestPage from "./components/GuestPage.tsx";
import HostPage from "./components/HostPage.tsx";
import "./css/main.css";
import "@fortawesome/fontawesome-free/css/all.css";

function AppWithVerification() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    ApiService.isAuthenticated(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication on mount and periodically
  React.useEffect(() => {
    const checkAuth = () => {
      const authenticated = ApiService.isAuthenticated();
      if (authenticated !== isAuthenticated) {
        setIsAuthenticated(authenticated);
      }
    };

    // Check every minute for JWT expiration
    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleTurnstileVerify = async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await ApiService.verifyTurnstile(token);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
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
        {error && (
          <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
        )}
        {isLoading ? (
          <div>Verifying...</div>
        ) : (
          <Turnstile
            // @ts-ignore
            sitekey={import.meta.env.VITE_CF_TURNSTILE_SITE_KEY}
            onVerify={handleTurnstileVerify}
            onError={() => setError("Turnstile verification failed")}
          />
        )}
      </div>
    );
  }

  return (
    <AuthErrorBoundary onAuthError={() => setIsAuthenticated(false)}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/event/:eventId" element={<HostPage />} />
          <Route path="/guest/:guestId" element={<GuestPage />} />
        </Routes>
      </BrowserRouter>
    </AuthErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWithVerification />
  </React.StrictMode>,
);
