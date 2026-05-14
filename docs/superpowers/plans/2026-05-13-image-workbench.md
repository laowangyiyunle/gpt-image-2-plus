# Image Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current chat-first image generator into a workbench-first UI with a central result gallery and a fixed creation panel.

**Architecture:** Keep the existing API and persistence paths. Add a small pure helper for deriving gallery items from chat messages, then render those items in a new gallery component wired to existing preview, retry, refine, template, and download handlers.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS, Node assertion tests.

---

### Task 1: Gallery Data Helper

**Files:**
- Create: `lib/gallery-results.ts`
- Create: `tests/gallery-results.test.mjs`
- Modify: `package.json`

- [ ] Add a test that builds mixed user/assistant messages and asserts only successful generated images become gallery items.
- [ ] Run `node --no-warnings --experimental-strip-types tests/gallery-results.test.mjs` and confirm it fails because the helper does not exist.
- [ ] Implement `getImageResultGalleryItems(messages)` with `image`, `message`, `prompt`, and `createdAt`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Gallery Component

**Files:**
- Create: `components/chat/image-result-gallery.tsx`
- Modify: `components/chat/chat-shell.tsx`

- [ ] Render a center-column gallery above the generation record.
- [ ] Wire each gallery card to existing handlers for preview, retry, refine, and template toggle.
- [ ] Keep pending and failed states visible in `MessageList`.

### Task 3: Workbench Layout

**Files:**
- Modify: `components/chat/chat-composer.tsx`
- Modify: `components/history/session-sidebar.tsx`
- Modify: `app/globals.css`

- [ ] Rename visible copy from chat-first wording to workbench wording.
- [ ] Move composer styling from bottom bar to right-side creation panel.
- [ ] Style the middle gallery as a dense image workspace with a compact record area below it.

### Task 4: Verification

**Files:**
- Modify: `package.json`

- [ ] Run `npm run test:validations`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Inspect `git diff --stat` and summarize changed files.
