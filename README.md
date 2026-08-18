# Clean Air Horizons 2026 — Event Command Centre

A live, shared dashboard for running the CAH 2026 event (7–8 September, India Habitat Centre).
Frontend + backend in one small app. **No installation of libraries needed** — it runs on Node.js alone.

It answers five questions at a glance: what needs to happen, who is doing it, when, what is at risk, and where the file is.

---

## What it does

- **Six tabs:** 01 Dashboard · 02 Before event · 03 One week before · 04 Sessions & people · 05 Documents & coordination · 06 Event day.
- **Automatic status:** session readiness (green/amber/red), a "needs attention" panel, overdue tasks, workload per person, and conflict flags (e.g. one person leading two overlapping sessions) are all calculated for you.
- **Everyone can view. A few people can edit.** Editing is protected by a shared passcode. When someone with the passcode switches to editing, they can change any status or entry, then press **Save changes** — and everyone else sees it on their next refresh.
- **No silent overwrites.** If two people edit at once, the second save is stopped with a clear message asking them to refresh first, so nobody's work is lost.
- **Pre-loaded with your real data** from the agenda, session PoCs, responsibility sheets and master checklist. Nothing was invented; where the source files disagreed, the row carries a ⚑ flag to confirm rather than a silent fix.

---

## Run it on your own laptop (to try it)

1. Install [Node.js](https://nodejs.org) (version 18 or newer) if you don't have it.
2. Open a terminal in this folder and run:
   ```
   node server.js
   ```
3. Open **http://localhost:3000** in your browser.
4. The editor passcode is `cleanair2026` until you change it (see below).

To stop, press `Ctrl + C` in the terminal.

---

## Host it so the team can use it (recommended)

Any service that runs a Node app works. The two simplest free options:

**Render (easiest):**
1. Put this folder in a GitHub repository.
2. On [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. Build command: leave blank. Start command: `node server.js`.
4. Under **Environment**, add a variable `EDITOR_PASSCODE` with a passcode of your choice.
5. Deploy. Render gives you a public link to share with the team.
   *(Note: on Render's free tier the data file can reset when the service sleeps. For a permanent record, keep the Google Sheets as the master and use this as the live working view, or attach a Render "disk" to the `data/` folder.)*

**Glitch / Railway:** import the folder, set the same `EDITOR_PASSCODE` variable, and use the start command `node server.js`.

**Set the editor passcode** (do this before sharing): set an environment variable `EDITOR_PASSCODE`. Locally you can run:
```
EDITOR_PASSCODE="your-secret-here" node server.js
```
Share that passcode only with the few people allowed to edit.

---

## How editing works (for the team)

- **View mode** is the default — anyone with the link can read everything.
- **Switch to editing** (top right) → pick your name → enter the passcode → **Start editing**.
- Change statuses, tick readiness boxes, add rows, edit any cell.
- Press **Save changes**. A note records who saved and when.
- **Refresh** (top right) pulls the latest saved version. The dashboard also auto-checks every 20 seconds.
- If someone saved while you were editing, you'll see a notice — refresh, then re-apply your change.

---

## The data

- Live data lives in `data/data.json`. It is created automatically from `data/data.default.json` the first time the server starts.
- **To reset to the original seeded data:** stop the server, delete `data/data.json`, start again (or run `npm run reset`).
- **To re-generate the seed** from the transcribed source content: `node build-seed.js`.
- Because this is a working draft, always verify against the CEEW source documents before anything enters an official output.

---

## Files

| File | What it is |
|------|-----------|
| `server.js` | The backend (serves the app + save/load API). Zero dependencies. |
| `public/index.html`, `styles.css`, `app.js` | The dashboard the team sees. |
| `build-seed.js` | Builds the starting data from your source files. |
| `data/data.default.json` | The seeded starting data. |
| `package.json` | Project metadata and the `start` / `seed` / `reset` scripts. |
