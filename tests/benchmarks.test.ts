// Marco 3 restante: e1rm/seedLoad, bateria de testes (batteryFor) e comparação
// de reteste (compareBenchmarks).
import test from "node:test";
import assert from "node:assert/strict";
import { e1rm, pctForReps, roundDownToOwned, seedLoad, batteryFor, compareBenchmarks } from "../src/engine/benchmarks.ts";
import { CATALOGUE, RULES, byId } from "../src/engine/catalogue.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { beginnerLumbarDiscDb, intermediateHypertrophy, seniorKneeBandsOnly } from "./fixtures/clients.ts";

test("e1rm: Epley with RIR", () => {
  assert.ok(Math.abs(e1rm(100, 5, 2) - 100 * (1 + 7 / 30)) < 1e-9);
  assert.equal(e1rm(0, 10, 0), 0);
});

test("pctForReps is the inverse of e1rm scaling (round-trip)", () => {
  const e = e1rm(10, 8, 2);
  assert.ok(Math.abs(e * pctForReps(8, 2) - 10) < 1e-9);
});

test("roundDownToOwned picks the heaviest owned weight <= load, else the lightest", () => {
  assert.equal(roundDownToOwned(7, [2, 4, 6, 8]), 6);
  assert.equal(roundDownToOwned(20, [2, 4]), 4);
  assert.equal(roundDownToOwned(1, [2, 4]), 2);
});

test("seedLoad: undefined for bodyweight or before any rep test (calibration)", () => {
  assert.equal(seedLoad(byId("bodyweight-squat")!, 12, 3, beginnerLumbarDiscDb), undefined);
  const noBench = { ...intermediateHypertrophy, benchmarks: undefined };
  assert.equal(seedLoad(byId("db-row")!, 8, 2, noBench), undefined);
});

test("seedLoad: direct rep test seeds load rounded down to owned weights", () => {
  // Ana: goblet-squat 8kg x 10 @ RIR 2 -> e1rm 11.2; 12 reps @ RIR 3 -> 66.7% -> 7.47 -> 6 kg
  const load = seedLoad(byId("goblet-squat")!, 12, 3, beginnerLumbarDiscDb);
  assert.equal(load, 6);
  assert.ok(beginnerLumbarDiscDb.env.weightsKg.includes(load!));
});

test("seedLoad: related-lift ratio estimates a missing test (db-bench-press from db-row)", () => {
  // Bruno: db-row 22.5kg x 8 @ RIR 1 -> e1rm 29.25; ratio 0.8 -> 23.4; 8 @ RIR 2 -> 75% -> 17.55 -> 17.5
  const load = seedLoad(byId("db-bench-press")!, 8, 2, intermediateHypertrophy);
  assert.equal(load, 17.5);
});

test("batteryFor: only loadable, owned, level-capped, injury-safe exercises; deterministic", () => {
  const b = batteryFor(beginnerLumbarDiscDb, CATALOGUE);
  assert.equal(b.length, 4);
  assert.ok(b.length >= 2 && new Set(b.map((x) => byId(x.exerciseId)!.pattern)).size >= 2, "covers distinct patterns");
  for (const s of b) {
    const ex = byId(s.exerciseId)!;
    assert.ok(ex.loadable, `${s.exerciseId} must be loadable`);
    assert.ok(ex.complexity <= 2, "beginner cap");
    assert.ok(ex.equipment.every((eq) => beginnerLumbarDiscDb.env.equipment.includes(eq)), "owned equipment");
    assert.deepEqual(passesHardFilters(ex, beginnerLumbarDiscDb, RULES), [], "injury-safe test");
    assert.ok(s.targetReps >= 5 && s.targetReps <= 10, "Epley-valid rep range");
  }
  assert.deepEqual(batteryFor(beginnerLumbarDiscDb, CATALOGUE), b);
});

test("batteryFor: equipment-less client gets only what they own", () => {
  const b = batteryFor(seniorKneeBandsOnly, CATALOGUE); // band + bench only
  assert.ok(b.length >= 1);
  for (const s of b) {
    const ex = byId(s.exerciseId)!;
    assert.ok(ex.equipment.every((eq) => seniorKneeBandsOnly.env.equipment.includes(eq)));
    assert.deepEqual(passesHardFilters(ex, seniorKneeBandsOnly, RULES), []);
  }
  assert.ok(b.every((s) => s.exerciseId === "step-up"), "only the bench step-up qualifies");
});

test("compareBenchmarks: e1rm evolution per test, new tests, pain deltas", () => {
  const before = {
    repTests: [{ exerciseId: "goblet-squat", reps: 10, loadKg: 8, rir: 2 }], // e1rm 11.2
    pain: [{ region: "spine" as const, score: 5 }],
  };
  const after = {
    repTests: [
      { exerciseId: "goblet-squat", reps: 10, loadKg: 10, rir: 2 }, // e1rm 14
      { exerciseId: "db-row", reps: 8, loadKg: 20, rir: 2 },
    ],
    pain: [{ region: "spine" as const, score: 2 }],
  };
  const c = compareBenchmarks(before, after);
  assert.equal(c.tests.length, 1);
  const t = c.tests[0]!;
  assert.equal(t.exerciseId, "goblet-squat");
  assert.ok(Math.abs(t.beforeE1rm - 11.2) < 1e-9);
  assert.ok(Math.abs(t.afterE1rm - 14) < 1e-9);
  assert.ok(Math.abs(t.deltaPct - 0.25) < 1e-9);
  assert.deepEqual(c.newTests, ["db-row"]);
  assert.equal(c.improved, 1);
  assert.equal(c.declined, 0);
  assert.deepEqual(c.pain, [{ region: "spine", before: 5, after: 2, delta: -3 }]);
  // empty comparison is well-defined
  const empty = compareBenchmarks(undefined, undefined);
  assert.deepEqual(empty.tests, []);
  assert.equal(empty.improved, 0);
});
