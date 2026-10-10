
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL =
  process.env.TEST_API_BASE_URL ||
  "http://127.0.0.1:5000";

// ==========================================
// TEST 1 - BACKEND HEALTH CHECK
// ==========================================

test("Health API should return HTTP 200", async () => {
  const response = await fetch(
    `${BASE_URL}/api/health`
  );

  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
});

// ==========================================
// TEST 2 - LOGIN INPUT VALIDATION
// ==========================================

test("Login should reject missing credentials", async () => {
  const response = await fetch(
    `${BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }
  );

  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.success, false);
});

// ==========================================
// TEST 3 - VERIFIER AUTHENTICATION
// ==========================================

test("Verifier queue should block unauthenticated users", async () => {
  const response = await fetch(
    `${BASE_URL}/api/verifier/orders`
  );

  const data = await response.json();

  assert.equal(response.status, 401);
  assert.equal(data.success, false);
});

// ==========================================
// TEST 4 - PRODUCTION HISTORY SECURITY
// ==========================================

test("Production history should require authentication", async () => {
  const response = await fetch(
    `${BASE_URL}/api/sewing/history`
  );

  const data = await response.json();

  assert.equal(response.status, 401);
  assert.equal(data.success, false);
});

// ==========================================
// TEST 5 - PROGRESS UPDATE SECURITY
// ==========================================

test("Unauthenticated users cannot update sewing progress", async () => {
  const response = await fetch(
    `${BASE_URL}/api/sewing/orders/1/progress`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        completedQty: 999999
      })
    }
  );

  const data = await response.json();

  assert.equal(response.status, 401);
  assert.equal(data.success, false);
});
