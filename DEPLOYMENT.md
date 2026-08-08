# Deploying to a live URL

Architecture: **backend on AWS Lambda** behind a Function URL (no API Gateway
— Function URLs are simpler and free-tier-friendly for demo traffic),
**frontend on GitHub Pages** (static hosting via GitHub Actions), **MySQL on
the existing RDS instance**. Everything needed to deploy is already written
(`backend/Dockerfile`, `backend/template.yaml`, `.github/workflows/deploy-pages.yml`)
— what's left are steps that need your AWS/GitHub accounts, which I can't do
on your behalf.

## 1. Database: rotate the RDS password

`backend/.env` has the old RDS instance's credentials commented out
(`expense-splitter-db...rds.amazonaws.com`), left in plaintext from an
earlier setup attempt. Before using it:

1. AWS Console → RDS → the `expense-splitter-db` instance → **Modify** →
   set a new master password. (Or, once your AWS CLI is re-authenticated:
   `aws rds modify-db-instance --db-instance-identifier expense-splitter-db --master-user-password '<new password>' --apply-immediately`.)
2. Confirm it's reachable from Lambda: RDS → the instance → **Connectivity &
   security** → check **Publicly accessible** is `Yes`, and the attached
   security group has an inbound rule allowing port 3306 from `0.0.0.0/0`
   (or at minimum a broad range — Lambda outside a VPC egresses from AWS's
   shared IP pool, not a fixed IP, so it can't be scoped tighter than that
   without attaching the function to your VPC, which is more setup than a
   demo needs).
3. Your new connection string: `mysql://admin:<new password>@expense-splitter-db.cvucc6meszah.us-east-2.rds.amazonaws.com:3306/expense_splitter_db`

## 2. AWS CLI: re-authenticate

The credentials in `~/.aws/credentials` are expired (`InvalidClientTokenId`).
Refresh them however you normally do (`aws configure`, `aws sso login`,
etc.), then confirm:

```bash
aws sts get-caller-identity
```

## 3. Deploy the backend to Lambda

```bash
cd backend
sam build
sam deploy --guided
```

`--guided` walks you through stack name, region, and the four parameters
`template.yaml` declares — paste in the RDS connection string from step 1,
a long random `JwtSecret` (`openssl rand -base64 48` works), and leave
`CorsOrigin` as a placeholder for now (you'll update it once you know your
GitHub Pages URL in step 5 — `sam deploy` again after with the real value).
Say yes to saving these as defaults in `samconfig.toml` so future deploys
are just `sam deploy` -- that file is gitignored on purpose: `--guided`
writes parameter values into it in plaintext, including the DB password and
JWT secret (`NoEcho` only hides them from the terminal prompt, it doesn't
stop them from being saved to disk). Never remove it from `.gitignore`.

When it finishes, copy the **FunctionUrl** output — that's your live API
base (append `/api` for the actual endpoint prefix the app expects).

Sanity check:

```bash
curl https://<function-url>/health
```

Note on cold starts: this is a container-image Lambda function with no
provisioned concurrency (not worth the cost for demo traffic), so the first
request after a period of inactivity will take a few seconds while Lambda
spins up a fresh execution environment and `prisma migrate deploy` runs its
no-op check. Worth a line in the resume README so it doesn't read as a bug
when someone clicks the link cold.

## 4. Push the repo to GitHub

This repo has never been pushed anywhere (`git remote -v` is empty). Create
an empty repo on GitHub (no README/gitignore — this repo already has both),
then:

```bash
git remote add origin git@github.com:<you>/expense-splitter.git
git push -u origin main
```

## 5. Enable GitHub Pages

Repo → **Settings** → **Pages** → under **Build and deployment**, set
**Source** to **GitHub Actions**. That's the only manual toggle; the
workflow at `.github/workflows/deploy-pages.yml` handles the rest on every
push to `main`.

Before the first real deploy, set the backend URL it needs to build against:
Repo → **Settings** → **Secrets and variables** → **Actions** → **Variables**
tab → **New repository variable** → name `REACT_APP_API_URL`, value
`https://<function-url>/api` from step 3. (It's a variable, not a secret —
it's a public URL, nothing sensitive — but Actions needs it set either way
since CRA inlines env vars at build time.)

Push to `main` (or re-run the workflow manually from the Actions tab) and
the frontend deploys to `https://<you>.github.io/<repo-name>/`.

## 6. Close the loop: CORS

Once you have the real Pages URL, update the Lambda's `CorsOrigin` to match
it exactly (including no trailing slash) and redeploy:

```bash
cd backend
sam deploy --parameter-overrides CorsOrigin=https://<you>.github.io
```

Without this, the deployed frontend's requests will be blocked by the
backend's CORS check (by design — same mechanism I verified is working
during local testing, just pointed at the wrong origin until this step).

## 7. Seed demo data (optional, recommended for a resume link)

```bash
cd backend
DATABASE_URL="mysql://admin:<password>@<rds-host>:3306/expense_splitter_db" npm run seed
```

Gives anyone clicking the link real data to look at immediately (login as
`demo@example.com` / `password123`) instead of an empty "create your first
group" screen.

## Everything above this line needs your credentials

Once redeployed with steps 3-6, run through the app end to end (this is
identical to how I browser-tested the app locally in stage 4 — the plan
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the local dev flow are
unchanged, only the URLs differ) and let me know if anything doesn't behave
the way it did locally. Stage 7 (README with the live link, screenshots,
and the algorithm writeup) picks up once this is live.
