// Persona fixture (plan section 11): beginner with lumbar disc + dumbbells 2-12.
import test from "node:test";
import assert from "node:assert/strict";
import { generateProgram } from "../src/engine/generate.ts";
import { byId, RULES } from "../src/engine/catalogue.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { beginnerLumbarDiscDb } from "./fixtures/clients.ts";

test("persona: beginner, lumbar disc, dumbbells 2-12, apartment", () => {
  const program = generateProgram(beginnerLumbarDiscDb);
  assert.equal(program.split, "full-body-a/b");
  assert.equal(program.weeks, 4);
  const ids = new Set<string>();
  for (const s of program.sessions) {
    for (const item of s.items) {
      ids.add(item.exerciseId);
      if (item.loadKg !== undefined) {
        assert.ok(beginnerLumbarDiscDb.env.weightsKg.includes(item.loadKg), `unowned load ${item.loadKg}`);
      }
    }
  }
  // never a spine-stressing pick for the disc rule
  for (const id of ids) {
    const ex = byId(id);
    if (!ex) continue; // ramp-up pseudo-item
    assert.equal(passesHardFilters(ex, beginnerLumbarDiscDb, RULES).length, 0, `${id} must pass filters`);
  }
  // no jumping in an apartment
  assert.ok(!ids.has("jump-rope"));
  // week 4 is a deload: fewer/easier sets
  const week3 = program.sessions.filter((s) => s.week === 3);
  const week4 = program.sessions.filter((s) => s.week === 4);
  const sets3 = week3.reduce((n, s) => n + s.items.reduce((m, i) => m + i.sets, 0), 0);
  const sets4 = week4.reduce((n, s) => n + s.items.reduce((m, i) => m + i.sets, 0), 0);
  assert.ok(sets4 < sets3, "deload week must cut sets");
  // cardio é dosado por duração (menor no deload), não por RIR
  assert.ok(
    week4.every((s) => s.items.every((i) => i.block === "cardio" || i.targetRir >= 4)),
    "deload at RIR 4+",
  );
});
