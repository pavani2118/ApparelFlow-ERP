
import { useEffect, useState, type FormEvent } from "react";
import "./CuttingOrders.css";

type Component = {
  id: number;
  componentName: string;
  piecesPerGarment: number;
};

type Recipe = {
  id: number;
  recipeCode: string;
  name: string;
  stdFabricYards: number;
  wastageCap: number;
  components: Component[];
};

type VerificationItem = {
  id: number;
  expectedQty: number;
  actualQty: number | null;
  component: {
    componentName: string;
  };
};

type CuttingOrder = {
  id: number;
  orderNo: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  status: string;
  createdAt: string;
  recipe: {
    name: string;
    recipeCode: string;
  };
  verificationItems: VerificationItem[];
};

const API = "";

const statusLabels: Record<string, string> = {
  CUTTING_IN_PROGRESS: "Cutting In Progress",
  PENDING_VERIFICATION: "Pending Verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  SEWING_IN_PROGRESS: "Sewing In Progress",
};

function CuttingOrdersPage() {
  // Recipe states
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("100");
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYds, setActualFabricYds] = useState("");

  // Order states
  const [orders, setOrders] = useState<CuttingOrder[]>([]);
  const [ordersRefresh, setOrdersRefresh] = useState(0);

  // Loading and messages
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const [formError, setFormError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");

  const [createdOrder, setCreatedOrder] =
    useState<CuttingOrder | null>(null);

  // ========================================
  // LOAD RECIPES
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecipes() {
      setLoadingRecipes(true);

      try {
        const response = await fetch(
          `${API}/api/recipes`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to load recipes"
          );
        }

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid recipe response");
        }

        if (controller.signal.aborted) return;

        const data = result.data as Recipe[];

        setRecipes(data);
        setRecipeId(
          data.length > 0 ? String(data[0].id) : ""
        );

      } catch (error) {
        if (!controller.signal.aborted) {
          setFormError(
            error instanceof Error
              ? error.message
              : "Unable to load recipes"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRecipes(false);
        }
      }
    }

    void loadRecipes();

    return () => controller.abort();
  }, []);

  // ========================================
  // LOAD SAVED CUTTING ORDERS
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setLoadingOrders(true);
      setOrdersError("");

      try {
        const response = await fetch(
          `${API}/api/cutting-orders`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to load cutting orders"
          );
        }

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid cutting orders response");
        }

        if (controller.signal.aborted) return;

        setOrders(result.data as CuttingOrder[]);

      } catch (error) {
        if (!controller.signal.aborted) {
          setOrdersError(
            error instanceof Error
              ? error.message
              : "Unable to load cutting orders"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOrders(false);
        }
      }
    }

    void loadOrders();

    return () => controller.abort();
  }, [ordersRefresh]);

  // ========================================
  // CALCULATE EXPECTED REQUIREMENTS
  // ========================================

  const selectedRecipe = recipes.find(
    (recipe) => recipe.id === Number(recipeId)
  );

  const quantity = Number(targetQty);

  const validQuantity =
    Number.isSafeInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 100000;

  const standardFabric =
    selectedRecipe && validQuantity
      ? selectedRecipe.stdFabricYards * quantity
      : 0;

  // ========================================
  // CREATE CUTTING ORDER
  // ========================================

  async function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (creating) return;

    setFormError("");
    setCreatedOrder(null);

    const fabricUsed = Number(actualFabricYds);

    if (!selectedRecipe) {
      setFormError("Please select a production recipe.");
      return;
    }

    if (!validQuantity) {
      setFormError(
        "Target quantity must be between 1 and 100000."
      );
      return;
    }

    if (
      !fabricRollId.trim() ||
      fabricRollId.trim().length > 80
    ) {
      setFormError("Enter a valid fabric roll ID.");
      return;
    }

    if (
      !actualFabricYds.trim() ||
      !Number.isFinite(fabricUsed) ||
      fabricUsed <= 0 ||
      fabricUsed > 10000000
    ) {
      setFormError(
        "Enter a valid actual fabric quantity."
      );
      return;
    }

    setCreating(true);

    try {
      const response = await fetch(
        `${API}/api/cutting-orders`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipeId: selectedRecipe.id,
            targetQty: quantity,
            fabricRollId: fabricRollId.trim(),
            actualFabricYds: fabricUsed,
          }),
        }
      );

      const result = await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message || "Failed to create cutting order"
        );
      }

      setCreatedOrder(result.data as CuttingOrder);
      setFabricRollId("");
      setActualFabricYds("");

      // Reload saved orders from the database
      setOrdersRefresh((previous) => previous + 1);

    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to create cutting order"
      );
    } finally {
      setCreating(false);
    }
  }

  // ========================================
  // SUBMIT FOR VERIFICATION
  // ========================================

  async function handleSubmitVerification(
    order: CuttingOrder
  ) {
    if (
      submittingId !== null ||
      order.status !== "CUTTING_IN_PROGRESS"
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Submit order ${order.orderNo} for independent verification?\n\n` +
      "Once submitted, this order cannot be submitted again."
    );

    if (!confirmed) return;

    setSubmittingId(order.id);
    setOrdersError("");
    setOrderMessage("");

    try {
      const response = await fetch(
        `${API}/api/cutting-orders/${order.id}/submit-verification`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Failed to submit order for verification"
        );
      }

      setOrderMessage(
        `Order #${order.id} submitted successfully. ` +
        "It is now waiting for Cutting Verifier approval."
      );

      // Fetch updated status from database
      setOrdersRefresh((previous) => previous + 1);

    } catch (error) {
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Failed to submit order"
      );

      // Refresh in case status was changed elsewhere
      setOrdersRefresh((previous) => previous + 1);
    } finally {
      setSubmittingId(null);
    }
  }

  // ========================================
  // STATUS STYLING
  // ========================================

  function statusClass(status: string) {
    switch (status) {
      case "CUTTING_IN_PROGRESS":
        return "af-order-status af-order-progress";

      case "PENDING_VERIFICATION":
        return "af-order-status af-order-pending";

      case "VERIFIED":
        return "af-order-status af-order-verified";

      case "REJECTED":
        return "af-order-status af-order-rejected";

      default:
        return "af-order-status";
    }
  }

  // ========================================
  // PAGE UI
  // ========================================

  return (
    <section className="af-cutting-page">

      {/* PAGE HEADING */}
      <div className="af-cutting-heading">
        <span>PRODUCTION MANAGEMENT</span>

        <h2>Cutting Order Management</h2>

        <p>
          Create production batches, calculate expected
          components and submit completed cutting orders
          for independent verification.
        </p>
      </div>

      {/* CREATE ORDER FORM + LIVE PREVIEW */}
      <div className="af-cutting-grid">

        <div className="af-cutting-panel">
          <div className="af-cutting-panel-title">
            <h3>Create Cutting Order</h3>
            <p>Enter details for a new production batch.</p>
          </div>

          <form onSubmit={handleCreate}>

            <div className="af-cutting-field">
              <label htmlFor="cutting-recipe">
                Production Recipe
              </label>

              <select
                id="cutting-recipe"
                value={recipeId}
                required
                disabled={loadingRecipes || creating}
                onChange={(event) => {
                  setRecipeId(event.target.value);
                  setCreatedOrder(null);
                }}
              >
                {loadingRecipes ? (
                  <option value="">Loading recipes...</option>
                ) : recipes.length === 0 ? (
                  <option value="">No recipes available</option>
                ) : (
                  recipes.map((recipe) => (
                    <option
                      key={recipe.id}
                      value={recipe.id}
                    >
                      {recipe.name} ({recipe.recipeCode})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="af-cutting-field">
              <label htmlFor="cutting-target">
                Target Garment Quantity
              </label>

              <input
                id="cutting-target"
                type="number"
                required
                min="1"
                max="100000"
                step="1"
                value={targetQty}
                onChange={(event) =>
                  setTargetQty(event.target.value)
                }
              />
            </div>

            <div className="af-cutting-field">
              <label htmlFor="cutting-roll">
                Fabric Roll ID
              </label>

              <input
                id="cutting-roll"
                type="text"
                required
                maxLength={80}
                placeholder="e.g. ROLL-003"
                value={fabricRollId}
                onChange={(event) =>
                  setFabricRollId(event.target.value)
                }
              />
            </div>

            <div className="af-cutting-field">
              <label htmlFor="cutting-fabric">
                Actual Fabric Used (Yards)
              </label>

              <input
                id="cutting-fabric"
                type="number"
                required
                min="0.01"
                max="10000000"
                step="any"
                placeholder="e.g. 180"
                value={actualFabricYds}
                onChange={(event) =>
                  setActualFabricYds(event.target.value)
                }
              />
            </div>

            {formError && (
              <div
                className="af-cutting-error"
                role="alert"
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              className="af-cutting-submit"
              disabled={
                creating ||
                loadingRecipes ||
                !selectedRecipe
              }
            >
              {creating
                ? "Creating Cutting Order..."
                : "Create Cutting Order →"}
            </button>
          </form>
        </div>

        {/* LIVE CALCULATION PREVIEW */}
        <div className="af-cutting-preview">
          <div className="af-cutting-panel-title">
            <h3>Production Requirements</h3>
            <p>
              Calculated automatically from the recipe.
            </p>
          </div>

          {selectedRecipe ? (
            <>
              <div className="af-cutting-recipe-name">
                <strong>{selectedRecipe.name}</strong>
                <span>{selectedRecipe.recipeCode}</span>
              </div>

              <div className="af-cutting-stats">
                <div>
                  <span>Standard Fabric</span>

                  <strong>
                    {standardFabric.toFixed(2)}
                    <small> yd</small>
                  </strong>
                </div>

                <div>
                  <span>Wastage Cap</span>

                  <strong>
                    {selectedRecipe.wastageCap}
                    <small>%</small>
                  </strong>
                </div>
              </div>

              <h4>Expected Cutting Components</h4>

              <div className="af-cutting-table-wrap">
                <table className="af-cutting-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Per Garment</th>
                      <th>Expected</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedRecipe.components.map(
                      (component) => (
                        <tr key={component.id}>
                          <td>
                            {component.componentName}
                          </td>

                          <td>
                            {component.piecesPerGarment}
                          </td>

                          <td>
                            <strong>
                              {validQuantity
                                ? component.piecesPerGarment *
                                  quantity
                                : "—"}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <p className="af-cutting-info">
                Expected quantity = Target garment quantity
                × Pieces per garment.
                Actual counts must be checked by the
                Cutting Verifier before approval.
              </p>
            </>
          ) : (
            <p role="status">
              {loadingRecipes
                ? "Loading recipe requirements..."
                : "No recipe selected."}
            </p>
          )}
        </div>
      </div>

      {/* SUCCESS AFTER CREATING ORDER */}
      {createdOrder && (
        <div
          className="af-cutting-success"
          role="status"
        >
          <div className="af-cutting-success-title">
            <span>✓</span>

            <div>
              <h3>Cutting Order Created</h3>
              <p>
                Your production batch was saved
                successfully.
              </p>
            </div>
          </div>

          <div className="af-cutting-success-details">
            <div>
              <span>Order Reference</span>
              <strong>{createdOrder.orderNo}</strong>
            </div>

            <div>
              <span>Status at Creation</span>
              <strong>CUTTING_IN_PROGRESS</strong>
            </div>
          </div>
        </div>
      )}

      {/* ====================================
          SAVED CUTTING ORDERS
         ==================================== */}

      <section className="af-orders-section">
        <div className="af-orders-heading">
          <div>
            <span className="af-orders-eyebrow">
              PRODUCTION BATCH TRACKING
            </span>

            <h2>Saved Cutting Orders</h2>

            <p>
              Review created batches and send completed
              cutting work for verification.
            </p>
          </div>

          <button
            type="button"
            className="af-orders-refresh"
            disabled={loadingOrders}
            onClick={() =>
              setOrdersRefresh((previous) => previous + 1)
            }
          >
            {loadingOrders
              ? "Loading..."
              : "↻ Refresh Orders"}
          </button>
        </div>

        {/* Submission success */}
        {orderMessage && (
          <div
            className="af-orders-notice"
            role="status"
          >
            ✓ {orderMessage}
          </div>
        )}

        {/* API error */}
        {ordersError && (
          <div
            className="af-cutting-error"
            role="alert"
          >
            {ordersError}
          </div>
        )}

        {/* Loading */}
        {loadingOrders && (
          <p className="af-orders-loading" role="status">
            Loading saved cutting orders...
          </p>
        )}

        {/* Empty State */}
        {!loadingOrders &&
          !ordersError &&
          orders.length === 0 && (
            <div className="af-orders-empty">
              No cutting orders created yet.
            </div>
          )}

        {/* Order Cards */}
        <div className="af-orders-list">
          {orders.map((order) => (
            <article
              className="af-order-card"
              key={order.id}
            >
              <div className="af-order-top">

                <div className="af-order-title">
                  <span className="af-order-number">
                    ORDER #{order.id}
                  </span>

                  <h3>{order.recipe.name}</h3>

                  <small title={order.orderNo}>
                    {order.orderNo}
                  </small>
                </div>

                <span className={statusClass(order.status)}>
                  {statusLabels[order.status] ||
                    order.status}
                </span>
              </div>

              <div className="af-order-information">
                <div>
                  <span>Target Quantity</span>
                  <strong>
                    {order.targetQty} garments
                  </strong>
                </div>

                <div>
                  <span>Fabric Roll</span>
                  <strong>{order.fabricRollId}</strong>
                </div>

                <div>
                  <span>Fabric Used</span>
                  <strong>
                    {order.actualFabricYds} yd
                  </strong>
                </div>

                <div>
                  <span>Created</span>
                  <strong>
                    {new Date(
                      order.createdAt
                    ).toLocaleDateString()}
                  </strong>
                </div>
              </div>

              {/* View Expected Components */}
              <details className="af-order-details">
                <summary>
                  View Expected Components
                </summary>

                <div className="af-cutting-table-wrap">
                  <table className="af-cutting-table">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Expected</th>
                        <th>Actual</th>
                      </tr>
                    </thead>

                    <tbody>
                      {order.verificationItems.map(
                        (item) => (
                          <tr key={item.id}>
                            <td>
                              {item.component.componentName}
                            </td>

                            <td>{item.expectedQty}</td>

                            <td>
                              {item.actualQty ?? "Not counted"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* Order Actions */}
              <div className="af-order-actions">
                {order.status ===
                "CUTTING_IN_PROGRESS" ? (
                  <button
                    type="button"
                    className="af-order-submit"
                    disabled={submittingId !== null}
                    onClick={() =>
                      handleSubmitVerification(order)
                    }
                  >
                    {submittingId === order.id
                      ? "Submitting..."
                      : "Submit for Verification →"}
                  </button>
                ) : (
                  <span className="af-order-no-action">
                    {order.status ===
                    "PENDING_VERIFICATION"
                      ? "Waiting for Cutting Verifier"
                      : "No submission action available"}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default CuttingOrdersPage;
