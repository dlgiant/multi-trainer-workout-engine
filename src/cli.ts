// Demo runner: seeds clients and runs them through the engine, printing the
// result (program or blocking gate) to stdout. Optional JSON export.
//
//   node src/cli.ts            # 6 curated personas
//   node src/cli.ts 20         # + 20 deterministic generated clients
//   node src/cli.ts 0 out.json  # export the programs as JSON
import { writeFileSync } from "node:fs";
import { generateProgram, GateError, progress } from "./engine/index.ts";
import { byId } from "./engine/catalogue.ts";
import { demoClients, generateDemoClients } from "./seed.ts";
import type { Program } from "./engine/types.ts";

const argCount = Number(process.argv[2] ?? "0");
const outFile = process.argv[3];

const clients = [...demoClients(), ...generateDemoClients(Number.isFinite(argCount) && argCount > 0 ? argCount : 0)];
const programs: Program[] = [];
let blocked = 0;
let failed = 0;

const line = "─".repeat(72);
for (const c of clients) {
  console.log(`\n${line}\n${c.name} — ${c.goal.primary} · ${c.level} · ${c.prefs.daysPerWeek}x/sem · ${c.prefs.sessionMin} min`);
  console.log(`  equip: [${c.env.equipment.join(", ")}]  cargas: [${c.env.weightsKg.join(", ")}]  lesões: ${c.injuries.length ? c.injuries.map((i) => `${i.condition}(${i.status})`).join(", ") : "nenhuma"}`);
  try {
    const p = generateProgram(c);
    programs.push(p);
    const s1 = p.sessions[0]!;
    console.log(`  ✓ programa: ${p.split}, ${p.weeks} semanas, sessão 1 ≈ ${s1.minutes} min`);
    for (const it of s1.items) {
      const name = it.exerciseId === "ramp-up" ? "série de aproximação" : byId(it.exerciseId)?.name ?? it.exerciseId;
      console.log(`    [${it.block.padEnd(9)}] ${name}: ${it.sets}×${it.targetReps} RIR ${it.targetRir}${it.loadKg ? ` @ ${it.loadKg} kg` : ""}  (${it.reason.id})`);
    }
    // proposta de progressão para a semana 2 a partir de um log sintético da sessão 1
    const main = s1.items.find((it) => it.block === "main" && it.loadKg !== undefined);
    if (main) {
      const log = { week: 1, dayIndex: 0, sets: Array.from({ length: main.sets }, () => ({ exerciseId: main.exerciseId, reps: main.targetReps, loadKg: main.loadKg, rir: main.targetRir })) };
      const changes = progress(p, [log]);
      console.log(`  proposta p/ próxima semana: ${changes.length ? changes.map((ch) => `${ch.kind}(${ch.reason.id})`).join(" · ") : "sem alterações"}`);
    }
  } catch (e) {
    if (e instanceof GateError) {
      blocked++;
      console.log(`  ⛔ BLOQUEADO pelas portas de segurança:`);
      for (const b of e.blocks) console.log(`     - [${b.gate}] ${b.message}`);
    } else {
      failed++;
      console.log(`  ✗ ERRO: ${(e as Error).message}`);
    }
  }
}

console.log(`\n${line}\nResumo: ${programs.length} programas gerados, ${blocked} bloqueados por porta de segurança, ${failed} erros.`);

if (outFile) {
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), programs }, null, 2));
  console.log(`Programas exportados para ${outFile}`);
}
