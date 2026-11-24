// Group workouts (marco 5): treino em dupla (plan section 4).
// Fixtures inline para não depender do fixtures/clients.ts existente.
// node --test tests/group.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE, RULES, byId } from "../src/engine/catalogue.ts";
import { generateGroupProgram, slotsOfSession } from "../src/engine/group.ts";
import { GateError } from "../src/engine/generate.ts";
import { passesHardFilters } from "../src/engine/filters.ts";
import type { ClientModel, Injury, Pattern, Program, SessionPlan, PlannedExercise } from "../src/engine/types.ts";

// ---------- fixtures (casal do apartamento) ----------
const lumbarDisc = (extra: Partial<Injury> = {}): Injury => ({
  id: "inj-ana-lumbar",
  region: "spine",
  condition: "hérnia de disco lombar (lumbar-disc)",
  severity: 2,
  status: "chronic",
  painMoves: ["flexão de tronco"],
  ...extra,
});

const bruno: ClientModel = {
  clientId: "bruno",
  name: "Bruno",
  goal: { primary: "hypertrophy" },
  level: "intermediate",
  monthsTraining: 24,
  parqPositive: false,
  injuries: [],
  prefs: { daysPerWeek: 3, sessionMin: 60, likes: [], dislikes: [], focus: [], noJump: true, spaceM2: 12 },
  env: { equipment: ["db", "bench"], weightsKg: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] },
  benchmarks: { repTests: [{ exerciseId: "db-row", reps: 10, loadKg: 24, rir: 2 }] },
};

const ana: ClientModel = {
  clientId: "ana",
  name: "Ana",
  goal: { primary: "general-fitness" },
  level: "beginner",
  monthsTraining: 6,
  parqPositive: false,
  injuries: [lumbarDisc()],
  prefs: { daysPerWeek: 3, sessionMin: 60, likes: [], dislikes: [], focus: ["glutes"], noJump: true, spaceM2: 10 },
  env: { equipment: ["db", "bench"], weightsKg: [2, 4, 6, 8, 10, 12] },
  benchmarks: { repTests: [{ exerciseId: "db-row", reps: 10, loadKg: 10, rir: 2 }] },
};

const anaParq: ClientModel = { ...ana, parqPositive: true };

const brunoLight: ClientModel = {
  ...bruno,
  clientId: "bruno-light",
  name: "Bruno (halteres leves)",
  env: { ...bruno.env, weightsKg: [7.5, 10, 12.5] },
  benchmarks: { repTests: [{ exerciseId: "db-row", reps: 10, loadKg: 10, rir: 2 }] },
};

// ---------- helpers ----------
function itemForSlot(s: SessionPlan, slot: Pattern): PlannedExercise | undefined {
  return s.items.find(
    (it) => (it.block === "main" || it.block === "core") && it.reason.params?.slot === slot,
  );
}

function mainItems(p: Program, sessionIndex: number): PlannedExercise[] {
  return p.sessions[sessionIndex]!.items.filter((it) => it.block === "main" || it.block === "core");
}

// ---------- tests ----------
test("grupo 'shared': mesma estrutura de slots, líder é members[0]", () => {
  const group = generateGroupProgram([bruno, ana], "shared");
  assert.equal(group.mode, "shared");
  assert.equal(group.split, "full-body-a/b/c"); // split do líder (Bruno, 3 dias)
  assert.equal(group.members[0]!.clientId, "bruno");
  assert.equal(group.members[1]!.clientId, "ana");

  const bp = group.members[0]!.program;
  const ap = group.members[1]!.program;
  assert.equal(bp.sessions.length, ap.sessions.length);
  for (let i = 0; i < bp.sessions.length; i++) {
    const bs = bp.sessions[i]!;
    const as = ap.sessions[i]!;
    assert.equal(bs.week, as.week);
    assert.equal(bs.dayIndex, as.dayIndex);
    assert.deepEqual(slotsOfSession(as), slotsOfSession(bs));
  }

  // Ana: tudo passa nos filtros dela, e cargas são sempre halteres dela
  for (const s of ap.sessions) {
    for (const it of s.items) {
      const ex = byId(it.exerciseId);
      assert.ok(ex, `exercício desconhecido ${it.exerciseId}`);
      assert.deepEqual(passesHardFilters(ex, ana, RULES), [], `${it.exerciseId} falha filtro duro p/ Ana`);
      if (it.loadKg !== undefined) {
        assert.ok(ana.env.weightsKg.includes(it.loadKg), `carga ${it.loadKg} fora dos halteres de Ana`);
      }
    }
  }
  const hasCardio = ap.sessions.some((s) => s.items.some((it) => it.block === "cardio"));
  assert.ok(hasCardio, "Ana (general-fitness) deveria ter bloco de cardio");
});

test("shared: exercício do líder que passa nos filtros da Ana é mantido (shared: true)", () => {
  const group = generateGroupProgram([bruno, ana], "shared");
  const ap = group.members[1]!.program;
  const shared = ap.sessions[0]!.items.filter((it) => it.reason.params?.shared === true);
  assert.ok(shared.length >= 1, "Ana deveria manter ao menos 1 exercício do líder");
});

test("divergência segura: hinge do líder (RDL) falha a regra lombar da Ana e é trocado", () => {
  const group = generateGroupProgram([bruno, ana], "shared");
  const bp = group.members[0]!.program;
  const ap = group.members[1]!.program;
  const i = 0; // semana 1, dia A
  const bh = itemForSlot(bp.sessions[i]!, "hinge");
  assert.ok(bh, "Bruno deveria ter slot hinge");
  assert.equal(bh!.exerciseId, "db-romanian-deadlift"); // ranking + tie-break por id

  const ah = itemForSlot(ap.sessions[i]!, "hinge");
  assert.ok(ah, "Ana deveria ter slot hinge");
  assert.notEqual(ah!.exerciseId, bh!.exerciseId, "RDL não pode aparecer para a Ana (range lombar 2 > 1)");
  assert.equal(ah!.reason.params?.shared, false);
  // a substituição da Ana precisa passar nos filtros dela
  const ex = byId(ah!.exerciseId)!;
  assert.deepEqual(passesHardFilters(ex, ana, RULES), []);
});

test("mesmos exercícios, cargas diferentes: halteres leves dosam menor", () => {
  const group = generateGroupProgram([bruno, brunoLight], "shared");
  const a = group.members[0]!.program;
  const b = group.members[1]!.program;
  for (let i = 0; i < a.sessions.length; i++) {
    assert.deepEqual(
      mainItems(b, i).map((it) => it.exerciseId),
      mainItems(a, i).map((it) => it.exerciseId),
      `sessão ${i}: clones devem treinar os mesmos exercícios`,
    );
  }
  // db-row: e1RM maior (teste 24kg) vs menor (teste 10kg) -> cargas diferentes
  const rowA = a.sessions[0]!.items.find((it) => it.exerciseId === "db-row");
  const rowB = b.sessions[0]!.items.find((it) => it.exerciseId === "db-row");
  assert.ok(rowA, "db-row deveria aparecer na sessão A do Bruno");
  assert.ok(rowB, "db-row deveria aparecer na sessão do clone");
  assert.ok(rowA.loadKg !== undefined && rowB.loadKg !== undefined);
  assert.ok(rowA.loadKg! > rowB.loadKg!, "mesmo teste com cargas maiores -> carga maior no treino");
  assert.ok(brunoLight.env.weightsKg.includes(rowB.loadKg!), "carga do clone deve ser um halter dele");
});

test("modo 'mixed': cada membro mantém o próprio split", () => {
  const ana2 = { ...ana, prefs: { ...ana.prefs, daysPerWeek: 2 } };
  const group = generateGroupProgram([bruno, ana2], "mixed");
  assert.equal(group.mode, "mixed");
  assert.equal(group.members[0]!.program.split, "full-body-a/b/c");
  assert.equal(group.members[1]!.program.split, "full-body-a/b");
  assert.equal(group.members[0]!.program.sessions.length, 4 * 3);
  assert.equal(group.members[1]!.program.sessions.length, 4 * 2);
});

test("membro com PAR-Q+ positivo bloqueia o grupo inteiro", () => {
  assert.throws(() => generateGroupProgram([bruno, anaParq], "shared"), GateError);
  assert.throws(() => generateGroupProgram([bruno, anaParq], "mixed"), GateError);
});

test("grupo exige >= 2 membros", () => {
  assert.throws(() => generateGroupProgram([bruno]), />= 2 membros/);
});
