# AI Optimisation Report — ApparelFlow ERP

**Project:** ApparelFlow ERP — Production Batch Verification & Sewing Queue Gate  
**Repository:** https://github.com/pavani2118/ApparelFlow-ERP  
**Deployed application:** https://apparelflow-erp-puce.vercel.app  
**AI assistance:** ChatGPT (OpenAI)  
**Report version:** Submission review — 11 October 2026

## 1. Purpose and scope

AI assistance supported planning, code scaffolding, debugging, test design, documentation, and frontend iteration for this React/TypeScript, Express, Prisma, and Neon PostgreSQL application. AI suggestions were not treated as proof of correctness. The implementation was checked through compiler and schema validation, API security tests, browser-based workflow checks, and database-backed state transitions.

The engineering priority was **server-side enforcement** of the manufacturing checkpoint: a user must not bypass role restrictions or release a batch with short or uncounted components merely by manipulating the frontend or an API request.

## 2. Tools, tasks and prompting approach

The principal AI tool used was ChatGPT. The following are **summaries of request themes**, rather than verbatim historical prompts.

| AI-assisted task                                      | Developer review and outcome                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Plan a three-role ERP workflow                        | Reviewed the Cutting Supervisor, Cutting Verifier and Sewing Supervisor responsibilities and permissions                    |
| Design Prisma models and relationships                | Validated schema definitions, corrected a failing schema iteration, and applied database migrations                         |
| Implement component quantity validation               | Checked expected quantities against actual counts and separated server-side QC calculations into `backend/utils/qcRules.js` |
| Build cutting, verification, sewing and history pages | Tested workflow navigation and corrected views that still displayed placeholder content                                     |
| Design security and quality-control tests             | Ran local test suites, diagnosed a backend-not-running failure, configured test credentials and reran all available tests   |
| Prepare cloud deployment and documentation            | Set up Vercel Services routing and reviewed the README and this AI report                                                   |

The developer used compilation, server logs, API responses and persisted data to decide whether AI-generated changes were acceptable.

## 3. Flawed or suboptimal AI-assisted code — example 1: Prisma schema validation

**Observed issue:** An early AI-assisted schema iteration produced Prisma **P1012** validation errors, preventing migration. This demonstrated that syntactically plausible generated schema code could not be trusted without checking it against the ORM.

**Correction:** The relations and model fields were reviewed for consistency and a valid relation definition was retained in `backend/prisma/schema.prisma`, for example:

```prisma
creator User @relation(fields: [createdBy], references: [id])
```

Schema validation and migrations were then used to establish the database structure; an additional migration introduced sewing-progress tracking.

**Evidence limitation:** The exact original erroneous AI output and full P1012 diagnostic are not reproduced here. This is a description of the reported debugging incident, **not a claim that multiline formatting alone causes P1012**. A verbatim before/after comparison would require the original saved output or commit history.

**Engineering lesson:** Validate generated Prisma schemas and relationships with actual tooling before running migrations or writing application logic against them.

## 4. Flawed or suboptimal AI-assisted code — example 2: Dashboard navigation regression

**Observed issue:** During frontend iteration, the Production History navigation showed a generic “not implemented yet” placeholder instead of the completed-production view. Later review also found the Cutting Progress navigation had a similar missing page connection. Compilation alone did not catch these user-visible behaviour problems.

A **simplified reconstruction** of the routing failure is:

```tsx
// Illustrative failure, not an exact historical AI response
) : isProductionHistoryView ? (
  renderUpcoming()
) : (
  renderUpcoming()
)
```

**Correction:** The relevant page components were connected to the dashboard view-selection logic. The reviewed repository routes Production History to its own component, and Cutting Progress and the two verifier screens now have separate routes:

```tsx
) : isCuttingProgressView ? (
  <CuttingProgressPage />
) : isPendingVerificationView ? (
  <PendingVerificationPage onInspect={handleInspect} />
) : isComponentQcView ? (
  <CuttingVerifierPage initialOrderId={selectedQcOrderId} />
) : isProductionHistoryView ? (
  <ProductionHistoryPage />
) : (
  renderUpcoming()
)
```

This is a **shortened illustrative excerpt**; the actual dashboard also includes other routes, and `handleInspect` represents its inline navigation callback.

**Engineering lesson:** Verify role-specific navigation in the browser, not only with a successful TypeScript/Vite build. Functional page routing is part of product correctness.

## 5. Server-side gatekeeper and defensive refactoring

For each cutting order, expected component quantity is calculated from the recipe and target garment quantity. Actual component counts are validated as non-negative integers. The backend calculates the QC outcome rather than trusting a status submitted by the browser:

- **GREEN:** counted quantity equals expected quantity.
- **YELLOW:** counted quantity exceeds expected quantity.
- **RED:** counted quantity is below expected quantity or invalid.
- **UNCOUNTED:** no actual count is supplied.

The implementation uses `getQcStatus()` and `isBlockingComponent()` in `backend/utils/qcRules.js`. A batch cannot be approved if a required count is absent, invalid or below expectation. The server also checks for inconsistencies between the stored and calculated component status.

The backend rejects invalid approval or rejection requests with **HTTP 422** where appropriate, including a missing rejection reason, and rejects unauthorised role actions with **HTTP 403**. Authentication uses a JWT in an HTTP-only cookie; production cookies use the Secure flag. Frontend button states make the workflow understandable but **are not security controls**.

The sewing queue is restricted in the database query itself:

```js
where: {
  status: "VERIFIED";
}
```

This prevents pending and rejected orders from being exposed to sewing merely through client-side filtering.

## 6. Database integrity and auditability

The PostgreSQL schema, managed through Prisma, includes `User`, `Recipe`, `RecipeComponent`, `CuttingOrder`, `VerificationItem`, `VerificationLog` and `SewingProgressLog`. It persists production statuses, component checks, verifier decisions and sewing quantity changes.

Verification records associate decisions with the authenticated verifier and database timestamps. Sewing progress logs record the responsible supervisor and previous/current quantities. The application was designed so that status changes are checked on the backend rather than accepted directly from client-provided values.

## 7. Tests and observed results

**Final local test run (reported by the developer, 11 October 2026):**

| Result      |  Count |
| ----------- | -----: |
| Total tests |     13 |
| Passed      | **13** |
| Failed      |  **0** |
| Skipped     |  **0** |

The successful local run used a running backend at `http://127.0.0.1:5000` and configured role-specific test credentials. Earlier runs had failed because the backend was not started, or skipped authenticated tests because credentials had not been configured. These setup problems were corrected and the suite was rerun.

The 13 passing tests cover:

- Unit checks for GREEN, YELLOW, RED, UNCOUNTED and invalid expected component quantities.
- Cutting Supervisor access restrictions, including a forbidden direct approval attempt (**403**).
- Authenticated rejection without a reason (**422**).
- Health endpoint, missing login credentials and unauthenticated route protection.
- Sewing queue isolation, comparing the API's order IDs with database records whose status is `VERIFIED`.

The developer also reported a successful frontend production build using `npm run build` (TypeScript and Vite) and tested the deployed application through the browser.

**Testing boundaries:** The GREEN and RED tests validate the reusable QC helper, rather than a complete authenticated approval transaction from start to finish. The queue comparison checks the current database state; a stronger future test would create isolated known VERIFIED and rejected fixtures. The reported browser tests and local automated suite should not be described as an independent penetration test or comprehensive production audit.

## 8. Deployment and remaining safeguards

The repository uses **Vercel Services** to deploy the Vite frontend at `/` and Express API at `/api` under one public domain. Frontend API requests use relative `/api/...` paths. The backend still has a development CORS origin for `localhost:5173`; this does not by itself imply a cross-origin browser call in the same-origin Vercel deployment.

The developer reported that the deployed screens and workflows were working, with production records visible after browser refresh. Before submission, the remaining operational safeguards are:

1. **Credential rotation:** Rotate any previously disclosed database credentials, JWT secrets and live-account passwords; do not publish them in GitHub or the AI report.
2. **Evaluator access:** Check the public URL in a private/incognito browser without a Vercel account. Provide test access through demo-only accounts and data, rather than disclosing ordinary live-account credentials.
3. **Documentation:** Ensure `README.md` contains the real deployment link, setup instructions, architecture/schema overview and safe evaluator access instructions.
4. **Additional testing:** If time permits, add isolated end-to-end API tests for authenticated GREEN approval and RED-shortage rejection, and check text/input contrast at different viewport sizes.

These points distinguish work verified so far from follow-up security and test hardening; they do not negate the reported 13/13 passing local suite.

## 9. Evaluation of AI assistance

AI assistance accelerated scaffolding, feature development and troubleshooting, but it also required corrections. The Prisma schema validation incident and navigation regression show why generated code needs explicit review. The resulting workflow emphasised compiler/schema checks, backend authorization, database-level filtering, audit records, and user-facing verification.

**Submission integrity note:** Historical “before” code was not reproduced verbatim where no exact preserved text was available. Illustrative excerpts are marked as such. Specific observed failures, repository behaviour and local test outcomes are distinguished from inferred causes and recommendations.
