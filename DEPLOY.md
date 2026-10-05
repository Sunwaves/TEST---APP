# Deploying BookMe

The app runs on **Vercel** (hosting) with a **Neon** Postgres database. Total setup is about 15 minutes of clicking; no command line needed.

You get a free address like `https://bookme.vercel.app`. A custom domain can be added later (step 6).

## 1. Create the Vercel project

1. Go to <https://vercel.com/signup> and sign up **with GitHub**. Choose the Pro plan if you want it (recommended for production; the free Hobby plan also works).
2. Click **Add New… → Project**, find **Sunwaves/TEST---APP** and click **Import**.
   If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the repository.
3. On the configuration screen:
   - **Root Directory**: click **Edit** and choose `apps/web`. *(Important: the app lives in that folder.)*
   - **Framework Preset**: Next.js (detected automatically).
   - Leave the build and install commands as they are (`apps/web/vercel.json` sets them).
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `CRON_SECRET` | a long random password, e.g. from <https://1password.com/password-generator> (40+ letters and numbers). Keep a copy for step 4. |

5. Click **Deploy**. **This first deploy will fail** because there is no database yet. That's expected; carry on.

## 2. Add the Neon database

1. In your new Vercel project, open the **Storage** tab → **Create Database** → **Neon** (Serverless Postgres) → **Continue**.
2. Pick a region close to your clients (e.g. **London** or **Frankfurt** for the UK), choose a plan, and create it.
3. When asked which environments to connect, keep **Production**, **Preview** and **Development** ticked. Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
4. Go to **Deployments**, open the failed deployment's **⋯** menu and click **Redeploy**. The build now creates the database tables and the site goes live.

## 3. Tell the app its address

1. On the project's overview, copy the **Domains** address, e.g. `https://bookme.vercel.app`.
2. **Settings → Environment Variables** → add `APP_URL` = that address (no trailing slash), for Production.
3. **Deployments → ⋯ → Redeploy** once more, so links in messages use the right address.

## 4. Turn on reminders

Reminders are sent by a GitHub job that calls the site every 10 minutes.

1. On GitHub, open the repository → **Settings → Secrets and variables → Actions → New repository secret**, and add:
   - `APP_URL`: the same address as in step 3
   - `CRON_SECRET`: the same value as in step 1
2. Check it works: **Actions → Deliver reminders → Run workflow**. The run should finish green and print something like `{"sent":0,"failed":0}`.

*(On Vercel Pro you can use Vercel Cron instead; ask to switch.)*

## 5. Create your salon

Open `https://<your-address>/signup`, create your account and salon, add your services and check your opening hours in Settings. Your booking page is shown in Settings → Online booking page.

The demo salon and demo login are **not** created on the live site.

## 6. Later: your own domain and real email

- **Domain**: buy one (e.g. via Vercel → **Domains**, or any registrar), then **Settings → Domains → Add**. Update `APP_URL` (and the GitHub secret) to the new address and redeploy.
- **Real email** (needs your own domain): sign up at <https://resend.com>, verify the domain, create an API key, then add `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `Your Salon <bookings@yourdomain.com>`) in Vercel and redeploy. Until then, messages are simulated and visible in Dashboard → Messages, and **password reset emails are not delivered**.
- **Real SMS**: Twilio account, then `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.

## How updates go live

- Every push to the **production branch** redeploys the live site after the build succeeds. Vercel uses the repository's default branch; check it under **Settings → Git → Production Branch**.
- Every other branch and pull request gets its own **preview** link.
- Database changes (migrations) are applied automatically during the build (`npm run vercel-build`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with "Environment variable not found: DATABASE_URL" | Step 2 not done, or not connected to that environment. |
| Build fails with "Could not find a Next.js app" or similar | Root Directory isn't `apps/web` (Settings → Build and Deployment). |
| Links in messages point to the wrong address | Set `APP_URL` (step 3) and redeploy. |
| Reminders never go out | Check the GitHub secrets (step 4) and the latest **Deliver reminders** run. |
| "Too many attempts" when logging in | Rate limit after repeated wrong passwords; wait 15 minutes. |
