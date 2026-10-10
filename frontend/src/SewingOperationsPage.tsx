import { useEffect, useState } from "react";
import "./SewingOperations.css";

type SewingView = "queue" | "progress";

type SewingItem = {
  id: number;
  expectedQty: number;
  actualQty: number | null;
  status: "GREEN" | "YELLOW" | "RED" | null;
  component: { componentName: string };
};

type SewingOrder = {
  id: number;
  orderNo: string;
  targetQty: number;
  completedQty?: number;
  status: string;
  fabricRollId: string;
  actualFabricYds: number;
  updatedAt: string;
  recipe: {
    name: string;
    recipeCode: string;
    stdFabricYards: number;
    wastageCap: number;
  };
  verificationItems: SewingItem[];
};

type OrdersResponse = {
  success: boolean;
  data?: SewingOrder[];
  message?: string;
};

type StartResponse = {
  success: boolean;
  message?: string;
  data?: SewingOrder;
};

type ProgressResponse = {
  success: boolean;
  message?: string;
  data?: {
    orderId: number;
    targetQty: number;
    completedQty: number;
    progressPct: number;
    status: string;
    sewingCompletedAt: string | null;
    progressLogId: number;
  };
};

type Notice = {
  title: string;
  message: string;
  showActiveLink: boolean;
};

type SewingOperationsProps = {
  view: SewingView;
  onNavigate: (view: string) => void;
};

const API_BASE = "http://localhost:5000";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function SewingOperationsPage({ view, onNavigate }: SewingOperationsProps) {
  const [orders, setOrders] = useState<SewingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});

  const isQueue = view === "queue";
  const busy = startingId !== null || updatingId !== null;

  // Load the live database state whenever the tab changes or data is updated.
  useEffect(() => {
    const controller = new AbortController();
    const endpoint = view === "queue" ? "/api/sewing/queue" : "/api/sewing/active";

    async function loadOrders() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });
        const result: OrdersResponse = await response.json();

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || `Unable to load sewing orders (${response.status})`);
        }
        if (!controller.signal.aborted) setOrders(result.data);
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setOrders([]);
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to load sewing orders."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadOrders();
    return () => controller.abort();
  }, [view, refreshKey]);

  const garmentTotal = orders.reduce((total, order) => total + order.targetQty, 0);
  const progressDataAvailable = orders.every(
    (order) => Number.isSafeInteger(order.completedQty) && (order.completedQty ?? -1) >= 0
  );
  const garmentsCompleted = orders.reduce((total, order) => total + (order.completedQty ?? 0), 0);

  async function startSewing(order: SewingOrder) {
    if (busy || order.status !== "VERIFIED") return;

    const confirmed = window.confirm(
      `Start sewing for Order #${order.id} (${order.recipe.name}, ${order.targetQty} garments)?\n\n` +
        "This changes its status from VERIFIED to SEWING_IN_PROGRESS."
    );
    if (!confirmed) return;

    setStartingId(order.id);
    setError("");
    setNotice(null);

    try {
      const response = await fetch(`${API_BASE}/api/sewing/orders/${order.id}/start`, {
        method: "PATCH",
        credentials: "include",
      });
      const result: StartResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || `Unable to start sewing (${response.status})`);
      }

      setNotice({
        title: "Sewing started",
        message: `Order #${order.id} started successfully. Open Assembly Operations to track its progress.`,
        showActiveLink: true,
      });
      setRefreshKey((key) => key + 1);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start sewing.");
    } finally {
      setStartingId(null);
    }
  }

  async function updateProgress(order: SewingOrder) {
    if (busy || order.status !== "SEWING_IN_PROGRESS") return;

    if (!Number.isSafeInteger(order.completedQty) || (order.completedQty ?? -1) < 0) {
      setError("The active-orders API is missing completedQty. Check GET /api/sewing/active.");
      return;
    }

    const previousQty = order.completedQty as number;
    const rawQuantity = quantityDrafts[order.id] ?? String(previousQty);
    const quantity = Number(rawQuantity);

    if (rawQuantity.trim() === "" || !Number.isSafeInteger(quantity) || quantity < 0) {
      setError("Enter a valid whole-number completed quantity (0 or more).");
      return;
    }
    if (quantity > order.targetQty) {
      setError(`Order #${order.id}: completed quantity cannot exceed ${order.targetQty}.`);
      return;
    }
    if (quantity < previousQty) {
      setError(`Order #${order.id}: completed quantity cannot decrease below ${previousQty}.`);
      return;
    }
    if (quantity === previousQty) {
      setError("Enter a quantity greater than the current completed quantity.");
      return;
    }

    if (quantity === order.targetQty) {
      const confirmed = window.confirm(
        `Complete Order #${order.id}?\n\n` +
          `This will record ${quantity} of ${order.targetQty} garments and mark the batch SEWING_COMPLETED.`
      );
      if (!confirmed) return;
    }

    setUpdatingId(order.id);
    setError("");
    setNotice(null);

    try {
      const response = await fetch(`${API_BASE}/api/sewing/orders/${order.id}/progress`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedQty: quantity }),
      });
      const result: ProgressResponse = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || `Unable to update sewing progress (${response.status})`);
      }

      const completed = result.data.status === "SEWING_COMPLETED";
      setNotice({
        title: completed ? "Sewing completed" : "Progress updated",
        message: completed
          ? `Order #${order.id} reached 100% and is now SEWING_COMPLETED. It will no longer appear in active sewing.`
          : `Order #${order.id}: ${result.data.completedQty}/${result.data.targetQty} garments completed (${result.data.progressPct}%).`,
        showActiveLink: false,
      });

      // The new values come from the server, not from optimistic local state.
      setQuantityDrafts((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      setRefreshKey((key) => key + 1);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update sewing progress.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="af-sewing-page">
      <div className="af-sewing-intro">
        <div>
          <span className="af-sewing-eyebrow">PRODUCTION / SEWING CONTROL</span>
          <h2>{isQueue ? "Verified Sewing Queue" : "Assembly Operations"}</h2>
          <p>
            {isQueue
              ? "Only cutting batches approved by the verifier can enter sewing."
              : "Track completed garment quantities, update sewing progress, and finish production batches."}
          </p>
        </div>
        <button
          type="button"
          className="af-sewing-refresh"
          disabled={loading || busy}
          onClick={() => setRefreshKey((key) => key + 1)}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      <div className="af-sewing-tabs" role="group" aria-label="Sewing workspace">
        <button
          type="button"
          className={isQueue ? "af-sewing-tab af-sewing-tab-active" : "af-sewing-tab"}
          aria-pressed={isQueue}
          onClick={() => onNavigate("Verified Sewing Queue")}
        >
          Verified Queue
        </button>
        <button
          type="button"
          className={!isQueue ? "af-sewing-tab af-sewing-tab-active" : "af-sewing-tab"}
          aria-pressed={!isQueue}
          onClick={() => onNavigate("Assembly Operations")}
        >
          Sewing in Progress
        </button>
      </div>

      <div className="af-sewing-stats">
        <div className="af-sewing-stat">
          <span>{isQueue ? "Ready to Start" : "Batches in Sewing"}</span>
          <strong>{loading ? "—" : orders.length}</strong>
          <small>{isQueue ? "Verified batches" : "Active sewing batches"}</small>
        </div>
        <div className="af-sewing-stat">
          <span>{isQueue ? "Garments Ready" : "Garments in Sewing"}</span>
          <strong>{loading ? "—" : garmentTotal.toLocaleString()}</strong>
          <small>Planned garment quantity</small>
        </div>
        <div className="af-sewing-stat af-sewing-stat-rule">
          <span>{isQueue ? "Backend Security Gate" : "Garments Completed"}</span>
          <strong>
            {isQueue
              ? "Verified Only"
              : loading || !progressDataAvailable
                ? "—"
                : garmentsCompleted.toLocaleString()}
          </strong>
          <small>
            {isQueue
              ? "Server enforces workflow permissions"
              : "Saved completed quantity across active batches"}
          </small>
        </div>
      </div>

      {notice && (
        <div className="af-sewing-notice" role="status">
          <strong>✓ {notice.title}</strong>
          <span>{notice.message}</span>
          {notice.showActiveLink && (
            <button type="button" onClick={() => onNavigate("Assembly Operations")}>
              View Active Batches →
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="af-sewing-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="af-sewing-empty" role="status">
          Loading {isQueue ? "verified queue" : "active sewing batches"}...
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="af-sewing-empty">
          <div className="af-sewing-empty-icon">◎</div>
          <h3>{isQueue ? "No verified batches waiting" : "No active sewing batches"}</h3>
          <p>
            {isQueue
              ? "New batches will appear here after Cutting Verifier approval."
              : "Start a verified batch from the sewing queue to see it here. Completed batches appear in Production History."}
          </p>
          {!isQueue && (
            <button type="button" onClick={() => onNavigate("Verified Sewing Queue")}>
              Open Verified Queue →
            </button>
          )}
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="af-sewing-orders">
          {orders.map((order) => {
            const green = order.verificationItems.filter((item) => item.status === "GREEN").length;
            const yellow = order.verificationItems.filter((item) => item.status === "YELLOW").length;
            const invalid = order.verificationItems.filter(
              (item) =>
                item.actualQty === null ||
                item.actualQty < item.expectedQty ||
                !["GREEN", "YELLOW"].includes(item.status || "")
            ).length;

            const hasProgressData =
              Number.isSafeInteger(order.completedQty) && (order.completedQty ?? -1) >= 0;
            const completedQty = hasProgressData ? (order.completedQty as number) : 0;
            const progressPct =
              order.targetQty > 0
                ? Math.min(100, Math.max(0, Math.round((completedQty / order.targetQty) * 100)))
                : 0;
            const quantityValue = quantityDrafts[order.id] ?? String(completedQty);

            return (
              <article className="af-sewing-card" key={order.id}>
                <div className="af-sewing-card-header">
                  <div className="af-sewing-card-title">
                    <span>PRODUCTION BATCH #{order.id}</span>
                    <h3>{order.recipe.name}</h3>
                    <small title={order.orderNo}>{order.orderNo}</small>
                  </div>
                  <span
                    className={
                      isQueue
                        ? "af-sewing-badge af-sewing-verified"
                        : "af-sewing-badge af-sewing-active"
                    }
                  >
                    {order.status === "VERIFIED" ? "✓ VERIFIED" : "◉ SEWING IN PROGRESS"}
                  </span>
                </div>

                <div className="af-sewing-card-info">
                  <div>
                    <span>Target Quantity</span>
                    <strong>{order.targetQty} garments</strong>
                  </div>
                  <div>
                    <span>Fabric Roll</span>
                    <strong>{order.fabricRollId}</strong>
                  </div>
                  <div>
                    <span>Fabric Used</span>
                    <strong>{order.actualFabricYds} yd</strong>
                  </div>
                  <div>
                    <span>Last Updated</span>
                    <strong>{formatDate(order.updatedAt)}</strong>
                  </div>
                </div>

                <div className="af-sewing-qc-summary">
                  <span className="af-sewing-qc-green">{green} GREEN</span>
                  <span className="af-sewing-qc-yellow">{yellow} YELLOW</span>
                  {invalid > 0 && <span className="af-sewing-qc-red">{invalid} INVALID</span>}
                  <span className="af-sewing-qc-label">Cutting component checks</span>
                </div>

                <details className="af-sewing-details">
                  <summary>View Verified Component Counts</summary>
                  <div className="af-sewing-table-wrap">
                    <table className="af-sewing-table">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th>Expected</th>
                          <th>Actual</th>
                          <th>QC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.verificationItems.map((item) => (
                          <tr key={item.id}>
                            <td>{item.component.componentName}</td>
                            <td>{item.expectedQty}</td>
                            <td>{item.actualQty ?? "—"}</td>
                            <td>
                              <span
                                className={
                                  item.status === "GREEN"
                                    ? "af-sewing-mini-qc af-sewing-qc-green"
                                    : item.status === "YELLOW"
                                      ? "af-sewing-mini-qc af-sewing-qc-yellow"
                                      : "af-sewing-mini-qc af-sewing-qc-red"
                                }
                              >
                                {item.status || "UNCOUNTED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {!isQueue && (
                  <div className="af-sewing-progress-panel">
                    <div className="af-sewing-progress-header">
                      <div>
                        <span className="af-sewing-progress-eyebrow">SEWING PROGRESS</span>
                        <strong>
                          {hasProgressData ? `${completedQty} / ${order.targetQty} garments` : "Progress unavailable"}
                        </strong>
                      </div>
                      <span className="af-sewing-progress-percent">
                        {hasProgressData ? `${progressPct}%` : "—"}
                      </span>
                    </div>
                    <div
                      className="af-sewing-progress-track"
                      role="progressbar"
                      aria-label={`Sewing completion for order ${order.id}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressPct}
                    >
                      <div className="af-sewing-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="af-sewing-progress-subtext">
                      <span>{hasProgressData ? `${order.targetQty - completedQty} garments remaining` : "Backend data missing"}</span>
                      <span>Target: {order.targetQty}</span>
                    </div>
                    <div className="af-sewing-progress-controls">
                      <div className="af-sewing-progress-field">
                        <label htmlFor={`af-sewing-quantity-${order.id}`}>
                          Total completed garments
                        </label>
                        <input
                          id={`af-sewing-quantity-${order.id}`}
                          type="number"
                          min={completedQty}
                          max={order.targetQty}
                          step={1}
                          inputMode="numeric"
                          value={quantityValue}
                          disabled={!hasProgressData || busy}
                          onChange={(event) =>
                            setQuantityDrafts((drafts) => ({
                              ...drafts,
                              [order.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="af-sewing-update-progress"
                        disabled={!hasProgressData || busy}
                        onClick={() => void updateProgress(order)}
                      >
                        {updatingId === order.id ? "Saving Progress..." : "Update Progress"}
                      </button>
                    </div>
                    <p className="af-sewing-progress-help">
                      Enter the total completed quantity, not just the garments finished today.
                      Progress cannot decrease or exceed the target.
                    </p>
                  </div>
                )}

                <div className="af-sewing-card-footer">
                  {isQueue ? (
                    <>
                      <p>Start is authorised only after the backend rechecks approval and component counts.</p>
                      <button
                        type="button"
                        className="af-sewing-start"
                        disabled={busy || order.status !== "VERIFIED"}
                        onClick={() => void startSewing(order)}
                      >
                        {startingId === order.id ? "Starting Sewing..." : "▶ Start Sewing"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Progress updates are saved with an audit log. Reaching the target automatically completes the batch.</p>
                      <span className="af-sewing-progress-label">Sewing in Progress</span>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SewingOperationsPage;
