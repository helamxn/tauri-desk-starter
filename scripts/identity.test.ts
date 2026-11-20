import assert from "node:assert/strict";
import { test } from "node:test";
import { remainingIdentity } from "./lib/identity.ts";

test("template identity occurs only in documented files", () => {
  assert.deepEqual(remainingIdentity(), []);
});
