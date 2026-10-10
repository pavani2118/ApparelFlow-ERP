import { useEffect, useState } from "react";
import CuttingOrdersPage from "./CuttingOrdersPage";
import CuttingVerifierPage from "./CuttingVerifierPage";
import PendingVerificationPage from "./PendingVerificationPage";
import VerificationHistoryPage from "./VerificationHistoryPage";
import SewingOperationsPage from "./SewingOperationsPage";
import "./Dashboard.css";
import ProductionHistoryPage from "./ProductionHistoryPage";
import CuttingProgressPage from "./CuttingProgressPage";
// ==========================================
// USER TYPES
// ==========================================
export type DashboardUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};
type DashboardProps = {
  user: DashboardUser;
  onLogout: () => void;
};
type RecipeComponent = {
  id: number;
  recipeId: number;
  componentName: string;
  piecesPerGarment: number;
  imageUrl: string | null;
};
type Recipe = {
  id: number;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: RecipeComponent[];
};
type RecipeApiResponse = {
  success: boolean;
  count?: number;
  data?: Recipe[];
  message?: string;
};
type RoleConfig = {
  title: string;
  description: string;
  sections: string[];
};
const roleConfig: Record<string, RoleConfig> = {
  cutting_supervisor: {
    title: "Cutting Supervisor",
    description:
      "Manage garment cutting operations and production orders.",
    sections: ["Production Recipes", "Cutting Orders", "Cutting Progress"],
  },
  cutting_verifier: {
    title: "Cutting Verifier",
    description:
      "Review component quantities and verify production batches.",
    sections: [
      "Pending Verification",
      "Component Quality Control",
      "Verification History",
    ],
  },
  sewing_supervisor: {
    title: "Sewing Supervisor",
    description: "Manage approved production batches for sewing.",
    sections: [
      "Verified Sewing Queue",
      "Assembly Operations",
      "Production History",
    ],
  },
};
function DashboardPage({ user, onLogout }: DashboardProps) {
  const config = roleConfig[user.role];
  const [activeView, setActiveView] = useState("Dashboard Overview");
  const [selectedQcOrderId, setSelectedQcOrderId] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const isRecipesView =
    activeView === "Production Recipes" &&
    user.role === "cutting_supervisor";
  const isCuttingOrdersView =
    activeView === "Cutting Orders" &&
    user.role === "cutting_supervisor";
const isCuttingProgressView =
  activeView === "Cutting Progress" &&
  user.role === "cutting_supervisor";
  const isPendingVerificationView =
    user.role === "cutting_verifier" && activeView === "Pending Verification";
  const isComponentQcView =
    user.role === "cutting_verifier" && activeView === "Component Quality Control";
  const isHistoryView =
    user.role === "cutting_verifier" && activeView === "Verification History";
  const isSewingQueueView =
    user.role === "sewing_supervisor" &&
    activeView === "Verified Sewing Queue";
  const isSewingProgressView =
    user.role === "sewing_supervisor" &&
    activeView === "Assembly Operations";
  const isProductionHistoryView =
    user.role === "sewing_supervisor" &&
    activeView === "Production History";
  // ========================================
  // FETCH RECIPES FROM BACKEND
  // ========================================
  useEffect(() => {
    if (!isRecipesView) return;
    const controller = new AbortController();
    async function loadRecipes() {
      setRecipesLoading(true);
      setRecipesError("");
      try {
        const response = await fetch("/api/recipes", {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });
        const result: RecipeApiResponse = await response.json();
        if (!response.ok) {
          throw new Error(
            result.message || `Unable to load recipes (${response.status})`
          );
        }
        if (!result.success || !Array.isArray(result.data)) {
          throw new Error("Invalid recipe data returned by the server.");
        }
        if (controller.signal.aborted) return;
        const loadedRecipes = result.data;
        setRecipes(loadedRecipes);
        setSelectedRecipeId((previousId) => {
          if (loadedRecipes.some((recipe) => recipe.id === previousId)) {
            return previousId;
          }
          return loadedRecipes[0]?.id ?? null;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setRecipesError(
            error instanceof Error ? error.message : "Failed to load recipes."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecipesLoading(false);
        }
      }
    }
    void loadRecipes();
    return () => controller.abort();
  }, [isRecipesView, refreshCount]);
  const selectedRecipe =
    recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  if (!config) {
    return (
      <main className="af-dashboard-error">
        <h1>Unsupported user role</h1>
        <button type="button" onClick={onLogout}>
          Log Out
        </button>
      </main>
    );
  }
  // ========================================
  // DASHBOARD OVERVIEW
  // ========================================
  function renderOverview() {
    return (
      <>
        <section className="af-welcome-card">
          <div>
            <span>APPARELFLOW ERP</span>
            <h2>Welcome, {user.fullName}!</h2>
            <p>{config.description}</p>
          </div>
          <div className="af-welcome-symbol">AF</div>
        </section>
        <div className="af-section-heading">
          <h2>Your Workspace</h2>
          <p>Available modules for your assigned role.</p>
        </div>
        <section className="af-module-grid">
          {config.sections.map((section, index) => {
            const isSupervisorReady =
              user.role === "cutting_supervisor" &&
              (section === "Production Recipes" || section === "Cutting Orders"|| section === "Cutting Progress");
            const isVerifierReady =
              user.role === "cutting_verifier" &&
              (section === "Pending Verification" ||
                section === "Component Quality Control" ||
                section === "Verification History");
            const isSewingReady =
              user.role === "sewing_supervisor" &&
              (section === "Verified Sewing Queue" ||
                section === "Assembly Operations" ||
                section === "Production History");
            const ready = isSupervisorReady || isVerifierReady || isSewingReady;
            let description =
              `The ${section} module will be connected during the next development stage.`;
            if (section === "Production Recipes" && ready) {
              description =
                "Explore production recipes, component requirements, and fabric standards.";
            } else if (section === "Cutting Orders" && ready) {
              description =
                "Create cutting orders, review component requirements, and submit batches for verification.";
            } else if (section === "Cutting Progress" && ready) {
              description =
                "Track your cutting orders through verification and sewing.";
            } else if (section === "Pending Verification" && ready) {
              description =
                "View cutting batches awaiting independent verification and take a decision.";
            } else if (section === "Component Quality Control" && ready) {
              description =
                "Enter actual component counts, review live QC colours, and approve or reject.";
            } else if (section === "Verification History" && ready) {
              description =
                "Review your approved and rejected cutting batches with audit information.";
            } else if (section === "Verified Sewing Queue" && ready) {
              description =
                "See verifier-approved batches and start sewing safely after the backend checks.";
            } else if (section === "Assembly Operations" && ready) {
              description =
                "Track live garment completion, update quantities, and finish sewing batches.";
            } else if (section === "Production History" && ready) {
              description =
                "Review completed batches, production totals, and every sewing progress audit entry.";
            }
            return (
              <button
                type="button"
                className="af-module-card"
                key={section}
                onClick={() => setActiveView(section)}
              >
                <div className="af-module-icon">
                  {index === 0 ? "◈" : index === 1 ? "▤" : "◎"}
                </div>
                <h3>{section}</h3>
                <p>{description}</p>
                <span
                  className={
                    ready
                      ? "af-module-status af-module-ready"
                      : "af-module-status"
                  }
                >
                  {ready ? "Open Module →" : "Upcoming Module"}
                </span>
              </button>
            );
          })}
        </section>
      </>
    );
  }
  // ========================================
  // PRODUCTION RECIPES PAGE (UNCHANGED UI)
  // ========================================
  function renderRecipes() {
    return (
      <section className="af-recipes-page">
        <div className="af-recipes-toolbar">
          <div>
            <span className="af-recipes-eyebrow">PRODUCTION MASTER DATA</span>
            <h2>Production Recipe Library</h2>
            <p>
              Browse garment recipes and review their standard cutting
              requirements.
            </p>
          </div>
          <button
            type="button"
            className="af-refresh-button"
            disabled={recipesLoading}
            onClick={() => setRefreshCount((count) => count + 1)}
          >
            {recipesLoading ? "Loading..." : "↻ Refresh Recipes"}
          </button>
        </div>
        {recipesLoading && recipes.length === 0 && (
          <div className="af-recipes-message" role="status">
            Loading recipes from database...
          </div>
        )}
        {recipesError && (
          <div className="af-recipes-error" role="alert">
            <strong>Unable to load recipes</strong>
            <p>{recipesError}</p>
            <button
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
            >
              Try Again
            </button>
          </div>
        )}
        {!recipesLoading && !recipesError && recipes.length === 0 && (
          <div className="af-recipes-message">No production recipes found.</div>
        )}
        {recipes.length > 0 && (
          <>
            <div className="af-recipes-summary">
              <strong>{recipes.length}</strong>
              <span>Available Production Recipes</span>
            </div>
            <div className="af-recipes-layout">
              <div className="af-recipe-list">
                <h3>Select a Recipe</h3>
                {recipes.map((recipe) => (
                  <button
                    type="button"
                    key={recipe.id}
                    className={
                      selectedRecipeId === recipe.id
                        ? "af-recipe-select af-recipe-selected"
                        : "af-recipe-select"
                    }
                    aria-pressed={selectedRecipeId === recipe.id}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                  >
                    <span className="af-recipe-code">{recipe.recipeCode}</span>
                    <strong>{recipe.name}</strong>
                    <small>
                      {recipe.category} · {recipe.components.length} components
                    </small>
                    <span className="af-recipe-arrow">→</span>
                  </button>
                ))}
              </div>
              {selectedRecipe && (
                <article className="af-recipe-details">
                  <div className="af-recipe-details-header">
                    <div>
                      <span className="af-recipes-eyebrow">
                        RECIPE SPECIFICATION
                      </span>
                      <h3>{selectedRecipe.name}</h3>
                      <p>
                        {selectedRecipe.recipeCode} · {selectedRecipe.category}
                      </p>
                    </div>
                    <span className="af-recipe-badge">Active Recipe</span>
                  </div>
                  <div className="af-recipe-stats">
                    <div className="af-recipe-stat">
                      <span>Standard Fabric</span>
                      <strong>
                        {selectedRecipe.stdFabricYards}
                        <small> yd</small>
                      </strong>
                      <p>Per garment</p>
                    </div>
                    <div className="af-recipe-stat">
                      <span>Wastage Cap</span>
                      <strong>
                        {selectedRecipe.wastageCap}
                        <small>%</small>
                      </strong>
                      <p>Configured limit</p>
                    </div>
                    <div className="af-recipe-stat">
                      <span>Component Types</span>
                      <strong>{selectedRecipe.components.length}</strong>
                      <p>Required categories</p>
                    </div>
                  </div>
                  <div className="af-components-heading">
                    <h4>Cutting Components</h4>
                    <p>Required pieces for one garment.</p>
                  </div>
                  <div className="af-component-table-scroll">
                    <table className="af-component-table">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th>Pieces / Garment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRecipe.components.map((component) => (
                          <tr key={component.id}>
                            <td>{component.componentName}</td>
                            <td>
                              <span className="af-quantity-pill">
                                {component.piecesPerGarment}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="af-recipe-note">
                    <strong>Production Note</strong>
                    <p>
                      These values are recipe standards. When a cutting order
                      is created, the system automatically calculates expected
                      component quantities using the target garment quantity.
                    </p>
                  </div>
                </article>
              )}
            </div>
          </>
        )}
      </section>
    );
  }
  function renderUpcoming() {
    return (
      <section className="af-upcoming-page">
        <div className="af-upcoming-icon">▤</div>
        <h2>{activeView}</h2>
        <p>
          This module is not implemented yet. It will be connected to the
          production workflow in the upcoming steps.
        </p>
        <button type="button" onClick={() => setActiveView("Dashboard Overview")}>
          ← Back to Overview
        </button>
      </section>
    );
  }
  // ========================================
  // DASHBOARD LAYOUT
  // ========================================
  return (
    <div className="af-dashboard">
      <aside className="af-sidebar">
        <div className="af-sidebar-brand">
          <span className="af-sidebar-logo">A</span>
          <div>
            <strong>APPARELFLOW</strong>
            <small>ENTERPRISE ERP</small>
          </div>
        </div>
        <nav className="af-sidebar-section" aria-label="Workspace navigation">
          <span className="af-sidebar-label">WORKSPACE</span>
          <button
            type="button"
            className={
              activeView === "Dashboard Overview"
                ? "af-sidebar-active"
                : "af-sidebar-item"
            }
            aria-current={
              activeView === "Dashboard Overview" ? "page" : undefined
            }
            onClick={() => setActiveView("Dashboard Overview")}
          >
            ◈ &nbsp; Dashboard Overview
          </button>
          {config.sections.map((section) => (
            <button
              type="button"
              key={section}
              className={
                activeView === section ? "af-sidebar-active" : "af-sidebar-item"
              }
              aria-current={activeView === section ? "page" : undefined}
              onClick={() => setActiveView(section)}
            >
              {section}
            </button>
          ))}
        </nav>
        <div className="af-sidebar-bottom">
          <div className="af-sidebar-profile">
            <div className="af-avatar">{user.fullName.charAt(0)}</div>
            <div>
              <strong>{user.fullName}</strong>
              <small>{config.title}</small>
            </div>
          </div>
          <button type="button" className="af-sidebar-logout" onClick={onLogout}>
            Log Out →
          </button>
        </div>
      </aside>
      <main className="af-main-content">
        <header className="af-dashboard-topbar">
          <div>
            <span className="af-breadcrumb">Workspace / {activeView}</span>
            <h1>{activeView}</h1>
          </div>
          <div className="af-topbar-status">
            <span className="af-status-dot" />
            Authenticated Session
          </div>
        </header>
        {activeView === "Dashboard Overview" ? (
          renderOverview()
        ) : isRecipesView ? (
          renderRecipes()
        ) : isCuttingOrdersView ? (
          <CuttingOrdersPage />
        ) : isCuttingProgressView ? (
          <CuttingProgressPage />
        ) : isPendingVerificationView ? (
          <PendingVerificationPage
            onInspect={(orderId) => {
              setSelectedQcOrderId(orderId);
              setActiveView("Component Quality Control");
            }}
          />
        ) : isComponentQcView ? (
          <CuttingVerifierPage initialOrderId={selectedQcOrderId} />
        ) : isHistoryView ? (
          <VerificationHistoryPage />
        ) : isSewingQueueView ? (
          <SewingOperationsPage view="queue" onNavigate={setActiveView} />
        ) : isSewingProgressView ? (
          <SewingOperationsPage view="progress" onNavigate={setActiveView} />
        ) : isProductionHistoryView ? (
          <ProductionHistoryPage />
        ) : (
          renderUpcoming()
        )}
        <footer className="af-dashboard-footer">
          ApparelFlow ERP · Secure Production Management
        </footer>
      </main>
    </div>
  );
}
export default DashboardPage;
