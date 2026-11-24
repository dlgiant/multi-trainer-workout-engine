// Catalogue validation harness (run: node --test tests/catalogue.test.ts).
// 1. unique ids  2. no dangling chain refs  3. schema sanity
// 4. every pattern has beginner-safe options  5. injury-rule coverage.
import { CATALOGUE, RULES, byId } from "../src/engine/catalogue.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { rankForSlot } from "../src/engine/scoring.ts";
import type { BodyRegion, ClientModel, Pattern } from "../src/engine/types.ts";
import assert from "node:assert";
import test from "node:test";

const PATTERNS: Pattern[] = ["squat", "hinge", "lunge", "h-push", "v-push", "h-pull", "v-pull", "carry", "core", "conditioning", "mobility"];

const client = (o: Partial<ClientModel> = {}): ClientModel => ({
  clientId: "t", name: "t",
  goal: { primary: "general-fitness" },
  level: "beginner", monthsTraining: 1,
  parqPositive: false, injuries: [],
  prefs: { daysPerWeek: 3, sessionMin: 45, likes: [], dislikes: [], focus: [], noJump: false, spaceM2: 10 },
  env: { equipment: ["db", "bench", "band", "wallAnchor"], weightsKg: [2, 4, 6, 8, 10] },
  ...o,
});

test("ids are unique", () => {
  const ids = CATALOGUE.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("no dangling chain references", () => {
  for (const ex of CATALOGUE) {
    if (ex.regressesTo) assert.ok(byId(ex.regressesTo), `${ex.id}.regressesTo -> ${ex.regressesTo} missing`);
    if (ex.progressesTo) assert.ok(byId(ex.progressesTo), `${ex.id}.progressesTo -> ${ex.progressesTo} missing`);
  }
});

test("stress values are 0-3 and equipment ids are known", () => {
  const known = new Set(["db", "band", "bench", "barbell", "rack", "pullup-bar", "wallAnchor", "trx", "rower", "bike", "treadmill"]);
  for (const ex of CATALOGUE) {
    for (const v of Object.values(ex.stress)) {
      for (const axis of ["load", "range", "impact"] as const) {
        assert.ok(v![axis] >= 0 && v![axis] <= 3, `${ex.id} stress ${axis} out of range`);
      }
    }
    for (const eq of ex.equipment) assert.ok(known.has(eq), `${ex.id} unknown equipment ${eq}`);
  }
});

test("mobility set covers every body region with at least one stretch", () => {
  const regions: BodyRegion[] = ["spine", "shoulder", "elbow", "wrist", "hip", "knee", "ankle"];
  const mob = CATALOGUE.filter((x) => x.pattern === "mobility");
  for (const r of regions) {
    assert.ok(mob.some((x) => x.stress[r]), `no mobility entry stresses ${r}`);
  }
});

test("every pattern has at least one beginner-safe, db+band+bench option", () => {
  const c = client();
  for (const p of PATTERNS) {
    const ok = CATALOGUE.filter(
      (ex) => ex.pattern === p && passesHardFilters(ex, c, RULES).length === 0,
    );
    assert.ok(ok.length >= 1, `pattern ${p} has no beginner-safe option`);
  }
});

test("injury rules still leave every slot fillable", () => {
  const cases: [string, NonNullable<ClientModel["injuries"][number]>["condition"]][] = [
    ["spine", "lumbar-disc"],
    ["knee", "patellofemoral"],
    ["shoulder", "shoulder-impingement"],
    ["ankle", "achilles-tendinopathy"],
  ];
  for (const slot of ["squat", "hinge", "lunge", "h-push", "v-push", "h-pull", "v-pull", "core"] as Pattern[]) {
    for (const [region, condition] of cases) {
      const c = client({
        level: "intermediate",
        injuries: [{ id: "i", region: region as never, condition, severity: 2, status: "recovering", painMoves: [] }],
      });
      const ranked = rankForSlot(slot, c, CATALOGUE)
        .map((x) => ({ ...x, fails: passesHardFilters(x.exercise, c, RULES) }))
        .filter((x) => x.fails.length === 0);
      assert.ok(ranked.length >= 1, `${condition} + ${slot}: no candidate passes`);
    }
  }
});

test("no-jump/noise rule removes every jumping exercise", () => {
  const c = client({ prefs: { daysPerWeek: 3, sessionMin: 45, likes: [], dislikes: [], focus: [], noJump: true, spaceM2: 10 } });
  for (const ex of CATALOGUE) {
    if (ex.constraints.jumping) {
      assert.ok(passesHardFilters(ex, c, RULES).length > 0, `${ex.id} should fail noJump`);
    }
  }
});

test("TRX-only client can fill every main slot, even with lumbar or knee rules", () => {
  const trxCases = [
    [], // healthy
    [{ id: "i1", region: "spine" as never, condition: "lumbar-disc", severity: 2, status: "recovering" as never, painMoves: [] }],
    [{ id: "i2", region: "knee" as never, condition: "patellofemoral", severity: 2, status: "recovering" as never, painMoves: [] }],
  ];
  for (const injuries of trxCases) {
    const c = client({
      level: "intermediate",
      injuries: injuries as never,
      env: { equipment: ["trx"], weightsKg: [] },
      prefs: { daysPerWeek: 3, sessionMin: 45, likes: [], dislikes: [], focus: [], noJump: true, spaceM2: 6 },
    });
    for (const slot of ["squat", "hinge", "lunge", "h-push", "h-pull", "v-pull", "core"] as Pattern[]) {
      const ranked = rankForSlot(slot, c, CATALOGUE)
        .map((x) => ({ ...x, fails: passesHardFilters(x.exercise, c, RULES) }))
        .filter((x) => x.fails.length === 0);
      assert.ok(ranked.length >= 1, `TRX-only + ${injuries.map((i) => i.condition).join(",") || "healthy"} + ${slot}: no candidate passes`);
    }
  }
});
