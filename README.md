# TidyTrack — Deployment Guide

You're going to:
1. Put your two Supabase keys into the app
2. Push the project to GitHub (free)
3. Connect GitHub to Vercel (free)
4. Get a live URL like `tidytrack-yourname.vercel.app` that works on any phone

Total time: 15–20 minutes. No credit card needed.

---

## Step 1 — Add your Supabase keys to the app

1. Open the file `src/App.jsx` in any text editor (TextEdit on Mac, Notepad on Windows, or VS Code).
2. Near the top, find these two lines:

```js
const SUPABASE_URL = "PASTE_YOUR_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";
```

3. Replace them with the keys you copied from Supabase. Keep the quotes! It should look like:

```js
const SUPABASE_URL = "https://abcdefghij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGc...very long string...";
```

4. Save the file.

---

## Step 2 — Create a free GitHub account (skip if you have one)

Go to https://github.com → click **Sign up** → follow the prompts. Free.

---

## Step 3 — Install GitHub Desktop (easiest way to upload)

If you've never used Git before, this is the easiest path. No command line.

1. Download from https://desktop.github.com → install → sign in with your GitHub account.
2. Open GitHub Desktop.
3. Click **File → Add Local Repository**.
4. Click **Choose…** and pick the `tidytrack-app` folder (the one this README is in).
5. It will say "This directory does not appear to be a Git repository." Click **create a repository**.
6. Leave defaults, click **Create Repository**.
7. At the top, click **Publish repository**.
8. ⚠️ **Uncheck "Keep this code private"** if you want Vercel's free tier to work easily, OR leave it private (Vercel works with private repos too, just one extra step).
9. Click **Publish Repository**.

Your code is now on GitHub. 🎉

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com → click **Sign Up** → choose **Continue with GitHub** → authorize.
2. Once logged in, click **Add New… → Project**.
3. Find your `tidytrack-app` repository in the list → click **Import**.
4. Vercel will auto-detect it as a Vite project. Don't change anything.
5. Click **Deploy**.
6. Wait ~1 minute. ☕

When done, you'll see a celebration screen with a URL like:
`tidytrack-app-yourname.vercel.app`

Click it. You should see the PIN entry screen of TidyTrack.

---

## Step 5 — Test it

1. On your phone or computer, open the Vercel URL.
2. Enter the PIN you set up for your manager account (e.g. `9999`).
3. You should land in the Manager dashboard.

If it works:
- 📱 Add the URL to your phone's home screen for an app-like experience (Safari: Share → Add to Home Screen; Chrome: ⋮ → Add to Home Screen).
- Tap **Team** to add your employees with their PINs.
- Tap **Properties** to set up the apartment complex(es) you clean.
- Have your employees open the URL and sign in with their PINs.

---

## Updating the app later

When you want to change something:
1. Open `src/App.jsx`, make your changes, save.
2. Open GitHub Desktop → write a short summary of the change → click **Commit to main** → click **Push origin**.
3. Vercel detects the push and re-deploys automatically (~1 min).

That's it. No FTP, no uploads, no servers to manage.

---

## Troubleshooting

**"Setup needed" screen on the deployed site**
You forgot Step 1 — go back, paste your real Supabase URL and anon key into `src/App.jsx`, commit and push.

**"Invalid PIN" when signing in**
You haven't created an employee with that PIN yet. Go to Supabase SQL Editor and run:
```sql
INSERT INTO employees (name, pin, role) VALUES ('Owner', '9999', 'manager');
```

**Photos won't upload**
You probably skipped the storage bucket setup or the storage policy SQL. Go back to Supabase → Storage → confirm `task-photos` bucket exists and is **public**.

**Anything else**
The browser's developer console (F12 in Chrome) usually shows the actual error. Copy/paste it back to me.

---

## Costs

- **Supabase free tier**: 500 MB database, 1 GB storage, 50,000 monthly users. You'll hit this in 12–24 months at the earliest.
- **Vercel free tier**: 100 GB bandwidth/month. Plenty for a small business.
- **GitHub free tier**: unlimited public + private repos.

When you outgrow free, Supabase Pro is $25/mo and Vercel Pro is $20/mo. Most small cleaning businesses never need to upgrade.
