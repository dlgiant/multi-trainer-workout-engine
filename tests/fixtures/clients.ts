// Persona fixtures (plan section 11): realistic clients with expected behaviour.
import type { ClientModel } from "../../src/engine/types.ts";

export const beginnerLumbarDiscDb: ClientModel = {
  clientId: "p1", name: "Ana", level: "beginner", monthsTraining: 3, parqPositive: false,
  goal: { primary: "general-fitness" },
  injuries: [{ id: "i1", region: "spine", condition: "lumbar-disc", severity: 2, status: "chronic", painMoves: ["flexion under load"] }],
  prefs: { daysPerWeek: 2, sessionMin: 55, likes: [], dislikes: [], focus: ["glutes"], noJump: true, spaceM2: 6 },
  env: { equipment: ["db", "bench", "band"], weightsKg: [2, 4, 6, 8, 10, 12] },
  benchmarks: { repTests: [{ exerciseId: "goblet-squat", reps: 10, loadKg: 8, rir: 2 }] },
};

export const intermediateHypertrophy: ClientModel = {
  clientId: "p2", name: "Bruno", level: "intermediate", monthsTraining: 24, parqPositive: false,
  goal: { primary: "hypertrophy", target: "+2 kg lean", targetDate: "2027-03-01" },
  injuries: [],
  prefs: { daysPerWeek: 4, sessionMin: 60, likes: ["db-row"], dislikes: ["forward-lunge"], focus: ["pecs", "lats"], noJump: false, spaceM2: 10 },
  env: { equipment: ["db", "bench", "band", "wallAnchor"], weightsKg: [10, 12.5, 15, 17.5, 20, 22.5, 25] },
  benchmarks: { repTests: [{ exerciseId: "db-row", reps: 8, loadKg: 22.5, rir: 1 }] },
};

export const seniorKneeBandsOnly: ClientModel = {
  clientId: "p3", name: "Carla, 68", level: "beginner", monthsTraining: 0, parqPositive: false,
  goal: { primary: "mobility-rehab" },
  injuries: [{ id: "i3", region: "knee", condition: "patellofemoral", severity: 1, status: "chronic", painMoves: ["deep knee flexion"] }],
  prefs: { daysPerWeek: 2, sessionMin: 40, likes: [], dislikes: [], focus: [], noJump: true, spaceM2: 5 },
  env: { equipment: ["band", "bench"], weightsKg: [] },
};

export const acuteShoulder: ClientModel = {
  clientId: "p4", name: "Diego", level: "intermediate", monthsTraining: 12, parqPositive: false,
  goal: { primary: "strength" },
  injuries: [{ id: "i4", region: "shoulder", condition: "shoulder-impingement", severity: 2, status: "acute", painMoves: [] }],
  prefs: { daysPerWeek: 3, sessionMin: 50, likes: [], dislikes: [], focus: [], noJump: false },
  env: { equipment: ["db", "bench"], weightsKg: [5, 7.5, 10] },
};
