
import { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage, {
  type DashboardUser,
} from "./DashboardPage";
import "./Landing.css";

function App() {
  const [entered, setEntered] = useState(false);

  const [user, setUser] = useState<DashboardUser | null>(
    null
  );

  const [checkingSession, setCheckingSession] = useState(true);

  // Check existing login session when page loads
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/me",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (response.ok) {
          const data = await response.json();

          if (active && data.success && data.user) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  // Called after successful login
  function handleLogin(loggedInUser: DashboardUser) {
    setUser(loggedInUser);
  }

  // Logout through backend API
  async function handleLogout() {
    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      setEntered(true);
    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to log out. Please try again.");
    }
  }

  // Wait while checking authentication
  if (checkingSession) {
    return (
      <div
        role="status"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6faff",
          color: "#15395f",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        Checking your session...
      </div>
    );
  }

  // Show Dashboard after login
  if (user) {
    return (
      <DashboardPage
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // Show Login Page after clicking Enter ERP
  if (entered) {
    return (
      <LoginPage
        onBack={() => setEntered(false)}
        onLogin={handleLogin}
      />
    );
  }

  // Animated Welcome Page
  return (
    <div className="afw-screen">

      {/* Navigation */}
      <header className="afw-header">
        <div className="afw-brand">
          <span className="afw-brand-icon">A</span>
          <span>APPARELFLOW</span>
        </div>

        <span className="afw-header-label">
          MANUFACTURING INTELLIGENCE
        </span>
      </header>

      {/* Main Hero */}
      <main className="afw-hero">

        {/* Left Side */}
        <section className="afw-copy">

          <div className="afw-eyebrow">
            <span className="afw-dot" />
            SMART PRODUCTION MANAGEMENT
          </div>

          <p className="afw-welcome">
            WELCOME TO THE FUTURE OF MANUFACTURING
          </p>

          <h1 className="afw-title">
            <span className="afw-type">
              APPARELFLOW
            </span>
            <span className="afw-erp">ERP</span>
          </h1>

          <h2 className="afw-heading">
            Precision in Every Stitch.
            <span>
              Confidence in Every Batch.
            </span>
          </h2>

          <p className="afw-description">
            Streamline garment production, verify cutting
            accuracy, and ensure every batch meets quality
            standards before reaching the sewing floor.
          </p>

          <div className="afw-actions">
            <button
              className="afw-button"
              onClick={() => setEntered(true)}
            >
              Enter ERP System
              <span aria-hidden="true">→</span>
            </button>

            <p className="afw-security">
              <span className="afw-dot" />
              SECURE PRODUCTION ENVIRONMENT
            </p>
          </div>
        </section>

        {/* Right Side - Video */}
        <section
          className="afw-media"
          aria-label="ApparelFlow manufacturing introduction"
        >
          <div className="afw-video-card">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              <source
                src="/apparelflow-intro.mp4"
                type="video/mp4"
              />
            </video>
          </div>

          <div className="afw-video-caption">
            <span className="afw-online-dot" />
            PRODUCTION QUALITY INTELLIGENCE

            <span className="afw-video-tag">
              APPARELFLOW / ERP
            </span>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="afw-footer">
        <span>© 2026 APPARELFLOW ERP</span>

        <span>
          CUTTING • VERIFICATION • SEWING
        </span>

        <span>ENGINEERED FOR PRECISION</span>
      </footer>

    </div>
  );
}

export default App;
