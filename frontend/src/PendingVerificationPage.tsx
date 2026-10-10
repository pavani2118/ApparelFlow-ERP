
import { useEffect, useState } from "react";
import "./CuttingVerifier.css";

type PendingOrder = {
  id: number;
  orderNo: string;
  targetQty: number;
  fabricRollId: string;
  createdAt: string;
  status: string;
  recipe: {
    name: string;
    recipeCode: string;
  };
};

type PendingVerificationProps = {
  onInspect: (orderId: number) => void;
};

function PendingVerificationPage({
  onInspect,
}: PendingVerificationProps) {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPendingOrders() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/verifier/orders", {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        const result = await response.json();

        if (
          !response.ok ||
          !result.success ||
          !Array.isArray(result.data)
        ) {
          throw new Error(
            result.message || "Failed to load pending batches."
          );
        }

        if (!controller.signal.aborted) {
          setOrders(result.data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load verification queue."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchPendingOrders();

    return () => controller.abort();
  }, [refreshKey]);

  const totalGarments = orders.reduce(
    (sum, order) => sum + order.targetQty,
    0
  );

  const totalRecipes = new Set(
    orders.map((order) => order.recipe.recipeCode)
  ).size;

  return (
    <section className="af-vf-page">
      <div className="af-vf-heading">
        <div>
          <span className="af-vf-eyebrow">
            CUTTING VERIFICATION WORKFLOW
          </span>

          <h2>Pending Verification Queue</h2>

          <p>
            Review production batches submitted by Cutting
            Supervisors. Select a batch to continue to
            Component Quality Control.
          </p>
        </div>

        <button
          type="button"
          className="af-vf-refresh"
          disabled={loading}
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          {loading ? "Loading..." : "↻ Refresh Queue"}
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="af-vf-stat-grid">
        <div className="af-vf-stat">
          <span>Pending Batches</span>
          <strong>{orders.length}</strong>
          <small>Awaiting inspection</small>
        </div>

        <div className="af-vf-stat">
          <span>Total Garments</span>
          <strong>{totalGarments}</strong>
          <small>Across pending batches</small>
        </div>

        <div className="af-vf-stat">
          <span>Recipe Types</span>
          <strong>{totalRecipes}</strong>
          <small>Awaiting quality control</small>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="af-vf-error" role="alert">
          {error}
        </div>
      )}

      {/* PENDING BATCH TABLE */}
      <div className="af-vf-workspace">
        <div className="af-vf-panel-heading">
          <h3>Batches Awaiting Verification</h3>

          <span className="af-vf-queue-count">
            {orders.length}
          </span>
        </div>

        {loading && (
          <p className="af-vf-help" role="status">
            Loading production batches...
          </p>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="af-vf-empty-small">
            <strong>All caught up!</strong>

            <p>
              There are currently no batches awaiting
              verification. A Cutting Supervisor must create
              and submit a cutting order first.
            </p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div
            className="af-vf-table-scroll"
            role="region"
            aria-label="Pending verification orders"
            tabIndex={0}
          >
            <table className="af-vf-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Recipe</th>
                  <th>Target Qty</th>
                  <th>Fabric Roll</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="af-vf-component">
                      #{order.id}
                    </td>

                    <td>
                      <strong>{order.recipe.name}</strong>
                      <div className="af-vf-help">
                        {order.recipe.recipeCode}
                      </div>
                    </td>

                    <td>{order.targetQty}</td>

                    <td>{order.fabricRollId}</td>

                    <td>
                      {new Date(
                        order.createdAt
                      ).toLocaleDateString()}
                    </td>

                    <td>
                      <span className="af-vf-pending-badge">
                        PENDING
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="af-vf-refresh"
                        onClick={() => onInspect(order.id)}
                        aria-label={
                          `Inspect cutting order ${order.id}`
                        }
                      >
                        Inspect Batch →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="af-vf-footer-note">
        Batch approval and rejection are performed in the
        Component Quality Control module. Backend security
        and verification rules remain enforced.
      </p>
    </section>
  );
}

export default PendingVerificationPage;
