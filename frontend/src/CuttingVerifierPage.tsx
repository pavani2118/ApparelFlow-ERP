import { useEffect, useState } from "react";
import "./CuttingVerifier.css";

const API_BASE = "";
const MAX_QUANTITY = 2147483647;

type VerificationItem = {
  id: number;
  expectedQty: number;
  actualQty: number | null;
  status: "GREEN" | "YELLOW" | "RED" | null;
  component: {
    id: number;
    componentName: string;
  };
};

type PendingOrder = {
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
    stdFabricYards: number;
    wastageCap: number;
  };
  verificationItems: VerificationItem[];
};

type QueueResponse = {
  success: boolean;
  message?: string;
  data?: PendingOrder[];
};

type DecisionResponse = {
  success: boolean;
  message?: string;
  status?: string;
  orderId?: number;
  auditId?: number;
  blockingComponents?: Array<{
    componentName: string;
    expectedQty: number;
    actualQty: number | null;
    status: string;
  }>;
};

type QcStatus = "GREEN" | "YELLOW" | "RED" | "UNCOUNTED" | "INVALID";

type InspectionRow = {
  item: VerificationItem;
  actualQty: number | null;
  status: QcStatus;
  variance: number | null;
  rawValue: string;
};

function CuttingVerifierPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [rejectionNote, setRejectionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [queueError, setQueueError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyDecision, setBusyDecision] = useState<"APPROVED" | "REJECTED" | null>(null);

  // ------------------------------------------
  // LOAD PENDING VERIFICATION QUEUE
  // ------------------------------------------
  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setLoading(true);
      setQueueError("");

      try {
        const response = await fetch(`${API_BASE}/api/verifier/orders`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        const result: QueueResponse = await response.json();

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || `Unable to load queue (${response.status})`);
        }

        if (controller.signal.aborted) return;

        setOrders(result.data);
        setSelectedOrderId((previous) => {
          if (result.data!.some((order) => order.id === previous)) {
            return previous;
          }
          return result.data![0]?.id ?? null;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setQueueError(
            error instanceof Error ? error.message : "Failed to load verifier queue."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadOrders();
    return () => controller.abort();
  }, [refreshKey]);

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;

  // Reset form whenever the selected batch changes or its data refreshes.
  useEffect(() => {
    if (!selectedOrder) {
      setCounts({});
      setRejectionNote("");
      setActionError("");
      return;
    }

    setCounts(
      Object.fromEntries(
        selectedOrder.verificationItems.map((item) => [
          item.id,
          item.actualQty === null ? "" : String(item.actualQty),
        ])
      )
    );
    setRejectionNote("");
    setActionError("");
  }, [selectedOrder]);

  // ------------------------------------------
  // LIVE QUALITY CONTROL CALCULATIONS
  // ------------------------------------------
  const inspection: InspectionRow[] = selectedOrder
    ? selectedOrder.verificationItems.map((item) => {
        const rawValue = counts[item.id] ?? "";
        const trimmed = rawValue.trim();

        if (trimmed === "") {
          return {
            item,
            actualQty: null,
            status: "UNCOUNTED" as const,
            variance: null,
            rawValue,
          };
        }

        const parsed = Number(trimmed);
        const isValid =
          /^\d+$/.test(trimmed) &&
          Number.isSafeInteger(parsed) &&
          parsed >= 0 &&
          parsed <= MAX_QUANTITY;

        if (!isValid) {
          return {
            item,
            actualQty: null,
            status: "INVALID" as const,
            variance: null,
            rawValue,
          };
        }

        const status: QcStatus =
          parsed < item.expectedQty
            ? "RED"
            : parsed > item.expectedQty
              ? "YELLOW"
              : "GREEN";

        return {
          item,
          actualQty: parsed,
          status,
          variance: parsed - item.expectedQty,
          rawValue,
        };
      })
    : [];

  const greenCount = inspection.filter((item) => item.status === "GREEN").length;
  const yellowCount = inspection.filter((item) => item.status === "YELLOW").length;
  const redCount = inspection.filter((item) => item.status === "RED").length;
  const missingCount = inspection.filter((item) => item.status === "UNCOUNTED").length;
  const invalidCount = inspection.filter((item) => item.status === "INVALID").length;

  const canApprove =
    selectedOrder !== null &&
    inspection.length > 0 &&
    inspection.every((item) =>
      item.status === "GREEN" || item.status === "YELLOW"
    );

  const standardFabric = selectedOrder
    ? selectedOrder.recipe.stdFabricYards * selectedOrder.targetQty
    : 0;

  const fabricOveruseEstimate =
    selectedOrder && standardFabric > 0
      ? Math.max(0, ((selectedOrder.actualFabricYds - standardFabric) / standardFabric) * 100)
      : 0;

  function refreshQueue() {
    if (busyDecision) return;
    setNotice("");
    setActionError("");
    setRefreshKey((value) => value + 1);
  }

  // ------------------------------------------
  // APPROVE / REJECT AGAINST BACKEND
  // ------------------------------------------
  async function submitDecision(decision: "APPROVED" | "REJECTED") {
    if (!selectedOrder || busyDecision) return;
    setActionError("");
    setNotice("");

    if (invalidCount > 0) {
      setActionError("Fix invalid quantities. Enter non-negative whole numbers only.");
      return;
    }

    if (decision === "APPROVED" && !canApprove) {
      setActionError(
        "HARD STOP: Every component must be counted and no quantity may be below the expected amount."
      );
      return;
    }

    const note = rejectionNote.trim();
    if (decision === "REJECTED" && (note.length === 0 || note.length > 1000)) {
      setActionError("A rejection reason is required (maximum 1000 characters).");
      return;
    }

    const confirmed = window.confirm(
      `${decision === "APPROVED" ? "Approve" : "Reject"} batch ${selectedOrder.orderNo}?\n\n` +
      "This is a final verification decision and will be recorded in the audit log."
    );
    if (!confirmed) return;

    setBusyDecision(decision);

    try {
      const response = await fetch(
        `${API_BASE}/api/verifier/orders/${selectedOrder.id}/decision`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            rejectionNote: decision === "REJECTED" ? note : undefined,
            items: inspection
              .filter((row) => row.actualQty !== null)
              .map((row) => ({
                verificationItemId: row.item.id,
                actualQty: row.actualQty,
              })),
          }),
        }
      );

      const result: DecisionResponse = await response.json();

      if (!response.ok || !result.success) {
        let message = result.message || `Verification failed (HTTP ${response.status}).`;
        if (response.status === 422 && result.blockingComponents?.length) {
          const blockingNames = result.blockingComponents
            .map((component) => `${component.componentName} (${component.status})`)
            .join(", ");
          message += ` Blocking components: ${blockingNames}.`;
        }
        throw new Error(message);
      }

      setNotice(
        `${selectedOrder.recipe.name} — Order #${selectedOrder.id} ${
          decision === "APPROVED" ? "approved" : "rejected"
        } successfully. Audit ID: ${result.auditId ?? "created"}.`
      );
      setSelectedOrderId(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to process verification."
      );
    } finally {
      setBusyDecision(null);
    }
  }

  return (
    <section className="af-vf-page">
      <div className="af-vf-heading">
        <div>
          <span className="af-vf-eyebrow">INDEPENDENT QUALITY VERIFICATION</span>
          <h2>Cutting Batch Verification</h2>
          <p>
            Inspect actual component quantities against the production recipe.
            Only batches without shortages can be approved for sewing.
          </p>
        </div>
        <button
          type="button"
          className="af-vf-refresh"
          disabled={loading || busyDecision !== null}
          onClick={refreshQueue}
        >
          {loading ? "Loading..." : "↻ Refresh Queue"}
        </button>
      </div>

      <div className="af-vf-stat-grid">
        <div className="af-vf-stat">
          <span>Pending Batches</span>
          <strong>{orders.length}</strong>
          <small>Awaiting decision</small>
        </div>
        <div className="af-vf-stat">
          <span>Current Inspection</span>
          <strong>{selectedOrder ? `#${selectedOrder.id}` : "—"}</strong>
          <small>{selectedOrder?.recipe.name ?? "No batch selected"}</small>
        </div>
        <div className="af-vf-stat">
          <span>Approval Gate</span>
          <strong className={canApprove ? "af-vf-yes" : "af-vf-no"}>
            {selectedOrder ? (canApprove ? "READY" : "BLOCKED") : "—"}
          </strong>
          <small>Backend also enforces hard stop</small>
        </div>
      </div>

      {notice && (
        <div className="af-vf-notice" role="status">✓ {notice}</div>
      )}
      {queueError && (
        <div className="af-vf-error" role="alert">{queueError}</div>
      )}

      <div className="af-vf-layout">
        <aside className="af-vf-queue" aria-label="Pending verification batches">
          <div className="af-vf-panel-heading">
            <h3>Pending Verification</h3>
            <span className="af-vf-queue-count">{orders.length}</span>
          </div>
          {loading && <p className="af-vf-help">Loading pending orders...</p>}
          {!loading && !queueError && orders.length === 0 && (
            <div className="af-vf-empty-small">
              <strong>All caught up!</strong>
              <p>
                There are no pending batches. A Cutting Supervisor must create
                a new cutting order and submit it for verification.
              </p>
            </div>
          )}
          <div className="af-vf-queue-list">
            {orders.map((order) => (
              <button
                type="button"
                key={order.id}
                className={
                  order.id === selectedOrderId
                    ? "af-vf-queue-item af-vf-queue-active"
                    : "af-vf-queue-item"
                }
                onClick={() => setSelectedOrderId(order.id)}
                aria-pressed={order.id === selectedOrderId}
                disabled={busyDecision !== null}
              >
                <span className="af-vf-queue-id">ORDER #{order.id}</span>
                <strong>{order.recipe.name}</strong>
                <small>{order.targetQty} garments · {order.recipe.recipeCode}</small>
                <span className="af-vf-queue-label">Pending Verification →</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="af-vf-workspace">
          {selectedOrder ? (
            <>
              <div className="af-vf-workspace-head">
                <div>
                  <span className="af-vf-eyebrow">ACTIVE QUALITY INSPECTION</span>
                  <h3>{selectedOrder.recipe.name}</h3>
                  <p title={selectedOrder.orderNo}>
                    Order #{selectedOrder.id} · {selectedOrder.orderNo}
                  </p>
                </div>
                <span className="af-vf-pending-badge">PENDING VERIFICATION</span>
              </div>

              <div className="af-vf-meta-grid">
                <div><span>Garment Quantity</span><strong>{selectedOrder.targetQty}</strong></div>
                <div><span>Fabric Roll</span><strong>{selectedOrder.fabricRollId}</strong></div>
                <div><span>Standard Fabric</span><strong>{standardFabric.toFixed(2)} yd</strong></div>
                <div><span>Actual Fabric</span><strong>{selectedOrder.actualFabricYds} yd</strong></div>
              </div>

              <div className="af-vf-overuse">
                <span>
                  Fabric overuse estimate: <strong>{fabricOveruseEstimate.toFixed(2)}%</strong>
                </span>
                <span>Recipe wastage cap: {selectedOrder.recipe.wastageCap}%</span>
              </div>
              <p className="af-vf-help">
                Fabric overuse is estimated from recorded usage vs standard fabric.
                The current backend reports the wastage cap but does not block on it.
              </p>

              <div className="af-vf-subheading">
                <div>
                  <h4>Component Quantity Inspection</h4>
                  <p>Enter the actual counted quantity for each cutting component.</p>
                </div>
              </div>

              <div className="af-vf-table-scroll">
                <table className="af-vf-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Expected</th>
                      <th>Actual Count</th>
                      <th>Variance</th>
                      <th>QC Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspection.map((row) => (
                      <tr key={row.item.id}>
                        <td className="af-vf-component">{row.item.component.componentName}</td>
                        <td>{row.item.expectedQty}</td>
                        <td>
                          <input
                            className="af-vf-qty-input"
                            aria-label={`Actual count for ${row.item.component.componentName}`}
                            type="number"
                            min="0"
                            max={MAX_QUANTITY}
                            step="1"
                            placeholder="Count"
                            value={row.rawValue}
                            disabled={busyDecision !== null}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCounts((previous) => ({
                                ...previous,
                                [row.item.id]: value,
                              }));
                              setActionError("");
                            }}
                          />
                        </td>
                        <td>{
                          row.variance === null
                            ? "—"
                            : row.variance > 0
                              ? `+${row.variance}`
                              : String(row.variance)
                        }</td>
                        <td>
                          <span className={`af-vf-qc af-vf-qc-${row.status.toLowerCase()}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="af-vf-qc-summary" aria-live="polite">
                <span className="af-vf-qc af-vf-qc-green">{greenCount} GREEN</span>
                <span className="af-vf-qc af-vf-qc-yellow">{yellowCount} YELLOW</span>
                <span className="af-vf-qc af-vf-qc-red">{redCount} RED</span>
                <span className="af-vf-qc af-vf-qc-uncounted">
                  {missingCount} UNCOUNTED
                </span>
                {invalidCount > 0 && (
                  <span className="af-vf-qc af-vf-qc-invalid">
                    {invalidCount} INVALID
                  </span>
                )}
              </div>

              <div className={canApprove ? "af-vf-gate af-vf-gate-pass" : "af-vf-gate af-vf-gate-stop"}>
                <strong>{canApprove ? "✓ Approval criteria met" : "⛔ Approval blocked"}</strong>
                <p>
                  {canApprove
                    ? "All quantities are counted and no component is below expected."
                    : "Missing, invalid or short component counts cannot be approved. GREEN or YELLOW results are required for every component."}
                </p>
              </div>

              <div className="af-vf-reject-area">
                <label htmlFor="af-vf-rejection-note">Rejection Reason (required if rejecting)</label>
                <textarea
                  id="af-vf-rejection-note"
                  rows={3}
                  maxLength={1000}
                  value={rejectionNote}
                  placeholder="Explain why this cutting batch is being rejected..."
                  disabled={busyDecision !== null}
                  onChange={(event) => {
                    setRejectionNote(event.target.value);
                    setActionError("");
                  }}
                />
                <small>{rejectionNote.length}/1000 characters</small>
              </div>

              {actionError && (
                <div className="af-vf-error" role="alert">{actionError}</div>
              )}

              <div className="af-vf-action-bar">
                <button
                  type="button"
                  className="af-vf-reject-button"
                  disabled={busyDecision !== null}
                  onClick={() => void submitDecision("REJECTED")}
                >
                  {busyDecision === "REJECTED" ? "Rejecting..." : "✕ Reject Batch"}
                </button>
                <button
                  type="button"
                  className="af-vf-approve-button"
                  disabled={!canApprove || busyDecision !== null}
                  onClick={() => void submitDecision("APPROVED")}
                  title={canApprove ? "Approve verified cutting batch" : "All components must be GREEN or YELLOW"}
                >
                  {busyDecision === "APPROVED" ? "Approving..." : "✓ Approve Batch"}
                </button>
              </div>
              <p className="af-vf-footer-note">
                Decisions are final and recorded by the backend with an audit ID.
                The backend enforces role access and shortage hard stops independently of this interface.
              </p>
            </>
          ) : (
            <div className="af-vf-no-selection">
              <span className="af-vf-no-selection-icon">✓</span>
              <h3>No batch selected</h3>
              <p>
                {loading
                  ? "Loading verification queue..."
                  : "Select a pending cutting order on the left. If the queue is empty, create and submit a new order using the Cutting Supervisor account."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default CuttingVerifierPage;
