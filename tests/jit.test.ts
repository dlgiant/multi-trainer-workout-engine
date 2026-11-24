// Marco 5: goal-ordered sequence + just-in-time next-session generation.
import test from "node:test";
import assert from "node:assert/strict";
import { generateProgram, nextSession, GateError, READINESS_LOW } from "../src/engine/generate.ts";
import { sequenceFor, orderSlotsForGoal } from "../src/engine/sequence.ts";
import { CATALOGUE, RULES, byId } from "../src/engine/catalogue.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import { beginnerLumbarDiscDb, intermediateHypertrophy, seniorKneeBandsOnly, acuteShoulder } from "./fixtures/clients.ts";
import type { ClientModel, Pattern, SessionLog } from "../src/engine/types.ts";

const enduranceClient: ClientModel = {
  ...intermediateHypertrophy,
  goal: { primary: "endurance" },
  prefs: { ...intermediateHypertrophy.prefs, daysPerWeek: 2 },
};

// ---------- sequence ordering ----------

test("sequence: slot order within a day depends on the goal", () => {
  // general-fitness keeps the legacy full-body order
  const gf = sequenceFor(beginnerLumbarDiscDb, 1)[0]!;
  assert.deepEqual(gf.slots, ["squat", "hinge", "h-push", "h-pull", "core"]);
  // endurance puts core first, then lower-body
  const en = sequenceFor(enduranceClient, 1)[0]!;
  assert.deepEqual(en.slots, ["core", "squat", "hinge", "h-push", "h-pull"]);
  // mobility-rehab prepends a mobility slot, core second
  const mr = sequenceFor(seniorKneeBandsOnly, 1)[0]!;
  assert.equal(mr.slots[0], "mobility");
  assert.equal(mr.slots[1], "core");
  // block shape: weeks x days
  assert.equal(sequenceFor(beginnerLumbarDiscDb, 4).length, 8);
  assert.equal(sequenceFor(intermediateHypertrophy, 2).length, 8);
});

test("sequence: deterministic and orderSlotsForGoal is stable for unknown slots", () => {
  assert.deepEqual(sequenceFor(enduranceClient, 2), sequenceFor(enduranceClient, 2));
  const slots: Pattern[] = ["core", "squat", "carry"];
  assert.deepEqual(orderSlotsForGoal(slots, "general-fitness"), ["squat", "carry", "core"]);
});

test("block mode materializes goal-ordered sessions; mobility-rehab trains mobility in-session", () => {
  const p = generateProgram(seniorKneeBandsOnly); // block (default)
  assert.equal(p.mode, "block");
  const s0 = p.sessions[0]!;
  assert.equal(s0.status, "ready");
  assert.ok(s0.items.length > 0);
  assert.deepEqual(s0.slots![0], "mobility");
  const mob = s0.items.find((it) => it.block === "main" && byId(it.exerciseId)?.pattern === "mobility");
  assert.ok(mob, "mobility-rehab session should contain a mobility main item");
  assert.equal(mob!.loadKg, undefined);
});

// ---------- JIT ----------

test("jit mode stores only the sequence; nextSession fills one session at a time", () => {
  const p0 = generateProgram(beginnerLumbarDiscDb, { mode: "jit", weeks: 1 });
  assert.equal(p0.mode, "jit");
  assert.equal(p0.sessions.length, 2);
  assert.ok(p0.sessions.every((s) => s.status === "pending" && s.items.length === 0 && s.minutes === 0));

  const r1 = nextSession(beginnerLumbarDiscDb, p0, []);
  assert.ok(r1, "first session can be generated with empty history");
  assert.equal(r1!.session.week, 1);
  assert.equal(r1!.session.dayIndex, 0);
  assert.equal(r1!.session.status, "ready");
  assert.ok(r1!.session.items.length > 0);
  assert.equal(r1!.program.sessions[0]!.status, "ready");
  assert.equal(r1!.program.sessions[1]!.status, "pending");
  for (const it of r1!.session.items) {
    const ex = byId(it.exerciseId);
    if (!ex) continue; // ramp-up pseudo-item
    assert.deepEqual(passesHardFilters(ex, beginnerLumbarDiscDb, RULES), [], `${it.exerciseId} must pass filters`);
  }
});

test("jit invariant: next session only after the previous one is logged", () => {
  const p0 = generateProgram(beginnerLumbarDiscDb, { mode: "jit", weeks: 1 });
  const r1 = nextSession(beginnerLumbarDiscDb, p0, [])!;
  // no log for session 0 yet -> session 1 must NOT be generated
  assert.equal(nextSession(beginnerLumbarDiscDb, r1.program, []), null);

  // log session 0 with every set at the top of the range -> session 1 unlocks
  const log: SessionLog = {
    week: 1, dayIndex: 0,
    sets: r1.session.items
      .filter((it) => it.block === "main" || it.block === "core")
      .flatMap((it) => Array.from({ length: it.sets }, () => ({ exerciseId: it.exerciseId, reps: it.targetReps, loadKg: it.loadKg, rir: it.targetRir }))),
  };
  const r2 = nextSession(beginnerLumbarDiscDb, r1.program, [log]);
  assert.ok(r2, "session 1 unlocks after session 0 is logged");
  assert.equal(r2!.session.week, 1);
  assert.equal(r2!.session.dayIndex, 1);
  assert.ok(r2!.changes.length > 0, "hitting the top of the range proposes changes");
  // the changes were applied to the upcoming session's matching items
  for (const c of r2!.changes) {
    const item = r2!.session.items.find((it) => it.exerciseId === c.exerciseId && (it.block === "main" || it.block === "core"));
    if (!item) continue;
    if (c.kind === "load") assert.equal(item.loadKg, c.to, "load change applied");
    if (c.kind === "reps") assert.equal(item.targetReps, c.to, "reps change applied");
    if (c.kind === "add-set") assert.equal(item.sets, c.to, "add-set change applied");
  }
});

test("jit: readiness-low log trims the next session by one set per main/core item", () => {
  const p0 = generateProgram(beginnerLumbarDiscDb, { mode: "jit", weeks: 1 });
  const r1 = nextSession(beginnerLumbarDiscDb, p0, [])!;
  const log: SessionLog = {
    week: 1, dayIndex: 0,
    readiness: { sleep: 8, soreness: READINESS_LOW.soreness, energy: 6, pain: 0 },
    sets: r1.session.items
      .filter((it) => it.block === "main" || it.block === "core")
      .flatMap((it) => Array.from({ length: it.sets }, () => ({ exerciseId: it.exerciseId, reps: it.targetReps, loadKg: it.loadKg, rir: it.targetRir }))),
  };
  const r2 = nextSession(beginnerLumbarDiscDb, r1.program, [log])!;
  assert.equal(r2.readinessLow, true);
  const mains = r2.session.items.filter((it) => it.block === "main" || it.block === "core");
  assert.ok(mains.length > 0);
  assert.ok(mains.every((it) => it.reason.id === "readiness-low"), "readiness-low reason on trimmed items");
  // a healthy readiness log does not trim
  const okLog: SessionLog = { ...log, readiness: { sleep: 8, soreness: 2, energy: 8, pain: 0 } };
  const r3 = nextSession(beginnerLumbarDiscDb, r1.program, [okLog])!;
  assert.equal(r3.readinessLow, false);
});

test("jit: safety gates are re-run on every generation", () => {
  const p0 = generateProgram(intermediateHypertrophy, { mode: "jit", weeks: 1 });
  const r1 = nextSession(intermediateHypertrophy, p0, [])!;
  const hurt: ClientModel = {
    ...intermediateHypertrophy,
    injuries: [...intermediateHypertrophy.injuries, acuteShoulder.injuries[0]!],
  };
  assert.throws(() => nextSession(hurt, r1.program, []), GateError);
});

test("jit: returns null when nothing is pending; deterministic", () => {
  const p0 = generateProgram(beginnerLumbarDiscDb, { mode: "jit", weeks: 1 });
  const r1 = nextSession(beginnerLumbarDiscDb, p0, [])!;
  const log: SessionLog = { week: 1, dayIndex: 0, sets: [] };
  const r2 = nextSession(beginnerLumbarDiscDb, r1.program, [log])!;
  const done = { ...r2.program, sessions: r2.program.sessions.map((s) => ({ ...s, status: "ready" as const, items: s.items.length ? s.items : r1.session.items })) };
  assert.equal(nextSession(beginnerLumbarDiscDb, done, [log]), null);
  // determinism
  const a = nextSession(beginnerLumbarDiscDb, r1.program, [log]);
  const b = nextSession(beginnerLumbarDiscDb, r1.program, [log]);
  assert.deepEqual(a, b);
});

test("block mode still materializes all weeks upfront (unchanged default)", () => {
  const p = generateProgram(beginnerLumbarDiscDb);
  assert.equal(p.mode, "block");
  assert.equal(p.sessions.length, 8);
  assert.ok(p.sessions.every((s) => s.status === "ready" && s.items.length > 0));
  assert.ok(CATALOGUE.length > 0);
});
