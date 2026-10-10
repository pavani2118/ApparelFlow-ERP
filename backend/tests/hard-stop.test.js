
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getQcStatus,
  isBlockingComponent
} = require("../utils/qcRules");

test("GREEN: matching component can pass", () => {
  const status = getQcStatus(100, 100);

  assert.equal(status, "GREEN");

  assert.equal(
    isBlockingComponent({
      expectedQty: 100,
      actualQty: 100,
      status
    }),
    false
  );
});

test("YELLOW: excess component can pass", () => {
  const status = getQcStatus(100, 105);

  assert.equal(status, "YELLOW");

  assert.equal(
    isBlockingComponent({
      expectedQty: 100,
      actualQty: 105,
      status
    }),
    false
  );
});

test("RED: shortage must block approval", () => {
  const status = getQcStatus(100, 99);

  assert.equal(status, "RED");

  assert.equal(
    isBlockingComponent({
      expectedQty: 100,
      actualQty: 99,
      status
    }),
    true
  );
});

test("UNCOUNTED: missing count must block approval", () => {
  const status = getQcStatus(100, null);

  assert.equal(status, "UNCOUNTED");

  assert.equal(
    isBlockingComponent({
      expectedQty: 100,
      actualQty: null,
      status
    }),
    true
  );
});

test("Invalid expected quantity must block approval", () => {
  assert.equal(
    isBlockingComponent({
      expectedQty: 0,
      actualQty: 0,
      status: "GREEN"
    }),
    true
  );
});
