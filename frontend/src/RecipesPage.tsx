
import { useEffect, useState } from "react";
import "./App.css";

type RecipeComponent = {
  id: number;
  componentName: string;
  piecesPerGarment: number;
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

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRecipes() {
      try {
        const response = await fetch(
          "http://localhost:5000/api/recipes"
        );

        if (!response.ok) {
          throw new Error("Unable to load recipes");
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error("Invalid API response");
        }

        setRecipes(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unknown error"
        );
      } finally {
        setLoading(false);
      }
    }

    loadRecipes();
  }, []);

  return (
    <main className="dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">APPARELFLOW ERP</p>
          <h1>Production Recipe Library</h1>
          <p className="subtitle">
            Manage and inspect garment manufacturing recipes.
          </p>
        </div>
        <span className="system-badge">Production System</span>
      </header>

      <section className="summary">
        <div className="summary-card">
          <span>Total Recipes</span>
          <strong>{recipes.length}</strong>
        </div>
        <div className="summary-card">
          <span>Total Component Types</span>
          <strong>
            {recipes.reduce(
              (total, recipe) => total + recipe.components.length,
              0
            )}
          </strong>
        </div>
      </section>

      {loading && <p role="status">Loading recipes...</p>}
      {error && <p role="alert" className="error">{error}</p>}

      {!loading && !error && recipes.length === 0 && (
        <p>No production recipes found.</p>
      )}

      <section className="recipe-grid">
        {recipes.map((recipe) => (
          <article key={recipe.id} className="recipe-card">
            <div className="recipe-heading">
              <div>
                <span className="recipe-code">
                  {recipe.recipeCode}
                </span>
                <h2>{recipe.name}</h2>
                <p>{recipe.category}</p>
              </div>
            </div>

            <div className="metrics">
              <div>
                <span>Fabric / Garment</span>
                <strong>{recipe.stdFabricYards} yds</strong>
              </div>
              <div>
                <span>Wastage Cap</span>
                <strong>{recipe.wastageCap}%</strong>
              </div>
            </div>

            <h3>Required Components</h3>

            <div className="component-list">
              {recipe.components.map((component) => (
                <div className="component" key={component.id}>
                  <span>{component.componentName}</span>
                  <strong>
                    × {component.piecesPerGarment}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
