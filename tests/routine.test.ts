// Evening stretch routine (milestone 2): injury-safe, trained-muscle aware.
import test from "node:test";
import assert from "node:assert/strict";
import { suggestStretches } from "../src/engine/routine.ts";
import { CATALOGUE, RULES, byId } from "../src/engine/catalogue.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { beginnerLumbarDiscDb, seniorKneeBandsOnly } from "./fixtures/clients.ts";

test("every suggestion passes the injury rules and is a mobility exercise", () => {
  for (const client of [beginnerLumbarDiscDb, seniorKneeBandsOnly]) {
    const picks = suggestStretches(client, CATALOGUE, RULES, { trainedMuscles: ["quads", "glutes", "hamstrings"] });
    assert.ok(picks.length >= 3, `expected a usable routine for ${client.name}`);
    for (const p of picks) {
      assert.equal(p.exercise.pattern, "mobility");
      assert.equal(passesHardFilters(p.exercise, client, RULES).length, 0, `${p.exercise.id} must pass filters`);
      assert.ok(p.reason.id.startsWith("stretch-"));
    }
  }
});

test("lumbar disc client never gets the seated toe touch (spine range 3)", () => {
  const picks = suggestStretches(beginnerLumbarDiscDb, CATALOGUE, RULES, { trainedMuscles: [] });
  assert.ok(!picks.some((p) => p.exercise.id === "seated-toe-touch"));
  // child-pose is safe here (spine flexion is unloaded) but knee OA should not get it
  assert.ok(!picks.some((p) => p.exercise.id === "seated-toe-touch"));
});

test("patellofemoral client avoids deep-knee-flexion stretches", () => {
  const picks = suggestStretches(seniorKneeBandsOnly, CATALOGUE, RULES, { trainedMuscles: [] });
  // child-pose / hip-flexor-stretch have knee range 3 > rule cap 2
  assert.ok(!picks.some((p) => ["child-pose", "hip-flexor-stretch"].includes(p.exercise.id)));
});

test("stretches hitting trained muscles rank first", () => {
  const picks = suggestStretches(beginnerLumbarDiscDb, CATALOGUE, RULES, {
    trainedMuscles: ["hamstrings", "glutes"],
    limit: 6,
  });
  const top = picks[0]!;
  const topHits = [...top.exercise.muscles.primary, ...top.exercise.muscles.secondary];
  assert.ok(topHits.some((m) => ["hamstrings", "glutes"].includes(m)), `top pick ${top.exercise.id} should match trained muscles`);
  // trained-muscle reason carries the muscle list
  assert.ok(picks.some((p) => p.reason.id === "stretch-trained-muscles" && typeof p.reason.params?.muscles === "string"));
});

test("deterministic ordering: same inputs, same routine", () => {
  const ctx = { trainedMuscles: ["pecs", "lats"], limit: 4 };
  const a = suggestStretches(beginnerLumbarDiscDb, CATALOGUE, RULES, ctx);
  const b = suggestStretches(beginnerLumbarDiscDb, CATALOGUE, RULES, ctx);
  assert.deepEqual(a.map((p) => p.exercise.id), b.map((p) => p.exercise.id));
});

test("focus areas from prefs are honoured (Ana: glutes)", () => {
  const picks = suggestStretches(beginnerLumbarDiscDb, CATALOGUE, RULES, { trainedMuscles: [] });
  assert.ok(
    picks.some((p) => [...p.exercise.muscles.primary, ...p.exercise.muscles.secondary].includes("glutes")),
    "glute stretch should appear for a glute-focused client",
  );
  const fig4 = byId("figure-4-stretch")!;
  assert.equal(passesHardFilters(fig4, beginnerLumbarDiscDb, RULES).length, 0);
});
