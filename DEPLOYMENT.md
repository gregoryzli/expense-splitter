# Deploying to a live URL

Architecture: **backend on Render** (free-tier Docker web service, running
the exact same image as local docker-compose), **database on TiDB
Serverless** (MySQL wire-compatible, genuinely free), **frontend on GitHub
Pages** (static hosting via GitHub Actions). No AWS involved -- everything
needed to deploy is already written (`backend/Dockerfile`, `render.yaml`,
`.github/workflows/deploy-pages.yml`, `.github/workflows/keep-alive.yml`)
-- what's left are steps that need your Render/TiDB/GitHub accounts, which
I can't do on your behalf.

(Earlier draft of this doc targeted AWS Lambda + RDS -- abandoned because
the AWS account was gated behind payment/identity verification with no
clear timeline, and Aurora/RDS don't meaningfully benefit from AWS's free
tier anyway. Render's free web service runs the unmodified Dockerfile with
no code changes, which is simpler than the Lambda path was.)

## 1. Database: create a TiDB Serverless cluster

1. Sign up at [tidbcloud.com](https://tidbcloud.com) and create a
   **Serverless** cluster (free tier, no credit card required historically
   -- confirm that's still true when you sign up).
2. From the cluster's **Connect** panel, grab the connection details and
   build a Prisma-style URL:
   `mysql://<user>:<password>@<host>:4000/expense_splitter_db?sslaccept=strict`
3. TiDB supports real foreign keys (unlike PlanetScale's old free tier), so
   the existing `prisma/schema.prisma` works as-is -- no `relationMode`
   workaround needed.
4. Run migrations against it once, from your machine:
   ```bash
   cd backend
   DATABASE_URL="mysql://...?sslaccept=strict" npx prisma migrate deploy
   ```

## 2. Deploy the backend to Render

1. Sign up at [render.com](https://render.com) and connect your GitHub
   account (needed after step 4 below, once this repo is pushed).
2. **New +** -> **Blueprint** -> pick this repo. Render reads `render.yaml`
   at the root and creates the `expense-splitter-api` web service from
   `backend/Dockerfile` automatically.
3. Before the first deploy succeeds, set the three secrets `render.yaml`
   leaves blank (Render's dashboard -> the service -> **Environment**):
   - `DATABASE_URL` -- the TiDB connection string from step 1
   - `JWT_SECRET` -- a long random value, e.g. `openssl rand -base64 48`
   - `CORS_ORIGIN` -- leave as a placeholder for now (e.g.
     `http://localhost:3000`); you'll update it once you know your GitHub
     Pages URL in step 4, then Render auto-redeploys on save.
4. Once deployed, copy the service URL (`https://expense-splitter-api-xxxx.onrender.com`).
   Sanity check:
   ```bash
   curl https://expense-splitter-api-xxxx.onrender.com/health
   ```

Note on cold starts: the free plan spins the container down after 15
minutes idle; the next request pays a ~30-60s cold-start penalty while it
boots and `prisma migrate deploy` runs its no-op check. The keep-alive
workflow in step 5 avoids this for anyone clicking the link, but it's
worth a line in the resume README regardless so a cold hit doesn't read as
a bug.

## 3. Push the repo to GitHub

This repo has never been pushed anywhere (`git remote -v` is empty). Create
an empty repo on GitHub (no README/gitignore -- this repo already has
both), then:

```bash
git remote add origin git@github.com:<you>/expense-splitter.git
git push -u origin main
```

## 4. Enable GitHub Pages

Repo -> **Settings** -> **Pages** -> under **Build and deployment**, set
**Source** to **GitHub Actions**. That's the only manual toggle; the
workflow at `.github/workflows/deploy-pages.yml` handles the rest on every
push to `main`.

Before the first real deploy, set the backend URL it needs to build against:
Repo -> **Settings** -> **Secrets and variables** -> **Actions** ->
**Variables** tab -> **New repository variable** -> name
`REACT_APP_API_URL`, value `https://expense-splitter-api-xxxx.onrender.com/api`
from step 2. (It's a variable, not a secret -- it's a public URL, nothing
sensitive -- but Actions needs it set either way since CRA inlines env
vars at build time.)

Push to `main` (or re-run the workflow manually from the Actions tab) and
the frontend deploys to `https://<you>.github.io/<repo-name>/`.

## 5. Turn on the keep-alive ping

Same **Variables** tab as step 4 -> add `RENDER_APP_URL` =
`https://expense-splitter-api-xxxx.onrender.com`. The workflow at
`.github/workflows/keep-alive.yml` pings `/health` every 14 minutes on a
schedule -- until this variable is set it's a harmless no-op.

## 6. Close the loop: CORS

Once you have the real Pages URL, go back to Render's dashboard ->
**Environment** and update `CORS_ORIGIN` to match it exactly (including no
trailing slash), e.g. `https://<you>.github.io`. Render redeploys
automatically on save.

Without this, the deployed frontend's requests will be blocked by the
backend's CORS check (by design -- same mechanism I verified is working
during local testing, just pointed at the wrong origin until this step).

## 7. Seed demo data (optional, recommended for a resume link)

```bash
cd backend
DATABASE_URL="mysql://...?sslaccept=strict" npm run seed
```

Gives anyone clicking the link real data to look at immediately (login as
`demo@example.com` / `password123`) instead of an empty "create your first
group" screen.

## Cleanup: the old RDS instance

If you had already created an `expense-splitter-db` RDS instance from an
earlier attempt, it's unused now -- delete it once your AWS account clears
verification, so it doesn't quietly start billing for a database nothing
reads from anymore.

## Everything above this line needs your credentials

Once deployed through steps 1-6, run through the app end to end (this is
identical to how I browser-tested the app locally in stage 4 -- the plan
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the local dev flow are
unchanged, only the URLs differ) and let me know if anything doesn't behave
the way it did locally. Stage 7 (README with the live link, screenshots,
and the algorithm writeup) picks up once this is live.
