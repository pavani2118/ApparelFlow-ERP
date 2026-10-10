# ApparelFlow ERP

A role-based garment production management system focused on
cutting batch verification, quality control, and secure sewing
queue management.

## Overview

ApparelFlow ERP manages garment production workflows across
three operational roles:

- Cutting Supervisor
- Cutting Verifier
- Sewing Supervisor

The system enforces a backend Hard Stop that prevents batches
with missing or insufficient components from entering sewing.

## Technology Stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Frontend       | React, TypeScript, Vite          |
| Backend        | Node.js, Express                 |
| Database       | PostgreSQL (Neon)                |
| ORM            | Prisma                           |
| Authentication | JWT, HTTP-only cookies           |
| Security       | Role-Based Access Control (RBAC) |
| Testing        | Node.js built-in test runner     |

## Key Features

### Cutting Management

- Create production batches using garment recipes
- Calculate required component quantities
- Submit completed cutting batches for verification

### Production Verification

- GREEN: exact required quantity
- YELLOW: surplus quantity
- RED: insufficient quantity
- UNCOUNTED: missing component count
- Block approval when a component is RED or UNCOUNTED
- Require a reason when rejecting a batch
- Record verification decisions and audit information

### Sewing Operations

- Display only verified batches in the sewing queue
- Start authorised sewing operations
- Track completed garment quantities
- Prevent invalid or decreasing progress updates
- View completed production history

### Security

- JWT authentication using HTTP-only cookies
- Server-side role-based authorisation
- HTTP 403 for forbidden role actions
- HTTP 422 for invalid verification decisions
- Database-backed production status enforcement

## System Architecture

React Frontend
|
| REST API
v
Express Backend
|
| Prisma ORM
v
Neon PostgreSQL Database

The backend is responsible for authorisation, validation,
production state transitions, and audit persistence.

## Database Models

- User
- Recipe
- RecipeComponent
- CuttingOrder
- VerificationItem
- VerificationLog
- SewingProgressLog

## Running Locally

Requirements:

- Node.js and npm
- PostgreSQL database connection
- Environment variables configured locally

### Backend

```sh
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm start
```

Backend default URL: http://localhost:5000

### Frontend

Open another terminal:

```sh
cd frontend
npm install
npm run dev
```

Frontend default URL: http://localhost:5173

## Environment Configuration

Create `backend/.env` with the required environment
variables:

```env
DATABASE_URL="YOUR_DATABASE_CONNECTION_STRING"
JWT_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"
PORT=5000
```

Never commit real database credentials, JWT secrets,
or production passwords.

## Automated Tests

Start the backend, then run:

```sh
cd backend
npm test
```

Tests cover:

- GREEN, YELLOW, RED and UNCOUNTED quality-control rules
- Unauthenticated API protection
- Role-based access restrictions
- Rejection reason validation
- Sewing queue isolation

Authenticated tests require corresponding test credentials.
Tests may be skipped when those credentials are not configured.

## Production Deployment

Public frontend and backend URLs will be added after
cloud deployment.

## AI-Assisted Development

AI tools were used to assist implementation and debugging.
Human-reviewed changes, corrections, and testing evidence
will be documented in `AI_OPTIMIZATION_REPORT.md`.

## Repository

https://github.com/pavani2118/ApparelFlow-ERP
