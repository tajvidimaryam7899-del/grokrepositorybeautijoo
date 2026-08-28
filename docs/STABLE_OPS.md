# Beautijoo — Stable Operations Guide

## 1. Recovery point (code)

| Item | Value |
|------|--------|
| Recovery branch | `stable/v1.0` |
| Points to commit | see GitHub branch `stable/v1.0` |
| Recommended tag | `v1.0-stable` (create once in GitHub Releases) |

### Restore code to this snapshot

```bash
git fetch origin
git checkout main
git reset --hard origin/stable/v1.0
# or after tag exists:
git checkout v1.0-stable
```

Then redeploy backend/frontend from that revision on Liara.

### Create the Release tag (one-time, in browser)

1. GitHub → repository → **Releases** → **Create a new release**
2. Choose tag: `v1.0-stable` (create on publish)
3. Target: branch **`stable/v1.0`** (or the same commit as that branch)
4. Title: `v1.0-stable`
5. Publish release

---

## 2. Database backup (you must do in Liara)

Code tag does **not** back up PostgreSQL. Before risky changes:

1. Liara Console → your **PostgreSQL** database
2. **Backups** / **Snapshot** / export dump
3. Keep at least one restore point labeled with the same date as `v1.0-stable`

Restore only from Liara DB restore UI or `pg_restore` of that dump.

---

## 3. Branch protection on `main` (required)

Do this in GitHub (Settings need repo admin):

1. Repository → **Settings** → **Branches**
2. **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
   - Status checks: select **`Backend build`** and **`Frontend build`** (after CI has run once)
   - **Do not allow bypassing the above settings** (recommended)
5. Optionally: **Restrict who can push to matching branches** (block direct pushes)
6. Save

Workflow after this: all work on feature branches → Pull Request → CI green → merge to `main`.

---

## 4. CI on every PR

File: `.github/workflows/ci.yml`

On each PR / push to `main`:

- Backend: `npm install` → `prisma generate` → `nest build`
- Frontend: `npm install` → `typecheck` → `next build`

If either job fails, the PR must not be merged (once branch protection requires these checks).

---

## 5. Golden rule — Prisma migrations on production

**Only additive migrations in production.**

Allowed examples:

- Add table / column / index
- Add nullable column
- Add new enum value (carefully)
- Backfill in a separate, reversible step when needed

Avoid on production without staging proof + backup:

- Drop column / table
- Rename column in a breaking way
- Change type that requires rewrite
- Destructive `prisma migrate reset`

Process:

1. Write migration locally
2. Apply on **staging** DB first
3. Verify app + data
4. Take production DB backup
5. Deploy app that includes the migration; `prisma migrate deploy` on start
6. Smoke-test production

---

## 6. Deploy only from approved `main` (Liara)

- Connect Liara apps to GitHub branch **`main` only** (not feature branches).
- Prefer deploy **after merge to main**, not on every push to random branches.
- Backend root directory: **`backend`** (Docker / `Dockerfile` in that folder).
- Frontend root directory: **`frontend`**.

If Liara offers **auto-rollback** / previous release restore, enable it and test once that you can roll back a failed deploy.

After a bad deploy:

1. Redeploy previous successful release **or** pin to `v1.0-stable` / `stable/v1.0`
2. If migration already applied and is incompatible, restore DB from the backup taken before that migration (last resort)

---

## 7. Checklist before production change

- [ ] Feature branch + PR
- [ ] CI green (backend + frontend)
- [ ] Migration is additive (or staged + approved)
- [ ] Production DB backup taken
- [ ] Deploy from `main` only
- [ ] Health check: `GET /api/v1/health`
- [ ] Smoke: login / list professionals / one booking path
