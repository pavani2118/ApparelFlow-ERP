
import { useEffect, useState } from "react";
import "./CuttingProgress.css";

type CuttingOrder = {
  id: number;
  orderNo: string;
  targetQty: number;
  status: string;
  createdAt: string;
  recipe: {
    name: string;
    recipeCode: string;
  };
};

const statusLabels: Record<string, string> = {
  CUTTING_IN_PROGRESS: "Cutting In Progress",
  PENDING_VERIFICATION: "Pending Verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  SEWING_IN_PROGRESS: "Sewing In Progress",
  SEWING_COMPLETED: "Sewing Completed",
};

function CuttingProgressPage() {
  const [orders, setOrders] = useState<CuttingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/cutting-orders", {
          credentials: "include",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok || !result.success ||
            !Array.isArray(result.data)) {
          throw new Error(
            result.message || "Unable to load cutting progress."
          );
        }

        if (!controller.signal.aborted) {
          setOrders(result.data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Request failed."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => controller.abort();
  }, [refresh]);

  const summary = [
    { label: "Total Orders", count: orders.length },
    {
      label: "In Cutting",
      count: orders.filter(
        (o) => o.status === "CUTTING_IN_PROGRESS"
      ).length,
    },
    {
      label: "Pending QC",
      count: orders.filter(
        (o) => o.status === "PENDING_VERIFICATION"
      ).length,
    },
    {
      label: "Verified",
      count: orders.filter(
        (o) => o.status === "VERIFIED"
      ).length,
    },
    {
      label: "Rejected",
      count: orders.filter(
        (o) => o.status === "REJECTED"
      ).length,
    },
    {
      label: "In Sewing / Completed",
      count: orders.filter(
        (o) => o.status === "SEWING_IN_PROGRESS" ||
               o.status === "SEWING_COMPLETED"
      ).length,
    },
  ];

  function getBadgeClass(status: string) {
    if (status === "REJECTED") return "rejected";
    if (status === "VERIFIED" ||
        status === "SEWING_COMPLETED") return "approved";
    if (status === "PENDING_VERIFICATION") return "pending";
    return "active";
  }

  return (
    <section className="af-cprogress">
      <div className="af-cprogress-header">
        <div>
          <span className="af-cprogress-eyebrow">
            PRODUCTION MONITORING
          </span>
          <h2>Cutting Progress Dashboard</h2>
          <p>
            Monitor cutting orders from creation through
            verification and sewing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh Status"}
        </button>
      </div>

      <div className="af-cprogress-stats">
        {summary.map((item) => (
          <div className="af-cprogress-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>

      <div className="af-cprogress-panel">
        <h3>Production Order Tracking</h3>
        <p>Latest status of your cutting orders.</p>

        {error && (
          <div className="af-cprogress-error" role="alert">
            {error}
          </div>
        )}

        {loading && <p role="status">Loading orders...</p>}

        {!loading && !error && orders.length === 0 && (
          <p>No cutting orders available yet.</p>
        )}

        {!loading && orders.length > 0 && (
          <div className="af-cprogress-scroll" tabIndex={0}
               role="region" aria-label="Cutting order progress table">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Recipe</th>
                  <th>Target Qty</th>
                  <th>Created</th>
                  <th>Current Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNo}</td>
                    <td>{order.recipe.name}</td>
                    <td>{order.targetQty}</td>
                    <td>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className={
                          "af-cprogress-badge " +
                          getBadgeClass(order.status)
                        }
                      >
                        {statusLabels[order.status] ||
                          order.status.replaceAll("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default CuttingProgressPage;
