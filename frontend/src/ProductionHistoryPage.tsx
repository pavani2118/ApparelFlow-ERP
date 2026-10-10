import { useEffect, useMemo, useState } from "react";
import "./ProductionHistory.css";

type SewingProgressLog = {
  id: number;
  previousQty: number;
  completedQty: number;
  timestamp: string;
  supervisor: { fullName: string } | null;
};

type CompletedOrder = {
  id: number;
  orderNo: string;
  targetQty: number;
  completedQty: number;
  progressPct: number;
  status: "SEWING_COMPLETED";
  fabricRollId: string;
  actualFabricYds: number;
  sewingStartedAt: string | null;
  sewingCompletedAt: string | null;
  recipe: {
    name: string;
    recipeCode: string;
  };
  sewingProgressLogs: SewingProgressLog[];
};

type HistoryApiResponse = {
  success: boolean;
  count?: number;
  data?: CompletedOrder[];
  message?: string;
};

const API_BASE = "";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProgress(order: CompletedOrder): number {
  if (!Number.isFinite(order.targetQty) || order.targetQty <= 0) return 0;
  return Math.min(100, Math.max(0, (order.completedQty / order.targetQty) * 100));
}

function ProductionHistoryPage() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/api/sewing/history`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        const result: HistoryApiResponse = await response.json();

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(
            result.message || `Unable to load production history (${response.status})`
          );
        }

        if (!controller.signal.aborted) {
          setOrders(result.data);
        }
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setOrders([]);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load production history."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchHistory();
    return () => controller.abort();
  }, [refreshKey]);

  const completedGarments = orders.reduce(
    (total, order) => total + order.completedQty,
    0
  );
  const auditEntries = orders.reduce(
    (total, order) => total + (order.sewingProgressLogs?.length ?? 0),
    0
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return orders;

    return orders.filter((order) =>
      [
        String(order.id),
        order.orderNo,
        order.recipe?.name,
        order.recipe?.recipeCode,
        order.fabricRollId,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(term))
    );
  }, [orders, search]);

  return (
    <section className="af-history-page">
      <div className="af-history-intro">
        <div>
          <span className="af-history-eyebrow">PRODUCTION / SEWING CONTROL</span>
          <h2>Production History</h2>
          <p>
            Review completed sewing batches and their recorded garment progress,
            timestamps and audit trail.
          </p>
        </div>
        <button
          type="button"
          className="af-history-refresh"
          disabled={loading}
          onClick={() => setRefreshKey((key) => key + 1)}
        >
          {loading ? "Refreshing..." : "↻ Refresh History"}
        </button>
      </div>

      <div className="af-history-stats" aria-label="Production history summary">
        <div className="af-history-stat">
          <span>Completed Batches</span>
          <strong>{loading ? "—" : orders.length.toLocaleString()}</strong>
          <small>Finished sewing orders</small>
        </div>
        <div className="af-history-stat">
          <span>Garments Produced</span>
          <strong>{loading ? "—" : completedGarments.toLocaleString()}</strong>
          <small>Total garments in completed batches</small>
        </div>
        <div className="af-history-stat">
          <span>Progress Audit Entries</span>
          <strong>{loading ? "—" : auditEntries.toLocaleString()}</strong>
          <small>Saved quantity change records</small>
        </div>
      </div>

      <div className="af-history-toolbar">
        <div>
          <h3>Completed Production Batches</h3>
          <p>
            {loading
              ? "Loading saved production records..."
              : `Showing ${filteredOrders.length} of ${orders.length} completed batches`}
          </p>
        </div>
        <label className="af-history-search-label">
          <span className="af-history-visually-hidden">Search production history</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search batch, recipe or fabric roll"
            aria-label="Search production history"
          />
        </label>
      </div>

      {error && (
        <div className="af-history-error" role="alert">
          <strong>Unable to load production history</strong>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Try Again
          </button>
        </div>
      )}

      {loading && (
        <div className="af-history-empty" role="status">
          Loading completed batches from the database...
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="af-history-empty">
          <div className="af-history-empty-icon" aria-hidden="true">◎</div>
          <h3>No completed batches yet</h3>
          <p>
            A batch appears here automatically after sewing reaches its full
            target quantity and the server marks it SEWING_COMPLETED.
          </p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && filteredOrders.length === 0 && (
        <div className="af-history-empty">
          <h3>No matching batches</h3>
          <p>Try a different batch number, recipe name or fabric roll ID.</p>
          <button type="button" onClick={() => setSearch("")}>Clear Search</button>
        </div>
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <div className="af-history-order-list">
          {filteredOrders.map((order) => {
            const percentage = getProgress(order);
            const logs = order.sewingProgressLogs ?? [];

            return (
              <article className="af-history-card" key={order.id}>
                <div className="af-history-card-heading">
                  <div className="af-history-card-heading-main">
                    <span className="af-history-card-kicker">PRODUCTION BATCH #{order.id}</span>
                    <h3>{order.recipe.name}</h3>
                    <div className="af-history-order-meta">
                      <span title={order.orderNo}>{order.orderNo}</span>
                      <span>{order.recipe.recipeCode}</span>
                    </div>
                  </div>
                  <span className="af-history-completed-badge">✓ SEWING COMPLETED</span>
                </div>

                <div className="af-history-detail-grid">
                  <div>
                    <span>Target Quantity</span>
                    <strong>{order.targetQty.toLocaleString()} garments</strong>
                  </div>
                  <div>
                    <span>Completed Quantity</span>
                    <strong>{order.completedQty.toLocaleString()} garments</strong>
                  </div>
                  <div>
                    <span>Fabric Roll</span>
                    <strong>{order.fabricRollId}</strong>
                  </div>
                  <div>
                    <span>Fabric Used</span>
                    <strong>{order.actualFabricYds.toLocaleString()} yd</strong>
                  </div>
                  <div>
                    <span>Sewing Started</span>
                    <strong>{formatDate(order.sewingStartedAt)}</strong>
                  </div>
                  <div>
                    <span>Completed On</span>
                    <strong>{formatDate(order.sewingCompletedAt)}</strong>
                  </div>
                </div>

                <div className="af-history-progress">
                  <div className="af-history-progress-heading">
                    <div>
                      <span>FINAL PRODUCTION PROGRESS</span>
                      <strong>
                        {order.completedQty.toLocaleString()} / {order.targetQty.toLocaleString()} garments
                      </strong>
                    </div>
                    <strong className="af-history-percentage">{percentage.toFixed(0)}%</strong>
                  </div>
                  <div
                    className="af-history-progress-track"
                    role="progressbar"
                    aria-label={`Batch ${order.id} sewing completion`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percentage)}
                  >
                    <div style={{ width: `${percentage}%` }} />
                  </div>
                </div>

                <details className="af-history-audit">
                  <summary>View Sewing Progress Audit Trail ({logs.length})</summary>
                  {logs.length === 0 ? (
                    <p className="af-history-no-logs">
                      No individual progress records are available for this batch.
                    </p>
                  ) : (
                    <ol className="af-history-timeline">
                      {logs.map((log) => (
                        <li key={log.id}>
                          <span className="af-history-timeline-dot" aria-hidden="true" />
                          <div className="af-history-log-top">
                            <strong>
                              {log.previousQty.toLocaleString()} → {log.completedQty.toLocaleString()} garments
                            </strong>
                            <span>+{(log.completedQty - log.previousQty).toLocaleString()} garments</span>
                          </div>
                          <div className="af-history-log-bottom">
                            <span>{formatDate(log.timestamp)}</span>
                            <span>Updated by {log.supervisor?.fullName || "Sewing Supervisor"}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ProductionHistoryPage;
