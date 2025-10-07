diff --git a//dev/null b/docs/ARCHITECTURE.md
index 0000000000000000000000000000000000000000..fc4cad7c6e1ccb8c62bea1dc9262d09ccd2eb47e 100644
--- a//dev/null
+++ b/docs/ARCHITECTURE.md
@@ -0,0 +1,110 @@
+# Resource Booking Frontend Overview
+
+This document explains the structure of the Resource Booking frontend so new contributors can get productive quickly.
+
+## Project at a Glance
+
+- **Framework**: [React](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
+- **Build tool**: [Vite](https://vitejs.dev/)
+- **Styling**: [Tailwind CSS](https://tailwindcss.com/) utility classes with a small set of headless UI primitives in `src/components/ui`
+- **Routing**: [React Router](https://reactrouter.com/) via `createBrowserRouter`
+- **Animations & Icons**: [`framer-motion`](https://www.framer.com/motion/) and [`lucide-react`](https://lucide.dev/)
+- **Notifications**: [`sonner`](https://sonner.emilkowal.ski/) toast component
+
+Run the app with `npm install` followed by `npm run dev`. The Vite dev server starts on port `5173` by default.
+
+## Directory Structure
+
+```
+src/
+├── App.tsx          # Public booking experience
+├── App.css & index.css
+├── Pages/           # Top-level route components
+│   └── admin/
+│       ├── AdminGate.tsx      # Role selection gate
+│       └── AdminResources.tsx # Staff resource management UI
+├── components/ui/   # Reusable presentational primitives (buttons, cards, dialogs…)
+├── lib/
+│   ├── api.ts       # REST client + domain types
+│   └── utils.ts     # Shared helpers (e.g., className combiner)
+├── main.tsx         # App entry, router, global providers
+└── vite-env.d.ts    # Vite TypeScript declarations
+```
+
+Other notable files:
+
+- `public/` holds static assets served as-is by Vite.
+- `vite.config.ts` configures Vite (aliases `@` to `src`).
+- `tsconfig.*.json` provide TypeScript project configuration.
+- `eslint.config.js` defines lint rules.
+
+## Application Flow
+
+### Entry point & routing
+
+`src/main.tsx` mounts React, wires up routes, and initializes global UI providers such as the toast system. It creates three routes:
+
+1. `/` → `App.tsx`, the public booking dashboard.
+2. `/admin` → `AdminGate.tsx`, a lightweight role selector for demo/testing.
+3. `/admin/resources` → `AdminResources.tsx`, the staff-facing resource management screen.
+
+### Public booking experience (`App.tsx`)
+
+`App.tsx` is the main dashboard new visitors see. It loads resources and existing bookings from the backend via the API client. Major responsibilities:
+
+- Fetch vehicles, facilities, equipment, and bookings on mount.
+- Provide a search box and tabbed view to filter resources by type.
+- Launch a booking drawer (`Sheet` component) with pre-filled resource details.
+- Perform optimistic client-side conflict checks before submitting bookings.
+- Call API helpers to create bookings and mutate status transitions (start, finish, cancel).
+- Display booking timelines, quick stats, and resource cards with status badges.
+
+This component is state-heavy; it uses `useState`, `useEffect`, and `useMemo` extensively. The UI leverages primitives from `src/components/ui` to keep styling consistent.
+
+### Admin experience
+
+- `AdminGate.tsx` stores the selected role in `sessionStorage` so API calls can include an `x-demo-role` header. Only `ADMIN` and `STAFF` roles can access the resource manager.
+- `AdminResources.tsx` reads the stored role, redirects unauthorized visitors back to the gate, and displays a CRUD table for resources. It depends on helper functions from `lib/api.ts` to list, update, soft delete, and create resources.
+- Subcomponents inside `AdminResources.tsx` (e.g., `Table`, `Row`, `Empty`) encapsulate UI for listings, editing, and maintenance toggling.
+
+### API client (`src/lib/api.ts`)
+
+This module centralizes HTTP calls and TypeScript types for resources and bookings. Highlights:
+
+- `BASE` picks up `VITE_API_BASE` from env variables or defaults to `http://localhost:5174`.
+- `http()` wraps `fetch` with JSON parsing, error handling, and 204 support.
+- `adminHeaders()` reads the stored demo role and adds it as `x-demo-role` for privileged endpoints.
+- Exposes functions like `listResources`, `createResource`, `updateResource`, and booking lifecycle helpers. Aliases (`api.resources`, `api.bookings`, etc.) exist for backward compatibility.
+
+Understanding this file is crucial before touching data fetching logic.
+
+### UI primitives (`src/components/ui`)
+
+The `ui` folder provides reusable, style-ready components (buttons, cards, dialogs, tabs, etc.). They are thin wrappers around Radix UI or custom markup styled with Tailwind. Reuse these components instead of rolling your own to keep the look-and-feel consistent.
+
+## Working with the Codebase
+
+### Environment & API
+
+- The frontend expects a backend that exposes REST endpoints under `/api`. Until you have the real server, you can mock responses by intercepting `fetch` or using tools like [MSW](https://mswjs.io/).
+- Configure the API base URL with `VITE_API_BASE` in a `.env` file if the backend runs elsewhere.
+
+### Styling patterns
+
+- Tailwind classes drive layout and visual styling. Use the `cn()` helper (`lib/utils.ts`) to merge class names when they depend on state.
+- Animations rely on `framer-motion`. Check existing uses before adding new animation primitives for consistency.
+
+### State management
+
+- The app currently uses React state and effects only; no external state library. Keep asynchronous data logic localized or consider extracting custom hooks if screens grow.
+
+## Suggested Next Steps for New Contributors
+
+1. **Run the app locally** to familiarize yourself with the public and admin flows.
+2. **Inspect `lib/api.ts`** to understand available backend endpoints and data structures.
+3. **Explore UI primitives** so you can build new screens quickly.
+4. **Add type-safe wrappers** or React Query/SWR if you plan to enhance data fetching with caching and pagination.
+5. **Write integration tests** (e.g., with `Vitest` + `Testing Library`)—the project currently lacks automated tests.
+6. **Document backend expectations** if the API surface changes; keep `api.ts` and accompanying docs updated.
+
+By grasping the entry points, API helpers, and reusable components, you can add new features—like booking approvals, calendar views, or analytics dashboards—without reinventing foundational pieces.
