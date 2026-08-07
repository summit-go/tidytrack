# Context

This is the entry point for any agent working on TidyTrack. It points to where detail lives. Read the linked file before working in that area.

## Stack (brief)

React + Vite + Tailwind frontend, deployed on Vercel. **Supabase** is the backend — Postgres for data, Storage for photos/files, and Edge Functions for server-side logic.

## Where to look

- **What this project is / MVP scope** → `aiDocs/mvp.md`
- **Prior architecture & tech stack** → `aiDocs/old_architecture.md`
- **History of changes** → `aiDocs/changelog.md`
- **Deployment / hosting setup** → `README.md`
- **Agent operating rules** → `AGENTS.md`
- **Application code** → `src/`
- **App entry point / global styles** → `src/main.jsx`, `src/index.css`
- **Dependencies & scripts** → `package.json`
- **Build/tooling config** → `vite.config.js`, `tailwind.config.js`, `postcss.config.js`

There is no styleguide yet. If one is added later, link it here.

## Rules for agents

- Update `aiDocs/changelog.md` with every commit.
- Git operations are read-only for agents. Humans make commits — do not `git commit`, `git push`, or otherwise write to git history yourself.
