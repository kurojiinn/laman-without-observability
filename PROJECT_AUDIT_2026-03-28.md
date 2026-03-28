# Laman App Audit Report

Date: 2026-03-28

## Scope

This report covers the current state of:

- iOS app in `/UI`
- Go backend in `/Backend`
- GitLab CI pipeline
- local Kubernetes manifests
- auth, courier, picker, orders, deployment and observability flows

## Verification Performed

- Backend test run: `go test ./...` in `/Backend`
- iOS build run: `xcodebuild -project /Users/ependihadziev/GolandProjects/Laman-App/UI/LamanDelivery.xcodeproj -scheme LamanDelivery -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`

Result:

- Backend tests passed
- iOS build passed

This means the project is in a buildable state, but not necessarily in a production-safe or logically complete state.

## Fixes Applied After Audit

The following inconsistencies were corrected after the initial review:

- unified role validation so backend now recognizes `PICKER` in the shared role model
- closed the public order status update route by requiring authentication
- removed OTP bypass for registration: backend now requires a verification code for `Register`
- aligned iOS courier status transitions with backend order statuses
- aligned iOS order status labels with backend order lifecycle
- aligned iOS default API base URL with the current local backend IP `192.168.0.11`
- aligned local Docker/admin-panel URLs with `192.168.0.11`
- aligned GitLab staging deploy namespace with `laman-staging`

These fixes reduce the inconsistency level noticeably, but they do not yet solve secret management or the missing real courier order APIs on iOS.

## Current Project State

### Backend

Implemented:

- phone-based auth with OTP request and OTP verify flow
- JWT auth
- roles for `CLIENT` and `COURIER`
- catalog, stores, products
- order creation and basic order lifecycle
- Telegram notifications for new orders and courier notifications
- SMS.RU call-based OTP provider
- Redis-based courier location and active pool
- courier location endpoint and shift start/end endpoints
- picker backend module with separate login flow and store-bound order operations
- Prometheus metrics, Jaeger tracing, Zap logging
- Docker Compose local environment
- Kubernetes manifests for local cluster deployment
- GitLab CI pipeline for lint/build/deploy

Partially implemented or inconsistent:

- picker role exists in code path, but not in global role model
- courier workflow UI exists, but current order/history data loading is still placeholder-based on iOS
- deployment docs are outdated and do not reflect the actual repository layout and runtime setup

### iOS App

Implemented:

- catalog, stores, cart, orders tabs for client flow
- auth flow with OTP request and OTP verify
- profile flow with logout
- role-based switch to courier screen
- courier shift screen
- courier history tab
- courier location tracking with CoreLocation
- periodic location updates to backend
- shift start/end calls from location service

Partially implemented or inconsistent:

- courier current order and courier order history use placeholder API methods and do not load real backend data
- shift UI state is optimistic and can diverge from backend state
- API base URL is hardcoded to one local IP

### DevOps / Deployment

Implemented:

- local GitLab pipeline stages: lint, build, deploy
- local Docker image build and push
- local Kubernetes manifests for app, postgres, redis, jaeger

Partially implemented or inconsistent:

- pipeline namespace targets do not match all manifest namespaces
- k8s and compose configs are mixed between local laptop assumptions and CI deployment assumptions
- old `app.yml` appears stale and references a different stack

## High Severity Findings

### 1. Secrets and credentials are committed to the repository

Affected files include:

- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/docker-compose.yml`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/k8s/secrets.yaml`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/k8s/secrets-staging.yaml`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/env.example`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/.env`

Observed examples:

- Telegram bot token
- Telegram chat ID
- SMS.RU API key
- database credentials
- admin credentials

Impact:

- anyone with repo access can use external services
- token leakage can lead to Telegram bot abuse and SMS provider abuse
- secret rotation is already required

Required action:

- rotate all exposed secrets immediately
- remove real secrets from tracked files
- move runtime secrets to GitLab CI variables, `.env.local`, Kubernetes external secret management or untracked local files

## Medium Severity Findings

### 2. Courier iOS interface is still not connected to real courier order APIs

Relevant code:

- `/Users/ependihadziev/GolandProjects/Laman-App/UI/ViewModels/CourierViewModel.swift:37`
- `/Users/ependihadziev/GolandProjects/Laman-App/UI/ViewModels/CourierViewModel.swift:46`

Current behavior:

- `fetchCurrentOrder()` returns placeholder `nil`
- `fetchAllOrders()` returns placeholder `[]`

Impact:

- courier UI compiles but is not operational for real order handling

### 3. GitLab deploy targets do not fully match the Kubernetes manifests

Relevant code:

- `/Users/ependihadziev/GolandProjects/Laman-App/.gitlab-ci.yml:45`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/k8s/namespace.yaml:1`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/k8s/namespace-staging.yaml:1`

Current behavior:

- staging deploy target now matches `laman-staging`
- production deploy still targets `laman-prod`
- no `laman-prod` namespace manifest was found in the audited set

Impact:

- production deployment path is still unmanaged or external to the audited manifests

### 4. Runtime networking is still environment-fragile

Relevant code:

- `/Users/ependihadziev/GolandProjects/Laman-App/UI/Services/LamanAPI.swift:51`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/internal/config/config.go:88`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/internal/config/config.go:91`

Current behavior:

- local IPs are more aligned than before, but still hardcoded

Impact:

- moving to another machine or network still requires code/config edits

### 5. Courier shift state in iOS is optimistic and can diverge from backend

Relevant files:

- `/Users/ependihadziev/GolandProjects/Laman-App/UI/ViewModels/CourierViewModel.swift:25`
- `/Users/ependihadziev/GolandProjects/Laman-App/UI/Services/LocationService.swift:119`

Current behavior:

- UI sets `isOnShift = true` before backend confirms shift start
- shift start request is performed later from `LocationService` on first location callback
- backend start failure is only logged, not surfaced as a state rollback

Impact:

- courier can see an active shift while backend has not accepted it
- order matching and location tracking can diverge

## Low Severity Findings

### 9. Documentation is outdated and partially misleading

Relevant files:

- `/Users/ependihadziev/GolandProjects/Laman-App/README.md:1`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/README.md:1`
- `/Users/ependihadziev/GolandProjects/Laman-App/app.yml`

Issues:

- docs describe older project structure
- some endpoint descriptions are outdated
- URLs and deployment assumptions point to localhost or old layouts
- `app.yml` references a different stack and looks stale

### 10. Compose and k8s configs are mixing local defaults with deploy-time behavior

Relevant files:

- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/docker-compose.yml:26`
- `/Users/ependihadziev/GolandProjects/Laman-App/Backend/k8s/configmap.yaml:5`

Impact:

- behavior differs between local Docker, iOS device, CI and k8s
- troubleshooting is harder than it needs to be

## Functional Status Summary

### Ready enough for local MVP demos

- catalog and stores browsing
- guest and authenticated order creation
- OTP request/verify flow
- client auth persistence
- role switch to courier UI
- courier location pinging
- courier shift start/end backend endpoints
- picker backend module
- Telegram notifications
- Docker Compose local stack

### Not ready for reliable production use

- secrets management
- role model consistency across client/courier/picker
- authorization on sensitive order mutations
- CI/CD and k8s environment consistency
- real courier order assignment and retrieval in iOS
- documentation accuracy

## Recommended Next Actions

### Immediate

1. Rotate all leaked secrets and remove them from git-tracked files.
2. Protect `PUT /api/v1/orders/:id/status` with auth and role checks.
3. Enforce OTP verification in backend registration flow.
4. Unify role model to include either `PICKER` formally or redesign picker auth as a separate principal type.

### Next

1. Replace hardcoded IP addresses with environment-based configuration.
2. Connect courier iOS screens to real backend order endpoints.
3. Align GitLab namespaces and k8s manifests for dev, staging and prod.
4. Rewrite root and backend documentation from the current code, not from the older structure.

## Suggested Documentation Baseline

The canonical current architecture is:

- `/Users/ependihadziev/GolandProjects/Laman-App/Backend`
  - Go API
  - PostgreSQL
  - Redis
  - Jaeger
  - Prometheus/Grafana
  - Telegram notifications
  - SMS.RU OTP/call verification
  - picker module
  - courier location and shifts
- `/Users/ependihadziev/GolandProjects/Laman-App/UI`
  - SwiftUI iOS app
  - client flow
  - OTP auth flow
  - role-based courier screen
  - CoreLocation courier tracking
- `/Users/ependihadziev/GolandProjects/Laman-App/.gitlab-ci.yml`
  - lint
  - docker build/push
  - kubectl rollout deploy jobs

## Final Assessment

The project is actively developed and materially ahead of the original MVP: it already includes OTP auth, roles, courier location, picker backend logic, CI and local k8s deployment assets. The main problem is not absence of code. The main problem is inconsistency between modules and unsafe operational practices around secrets, deployment assumptions and access control.
