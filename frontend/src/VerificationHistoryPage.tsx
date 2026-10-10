import { useEffect, useMemo, useState } from "react";
import "./VerificationHistory.css";

type Decision = "APPROVED" | "REJECTED";
type DecisionFilter = "ALL" | Decision;

type HistoryOrder = {
  id: number;
  orderNo: string;
  targetQty: number;
  status: string;
  recipe: {
    name: string;
    recipeCode: string;
  };
};

type HistoryLog = {
  id: number;
  orderId: number;
  verifierId: number;
  decision: Decision;
  rejectionNote: string | null;
  wastagePct: number;
  timestamp: string;
  order: HistoryOrder | null;
};

type HistoryResponse = {
  success: boolean;
  count?: number;
  data?: HistoryLog[];
  message?: string;
};

const HISTORY_URL = "/api/verifier/history";

function displayTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VerificationHistoryPage() {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<DecisionFilter>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(HISTORY_URL, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });
        const payload: HistoryResponse = await response.json();

        if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
          throw new Error(
            payload.message || `Unable to load verification history (${response.status})`
          );
        }

        if (!controller.signal.aborted) {
          setLogs(payload.data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load verification history."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadHistory();
    return () => controller.abort();
  }, [refreshKey]);

  const approvedCount = logs.filter((log) => log.decision === "APPROVED").length;
  const rejectedCount = logs.filter((log) => log.decision === "REJECTED").length;

  const visibleLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (filter !== "ALL" && log.decision !== filter) return false;
      if (!query) return true;

      const searchable = [
        log.id,
        log.orderId,
        log.order?.orderNo,
        log.order?.recipe.name,
        log.order?.recipe.recipeCode,
        log.decision,
        log.rejectionNote,
      ]
        .filter((value) => value != null)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [logs, filter, search]);

  return (
    <section className="af-history-page">
      <header className="af-history-heading">
        <div>
          <span className="af-history-eyebrow">QUALITY ASSURANCE / AUDIT TRAIL</span>
          <h2>Verification History</h2>
          <p>
            Review cutting batches you have approved or rejected, including
            decision times, fabric usage estimates, and rejection reasons.
          </p>
        </div>
        <button
          type="button"
          className="af-history-refresh"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh History"}
        </button>
      </header>

      <div className="af-history-stats" aria-label="Verification history summary">
        <div className="af-history-stat">
          <span>Total Decisions</span>
          <strong>{logs.length}</strong>
          <small>Your verification records</small>
        </div>
        <div className="af-history-stat">
          <span>Approved Batches</span>
          <strong className="af-history-approved-number">{approvedCount}</strong>
          <small>Passed the quality gate</small>
        </div>
        <div className="af-history-stat">
          <span>Rejected Batches</span>
          <strong className="af-history-rejected-number">{rejectedCount}</strong>
          <small>Not approved for sewing</small>
        </div>
      </div>

      <div className="af-history-panel">
        <div className="af-history-toolbar">
          <div>
            <h3>Audit Records</h3>
            <p>Each record represents a saved verifier decision.</p>
          </div>
          <div className="af-history-controls">
            <label className="af-history-search-label">
              <span className="af-history-sr-only">Search audit records</span>
              <input
                type="search"
                placeholder="Search order, recipe or reason..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="af-history-filter-label">
              <span className="af-history-sr-only">Filter decisions</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as DecisionFilter)}
              >
                <option value="ALL">All Decisions</option>
                <option value="APPROVED">Approved Only</option>
                <option value="REJECTED">Rejected Only</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="af-history-error" role="alert">
            <strong>Unable to load history</strong>
            <p>{error}</p>
            <button type="button" onClick={() => setRefreshKey((n) => n + 1)}>
              Try Again
            </button>
          </div>
        )}

        {loading && logs.length === 0 && !error && (
          <div className="af-history-empty" role="status">Loading audit records...</div>
        )}

        {!loading && !error && visibleLogs.length === 0 && (
          <div className="af-history-empty">
            {logs.length === 0
              ? "No verification decisions yet. Approved or rejected batches will appear here."
              : "No audit records match your search or filter."}
          </div>
        )}

        {visibleLogs.length > 0 && (
          <div className="af-history-list" aria-label="Verification decisions">
            {visibleLogs.map((log) => (
              <article className="af-history-record" key={log.id}>
                <div className="af-history-record-main">
                  <div className="af-history-record-icon" aria-hidden="true">
                    {log.decision === "APPROVED" ? "✓" : "×"}
                  </div>
                  <div className="af-history-record-title">
                    <div className="af-history-record-topline">
                      <span className="af-history-record-number">AUDIT #{log.id}</span>
                      <span
                        className={
                          log.decision === "APPROVED"
                            ? "af-history-decision af-history-decision-approved"
                            : "af-history-decision af-history-decision-rejected"
                        }
                      >
                        {log.decision}
                      </span>
                    </div>
                    <h4>{log.order?.recipe.name || `Cutting Order #${log.orderId}`}</h4>
                    <p className="af-history-order-ref">
                      Order #{log.orderId}
                      {log.order?.orderNo ? ` · ${log.order.orderNo}` : ""}
                    </p>
                  </div>
                </div>

                <div className="af-history-metadata">
                  <div>
                    <span>Decision Time</span>
                    <strong>{displayTimestamp(log.timestamp)}</strong>
                  </div>
                  <div>
                    <span>Garment Quantity</span>
                    <strong>
                      {log.order ? `${log.order.targetQty} garments` : "Unavailable"}
                    </strong>
                  </div>
                  <div>
                    <span>Current Batch Status</span>
                    <strong>{log.order?.status.replaceAll("_", " ") || "Unavailable"}</strong>
                  </div>
                  <div>
                    <span>Fabric Overuse Estimate</span>
                    <strong>{Number(log.wastagePct).toFixed(2)}%</strong>
                  </div>
                </div>

                {log.decision === "REJECTED" && (
                  <div className="af-history-rejection">
                    <strong>Rejection Reason</strong>
                    <p>{log.rejectionNote || "No reason recorded"}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <p className="af-history-count">
            Showing {visibleLogs.length} of {logs.length} audit records
          </p>
        )}
      </div>

      <p className="af-history-footnote">
        Records are scoped to your verifier account. Fabric overuse is an
        estimate relative to the recipe standard; component-count snapshots
        are not included in this audit history endpoint.
      </p>
    </section>
  );
}
