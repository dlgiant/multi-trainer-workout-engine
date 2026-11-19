// Demo seed: fully configured clients for exercising the engine without the app.
// Pure data — the engine has no storage; the importer decides where these go.
import type { ClientModel, Goal, Injury, Level } from "./engine/types.ts";

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

export function demoClients(): ClientModel[] {
  return [
    {
      clientId: "demo-ana", name: "Ana Martins", level: "beginner", monthsTraining: 3, parqPositive: false,
      goal: { primary: "general-fitness", target: "sair da dor e ganhar disposição" },
      injuries: [{ id: "ana-i1", region: "spine", condition: "lumbar-disc", severity: 2, status: "chronic", painMoves: ["flexão de tronco sob carga"], clinicianNotes: "Fisio liberou carga leve; evitar flexão lombar sob carga", reviewAt: iso(-45) }],
      prefs: { daysPerWeek: 2, sessionMin: 55, likes: [], dislikes: [], focus: ["glutes"], noJump: true, spaceM2: 6 },
      env: { equipment: ["db", "bench", "band"], weightsKg: [2, 4, 6, 8, 10, 12] },
      benchmarks: { repTests: [{ exerciseId: "goblet-squat", reps: 10, loadKg: 8, rir: 2 }] },
    },
    {
      clientId: "demo-bruno", name: "Bruno Costa", level: "intermediate", monthsTraining: 24, parqPositive: false,
      goal: { primary: "hypertrophy", target: "+2 kg massa magra", targetDate: "2027-03-01" },
      injuries: [],
      prefs: { daysPerWeek: 4, sessionMin: 60, likes: ["db-row"], dislikes: ["forward-lunge"], focus: ["pecs", "lats"], noJump: false, spaceM2: 10 },
      env: { equipment: ["db", "bench", "band", "wallAnchor"], weightsKg: [10, 12.5, 15, 17.5, 20, 22.5, 25] },
      benchmarks: { repTests: [{ exerciseId: "db-row", reps: 8, loadKg: 22.5, rir: 1 }] },
    },
    {
      clientId: "demo-carla", name: "Carla Ribeiro (68)", level: "beginner", monthsTraining: 0, parqPositive: false,
      goal: { primary: "mobility-rehab", target: "subir escada sem dor" },
      injuries: [{ id: "carla-i1", region: "knee", condition: "patellofemoral", severity: 1, status: "chronic", painMoves: ["agachamento profundo"], reviewAt: iso(-30) }],
      prefs: { daysPerWeek: 2, sessionMin: 40, likes: [], dislikes: [], focus: [], noJump: true, spaceM2: 5 },
      env: { equipment: ["band", "bench"], weightsKg: [] },
    },
    {
      clientId: "demo-diego", name: "Diego Alves", level: "intermediate", monthsTraining: 12, parqPositive: false,
      // Gate demo: acute shoulder without clearance -> generateProgram throws GateError.
      goal: { primary: "strength", target: "elevação pélvica 100 kg" },
      injuries: [{ id: "diego-i1", region: "shoulder", condition: "shoulder-impingement", severity: 2, status: "acute", painMoves: ["desenvolvimento acima da cabeça"], clinicianNotes: "Sem empurrar acima da cabeça até reavaliação", reviewAt: iso(-14) }],
      prefs: { daysPerWeek: 3, sessionMin: 50, likes: [], dislikes: [], focus: [], noJump: false },
      env: { equipment: ["db", "bench"], weightsKg: [5, 7.5, 10, 12.5, 15, 17.5, 20] },
    },
    {
      clientId: "demo-marina", name: "Marina Lopes", level: "intermediate", monthsTraining: 18, parqPositive: false,
      goal: { primary: "fat-loss", target: "−4 kg", targetDate: "2027-01-15" },
      injuries: [{ id: "marina-i1", region: "knee", condition: "patellofemoral", severity: 1, status: "cleared", clearedAt: iso(60), painMoves: [] }],
      prefs: { daysPerWeek: 3, sessionMin: 50, likes: ["hip-thrust"], dislikes: [], focus: ["glutes"], noJump: true, spaceM2: 6 },
      env: { equipment: ["db", "band", "bench"], weightsKg: [4, 6, 8, 10, 12, 14, 16] },
    },
    {
      clientId: "demo-rui", name: "Rui Barbosa", level: "advanced", monthsTraining: 60, parqPositive: false,
      goal: { primary: "strength", target: "back squat 1.5× PC" },
      injuries: [],
      prefs: { daysPerWeek: 4, sessionMin: 70, likes: ["back-squat"], dislikes: [], focus: ["quads", "glutes"], noJump: false, spaceM2: 12 },
      env: { equipment: ["db", "bench", "band", "barbell", "rack"], weightsKg: [20, 25, 30, 40, 50, 60] },
      benchmarks: { repTests: [{ exerciseId: "back-squat", reps: 5, loadKg: 100, rir: 1 }] },
    },
  ];
}

/** Deterministic pseudo-random (xorshift) so failures and demos reproduce. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

const GOALS: Goal[] = ["strength", "hypertrophy", "fat-loss", "general-fitness", "endurance", "mobility-rehab"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

/**
 * Bulk seed: n deterministic, fully configured clients with varied goals,
 * levels, equipment, and injuries. Same seed -> same clients.
 */
export function generateDemoClients(n: number, seed = 42): ClientModel[] {
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;
  const out: ClientModel[] = [];
  for (let i = 0; i < n; i++) {
    const level = pick(LEVELS);
    const days = 2 + Math.floor(r() * 4);
    const withInjury = r() > 0.35;
    const injury: Injury = withInjury
      ? {
          id: `gen-${i}-i1`,
          region: pick(["spine", "shoulder", "knee"] as const),
          condition: pick(["lumbar-disc", "shoulder-impingement", "patellofemoral"]),
          severity: pick([1, 2] as const),
          status: r() > 0.8 ? "acute" : "chronic",
          painMoves: [pick(["flexão sob carga", "prensa acima da cabeça", "agachamento profundo"])],
        }
      : ({} as never);
    const dbs = [2, 4, 6, 8, 10, 12, 14, 16, 20];
    out.push({
      clientId: `gen-${i}`,
      name: `Cliente gerado ${i + 1}`,
      level,
      monthsTraining: Math.floor(r() * 48),
      parqPositive: false,
      goal: { primary: pick(GOALS) },
      injuries: withInjury ? [injury] : [],
      prefs: {
        daysPerWeek: days,
        sessionMin: 40 + Math.floor(r() * 85),
        likes: [],
        dislikes: [],
        focus: [],
        noJump: r() > 0.5,
        spaceM2: 4 + Math.floor(r() * 8),
      },
      env: {
        equipment: ["db", "band", "bench"].filter(() => r() > 0.3),
        weightsKg: dbs.filter(() => r() > 0.25),
      },
    });
  }
  return out;
}
