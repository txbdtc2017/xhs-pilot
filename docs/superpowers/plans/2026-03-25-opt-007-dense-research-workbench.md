# OPT-007 Dense Research Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the frontend shell and core pages around the OPT-007 high-density research workbench direction without changing existing routes, APIs, or SSE behavior.

**Architecture:** Keep the current App Router page boundaries and data-loading model intact, but replace the visual shell, layout hierarchy, and page structures with a topbar-led, information-dense workbench. Reuse existing page files and tests where possible, introducing only small presentational helpers and CSS primitives needed to express the new interaction model.

**Tech Stack:** Next.js 16 App Router, React 19, CSS modules for `/create`, global CSS tokens for shared shell/pages, Node test runner, ESLint.

---

### Task 1: Rebuild the Global Workbench Shell

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/navigation.tsx`
- Modify: `src/components/navigation.test.ts`
- Modify: `src/app/layout.test.ts`
- Modify: `src/styles/variables.css`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write the failing shell tests**

Add assertions for:
- topbar-led navigation content
- persistent primary actions
- workbench wording replacing side-nav wording

- [ ] **Step 2: Run shell tests to verify they fail**

Run: `npm test -- src/components/navigation.test.ts src/app/layout.test.ts`
Expected: FAIL because current navigation still renders the previous side-led shell.

- [ ] **Step 3: Implement the shell redesign**

Update shared layout and navigation to:
- render a compact top workbench bar
- keep page content inside a denser main frame
- preserve route links and mobile toggle behavior
- refresh global tokens, spacing, borders, and panel primitives

- [ ] **Step 4: Run shell tests to verify they pass**

Run: `npm test -- src/components/navigation.test.ts src/app/layout.test.ts`
Expected: PASS

### Task 2: Redesign Dashboard and Samples into Dense Research Surfaces

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.ts`
- Modify: `src/app/samples/page.tsx`
- Modify: `src/app/samples/page.test.ts`
- Modify: `src/components/sample-ingest-drawer.tsx`
- Modify: `src/components/sample-ingest-drawer.test.ts`
- Modify: `src/components/sample-trash-actions.tsx` (if layout hooks are needed only)

- [ ] **Step 1: Write the failing page tests**

Add/adjust assertions for:
- dashboard “asset command” copy and tighter section structure
- samples page archive-table / dossier-workbench copy
- visible ingest action placement in the new workbench layout

- [ ] **Step 2: Run the dashboard and samples tests to verify they fail**

Run: `npm test -- src/app/page.test.ts src/app/samples/page.test.ts src/components/sample-ingest-drawer.test.ts`
Expected: FAIL because current page content and structure still reflect OPT-006.

- [ ] **Step 3: Implement the dashboard and samples redesign**

Update both pages to:
- favor strip/list/table-like information density over large cards
- shorten hero treatment and move actions into compact headers
- support quick scan of status, references, and sample metadata
- keep sample ingest, pagination, trash view, and auto-refresh intact

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npm test -- src/app/page.test.ts src/app/samples/page.test.ts src/components/sample-ingest-drawer.test.ts`
Expected: PASS

### Task 3: Redesign Detail, Style, and Offline Pages Around Dossiers

**Files:**
- Modify: `src/app/samples/[id]/page.tsx`
- Modify: `src/app/samples/[id]/page.test.ts`
- Modify: `src/app/styles/page.tsx`
- Modify: `src/app/styles/page.test.ts`
- Modify: `src/app/styles/[id]/page.tsx`
- Modify: `src/app/offline/page.tsx`
- Modify: `src/app/offline/page.test.ts`
- Modify: `src/components/style-profile-editor.tsx` (only if presentational integration is required)
- Modify: `src/components/sample-edit-form.tsx` (only if section affordances are needed)

- [ ] **Step 1: Write the failing dossier-page tests**

Add/adjust assertions for:
- sample detail section index / dossier framing
- style index and style dossier wording
- offline page being framed as part of the same workbench

- [ ] **Step 2: Run the dossier-page tests to verify they fail**

Run: `npm test -- src/app/samples/[id]/page.test.ts src/app/styles/page.test.ts src/app/offline/page.test.ts`
Expected: FAIL because current copy and layout do not match the new dossier/index structure.

- [ ] **Step 3: Implement the dossier/index redesign**

Update these pages to:
- use compact summaries and indexed sections
- emphasize referenceability, jumpability, and metadata scan
- keep all existing edit controls and routing intact

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npm test -- src/app/samples/[id]/page.test.ts src/app/styles/page.test.ts src/app/offline/page.test.ts`
Expected: PASS

### Task 4: Rebuild the Create Studio into Flow Rail + Draft Paper

**Files:**
- Modify: `src/app/create/page.tsx`
- Modify: `src/app/create/page.module.css`
- Modify: `src/app/create/copy.ts`
- Modify: `src/app/create/copy.test.ts`
- Modify: `src/app/create/history.test.ts` (only if visible labels change)
- Modify: `src/app/create/state.test.ts` (only if surfaced text assumptions change)

- [ ] **Step 1: Write the failing create-page tests**

Add/adjust assertions for:
- flow-rail wording replacing equal-weight three-column framing
- draft-paper/result panel wording
- history area naming staying discoverable under the new workbench language

- [ ] **Step 2: Run create-page tests to verify they fail**

Run: `npm test -- src/app/create/copy.test.ts src/app/create/history.test.ts src/app/create/state.test.ts`
Expected: FAIL where copy assumptions still match the old studio framing.

- [ ] **Step 3: Implement the create-page redesign**

Keep all stream/state logic intact while changing:
- header density
- task input framing
- process rail presentation for understanding/search/strategy/generation
- docked draft/result panel presentation
- history presentation consistency with the rest of the workbench

- [ ] **Step 4: Run the create-page tests to verify they pass**

Run: `npm test -- src/app/create/copy.test.ts src/app/create/history.test.ts src/app/create/state.test.ts`
Expected: PASS

### Task 5: Full Regression Verification

**Files:**
- Modify: `docs/optimizations/OPT-007-dense-research-workbench-redesign.md` (only if implementation reveals a boundary correction that must be documented)

- [ ] **Step 1: Run focused page tests after all UI changes**

Run: `npm test -- src/app/layout.test.ts src/components/navigation.test.ts src/app/page.test.ts src/app/samples/page.test.ts src/app/samples/[id]/page.test.ts src/app/styles/page.test.ts src/app/offline/page.test.ts src/app/create/copy.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: PASS
