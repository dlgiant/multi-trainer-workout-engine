// Marco 4: bloco de cardio — dose por objetivo, posicionamento early/late,
// fallback sem equipamento e orçamento de tempo.
import test from "node:test";
import assert from "node:assert/strict";
import { generateProgram } from "../src/engine/generate.ts";
import { cardioMinutesFor, pickCardio } from "../src/engine/cardio.ts";
import { CATALOGUE, RULES } from "../src/engine/catalogue.ts";
import { intermediateHypertrophy, seniorKneeBandsOnly } from "./fixtures/clients.ts";

const fatLossWithBike = {
  ...intermediateHypertrophy,
  goal: { primary: "fat-loss" as const },
  env: { ...intermediateHypertrophy.env, equipment: [...intermediateHypertrophy.env.equipment, "bike"] },
};

const session = (program: ReturnType<typeof generateProgram>, day = 0) =>
  program.sessions.find((s) => s.week === 1 && s.dayIndex === day)!;

test("cardio: fat-loss ganha 12 min no fim (default late), antes do relaxamento", () => {
  const p = generateProgram(fatLossWithBike);
  const items = session(p).items;
  const cardio = items.find((i) => i.block === "cardio");
  assert.ok(cardio, "esperava bloco de cardio");
  assert.equal(cardio!.durationMin, 12);
  assert.equal(cardio!.exerciseId, "stationary-bike");
  const cooldownAt = items.findIndex((i) => i.block === "cooldown");
  const cardioAt = items.findIndex((i) => i.block === "cardio");
  assert.ok(cardioAt > -1);
  assert.ok(cooldownAt > cardioAt);
});

test("cardio: cardioPlacement 'early' insere o cardio antes do primeiro principal", () => {
  const client = { ...fatLossWithBike, prefs: { ...fatLossWithBike.prefs, cardioPlacement: "early" as const } };
  const items = session(generateProgram(client)).items;
  const cardioAt = items.findIndex((i) => i.block === "cardio");
  const mainAt = items.findIndex((i) => i.block === "main");
  assert.ok(cardioAt > -1);
  assert.ok(mainAt > cardioAt);
});

test("cardio: força/hipertrofia sem preferência explícita não ganha bloco", () => {
  const p = generateProgram(intermediateHypertrophy);
  assert.equal(session(p).items.some((i) => i.block === "cardio"), false);
});

test("cardio: sem máquinas, caminhada rápida é o fallback (sem equipamento)", () => {
  const client = { ...fatLossWithBike, env: { equipment: ["db", "bench"], weightsKg: [10, 12] } };
  const cardioItem = session(generateProgram(client)).items.find((i) => i.block === "cardio");
  assert.equal(cardioItem?.exerciseId, "brisk-walk");
});

test("cardio: deload reduz a duração, nunca abaixo de 4 min", () => {
  assert.ok(cardioMinutesFor("fat-loss", true, false) > 3);
  assert.ok(cardioMinutesFor("fat-loss", true, false) < 12);
});

test("cardio: escolha respeita dislikes e hard filters", () => {
  const client = {
    ...fatLossWithBike,
    prefs: { ...fatLossWithBike.prefs, dislikes: ["stationary-bike", "brisk-walk"] },
  };
  assert.notEqual(pickCardio(client, CATALOGUE, RULES)?.id, "stationary-bike");
  // senior com band-only: caminhada rápida passa
  assert.equal(pickCardio(seniorKneeBandsOnly, CATALOGUE, RULES)?.id, "brisk-walk");
});

test("cardio: cliente sênior (mobilidade) sem preferência não ganha cardio", () => {
  const p = generateProgram(seniorKneeBandsOnly);
  assert.equal(session(p).items.some((i) => i.block === "cardio"), false);
});
