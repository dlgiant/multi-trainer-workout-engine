import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGates } from "../src/engine/gates.ts";
import { acuteShoulder, beginnerLumbarDiscDb } from "./fixtures/clients.ts";

test("acute injury blocks generation", () => {
  const blocks = evaluateGates(acuteShoulder);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.gate, "acute-injury");
});

test("cleared injury does not block", () => {
  const cleared = {
    ...acuteShoulder,
    injuries: acuteShoulder.injuries.map((i) => ({ ...i, status: "cleared" as const })),
  };
  assert.equal(evaluateGates(cleared).length, 0);
});

test("chronic lumbar disc without clearance does not hard-block", () => {
  assert.equal(evaluateGates(beginnerLumbarDiscDb).length, 0);
});

test("PAR-Q positive blocks", () => {
  const blocks = evaluateGates({ ...beginnerLumbarDiscDb, parqPositive: true });
  assert.ok(blocks.some((b) => b.gate === "parq"));
});

test("BP over threshold blocks", () => {
  const blocks = evaluateGates({ ...beginnerLumbarDiscDb, restingBloodPressure: { systolic: 165, diastolic: 95 } });
  assert.ok(blocks.some((b) => b.gate === "blood-pressure"));
});
