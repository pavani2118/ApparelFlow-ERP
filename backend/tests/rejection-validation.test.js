
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL =
  process.env.TEST_API_BASE_URL ||
  "http://127.0.0.1:5000";

const email = process.env.TEST_VERIFIER_EMAIL;
const password = process.env.TEST_VERIFIER_PASSWORD;

test(
  "Rejecting without a reason must return HTTP 422",
  {
    skip: !email || !password
      ? "Verifier test credentials not configured"
      : false
  },
  async () => {
    // 1. Login as Cutting Verifier
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
      "cutting_verifier"
    );

    const cookie = loginResponse.headers
      .get("set-cookie")
      ?.split(";")[0];

    assert.ok(cookie, "Authentication cookie missing");

    // 2. Attempt rejection with no reason
    // Use a non-existent order ID.
    // Backend should validate the reason first.
    const response = await fetch(
      `${BASE_URL}/api/verifier/orders/999999999/decision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie
        },
        body: JSON.stringify({
          decision: "REJECTED",
          rejectionNote: "",
          items: []
        })
      }
    );

    const result = await response.json();

    // 3. Backend must block empty reason
    assert.equal(response.status, 422);
    assert.equal(result.success, false);
    assert.match(
      result.message,
      /rejection reason is required/i
    );
  }
);
