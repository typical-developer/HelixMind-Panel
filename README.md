# HelixMind Panel

A browser-based genomic analysis bench: FASTA parsing and variant calling,
generational mutation dynamics, population growth under environmental stress,
and rule-based antimicrobial-resistance prediction.

> Every analysis runs in your browser. Sequences are never uploaded; results and
> history are stored locally. Only sign-in talks to a server.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — only to point at a different API
npm run dev
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest over `lib/` |
| `npm run test:watch` | Vitest in watch mode |

## Documentation

| | |
|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | Every region, shortcut and analysis |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it is built, and why |
| [docs/BUG-REPORT.md](docs/BUG-REPORT.md) | What was found and fixed, and what is still open |
| [docs/SUGGESTIONS.md](docs/SUGGESTIONS.md) | Prioritised roadmap |

## Known limitations

Also listed in-app under **Help → About**:

- A run ends when you leave the analysis that started it.
- The Growth Lab strain selector is displayed but does not yet drive the model.
- The Mutation Simulator records pH, nutrients and oxygen but does not use them.
- The Resistance Predictor organism flags unexpected markers but does not change
  the score.
- Password reset is not implemented — contact support.

See [docs/BUG-REPORT.md](docs/BUG-REPORT.md) for detail on each.
