# Security Specification — Aether Tactile Studio (`studio_snapshots`)

## 1. Data Invariants

1. **Zero-Trust Default Deny**: Every path in `/databases/{database}/documents` defaults to `allow read, write: if false;` except explicitly matched and validated `/studio_snapshots/{snapshotId}` documents.
2. **Strict Verified Ownership**: Only authenticated users with a verified Google email (`request.auth != null && request.auth.token.email_verified == true`) may create, read, update, or delete `/studio_snapshots/{snapshotId}`, and `ownerId` MUST strictly equal `request.auth.uid`.
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates `snapshotId` via `isValidId(snapshotId)` (`size >= 1 && size <= 128 && matches('^[a-zA-Z0-9_-]+$')`).
4. **Query Enforcer on List**: `allow list` strictly enforces `resource.data.ownerId == request.auth.uid` without delegating filtering to the client and without any `get()`/`exists()` cost explosion.
5. **Strict Key & Volumetric Bounds (Anti-Shadow-Field)**: `isValidStudioSnapshot(data)` enforces exact required and allowed keys (`hasAll` + `hasOnly`) on the root document, `summary` map, and `state` map, plus `.size()` limits on every string and array (`nodes.size() <= 40`, `edges.size() <= 80`, `selectedGroups.size() <= 6`) using strictly short-circuiting CEL ternaries for optional fields and list index checks.
6. **Temporal & Core State Immutability**: `createdAt` and `updatedAt` must equal server `request.time` on creation; on update, `ownerId`, `createdAt`, `versionTag`, `summary`, and `state` are strictly immutable via `affectedKeys().hasOnly(...)` and identity checks, `updatedAt == request.time`, and only explicit action-based updates (`label`/`note` metadata edit or `isPinned` toggle) are permitted.
7. **PII Isolation**: No emails, phone numbers, or addresses are stored in `studio_snapshots`; access is restricted exclusively to the document owner (`ownerId == request.auth.uid`).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 01 — Identity Spoofing (`ownerId` mismatch)**: Authenticated user `uid_attacker` creates a snapshot with `"ownerId": "uid_victim"`. Expected: `PERMISSION_DENIED`.
2. **Payload 02 — Unverified Email Write**: Authenticated token with `email_verified: false` attempts to create a valid snapshot. Expected: `PERMISSION_DENIED`.
3. **Payload 03 — Shadow / Ghost Field Injection on Create**: Valid snapshot payload plus extra field `"isAdmin": true`. Expected: `PERMISSION_DENIED`.
4. **Payload 04 — ID Poisoning (Path Variable Overflow)**: Create document at `/studio_snapshots/bad$id!@#` or >128 char ID. Expected: `PERMISSION_DENIED`.
5. **Payload 05 — Client Timestamp Forgery**: Create snapshot with forged past/future `createdAt` timestamp (`Timestamp.fromMillis(1700000000000)`) instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
6. **Payload 06 — Value Poisoning on Update (`label` wrong type / >160 chars)**: Update `label` to a 500-character string or boolean `true`. Expected: `PERMISSION_DENIED`.
7. **Payload 07 — Core Snapshot Mutation (`state` tampering on Update)**: Owner attempts to mutate `state.palette` on an existing snapshot instead of creating a new snapshot. Expected: `PERMISSION_DENIED`.
8. **Payload 08 — Ownership Transfer (`ownerId` mutation on Update)**: Owner attempts to change `ownerId` during metadata update. Expected: `PERMISSION_DENIED`.
9. **Payload 09 — Cross-Tenant `get` Read**: Authenticated user `uid_attacker` attempts `getDoc` on `uid_victim`'s snapshot. Expected: `PERMISSION_DENIED`.
10. **Payload 10 — Unfiltered `list` Scraping**: Authenticated user executes unfiltered `getDocs(collection(db, 'studio_snapshots'))` without `where('ownerId', '==', uid)`. Expected: `PERMISSION_DENIED`.
11. **Payload 11 — Denial-of-Wallet Array Overflow**: Snapshot with `state.screenMap.nodes` containing 45 elements (`> 40` max). Expected: `PERMISSION_DENIED`.
12. **Payload 12 — Invalid `versionTag` Format**: Snapshot with `"versionTag": "release_alpha"` violating `^v[0-9]+[.][0-9]+([.][0-9]+)?$`. Expected: `PERMISSION_DENIED`.

## 3. Test Runner

See `firestore.rules.test.ts` for the complete automated verification suite asserting `PERMISSION_DENIED` across all 12 adversarial payloads and `ALLOW` for valid owner operations.
