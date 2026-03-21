# Component Structure

Use this structure consistently:

- `components/layout`: global layout/navigation components used across many pages.
- `components/ui`: small reusable UI primitives and effects.
- `components/pages`: large page-level composition components.
- `components/courses`: domain-specific reusable components for course screens.

Rules:

- Route files stay in `src/app/**/page.js(x)`.
- Prefer alias imports (`@/components/...`) over deep relative paths.
- If a component is only used by one route, prefer `src/app/<route>/_components`.
