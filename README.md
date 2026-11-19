# multi-trainer-workout-engine

The MultiTrainer workout engine: a pure, deterministic TypeScript rules engine that
drafts a 4-6 week training block from a client model (goal, status, benchmarks,
injuries, preferences, environment). No React, no Dexie; it can move into the app
(`~/multitrainer/src/engine/`) or to a server unchanged.

- `generateProgram(inputs)` -> `Program` (six-step pipeline, trainer review last)
- `progress(program, history)` -> `Change[]` (diff proposal, never mutates)

Every output carries a machine-readable `reason` (stable id + params) so the app
can render a one-line, tappable explanation.

## Run

    npm test        # node --test (Node 22+ runs .ts natively)

Safety gates: PAR-Q+ "yes", acute injuries, severity-3 conditions and BP over
threshold block generation until the trainer records clearance. The engine never
decides an injured client is safe to train.
