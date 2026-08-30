# Architecture

This started as a pre-implementation plan (stage 2 of the rewrite -- see repo
history for the stage 1 audit) and is now the actual architecture reference
for what's built: the data model, API surface, and algorithm below all
reflect the current code, including everything added after the original
plan (settlement confirmation, per-group currency, friends, account
deletion). See the root [README](../README.md) for the live demo link and a
shorter version of this same material.

## Data model

Money is stored as **integer cents** (`Int` in Prisma / `BIGINT`-safe range in MySQL), not
`FLOAT` and not even `DECIMAL`. Splitting $10.00 three ways as floats gives you
`3.333333...`, and summing decimals back up is a classic source of off-by-a-cent bugs.
Integer cents make split arithmetic exact: divide, take the remainder, hand the leftover
pennies to the first N people. The API converts to/from dollars at the edge (request/response
serialization); the database and all internal math never touch floating point.

```mermaid
erDiagram
    User ||--o{ GroupMember : "belongs to"
    User ||--o{ Expense : "pays"
    User ||--o{ ExpenseSplit : "owes on"
    User ||--o{ Settlement : "pays/receives/initiates"
    User ||--o{ Friend : "saves/is saved by"
    User ||--o{ UnresolvedDeparture : "departs/resolves"
    Group ||--o{ GroupMember : has
    Group ||--o{ Expense : contains
    Group ||--o{ Settlement : records
    Group ||--o{ UnresolvedDeparture : "left with"
    Expense ||--o{ ExpenseSplit : "split into"

    User {
        int id PK
        string name
        string email UK
        string passwordHash
        datetime deletedAt "nullable -- soft delete"
        datetime createdAt
    }
    Group {
        int id PK
        string name
        string description
        string currency "display label only, default USD"
        int createdBy FK
        datetime createdAt
    }
    GroupMember {
        int groupId PK,FK
        int userId PK,FK
        datetime joinedAt
    }
    Expense {
        int id PK
        int groupId FK
        int paidBy FK
        int amountCents
        string description
        string category
        date expenseDate
        enum splitType "EQUAL | EXACT | PERCENTAGE"
        datetime createdAt
    }
    ExpenseSplit {
        int id PK
        int expenseId FK
        int userId FK
        int shareCents
    }
    Settlement {
        int id PK
        int groupId FK
        int fromUserId FK
        int toUserId FK
        int amountCents
        enum status "PENDING | CONFIRMED"
        int initiatedById FK
        datetime settledAt
        datetime confirmedAt "nullable"
        string note "nullable -- set on departure-resolution rows"
    }
    Friend {
        int userId PK,FK
        int friendId PK,FK
        datetime createdAt
    }
    UnresolvedDeparture {
        int id PK
        int groupId FK
        int userId FK
        int balanceCents "snapshot at departure time"
        datetime resolvedAt "nullable"
        int resolvedById FK "nullable"
        enum resolutionType "WRITE_OFF | ABSORB_EVEN, nullable"
        datetime createdAt
    }
```

Notes on the model:

- **`GroupMember` is a real join table**, not a JSON array of ids (the old `mockData.js` shape).
  This lets a `GET /groups/:id` query join straight to `users` instead of the frontend doing
  N+1 `getUserById` lookups, which is what the current code does.
- **`ExpenseSplit` stores the computed share per person**, not just a list of participant ids.
  That's what makes unequal/percentage splits possible: for `EQUAL` splits the server computes
  and stores each share at creation time; for `EXACT`/`PERCENTAGE` the client sends shares and
  the server validates they sum to the total. Either way, balance calculation later is just
  `SUM(shareCents) WHERE paidBy = X` vs `SUM(shareCents) WHERE userId = X` — no runtime
  division, no re-deriving from `amount / n`.
- **`Settlement` is a real table**, not just a computed suggestion, and it's a two-step record:
  a payment starts `PENDING` when either party records it and only counts toward balances once
  the *other* party confirms it (`getGroupBalances` only sums `CONFIRMED` rows) — a one-sided
  "mark as paid" can't move money on the sheet by itself. `note` is set only on the synthetic
  settlements a departure resolution creates, so payment history can tell "someone actually
  paid this" apart from "this was written off."
- **`UnresolvedDeparture` replaces a hard block.** The plan below originally called for
  blocking removal of a group member (or deletion of a group) with a nonzero balance. That's
  not what shipped: leaving now always succeeds, and if the balance wasn't zero it's recorded
  here as a snapshot, resolved later by any remaining member either writing it off (recorded as
  if it had been paid, via the same minimum-transaction algorithm as live settle-up, scoped to
  just the departed member) or splitting it evenly across whoever's left
  ([`backend/src/services/departures.ts`](../backend/src/services/departures.ts)). Account
  deletion runs every membership through this same path rather than having its own logic.
  Deletion itself is soft (`User.deletedAt`, not a row removal): expenses, splits, and
  settlements all reference `User` by id with no cascade, so hard-deleting the row would
  either violate those foreign keys or erase other people's expense history along with the
  deleted account. A deleted account can't log in, search, or be added anywhere new, but
  its name still shows on the old records it was actually part of.
- **`Friend` is one-directional**, not a mutual-request table: no status/pending state, just
  `(userId, friendId)` pairs. Saving someone doesn't require or grant anything on their side --
  it's a personal shortcut list, not a social feature.

## API surface

All routes are versioned-free (`/api/...` — no `/v1`, not worth it at this scale) and return
JSON. Standard error shape:

```json
{ "error": { "message": "Email already in use", "code": "EMAIL_TAKEN" } }
```

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | create user, sets auth cookie |
| POST | `/api/auth/login` | — | verify credentials, sets auth cookie (rejects soft-deleted accounts) |
| POST | `/api/auth/logout` | — | clears cookie |
| GET | `/api/auth/me` | required | current user (for session rehydration on page load) |
| PATCH | `/api/auth/password` | required | change password (requires current password) |
| DELETE | `/api/auth/me` | required | soft-delete the account (requires password); leaves every group via the same path as manually leaving |
| GET | `/api/users?search=` | required | search users by name/email, for adding real members to a group (excludes deleted accounts; flags `isFriend`) |
| GET | `/api/friends` | required | your saved friends |
| POST | `/api/friends` | required | save a user as a friend, by id |
| DELETE | `/api/friends/:friendId` | required | remove a saved friend |
| GET | `/api/groups` | required | groups the current user belongs to |
| POST | `/api/groups` | required | create group (creator is auto-added as member; optional `currency`) |
| GET | `/api/groups/:id` | member | group details + members + balances |
| PATCH | `/api/groups/:id` | creator | rename/edit description/currency |
| POST | `/api/groups/:id/members` | member | add a member by email |
| DELETE | `/api/groups/:id/members/:userId` | self or creator | remove member -- always succeeds; if their balance wasn't zero, records an `UnresolvedDeparture` |
| GET | `/api/groups/:id/departures` | member | unresolved (and resolved) departures for this group |
| POST | `/api/groups/:id/departures/:id/resolve` | member | resolve a departure: `WRITE_OFF` or `ABSORB_EVEN` |
| GET | `/api/groups/:id/expenses` | member | list expenses |
| POST | `/api/groups/:id/expenses` | member | create expense + splits |
| GET | `/api/expenses/:id` | member | single expense detail |
| PATCH | `/api/expenses/:id` | payer or creator | edit expense |
| DELETE | `/api/expenses/:id` | payer or creator | delete expense |
| GET | `/api/groups/:id/balances` | member | net balance per member (who's owed, who owes) |
| GET | `/api/groups/:id/settlements/suggestions` | member | **the settle-up algorithm** — minimal-transaction payment plan, computed on the fly, not persisted |
| GET | `/api/groups/:id/settlements` | member | settlement history |
| POST | `/api/groups/:id/settlements` | member | record a payment as `PENDING` (from, to, amount) |
| POST | `/api/groups/:id/settlements/:id/confirm` | member (counterparty only) | confirm a pending settlement -- only now does it affect balances |
| DELETE | `/api/groups/:id/settlements/:id` | member (either party) | reject/cancel a still-pending settlement |

Every group-scoped route checks the requester is a `GroupMember` (403 if not) — this
is the one piece of authorization logic that matters most, since balances and expenses
are financial data.

Validation: every request body is parsed through a `zod` schema before touching a
controller; failures return `400` with the zod issue list mapped into the standard
error shape. A small `validate(schema)` Express middleware wraps this so it's not
repeated per route.

Status codes used deliberately, not just 200/500: `400` validation, `401` no/invalid
session, `403` authenticated but not a group member, `404` not found, `409` conflict
(duplicate email, duplicate group member), `422` semantically invalid (e.g. splits
don't sum to the expense total), `500` unexpected.

## Auth approach

**JWT in an httpOnly, Secure, SameSite=Lax (or None if frontend/backend end up on
different domains) cookie** — not `localStorage`, and not server-side sessions.

Why not sessions: a session store needs a persistence layer (a `sessions` table, or
Redis) and, if you ever run more than one backend instance, either sticky sessions or
a shared store. None of that is wrong, it's just infrastructure this project doesn't
need to prove the point, and it adds a moving part to the free-tier deploy in stage 6.

Why not `localStorage` JWTs: a token in `localStorage` is readable by any JS running on
the page, which means it's exfiltratable via any XSS bug, including from a dependency.
An httpOnly cookie is invisible to JS entirely — the browser sends it automatically,
and a cross-site request still needs a matching `SameSite`/CORS configuration, so it's
not a free-for-all either.

The honest tradeoff I'm accepting: this is a stateless JWT with no server-side
revocation list. Logout clears the cookie client-side; a stolen token is valid until
it expires. I'm mitigating that with a short expiry (7 days) rather than building
token revocation or refresh-token rotation — that machinery is a legitimate next step
for a production app, and worth naming explicitly in an interview as "the thing I'd
add first," but it's disproportionate for this project's scope.

Password hashing: `bcryptjs` (pure JS), not native `bcrypt`. Native `bcrypt` is faster,
but requires a compiled native addon, which means the Docker image needs build tools
matching the deploy platform's architecture. `bcryptjs` trades a bit of hashing speed
for a Docker image that just works — a reasonable call for a login endpoint that isn't
under real load.

## The settle-up algorithm

This is the part worth being precise about, since it's the thing you specifically
want to defend in an interview.

**The problem:** given each member's net balance in a group (positive = owed money,
negative = owes money, and the balances always sum to zero), find a set of
payments — who pays whom, how much — that zeroes every balance out, using as few
payments as possible.

**The exact minimum is NP-hard.** It's equivalent to a set-partition-style problem:
you're looking for the smallest number of groups into which the balances can be
partitioned such that each subset sums to zero, and deciding whether *any* subset
of a set of numbers sums to zero is itself the subset-sum problem. There's no known
polynomial algorithm for the exact optimum in general.

**What real apps (including Splitwise) do, and what's implemented here:** a greedy
heuristic — repeatedly match the person owed the most money with the person who
owes the most money, settle the smaller of the two amounts between them, and
repeat.

```
sort creditors (balance > 0) descending, debtors (balance < 0) descending by magnitude
i = 0, j = 0
while i < creditors.length and j < debtors.length:
    pay = min(creditors[i].amount, debtors[j].amount)
    record payment: debtors[j] -> creditors[i], amount = pay
    creditors[i].amount -= pay
    debtors[j].amount -= pay
    if creditors[i].amount == 0: i += 1
    if debtors[j].amount == 0: j += 1
```

**Why this is a defensible choice, not just "good enough":**
- It's **optimal in the two-party case** trivially, and for the general case it
  guarantees **at most n − 1 transactions** for n people with nonzero balance —
  which is also the theoretical lower bound in the worst case (you can construct
  balance sets that genuinely need n − 1 payments), so the heuristic is
  asymptotically tight even though it's not always the exact optimum for every
  input.
- It's **fast**: sort is `O(n log n)`, the matching pass is `O(n)`, so `O(n log n)`
  total — trivial at the scale of a group of people, but it's the right way to
  answer "what's the complexity" in an interview.
- The cases where greedy isn't exactly optimal are ones where a subset of balances
  happens to sum to zero on its own (e.g. balances `[+30, +30, -30, -30]` can settle
  in 2 payments by pairing same-magnitude opposites, and greedy will actually find
  that here — but adversarial inputs exist where an exact solver would find one
  fewer transaction than greedy). That tradeoff is noted in the README rather than
  hidden, and it's a good "what would you improve" answer: for small n (say ≤ 12–15)
  you could brute-force/DP over subset bitmasks for the exact optimum, since the
  state space is `O(2^n · n)`.

This is implemented as a pure function (`computeSettlement(balances): Payment[]`)
with no I/O, which is what makes it cleanly unit-testable — property-based tests
(balances always sum to zero after applying all payments, payments never exceed
either party's original balance, output size ≤ n − 1) run alongside example-based
ones in [`backend/tests/unit/settleUp.test.ts`](../backend/tests/unit/settleUp.test.ts).

## What's explicitly out of scope

- Cross-group netting (Splitwise's global "friends" balance across all shared groups) —
  settle-up is scoped per group, which matches the data model and keeps the algorithm's
  input well-defined. (The `Friend` model added later is an unrelated feature -- a personal
  saved-contacts list, not a balance concept.)
- Real currency conversion — a group's `currency` field is a display label chosen at
  creation time; nothing converts between currencies or verifies amounts were actually
  entered in the selected one.
- Real payment processing (Stripe etc.) — "settlements" are a record of an
  out-of-band payment (cash, Venmo, whatever), not a processed transaction.
