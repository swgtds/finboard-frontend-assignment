# FinBoard (FRONT-END ASSIGNMENT)

A customizable personal finance dashboard built with Next.js, TypeScript, Tailwind CSS, and modern React tooling. Compose dashboards from drag-and-drop widgets (cards, charts, tables), use configurable templates, and connect widgets to API-backed data for live financial metrics.

## Features

- **Widget-based dashboard** – Cards, charts, and tables to visualize financial data.
- **Templates system** – Predefined templates in `src/lib/templates.ts` to quickly spin up dashboards.

- **Modern UI** – Tailwind CSS, Radix UI primitives, and theming support.
- **Light/dark theme** – Theme toggle with `next-themes`.
- **API proxy route** – `src/app/api/proxy/route.ts` for securely calling external APIs from the server.
- **Drag-and-drop layout** – Reorder and resize widgets using `@dnd-kit`.
- **State management** – Dashboard state stored with Zustand (`src/store/dashboardStore.ts`).

## Tech Stack

- **Framework**: Next.js (App Router, React, TypeScript)
- **Styling**: Tailwind CSS, CSS modules (`globals.css`)
- **UI**: Radix UI + custom components in `src/components/ui`
- **State**: Zustand + Immer
- **Charts**: `chart.js`, `react-chartjs-2`
- **Forms & Validation**: `react-hook-form`, `zod`, `@hookform/resolvers`

## Getting Started

### Prerequisites

- **Node.js** 18+ installed on your machine (which also provides **npm**)

### Clone & Install

Clone the repository and move into the project directory:

```bash
git clone https://github.com/swgtds/finboard-frontend-assignment.git
cd finboard-frontend-assignment
```

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.


## Project Structure

Key paths only:

- `src/app/layout.tsx` – Root layout, fonts, global providers, and `<Toaster />`.
- `src/app/page.tsx` – Home page; renders the `Header` and `Dashboard`.
- `src/app/globals.css` – Global styles and Tailwind setup.
- `src/app/api/proxy/route.ts` – API proxy route for external API requests.
- `src/components/Dashboard.tsx` – Main dashboard container and layout logic.
- `src/components/widgets/` – Individual widget implementations (card, chart, table, etc.).
- `src/components/layout/Header.tsx` – Top navigation and actions.
- `src/components/layout/ThemeToggle.tsx` – Light/dark mode switch.
- `src/components/WidgetBuilderModal.tsx` – UI to configure/add widgets.
- `src/components/TemplatesSidebar.tsx` – Sidebar showing available templates.
- `src/lib/templates.ts` – Template definitions for dashboard layouts and widgets.
- `src/lib/types.ts` – Shared TypeScript types for widgets, templates, etc.
- `src/lib/utils.ts` – Utility helpers (class merging, formatting, etc.).
- `src/store/dashboardStore.ts` – Zustand store to manage dashboard state.
- `src/hooks/use-hydration.ts` – Client-side hydration hook to avoid mismatches.
- `src/hooks/use-mobile.tsx` – Helpers for responsive behavior.

## Usage Overview

1. **Start the dev server** with `npm run dev`.
2. **Open the dashboard** at http://localhost:3000.
3. Use the **template sidebar** and **widget builder** to add or modify widgets.
4. Drag-and-drop widgets to rearrange the layout.
5. Use the **theme toggle** in the header to switch between light and dark modes.

## APIs

If the app consumes external APIs (for example, stock data or financial metrics), you can:

- Use the proxy route at `src/app/api/proxy/route.ts` to call third-party APIs from the server.

## License

This project is provided as an assignment and is released under [MIT License](LICENSE).

