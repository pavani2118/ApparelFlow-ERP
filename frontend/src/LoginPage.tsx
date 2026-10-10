
import { useState, type FormEvent } from "react";
import type { DashboardUser } from "./DashboardPage";
import "./Login.css";

type LoginPageProps = {
  onBack: () => void;
  onLogin: (user: DashboardUser) => void;
};

function LoginPage({ onBack, onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Authenticate user using backend API
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );

      const result = await response.json();

      // Check whether login was successful
      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Login failed. Please try again."
        );
      }

      // Validate returned user information
      const loggedInUser = result.user;

      if (
        !loggedInUser ||
        typeof loggedInUser.id !== "number" ||
        typeof loggedInUser.fullName !== "string" ||
        typeof loggedInUser.email !== "string" ||
        ![
          "cutting_supervisor",
          "cutting_verifier",
          "sewing_supervisor",
        ].includes(loggedInUser.role)
      ) {
        throw new Error("Invalid user data returned by server.");
      }

      // Clear password after successful login
      setPassword("");

      // Navigate to role-based dashboard
      onLogin(loggedInUser as DashboardUser);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="af-login-page">

      {/* Header */}
      <header className="af-login-header">
        <div className="af-logo">
          <span className="af-logo-mark">A</span>
          <span>APPARELFLOW</span>
        </div>

        <button
          type="button"
          className="af-back"
          onClick={onBack}
        >
          ← Back to Welcome
        </button>
      </header>

      {/* Login Layout */}
      <div className="af-login-layout">

        {/* Left Side - Login Form */}
        <section className="af-login-form-panel">

          <span className="af-eyebrow">
            SECURE WORKSPACE ACCESS
          </span>

          <h1>Welcome back</h1>

          <p className="af-subtitle">
            Sign in to access your production
            management workspace.
          </p>

          {/* Authentication Form */}
          <form onSubmit={handleLogin}>

            {/* Email */}
            <div className="af-field">
              <label htmlFor="af-email">
                Work Email
              </label>

              <input
                id="af-email"
                type="email"
                required
                maxLength={254}
                autoComplete="username"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="af-field">
              <label htmlFor="af-password">
                Password
              </label>

              <div className="af-password-box">
                <input
                  id="af-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  disabled={loading}
                />

                <button
                  type="button"
                  className="af-show-password"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p
                className="af-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              className="af-sign-in"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign In →"}
            </button>
          </form>

          {/* Demo Role Access */}
          <div className="af-demo-panel">
            <h2>Demo Role Access</h2>

            <p>
              Select an assessment account to
              fill in its email.
            </p>

            <label htmlFor="af-demo-role">
              Choose Demo Role
            </label>

            <select
              id="af-demo-role"
              value={
                [
                  "supervisor@apparelflow.demo",
                  "verifier@apparelflow.demo",
                  "sewing@apparelflow.demo",
                ].includes(email)
                  ? email
                  : ""
              }
              onChange={(e) => {
                setEmail(e.target.value);
                setPassword("");
                setError("");
              }}
              disabled={loading}
            >
              <option value="">
                Select a role
              </option>

              <option value="supervisor@apparelflow.demo">
                Cutting Supervisor
              </option>

              <option value="verifier@apparelflow.demo">
                Cutting Verifier
              </option>

              <option value="sewing@apparelflow.demo">
                Sewing Supervisor
              </option>
            </select>

            <small>
              Enter the corresponding demo password
              to sign in.
            </small>
          </div>

        </section>

        {/* Right Side - Professional Branding */}
        <aside className="af-login-brand-panel">

          {/* Decorative Artwork */}
          <div className="af-brand-art">
            <div className="af-art-ring af-ring-one" />
            <div className="af-art-ring af-ring-two" />
            <div className="af-art-center">AF</div>
          </div>

          {/* Branding Message */}
          <div className="af-brand-message">
            <span>
              MANUFACTURING INTELLIGENCE
            </span>

            <h2>
              Precision in
              <br />
              Every Stitch.
            </h2>

            <p>
              Connecting cutting operations,
              quality verification, and production
              workflows in one intelligent ERP platform.
            </p>
          </div>

          {/* Feature List */}
          <div className="af-feature-list">
            <div>
              ✓ Secure Role-Based Access
            </div>

            <div>
              ✓ Production Batch Verification
            </div>

            <div>
              ✓ Quality-Control Workflow
            </div>
          </div>

        </aside>
      </div>
    </main>
  );
}

export default LoginPage;
