import test from "node:test";
import assert from "node:assert/strict";
import { progressExercise } from "../src/engine/progression.ts";
import { e1rm, roundDownToOwned, seedLoad } from "../src/engine/benchmarks.ts";
import { byId } from "../src/engine/catalogue.ts";
import type { PlannedExercise, SessionLog } from "../src/engine/types.ts";
import { intermediateHypertrophy } from "./fixtures/clients.ts";

const planned = (over: Partial<PlannedExercise>): PlannedExercise => ({
  exerciseId: "db-row", block: "main", sets: 3, targetReps: 12, targetRir: 2, loadKg: 10, restMin: 2, reason: { id: "goal-match" }, ...over,
});
const session = (sets: SessionLog["sets"], week = 1): SessionLog => ({ week, dayIndex: 0, sets });

test("hit top of range at RIR -> next available weight (<=10% jump)", () => {
  const client = { ...intermediateHypertrophy, env: { ...intermediateHypertrophy.env, weightsKg: [10, 11, 12.5, 15, 20, 25] } };
  const h: SessionLog[] = [session([
    { exerciseId: "db-row", reps: 12, loadKg: 10, rir: 2 },
    { exerciseId: "db-row", reps: 12, loadKg: 10, rir: 2 },
    { exerciseId: "db-row", reps: 12, loadKg: 10, rir: 2 },
  ])];
  const changes = progressExercise(planned({ loadKg: 10 }), h, client);
  assert.equal(changes[0]!.kind, "load");
  assert.equal((changes[0] as { to?: number }).to, 11);
});

test("weight jump >10% (8 -> 10 kg): do not jump, add reps past the range", () => {
  const weights = [2, 4, 6, 8, 10, 12]; // 8 -> 10 = +25%
  const client = { ...intermediateHypertrophy, env: { ...intermediateHypertrophy.env, weightsKg: weights } };
  const h: SessionLog[] = [session([
    { exerciseId: "db-row", reps: 12, loadKg: 8, rir: 2 },
    { exerciseId: "db-row", reps: 12, loadKg: 8, rir: 2 },
    { exerciseId: "db-row", reps: 12, loadKg: 8, rir: 2 },
  ])];
  const changes = progressExercise(planned({ loadKg: 8 }), h, client);
  assert.equal(changes[0]!.kind, "reps");
  assert.equal((changes[0] as { to: number }).to, 15); // top + 3
  assert.equal(changes[0]!.reason.id, "weight-jump-too-big");
});

test("within range: same load, +1 rep on the weakest set", () => {
  const h: SessionLog[] = [session([
    { exerciseId: "db-row", reps: 12, loadKg: 10, rir: 2 },
    { exerciseId: "db-row", reps: 10, loadKg: 10, rir: 2 },
    { exerciseId: "db-row", reps: 11, loadKg: 10, rir: 2 },
  ])];
  const changes = progressExercise(planned({ loadKg: 10 }), h, intermediateHypertrophy);
  assert.equal(changes[0]!.kind, "reps");
  assert.equal(changes[0]!.reason.id, "within-range");
});

test("pain >= 4 ends the exercise and proposes the regression", () => {
  const h: SessionLog[] = [session([
    { exerciseId: "db-row", reps: 12, loadKg: 10, rir: 2, pain: { region: "shoulder", score: 5 } },
  ])];
  const changes = progressExercise(planned({ loadKg: 10, sets: 1 }), h, intermediateHypertrophy);
  assert.equal(changes[0]!.reason.id, "pain-flag");
});

test("below range twice in a row -> next lower weight", () => {
  const mk = (week: number): SessionLog => session([
    { exerciseId: "db-row", reps: 6, loadKg: 10, rir: 0 },
    { exerciseId: "db-row", reps: 6, loadKg: 10, rir: 0 },
    { exerciseId: "db-row", reps: 6, loadKg: 10, rir: 0 },
  ], week);
  const lighter = { ...intermediateHypertrophy, env: { ...intermediateHypertrophy.env, weightsKg: [2.5, 5, 7.5, 10, 12.5] } };
  const changes = progressExercise(planned({ loadKg: 10, targetReps: 12, targetRir: 2 }), [mk(1), mk(2)], lighter);
  assert.equal(changes[0]!.reason.id, "below-range-twice");
  assert.equal((changes[0] as { to?: number }).to, 10 - 2.5);
});

test("e1RM Epley with RIR", () => {
  assert.ok(Math.abs(e1rm(100, 5, 1) - 120) < 1e-9); // 100 * (1 + 6/30)
});

test("seedLoad rounds down to an owned weight", () => {
  const goblet = byId("goblet-squat")!;
  const load = seedLoad(goblet, 12, 3, {
    ...intermediateHypertrophy,
    benchmarks: { repTests: [{ exerciseId: "goblet-squat", reps: 10, loadKg: 20, rir: 2 }] },
  });
  assert.ok(load !== undefined && intermediateHypertrophy.env.weightsKg.includes(load));
  assert.equal(roundDownToOwned(13.1, [10, 12.5, 15]), 12.5);
});
