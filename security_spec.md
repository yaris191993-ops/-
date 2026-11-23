# Security Specification — Phang Nga Queue Booking Firestore Rules

## Phase 0: Data Invariants
1. **Zero-PII Queue Separation**: `/queues/{queueId}` MUST NEVER contain citizen PII (`fullName`, `idNumber`, `phone`, `note`). All PII lives strictly in `/queueDetails/{queueId}`.
2. **Atomic Companion Writes**: A `/queues/{queueId}` document cannot be created without atomically creating `/queueDetails/{queueId}` (and vice versa) via `existsAfter(...)` inside the same `writeBatch`.
3. **Strict Admin Access to PII**: `/queueDetails/{queueId}` `get`, `list`, `update`, and `delete` are strictly restricted to `isAdmin()` (verified Google sign-in matching bootstrapped `yaris191993@gmail.com` or an entry in `/staffAdmins/{email}`).
4. **Status & Terminal State Integrity**:
   - New queues MUST start with `status == 'waiting'` and server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
   - Non-admin self-service updates on `/queues/{queueId}` (reschedule/cancel on `/check`) are ONLY permitted when `existing().status == 'waiting'`. Terminal states (`done`, `no_show`, `cancelled`) and `called` queues are locked against non-admin modification.
5. **Counter & Channel Consistency**:
   - `channel == 'general'` accepts `counter` in `1..3` only.
   - `channel == 'foreign'` accepts `counter` in `1..5` only.
6. **Immutable Audit & Identity Fields**: `createdAt`, `bookingCode`, `serviceId`, `channel`, `source`, and `lookupHash` cannot be modified after creation.
7. **Shadow Field Prevention**: Every `create` and `update` passes `isValidQueue`, `isValidQueueDetail`, or `isValidStaffAdmin` (`hasAll` + `hasOnly`), rejecting any undocumented fields.

## Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated PII Read**: Unauthenticated `get(/queueDetails/{id})` -> Denied (`!isAdmin()`).
2. **Unauthenticated PII List**: Unauthenticated `list(/queueDetails)` -> Denied (`!isAdmin()`).
3. **Ghost Field Injection on Queue Create**: `queues/{id}` with extra field `isAdmin: true` -> Denied (`keys().hasOnly(...)`).
4. **Pre-Called Queue Create**: `queues/{id}` created with `status: 'called'` -> Denied (`incoming().status == 'waiting'`).
5. **Orphaned Queue Without Details**: `queues/{id}` created without `/queueDetails/{id}` in batch -> Denied (`existsAfter` fails).
6. **Orphaned Detail Without Queue**: `queueDetails/{id}` created without `/queues/{id}` in batch -> Denied (`existsAfter` fails).
7. **ID Poisoning**: Document ID > 128 chars or containing invalid symbols (`../admin`) -> Denied (`isValidId`).
8. **Counter Overflow**: `channel: 'general'` with `counter: 5` -> Denied (`counter <= 3`).
9. **Terminal State Tampering**: Unauthenticated update changing `status: 'done'` back to `'waiting'` -> Denied (`existing().status == 'waiting'`).
10. **Non-Admin Recall/Call**: Unauthenticated update changing `status` to `'called'` -> Denied (`!isAdmin()`).
11. **Unverified Email Spoof**: Signed-in user with `email: 'yaris191993@gmail.com'` and `email_verified: false` -> Denied (`email_verified == true`).
12. **Self-Assigned Staff Escalation**: Non-admin user creating `/staffAdmins/attacker@gmail.com` -> Denied (`!isAdmin()`).
