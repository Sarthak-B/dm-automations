# FlexiAutomations

Team hub at **https://flexiautomations.vercel.app** that runs approved GitHub Actions workflows (AiSensy broadcast sync, Discrepancy tracker) with a team access code.

This repo is connected to the Vercel project **flexiautomations**. Every commit to `main` deploys to production automatically.

## What's where

| Path | What it is |
|---|---|
| `public/index.html` | The built website (one self-contained file). This is what visitors get. |
| `public/FlexiAutomations.html` | Same file, served for the "Download HTML" link. |
| `api/bridge.js` | Server: checks the team code, reads workflow inputs from GitHub, starts runs, lists activity. |
| `lib/vendor/yaml.mjs` | YAML parser (js-yaml 4.1.1) used to read workflow inputs. |
| `source/frontend/` | Editable React source: `Home.tsx` (dashboard + forms), `entry.tsx` (access-code screen), `styles.css`, `catalog.ts` (built-in workflows). |
| `source/build.mjs` | Rebuilds `public/index.html` from `source/frontend/`. |
| `tests/` | Server tests with mocked GitHub/Redis. |
| `vercel.json` | Vercel config: no build step, serves `public/`, routes `/api/*` to `api/bridge.js`. |
| `.env.example` | Names of the server settings. Real values live only in Vercel → Settings → Environment Variables. |

## Workflow form fields

The Run form is built from each workflow's `workflow_dispatch` inputs, read live from GitHub.
To add or change a field, edit the workflow YAML in its own repo (e.g. `.github/workflows/test.yml` in
`flexifunnels-discrepancy-tracker`). Nothing needs to change here.

## Changing the website

1. Edit files in `source/frontend/`.
2. Rebuild the page:
   ```
   cd source && npm install && cd ..
   node source/build.mjs
   ```
3. Commit both the source change and the rebuilt `public/` files, then push to `main`.

Only changing `public/index.html` without the source (or the reverse) will make them drift apart, so always rebuild.

## Checks

```
npm test
```

## Server settings (Vercel → Settings → Environment Variables)

`TEAM_ACCESS_CODE`, `GITHUB_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (required);
`ALLOWED_REPOSITORIES`, `DISCREPANCY_WORKFLOW` (optional). Never commit real values.

`START-HERE.txt` has the original setup notes.
