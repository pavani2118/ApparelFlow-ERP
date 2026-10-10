
const test = require("node:test");
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");

require("dotenv").config();

const prisma = new PrismaClient();

const BASE_URL =
  process.env.TEST_API_BASE_URL ||
  "http://127.0.0.1:5000";

const email = process.env.TEST_SEWING_EMAIL;
const password = process.env.TEST_SEWING_PASSWORD;

test(
  "Sewing queue must contain only VERIFIED orders",
  {
    skip:
      !email || !password
        ? "Sewing Supervisor credentials not configured"
        : false
  },
  async () => {
    try {
      // 1. Login as Sewing Supervisor
      const loginResponse = await fetch(
        `${BASE_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password
          })
        }
      );

      assert.equal(loginResponse.status, 200);

      const loginData = await loginResponse.json();

      assert.equal(
        loginData.user.role,
        "sewing_supervisor"
      );

      const cookie = loginResponse.headers
        .get("set-cookie")
        ?.split(";")[0];

      assert.ok(cookie);

      // 2. Fetch Sewing Queue
      const response = await fetch(
        `${BASE_URL}/api/sewing/queue`,
        {
          headers: {
            Cookie: cookie
          }
        }
      );

      assert.equal(response.status, 200);

      const result = await response.json();

      assert.equal(result.success, true);
      assert.ok(Array.isArray(result.data));

      // 3. Every returned order must be VERIFIED
      for (const order of result.data) {
        assert.equal(order.status, "VERIFIED");
      }

      // 4. Read database orders independently
      // These are SELECT queries only.
      const verifiedOrders =
        await prisma.cuttingOrder.findMany({
          where: {
            status: "VERIFIED"
          },
          select: {
            id: true
          }
        });

      const otherOrders =
        await prisma.cuttingOrder.findMany({
          where: {
            status: {
              not: "VERIFIED"
            }
          },
          select: {
            id: true,
            status: true
          }
        });

      // Ensure this is a meaningful isolation test
      assert.ok(
        otherOrders.length > 0,
        "At least one non-VERIFIED order is required"
      );

      const queueIds = result.data
        .map((order) => order.id)
        .sort((a, b) => a - b);

      const verifiedIds = verifiedOrders
        .map((order) => order.id)
        .sort((a, b) => a - b);

      // 5. Queue must match VERIFIED database orders
      assert.deepEqual(queueIds, verifiedIds);

      // 6. No non-VERIFIED order may appear
      const blockedIds = new Set(
        otherOrders.map((order) => order.id)
      );

      for (const id of queueIds) {
        assert.equal(blockedIds.has(id), false);
      }
    } finally {
      await prisma.$disconnect();
    }
  }
);
