# Engineering Configuration Iteration Plan

**Goal:** Make the repository ready for frontend CI, local Supabase setup, and a future GitHub Pages release without adding secrets or changing business design.

**Scope:** `.github/**`, `.env.example`, `README.md`, and deployment/environment/verification documentation under `docs/`. Existing design and implementation plans remain unchanged.

## Tasks

- [x] Add GitHub Actions verification workflow with dependency installation, typecheck, unit test, build, and manual Pages deployment input.
- [x] Add public environment-variable template and document secret boundaries.
- [x] Document local Supabase startup, migrations, functions, and environment setup.
- [x] Document GitHub Pages configuration and the current no-frontend-package behavior.
- [x] Run YAML/file/shell validation appropriate to the current repository state.
