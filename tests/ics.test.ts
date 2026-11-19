// On-device .ics builder (milestone 2): RFC 5545 basics, determinism, escaping.
import test from "node:test";
import assert from "node:assert/strict";
import { buildIcs } from "../src/engine/ics.ts";

test("one weekly event with alarm: full VCALENDAR structure", () => {
  const ics = buildIcs([
    { uid: "routine-ana-1", title: "Alongamento noturno — Ana", description: "3 alongamentos", start: "2026-11-19 21:00", durationMin: 10, weekdays: [1, 4], count: 12 },
  ]);
  const lines = ics.split("\r\n");
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.ok(lines.includes("BEGIN:VEVENT"));
  assert.ok(lines.includes("UID:routine-ana-1"));
  assert.ok(lines.includes("DTSTART:20261119T210000"));
  assert.ok(lines.includes("DTEND:20261119T211000"), "10 min duration");
  assert.ok(lines.some((l) => l.startsWith("SUMMARY:")));
  assert.ok(lines.some((l) => l.startsWith("RRULE:") && l.includes("BYDAY=MO,TH") && l.includes("COUNT=12")));
  assert.ok(lines.includes("BEGIN:VALARM"));
  assert.ok(lines.includes("TRIGGER:-PT10M"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("long lines are folded at 74 octets (unfold keeps the text)", () => {
  const long = ["Rotate suavemente", "x".repeat(80)].join(", ");
  const ics = buildIcs([{ uid: "u", title: long, start: "2026-11-19 21:00", durationMin: 10, weekdays: [2] }]);
  const raw = ics.split("\r\n");
  const descLines = raw.filter((l) => l.startsWith("DESCRIPTION:") || l.startsWith(" "));
  const text = descLines.map((l) => (l.startsWith(" ") ? l.slice(1) : l)).join("");
  assert.ok(text.includes("Rotate suavemente"));
  assert.ok(text.length > 74, "fold applied");
  for (const l of raw) assert.ok(l.length <= 75, `line too long: ${l.length}`);
});

test("escapes iCalendar special characters in text fields", () => {
  const ics = buildIcs([{ uid: "u2", title: "A;B,C\\D", start: "2026-11-19 21:00", durationMin: 5, weekdays: [0] }]);
  const summary = ics.split("\r\n").find((l) => l.startsWith("SUMMARY:"))!;
  assert.ok(summary.includes("A\\;B\\,C\\\\D"));
});

test("alarmMin 0 emits no VALARM; multiple weekdays de-duplicate", () => {
  const ics = buildIcs([{ uid: "u3", title: "T", start: "2026-11-19 21:00", durationMin: 5, weekdays: [1, 1, 3], alarmMin: 0 }]);
  assert.ok(!ics.includes("VALARM"));
  assert.ok(ics.includes("BYDAY=MO,WE"));
});

test("deterministic: same event, same bytes", () => {
  const ev = { uid: "u4", title: "Rotina", description: "linha 1\nlinha 2", start: "2026-12-01 22:00", durationMin: 15, weekdays: [5, 6] };
  assert.equal(buildIcs([ev]), buildIcs([ev]));
  const ics = buildIcs([ev]);
  assert.ok(ics.split("\r\n").some((l) => l.startsWith("DESCRIPTION:") && l.includes("linha 1\\nlinha 2")));
  assert.ok(ics.includes("BYDAY=FR,SA"));
});
