# Repository Guidelines

## Project Structure & Module Organization
LingPet pairs a Vue 3 front end with a Tauri shell. Front-end views, stores, and services live in `src`; key folders include `components/main` for the pet UI, `pages` for routed screens, `stores`/`services` for state and APIs, and `assets` for bundled media. Ship-ready static files live in `public`. Native integrations reside in `src-tauri/src` with `tauri.conf.json` and Cargo manifests. Keep Live2D helper scripts under `scripts/` and longer-form notes in `docs/`.

## Build, Test, and Development Commands
- `pnpm install` – sync JavaScript dependencies.
- `pnpm dev` – run the Vite dev server for web debugging.
- `pnpm tauri dev` – launch the desktop shell; primary smoke test.
- `pnpm build` – type-check (`vue-tsc`) and build the SPA bundle.
- `pnpm tauri build` – create production desktop artifacts.
- `pnpm preview` – serve the most recent web build.
- `cargo fmt` / `cargo clippy` – format and lint Rust code when touching `src-tauri`.

## Coding Style & Naming Conventions
Use `<script setup lang="ts">` with two-space indentation, single quotes, and the existing no-semicolon style. Name Vue components and Pinia stores in PascalCase (`Live2DAvatar.vue`, `usePetStateStore`). Prefix composables with `use` under `src/composables`, and keep cross-feature constants in `src/constants`. Rust modules should follow `rustfmt` defaults and stay organized by capability inside `src-tauri/src`.

## Testing Guidelines
Automated tests are not yet in place, so every change must run `pnpm build` and `pnpm tauri dev` without errors. When adding coverage, prefer Vitest specs colocated as `*.spec.ts` alongside the feature and exercise Pinia stores through integration-style tests. Rust additions should include module-level unit tests gated by `cargo test`.

## Commit & Pull Request Guidelines
History favors a `type: summary` prefix (`fix: 调整live2d偏移`, `feature: live2d`). Keep commits focused and under one concern. Pull requests should describe user-visible impact, reference issues, and attach screenshots or short clips for UI tweaks. Call out config or migration steps so reviewers can reproduce outcomes.

## Configuration & Secrets
Persist API keys through the in-app settings (Tauri store) rather than source control. Document any new environment variables in `README.md` and supply safe defaults in example files. Review `tauri.conf.json` before enabling additional capabilities to keep packaged permissions minimal.
