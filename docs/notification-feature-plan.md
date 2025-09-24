# Notification Feature Plan (macOS)

## Objective
Implement a LingPet desktop notification banner that appears in the top-right corner on macOS using `NSPanel`, providing a foundation for future cross-platform notifications.

## Constraints & References
- Platform focus: macOS first; design must allow future extension to Windows/Linux.
- Follow existing Vue 3 + Tauri architecture, stylistic conventions, and build/test guidelines.
- Ensure `pnpm build` and `pnpm tauri dev` continue to succeed after changes.

## Work Breakdown

### 1. Discover & Align
- Review current `components/main`, `stores`, `services`, and any notification-related logic to avoid duplication.
- Audit `src-tauri/src` for existing window or native helper patterns we can extend (e.g., custom windows, commands, or plugins).
- Confirm UX requirements with stakeholders (banner size, dismissal behavior, animation, trigger sources, timeout defaults).

### 2. Design Notification Flow
- Define a shared notification payload (title, message, optional icon, duration) and document it in `docs/` for front-end/back-end alignment.
- Outline the front-end state flow: triggering notifications via a Pinia store or composable, rendering the banner component, and handling lifecycle events.
- Plan the Tauri bridge: decide between invoking commands vs. emitting events, and map out how macOS-specific native code is gated.

### 3. Implement Front-End Scaffold
- Create a `NotificationBanner.vue` component under `src/components/main` with placeholder styling matching LingPet aesthetics.
- Add a Pinia store (e.g., `useNotificationStore.ts`) to manage notification queueing, deduping, and dismissal timing.
- Wire a basic trigger API (`src/services/notificationService.ts`) to centralize notification creation for future extensibility.

### 4. Build macOS NSPanel Integration
- Set up a dedicated Rust module under `src-tauri/src/notification/` to encapsulate NSPanel lifecycle management (create, show, update, hide).
- Implement Tauri command(s) or an event listener that accepts the shared payload and updates the NSPanel view accordingly.
- Ensure macOS-only compilation via `cfg(target_os = "macos")` guards and provide graceful fallbacks on other platforms.
- Handle focus rules, click-through behavior, and auto-dismiss timers consistent with the UX spec.

### 5. Connect Front-End to Native Layer
- Update Tauri invocation logic (likely in `src/services/notificationService.ts`) to call the new command/event when running in desktop mode.
- For web-preview mode (`pnpm dev`), implement a mocked banner so feature work can be developed without native bindings.
- Synchronize styling assets and payload validation between Vue and Rust sides.

### 6. Validate & Polish
- Manually test via `pnpm tauri dev` on macOS: triggering notifications, auto-dismiss, multiple queued banners, error handling.
- Run `pnpm build` to ensure the front-end build passes; run `cargo fmt` and `cargo clippy` if Rust code was touched.
- Capture screenshots or a short clip of the banner for documentation and PR requirements.

### 7. Documentation & Follow-Ups
- Document the notification payload schema and usage in the project docs (e.g., `docs/notification.md`).
- Note any new configuration or permissions changes in `README.md` and confirm `tauri.conf.json` reflects minimal capabilities.
- Identify next steps for cross-platform support (e.g., Windows toast integration, Linux alternatives) and backlog them.

## Risks & Mitigations
- **NSPanel behavior differences:** Prototype early to verify window level and animation; consult Apple HIG for compliance.
- **Event queue complexity:** Keep queue logic simple initially (single active banner) to reduce race conditions.
- **Cross-platform divergence:** Encapsulate macOS code so other platforms can adopt different implementations without breaking API contracts.

## Exit Criteria
- Desktop banner displays via NSPanel on macOS with basic show/hide cycle and matches agreed UX.
- Front-end fallback works in browser-only dev mode.
- Build and lint commands complete without errors.
- Documentation updated and demo assets captured for reviewers.
