
"use strict";

// Calculate component verification status.
function getQcStatus(expectedQty, actualQty) {
  if (actualQty === null || actualQty === undefined) {
    return "UNCOUNTED";
  }

  if (
    !Number.isSafeInteger(expectedQty) ||
    expectedQty <= 0 ||
    !Number.isSafeInteger(actualQty) ||
    actualQty < 0
  ) {
    return "RED";
  }

  if (actualQty < expectedQty) {
    return "RED";
  }

  if (actualQty === expectedQty) {
    return "GREEN";
  }

  return "YELLOW";
}

// Server-side approval gate.
// Invalid, missing, and shortage components block approval.
function isBlockingComponent(item) {
  if (
    !item ||
    !Number.isSafeInteger(item.expectedQty) ||
    item.expectedQty <= 0 ||
    !Number.isSafeInteger(item.actualQty)
  ) {
    return true;
  }

  const actualStatus = getQcStatus(
    item.expectedQty,
    item.actualQty
  );

  return (
    actualStatus === "RED" ||
    actualStatus === "UNCOUNTED" ||
    item.status !== actualStatus
  );
}

module.exports = {
  getQcStatus,
  isBlockingComponent
};
