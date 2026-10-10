# ApparelFlow ERP

**Secure Garment Production Management | Cutting Operations & Gatekeeper Verification**

ApparelFlow ERP is a deployed, role-based, full-stack application for managing garment cutting orders, independent component verification, and the controlled hand-off of approved batches to sewing. Its core safeguard is a **server-enforced Hard Stop**: orders with missing or insufficient component counts cannot be approved and released to sewing, even if a client attempts to bypass the interface.

**Live application:** https://apparelflow-erp-puce.vercel.app  
**Source repository:** https://github.com/pavani2118/ApparelFlow-ERP  
**Backend health endpoint:** https://apparelflow-erp-puce.vercel.app/api/health

> **Evaluator access:** Open the live application and sign in with one of the three demo roles listed below. If deployment protection is enabled, the publicly accessible URL must be enabled before assessment.

## 1. Project Scope

This project focuses on the critical manufacturing checkpoint between cutting and sewing; it is **not** intended to implement the entire enterprise ERP suite.

| Role                                          | Responsibilities                                                                                                                                  | Enforced restrictions                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Cutting Supervisor** (`cutting_supervisor`) | Review production recipes, create cutting orders, calculate expected components, submit batches for verification, track order status              | Cannot independently approve or reject verification decisions or access the sewing queue |
| **Cutting Verifier** (`cutting_verifier`)     | Review the pending queue, enter actual component counts, inspect GREEN/YELLOW/RED results, approve or reject batches, review verification history | Cannot create cutting orders or access the sewing queue                                  |
| **Sewing Supervisor** (`sewing_supervisor`)   | View the verified-only queue, start sewing, track completed quantities, view production history                                                   | Cannot view unapproved batches through the sewing queue or perform cutting verification  |

Role checks are enforced by the **Express API**, not just by hiding navigation controls in React.

## 2. Demo Access — Three Roles

| Demo persona       | Login email                   | Password / access instructions                                        |
| ------------------ | ----------------------------- | --------------------------------------------------------------------- |
| Cutting Supervisor | `supervisor@apparelflow.demo` | **TO COMPLETE:** provide the dedicated demo password to the evaluator |
| Cutting Verifier   | `verifier@apparelflow.demo`   | **TO COMPLETE:** provide the dedicated demo password to the evaluator |
| Sewing Supervisor  | `sewing@apparelflow.demo`     | **TO COMPLETE:** provide the dedicated demo password to the evaluator |

**Important before submission:** The assessment requests usable demo credentials for **all three** roles. Provide the corresponding passwords in the authorised submission channel, or publish **demo-only credentials** here if this is an isolated test environment with no real customer data or reusable passwords. Never publish database connection strings, JWT secrets, personal passwords, or credentials shared with other services. Test that all three demo accounts work on the live URL before submitting.

### Suggested 5-minute evaluator walkthrough

1. Sign in as **Cutting Supervisor**, open **Production Recipes**, create a **Cutting Order**, and submit it for verification. Check its status under **Cutting Progress**.
2. Sign out and sign in as **Cutting Verifier**. Open **Pending Verification**, select **Inspect Batch**, and review **Component Quality Control**.
3. Enter a count below the expected quantity for one component (**RED**). Verify that approval is blocked. Enter valid counts (all **GREEN**, or a permitted **YELLOW** surplus) and approve a suitable batch.
4. Sign in as **Sewing Supervisor**. Check that only `VERIFIED` batches appear in the **Verified Sewing Queue**. Start sewing and update the completed quantity; refresh to confirm persistence.
5. Inspect the repository's automated tests, database schema, and [`AI_OPTIMIZATION_REPORT.md`](AI_OPTIMIZATION_REPORT.md).

Use fresh demo orders for this walkthrough. Rejection decisions should include a reason; approved/rejected decisions are audited.

## 3. Production Workflow and Hard Stop

```text
CUTTING_IN_PROGRESS
        |
        | Cutting Supervisor submits order
        v
PENDING_VERIFICATION
        |
        +---- Cutting Verifier rejects (reason required) ---> REJECTED
        |
        | Every component counted; no shortages
        v
VERIFIED  --->  SEWING_IN_PROGRESS  --->  SEWING_COMPLETED
               (Sewing Supervisor only)
```

**Quantity rule:** `expected component quantity = target garment quantity × pieces per garment`.

| QC state      | Rule                                                                | Approval consequence |
| ------------- | ------------------------------------------------------------------- | -------------------- |
| **GREEN**     | Actual quantity equals expected quantity                            | Permitted            |
| **YELLOW**    | Actual quantity exceeds expected quantity                           | Permitted            |
| **RED**       | Actual quantity is less than expected quantity                      | **Blocked**          |
| **UNCOUNTED** | Actual quantity is missing                                          | **Blocked**          |
| **INVALID**   | Count is malformed, negative, non-integral, or outside valid limits | **Blocked**          |

On approval, the backend validates the authenticated verifier's role and actual component counts independently of the UI. A forbidden role receives **HTTP 403**; prohibited approval and missing rejection reason conditions return **HTTP 422**. Verification logs persist the responsible verifier, timestamp, decision, component counts/statuses, and related production information. The sewing queue queries orders whose persisted status is **`VERIFIED`** only.

> Fabric usage and recipe wastage-cap information are displayed to assist inspection. The existing application does **not** claim to enforce an automatic wastage-cap block; the mandatory approval Hard Stop is based on component-count sufficiency.

## 4. Seeded Garment Recipes

| Recipe code | Garment       | Standard fabric / garment | Wastage cap | Component types |
| ----------- | ------------- | ------------------------- | ----------- | --------------- |
| `REC-BL01`  | Casual Blouse | 1.8 yd                    | 5%          | 5               |
| `REC-CT02`  | Crop Top      | 1.1 yd                    | 8%          | 5               |

Component multipliers are stored in the relational database and used to calculate order-level expected counts.

## 5. Technical Architecture

```text
Browser
  |
  | HTTPS, same-domain /api requests
  v
Vercel (one public project)
  +-- React + TypeScript + Vite frontend (/)
  +-- Node.js + Express API (/api)
        |
        +-- JWT in HTTP-only cookie
        +-- Server-side role guards & state transitions
        +-- Prisma ORM
                 |
                 v
          Neon PostgreSQL
```

| Layer          | Technology                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite 8, CSS                                                            |
| Backend        | Node.js, Express 5                                                                           |
| Database       | Neon PostgreSQL                                                                              |
| Data access    | Prisma ORM / Prisma Client 6                                                                 |
| Authentication | JWT, HTTP-only cookies, bcrypt password hashes                                               |
| Authorisation  | Backend role-based access control (RBAC)                                                     |
| Tests          | Node.js built-in test runner (`node --test`)                                                 |
| Hosting        | Vercel Services (frontend + backend), single-domain routing via [`vercel.json`](vercel.json) |

### Main database entities

- **User:** authenticated persona, role, password hash; links to cutting orders, verification logs, and sewing progress logs.
- **Recipe:** garment recipe code, fabric standard, wastage cap.
- **RecipeComponent:** per-garment component name and quantity multiplier.
- **CuttingOrder:** recipe, target quantity, fabric roll, used fabric, lifecycle status, sewing progress fields.
- **VerificationItem:** expected/actual quantities and computed QC result for each required component.
- **VerificationLog:** verifier attribution, decision, reason, fabric wastage percentage and timestamp.
- **SewingProgressLog:** supervisor attribution and before/after completion quantities with timestamps.

Full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Schema migrations: [`backend/prisma/migrations/`](backend/prisma/migrations/).

## 6. Running Locally

**Prerequisites:** compatible Node.js/npm, a reachable PostgreSQL database, and credentials for demo accounts. The frontend development server proxies `/api` requests to the local Express backend.

### Backend (Terminal 1)

From the repository root:

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm start
```

Backend: `http://127.0.0.1:5000`  
Health check: `http://127.0.0.1:5000/api/health`

Create a local file at `backend/.env` (**do not commit**):

```dotenv
DATABASE_URL="POSTGRESQL_CONNECTION_URL"
JWT_SECRET="REPLACE_WITH_A_RANDOM_SECRET_OF_32_OR_MORE_CHARACTERS"
PORT=5000
NODE_ENV=development
```

To populate an **empty** database, run `node seed.js` inside `backend`. To create or reset **dedicated demo users**, first set `DEMO_SUPERVISOR_PASSWORD`, `DEMO_VERIFIER_PASSWORD`, and `DEMO_SEWING_PASSWORD` to separate passwords of at least 12 characters, then run `node seedUsers.js`. The user-seeding script updates existing demo-user password hashes; do not run it against accounts whose existing passwords must be preserved.

### Frontend (Terminal 2)

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## 7. Automated Test Suite

Keep the backend running in Terminal 1. In another terminal, from the `backend` directory:

```powershell
npm test
```

**Most recent developer-reported result (11 October 2026): 13 passed, 0 failed, 0 skipped.** The full run was performed with the backend listening on port `5000` and dedicated test login variables configured in the testing terminal. The automated suite includes:

- GREEN/YELLOW/RED/UNCOUNTED and invalid expected-count rules.
- Health endpoint and invalid-login checks.
- Unauthenticated endpoint protection.
- Cutting Supervisor RBAC checks, including forbidden verification decisions.
- Rejection without a reason returning HTTP 422.
- Verified-only sewing queue isolation, compared with persisted database records.

The authenticated integration tests use the following environment variables. Set them in the **test-running terminal** (not in Git and not in a public screenshot):

```text
TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD
TEST_VERIFIER_EMAIL   / TEST_VERIFIER_PASSWORD
TEST_SEWING_EMAIL     / TEST_SEWING_PASSWORD
```

If these are absent, three credential-dependent integration tests are **skipped** rather than passed. For a full run, set their values to working test accounts on the database connected to the locally running backend. Tests that call `/api` require the backend to be running; otherwise `ECONNREFUSED 127.0.0.1:5000` is expected.

> Note: The GREEN and RED checks in `hard-stop.test.js` validate the reusable QC rules. The suite also covers role and endpoint security, but the test names should not be interpreted as independent end-to-end proof of every UI interaction.

## 8. Production Deployment

The root-level [`vercel.json`](vercel.json) configures two services:

- `frontend` — Vite application at `/`.
- `backend` — Express API at `/api` with `npx prisma generate` in the backend build command.

The frontend calls relative `/api/...` paths, so browser requests use the same public host.

Required Vercel environment variables (configure securely in the dashboard, not in this repository):

- `DATABASE_URL` — Neon connection URL.
- `JWT_SECRET` — strong unpredictable secret, at least 32 characters.
- `NODE_ENV` — `production`.

Schema migrations must be applied to the target database separately; deployment does not automatically replace database migration/initialisation procedures. Do not expose `DATABASE_URL` or authentication secrets in logs, commits, screenshots, or example `.env` files.

**Deployment URL:** https://apparelflow-erp-puce.vercel.app

## 9. Security and Auditability

- Passwords are checked against bcrypt hashes.
- Session tokens are stored in HTTP-only cookies, configured with the `Secure` flag for production HTTPS.
- Server routes require authentication and enforce role isolation.
- Backend validation prevents illegal state transitions or component-shortage approvals.
- Verification decisions and sewing progress updates are persisted for audit and reload continuity.
- Production DB credentials and JWT signing material belong in protected environment variables, never in committed files.

This is an assessment application. Conduct a full security review before adapting it to real factory or customer data.

## 10. AI-Assisted Development

AI assistance was used for planning, UI implementation, backend debugging, schema refinement, testing suggestions, and documentation. The required [`AI_OPTIMIZATION_REPORT.md`](AI_OPTIMIZATION_REPORT.md) records reviewed AI code flaws and corrective engineering decisions. It must be read and finalised for factual accuracy before submission.

## 11. Submission Checklist

- [x] Live cloud-deployed URL supplied and user-tested.
- [x] Public GitHub source repository available.
- [x] README includes architecture, schema, test instructions, and demo accounts.
- [x] Developer-reported automated test run: **13 passed / 0 failed / 0 skipped**.
- [ ] **Evaluator login access:** complete delivery of the three demo passwords; verify each role in an incognito window.
- [ ] **Public access:** confirm the URL works without an account-specific Vercel share token or deployment-protection sign-in.
- [ ] **AI report:** remove draft-only wording once examples and claims are manually verified.
- [ ] **Credential hygiene:** confirm previously exposed Neon credentials were rotated.

---

**Repository:** https://github.com/pavani2118/ApparelFlow-ERP  
**Live demo:** https://apparelflow-erp-puce.vercel.app
