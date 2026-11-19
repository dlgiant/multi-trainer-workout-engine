// Property tests (plan section 11): for random-ish inputs, no plan breaks an
// active injury rule or needs equipment the client lacks; loads are owned;
// generation is deterministic.
import test from "node:test";
import assert from "node:assert/strict";
import { generateProgram, GateError } from "../src/engine/generate.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { CATALOGUE, RULES, byId } from "../src/engine/catalogue.ts";
import { beginnerLumbarDiscDb, intermediateHypertrophy, seniorKneeBandsOnly } from "./fixtures/clients.ts";
import type { ClientModel } from "../src/engine/types.ts";

// deterministic pseudo-random (xorshift) so failures reproduce
function rng(seed: number) {
  let s = seed;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

const baseClients = [beginnerLumbarDiscDb, intermediateHypertrophy, seniorKneeBandsOnly];
const perturb = (c: ClientModel, r: () => number): ClientModel => ({
  ...c,
  goal: { primary: (["strength", "hypertrophy", "fat-loss", "general-fitness"] as const)[Math.floor(r() * 4)] },
  level: (["beginner", "intermediate", "advanced"] as const)[Math.floor(r() * 3)],
  prefs: { ...c.prefs, daysPerWeek: 2 + Math.floor(r() * 3), sessionMin: 40 + Math.floor(r() * 85), noJump: r() > 0.5 },
});

test("property: generated plans never violate hard filters and are deterministic", () => {
  const r = rng(42);
  for (let i = 0; i < 50; i++) {
    const client = perturb(baseClients[i % baseClients.length]!, r);
    let program;
    try {
      program = generateProgram(client);
    } catch (e) {
      assert.ok(e instanceof GateError, "only GateError may abort generation");
      continue;
    }
    for (const s of program.sessions) {
      for (const item of s.items) {
        const ex = byId(item.exerciseId);
        assert.ok(ex, `unknown exercise ${item.exerciseId}`);
        const fails = passesHardFilters(ex!, client, RULES);
        assert.deepEqual(fails, [], `${ex!.id} fails filters: ${JSON.stringify(fails)}`);
        if (item.loadKg !== undefined && ex!.loadable) {
          assert.ok(client.env.weightsKg.includes(item.loadKg), `load ${item.loadKg} not owned`);
        }
      }
    }
    // determinism: same inputs, same plan
    assert.deepEqual(generateProgram(client), program);
  }
});
