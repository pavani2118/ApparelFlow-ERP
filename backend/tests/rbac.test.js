
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL =
  process.env.TEST_API_BASE_URL ||
  "http://127.0.0.1:5000";

const email = process.env.TEST_SUPERVISOR_EMAIL;
const password = process.env.TEST_SUPERVISOR_PASSWORD;

test(
  "Cutting Supervisor RBAC restrictions",
  {
    skip: !email || !password
      ? "Test supervisor credentials not configured"
      : false
  },
  async () => {
    // Login as Cutting Supervisor
    const loginResponse = await fetch(
      `${BASE_URL}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      }
    );

    assert.equal(loginResponse.status, 200);

    const loginData = await loginResponse.json();

    assert.equal(
      loginData.user.role,
      "cutting_supervisor"
    );

    const cookie = loginResponse.headers
      .get("set-cookie")
      ?.split(";")[0];

    assert.ok(cookie, "Authentication cookie missing");

    // Supervisor should access own cutting orders
    const ownResponse = await fetch(
      `${BASE_URL}/api/cutting-orders`,
      {
        headers: { Cookie: cookie }
      }
    );

    assert.equal(ownResponse.status, 200);

    // Supervisor must NOT access production history
    const historyResponse = await fetch(
      `${BASE_URL}/api/sewing/history`,
      {
        headers: { Cookie: cookie }
      }
    );

    assert.equal(historyResponse.status, 403);

    // Supervisor must NOT access sewing queue
    const sewingResponse = await fetch(
      `${BASE_URL}/api/sewing/queue`,
      {
        headers: { Cookie: cookie }
      }
    );

    assert.equal(sewingResponse.status, 403);

    // Supervisor must NOT access verifier queue
    const verifierResponse = await fetch(
      `${BASE_URL}/api/verifier/orders`,
      {
        headers: { Cookie: cookie }
      }
    );

    assert.equal(verifierResponse.status, 403);

    
// A Cutting Supervisor must not approve a batch
// by directly calling the verifier API.
//
// Non-existent ID avoids touching real production orders.
const approvalResponse = await fetch(
  `${BASE_URL}/api/verifier/orders/999999999/decision`,
  {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      decision: "APPROVED",
      items: []
    })
  }
);

assert.equal(
  approvalResponse.status,
  403,
  "Cutting Supervisor must not approve verification"
);

  }
);
