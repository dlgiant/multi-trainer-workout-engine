import test from "node:test";
import assert from "node:assert/strict";
import { byId, RULES } from "../src/engine/catalogue.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { suggestSubstitutions } from "../src/engine/substitution.ts";
import { CATALOGUE } from "../src/engine/catalogue.ts";
import { beginnerLumbarDiscDb, seniorKneeBandsOnly } from "./fixtures/clients.ts";

test("lumbar disc rule blocks exercises with spine flexion/axial load over 1", () => {
  const seatedToeTouch = byId("seated-toe-touch")!;
  const fails = passesHardFilters(seatedToeTouch, beginnerLumbarDiscDb, RULES);
  assert.ok(fails.some((f) => f.filter === "injury-rule"));
});

test("equipment filter: barbell lift blocked for dumbbell client", () => {
  const backSquat = byId("back-squat")!;
  const fails = passesHardFilters(backSquat, beginnerLumbarDiscDb, RULES);
  assert.ok(fails.some((f) => f.filter === "equipment"));
});

test("beginner complexity cap blocks complexity-3 exercises", () => {
  const backSquat = byId("back-squat")!;
  const advanced = { ...beginnerLumbarDiscDb, injuries: [], level: "advanced" as const };
  assert.equal(passesHardFilters(backSquat, beginnerLumbarDiscDb, RULES).some((f) => f.filter === "complexity"), true);
  assert.equal(passesHardFilters(backSquat, advanced, RULES).some((f) => f.filter === "complexity"), false);
});

test("patellofemoral rule blocks high knee flexion under load", () => {
  const goblet = byId("goblet-squat")!; // knee range 3
  const fails = passesHardFilters(goblet, seniorKneeBandsOnly, RULES);
  assert.ok(fails.some((f) => f.filter === "injury-rule"));
});

test("substitution walks regression chain and passes filters", () => {
  const pushUp = byId("push-up")!;
  // senior client: no floor-space issue but knee rule; push-up is fine, use a case with a violation:
  const suggestions = suggestSubstitutions(pushUp, { ...seniorKneeBandsOnly, prefs: { ...seniorKneeBandsOnly.prefs, dislikes: ["push-up"] } }, CATALOGUE, RULES);
  // still returns only exercises the client can do (band-only)
  for (const s of suggestions) {
    assert.equal(passesHardFilters(s.exercise, seniorKneeBandsOnly, RULES).length, 0);
  }
  assert.ok(suggestions.length > 0 && suggestions.length <= 3);
});
