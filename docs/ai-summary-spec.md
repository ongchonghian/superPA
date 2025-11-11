# AI-Generated Project Summaries & Status Reports

Authoritative, implementation-ready specification for the “AI-Generated Project Summaries & Status Reports” feature.

This document merges:
- The finalized UI/UX specification.
- The authoritative technical specification.

It is the single source of truth for product, design, engineering, and QA. All implementations must follow this spec.

---

## 0. Overview

Goal:
Provide a one-click, AI-generated, exportable project status report targeted at senior stakeholders.

The feature:
- Synthesizes:
  - Progress across tasks and checklists
  - Key accomplishments
  - Risks, blockers, ownership, and timelines
- Produces:
  - A concise, structured, exec-ready summary as Markdown
  - Exportable via copy and download
- Behaves as:
  - A new durable export asset:
    - `ReportType: "AI_SUMMARY"`
    - Viewable in `ReportViewerDialog`
    - Initiated from `More actions` → `Export`
- UX:
  - Non-blocking generation
  - Communicated via toasts
  - Viewable via a dialog using existing patterns

Tech stack assumptions:
- Next.js App Router
- Tailwind CSS
- shadcn/ui primitives
- Firebase (Firestore/Auth)
- Genkit-based AI flows

---

## 1. UI/UX Specification

### 1.1 Entry Point & Menu Hierarchy

Location:
- Header/toolbar overflow:
  - “More actions” (…) trigger (existing).
- Under:
  - `More actions` → `Export` → `Generate AI Summary…`

Behavior:
- New menu item:
  - Label: `Generate AI Summary…`
  - Appearance:
    - Standard dropdown item (same typography, spacing, hover/focus as others).
    - No special primary styling.
  - Optional icon:
    - Subtle AI/sparkle or document icon (16px, neutral color).
    - Must not visually dominate other export options.

States:
- Enabled when:
  - User is authenticated.
  - User has export/report permission for current project.
  - Project context is loaded.
  - No AI summary generation currently in progress for this project.
- Disabled when:
  - Offline detected.
  - No permissions.
  - Project not initialized.
  - Generation in-flight for this project.

Tooltip (when disabled):
- In-flight: “Summary is being generated.”
- Offline: “Connect to the internet to generate an AI summary.”
- Permission: “You don’t have access to generate summaries.”

Click (enabled):
- Close menu immediately.
- Trigger generation API call.
- Set in-progress state for this project.
- Show “Generating AI summary…” toast.
- Disable “Generate AI Summary…” for this project while in-flight.

Click (while in-flight):
- Menu item disabled.
- Optional: show info toast “AI summary is already being generated…” if user attempts.

Offline:
- Either pre-disabled or:
  - On click: show destructive toast “You’re offline. Reconnect to generate an AI summary.”
  - Do not call API.

---

### 2. Toasts

Use existing toast system and tokens.

#### 2.1 Generating Toast

Trigger:
- On successful initiation of generation (API call started and not rejected).

Spec:
- Variant: default.
- Title: `Generating AI summary…`
- Description: `You can continue working. We’ll notify you when it’s ready.`
- Optional subtle spinner icon.
- Non-blocking.

Behavior:
- Manual dismiss:
  - Hides toast only; does NOT cancel generation.
- On success:
  - Dismiss or update this toast.
  - Show Ready toast.
- On error:
  - Dismiss this toast.
  - Show Error toast.

#### 2.2 Ready Toast

Trigger:
- When `/api/ai-summary` returns 200 with a persisted report.

Spec:
- Variant: default.
- Title: `AI summary ready`
- Description: `View the summary for [Project Name].`
- Primary action button:
  - Label: `Open`
  - Behavior:
    - Opens `ReportViewerDialog` displaying the AI summary.
    - Closes toast.
- Optional:
  - Clicking toast body (non-close regions) may also open the dialog if consistent with existing patterns.

Behavior:
- Non-blocking.
- Auto-dismiss based on existing timeout.
- If dismissed:
  - Report remains in storage.
  - User may regenerate later or access via history (when implemented).
  - Dismissal does not delete or invalidate the report.

#### 2.3 Error Toast

Trigger:
- API/network/AI failure.

Spec:
- Variant: destructive.
- Base title: `AI summary failed`
- Description mapped from error code:
  - PERMISSION_DENIED: “You do not have permission to generate reports for this project.”
  - PROJECT_NOT_FOUND: “Project not found or unavailable.”
  - AI_TIMEOUT / AI_FAILURE: “AI service failed to generate a summary. Please try again.”
  - OFFLINE/NETWORK: “Failed to generate AI summary. Check your connection and try again.”

Behavior:
- Re-enable “Generate AI Summary…” for this project.

#### 2.4 Concurrency

- Only one in-flight generation per project:
  - Enforced by:
    - Disabled menu item in UI.
    - Idempotency on backend (see technical spec).

---

### 3. ReportViewerDialog (AI Summary Mode)

Reuses `ReportViewerDialog` with AI summary-specific configuration.

#### 3.1 Open Conditions

- Open when:
  - User clicks `Open` in the Ready toast.
  - (Future) From a reports/history screen.

#### 3.2 Header & Metadata

When used for AI Summary:

- Title:
  - `AI Project Summary`
- Subheader:
  - `Overview of current status for [Project Name] as of [Generated Time].`
- Metadata row (muted, compact):
  - `Project: [Project Name]`
  - `Generated: [Day, DD Mon YYYY, HH:MM TZ]`
  - `Scope: [Derived from filters at generation time]`
  - `Data snapshot: Tasks and statuses as of last sync.`

Implementation:
- Either:
  - Make `ReportViewerDialog` type-aware (accept Report object).
  - Or:
  - Construct this metadata in the caller using returned report metadata.

#### 3.3 Actions

Top-right of dialog:

- Download button:
  - Tooltip: `Download summary (.md)`
  - Exports `contentMarkdown` as:
    - `AI-Summary_[ProjectName]_[YYYY-MM-DD].md`
- Copy button:
  - Tooltip: `Copy summary`
  - Copies full `contentMarkdown`.
  - On success: toast `Copied to clipboard`.
  - On failure: destructive toast per existing pattern.

No additional controls:
- No “Regenerate” or “Refine” inside dialog.
- Regeneration only via `More actions` → `Export` → `Generate AI Summary…`.

#### 3.4 Content Layout Guidelines

Content (rendered from AI output as Markdown) must follow:

Sections (in order):
1. `# AI Project Summary – [Project Name]`
2. `## Executive Overview`
3. `## Overall Status`
4. `## Key Achievements Since Last Update`
5. `## Upcoming Milestones`
6. `## Risks & Issues`
7. `## Decisions & Dependencies`
8. `## Next Steps & Asks`

Formatting:
- Use Markdown headings.
- Primary use of bullet lists (no deep nesting).
- No walls of text.
- Highly scannable.

---

### 4. Discoverability

#### 4.1 “New” Badge

- Applies to “Generate AI Summary…” menu item.

Spec:
- Small “New” pill using existing badge styles.
- Right-aligned in that row.
- Behavior:
  - Per user:
    - Show for the first N (recommended: 3) menu opens when feature is available.
    - Stop showing once:
      - The user successfully triggers “Generate AI Summary…” at least once, or
      - N opens are reached.

#### 4.2 Tooltip

- On hover:
  - `Create an exec-ready status summary with one click.`
- No banners or primary CTAs.

---

### 5. Interaction, Loading, Navigation

- On click:
  - Menu closes.
  - Within ~300ms, Generating toast appears.
- App remains fully interactive:
  - Only this project’s “Generate AI Summary…” is disabled while in-flight.
- Navigation away/refresh:
  - No blocking UX.
  - Summary generation (if still running) is handled by server constraints.
  - Toasts are not required to persist across reloads in v1.
  - Generated reports are durable and can be surfaced later via history (future feature).

---

## 6. Technical Specification

### 6.1 End-to-End Flow

1. User clicks:
   - “More actions” → “Export” → “Generate AI Summary…”.
2. Client:
   - Validates online + permissions (if available client-side).
   - Sends `POST /api/ai-summary` with:
     - `projectId`
     - `filter` object (matching current UI filters)
     - `filterSignature` (stable, sorted JSON string)
     - optional `idempotencyKey`
   - Sets in-progress state for `projectId`.
   - Shows Generating toast.
3. Server (`/api/ai-summary`):
   - AuthN: validate user.
   - AuthZ: ensure user can view/export this project.
   - Idempotency:
     - Compute `jobKey = hash(projectId + filterSignature)`.
     - If recent report exists for same jobKey:
       - Return existing with `reusedExisting: true`.
   - Load project data from Firestore.
   - Apply filters and normalize.
   - Run Genkit flow (`ai-project-summary`) to generate structured Markdown.
   - Compute metadata:
     - wordCount, sectionsPresent, sourceStats, overallStatus, etc.
   - Persist Report (type: `AI_SUMMARY`) in Firestore.
   - Respond 200 with report and `reusedExisting` flag.
4. Client (success):
   - Clears in-progress flag.
   - Shows Ready toast with `Open`.
   - `Open`:
     - Opens `ReportViewerDialog` with report content + metadata.
5. Client (error):
   - Clears in-progress.
   - Re-enables menu.
   - Shows mapped Error toast.

Synchronous-but-non-blocking:
- The request blocks client only at the network level; UI remains usable.
- If environment constraints make long requests problematic, use configured timeouts (below).

---

### 6.2 Data Model

Introduce a shared `Report` model.

In types:

- `ReportType = 'AI_SUMMARY' | ...`
- `Report`:
  - `id: string`
  - `projectId: string`
  - `type: ReportType`
  - `title: string`
  - `createdAt: string` (ISO)
  - `createdBy: string` (user id)
  - `contentMarkdown: string`
  - `metadata`:
    - `filterSignature: string`
    - `overallStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN'`
    - `wordCount: number`
    - `sectionsPresent: { overview: boolean; timeline: boolean; milestones: boolean; risks: boolean; blockers: boolean; nextSteps: boolean }`
    - `sourceStats: { taskCount: number; openTaskCount: number; completedTaskCount: number; milestoneCount: number; remarkCount: number; timeWindowDays: number | null }`
    - `sourceSnapshotRange?: { from: string | null; to: string | null }`
    - `generationConfig: { model: string; maxInputTokens?: number; maxOutputTokens?: number }`

Stored in Firestore:
- Collection (e.g.): `reports`
- Indexed by `projectId` and `type` for future queries.

---

### 6.3 Data Sources & Scope

Data sources:
- Project / Checklist:
  - id, name, owners, collaborators.
- Tasks:
  - status, assignee, dueDate, tags, timestamps.
- Remarks / notes:
  - From remark utilities and task comments.
- Milestones:
  - Native model or derived semantics.
- Risks / blockers:
  - From status enums and pattern matching on remarks.

Scope:
- Always per single `projectId`.
- Use filter snapshot at time of generation:
  - Filters:
    - statuses, assignees, tags, date range, etc.
  - `filterSignature`:
    - Stable JSON string representation.
  - Persisted in `Report.metadata`.

Snapshot semantics:
- Based on data at time of generation.
- Future changes do not mutate existing reports.

---

### 6.4 API: /api/ai-summary

Method:
- `POST`

Body:
- `projectId: string`
- `filter: { statuses?: string[]; assignees?: string[]; tags?: string[]; fromDate?: string; toDate?: string }`
- `filterSignature: string`
- `idempotencyKey?: string`
- `force?: boolean` (optional, future override of reuse)

Success (200):
- `{ "report": Report, "reusedExisting": boolean }`

Errors:
- 400 INVALID_REQUEST
- 401 UNAUTHENTICATED
- 403 PERMISSION_DENIED
- 404 PROJECT_NOT_FOUND
- 409 IN_FLIGHT (if implemented for true in-flight detection)
- 429 RATE_LIMITED
- 500 INTERNAL
- 502/504 AI_TIMEOUT / AI_FAILURE

Error payload:
- `{ "error": { "code": string, "message": string, "retryable": boolean } }`

Idempotency:
- Use `hash(projectId + filterSignature)`:
  - If a recent AI_SUMMARY report exists for this key:
    - Return it (`reusedExisting = true`).
- Guards against duplicate runs for rapid repeated clicks.

---

### 6.5 AI Orchestration & Prompting

Flow (`ai-project-summary`):

1. Load project and filtered data.
2. Aggregate:
   - Status distributions, completion %, overdue items.
   - Notable remarks.
   - Risks/blockers signals.
3. For large datasets:
   - Hierarchical summarization:
     - Summarize groups (e.g., Completed, In Progress, Blocked, per milestone).
     - Feed those summaries into final prompt.

Prompt rules (high level):

- System:
  - Executive-level status generator.
  - Use only provided data.
  - No hallucinations.

- Output:
  - Valid Markdown.
  - Required sections and ordering as defined in UI section.
  - One Overall Status:
    - Exactly one of: On Track / At Risk / Off Track / Unknown.
  - Tone:
    - Concise, neutral-professional, outcome-focused.
  - Structure:
    - 300–700 words total.
    - 3–7 bullets per major section.
    - No deep nesting.

- Constraints:
  - If data missing:
    - Use honest statements (e.g., “No critical risks identified based on current data.”).
  - If conflicting:
    - Prefer latest timestamps.
    - If unresolved, explicitly call it out.

Timeouts:
- AI call max: ~25–30s.
- On timeout or AI failure:
  - No partial report persisted.
  - Return error with `AI_TIMEOUT` or `AI_FAILURE`, `retryable: true`.

---

### 6.6 Client Behavior & State

- Tracks “in-progress” per `projectId`:
  - Disables menu item.
  - Controls Generating toast.
- On success:
  - Clears in-progress.
  - Shows Ready toast.
  - On Open:
    - Opens dialog with report content.
- On any error:
  - Clears in-progress.
  - Re-enables menu.
  - Shows error toast.

Multiple clicks:
- Prevented by:
  - in-progress flag on client.
  - idempotency on server.

---

### 6.7 Error Handling & Edge Cases

- Insufficient data:
  - Generate short, honest summary.
  - “Unknown” status allowed.
  - Return 200 with valid report.
- Conflicting or stale statuses:
  - Prefer latest updates.
  - Explicitly mention inconsistencies.
- Very large projects:
  - Apply chunking and recent-history focus.
  - Document effective time window in metadata.
- Offline:
  - Pre-empt or handle with dedicated offline toast.
  - No API call made.
- AI timeout/partial:
  - No partial persistence.
  - Error toast; user can retry.
- Security errors:
  - 401/403/404 mapped cleanly to user-visible messages.
  - Do not leak unauthorized project existence.

---

### 6.8 Security, Privacy, Compliance

- Only users with:
  - Read access + export/report privileges can generate.
- Reuse existing AI environment:
  - Data residency and compliance same as other AI features.
- Exclude sensitive/PII fields as done in other AI flows.
- Audit log:
  - userId
  - projectId
  - timestamp
  - filterSignature
  - outcome
  - errorCode (if any)
  - reportId (on success)
- Do not log full prompts or full report bodies outside the reports collection.

---

### 6.9 Telemetry & Observability

Client events:
- `ai_summary_click`
- `ai_summary_success` (projectId, reportId, reusedExisting, latencyMs)
- `ai_summary_failure` (projectId, errorCode, retryable)

Server events:
- `ai_summary_started`
- `ai_summary_completed` (durationMs, tokenUsage where available)
- `ai_summary_ai_error`

Use report metadata for:
- Adoption analytics.
- Reliability and latency metrics segmented by project size.

---

### 6.10 Integration & Exportable Asset Model

- `ReportType = "AI_SUMMARY"` is treated as:
  - A first-class exportable/report type.
- `ReportViewerDialog`:
  - Short-term:
    - Accept inline props for content and metadata from API.
  - Long-term:
    - Accept full `Report` object and adjust header text based on `report.type`.
- Firestore storage:
  - Enables future:
    - “Reports/Exports” history views.
    - Sharing links and auditability, without schema changes.

---

## 7. Acceptance Criteria (Summary)

- Correct menu placement and label.
- Non-blocking generation flow with proper toast lifecycle.
- Dialog opens with correct AI summary content and metadata.
- Copy and Download actions function using the AI summary.
- Only authorized users can generate.
- Idempotency prevents duplicates on rapid interactions.
- Clear, specific error handling for offline, permission, AI timeout, and other failures.
- AI output:
  - Uses required structure, tone, and constraints.
  - Does not fabricate unsupported details.
- Implementation aligns with this document as the authoritative reference.