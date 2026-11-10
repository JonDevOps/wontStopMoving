# Deployment checks

The `CI` workflow runs the `Verify` check on pull requests, pushes to `main`,
and manual runs. It installs dependencies from the lockfile,
checks TypeScript, builds Next.js, then runs the Firestore rules and API tests
against local Auth and Firestore emulators using the `demo-wsm` project.

CI needs no Firebase login or production secrets. Node is pinned in `.nvmrc`,
Java is version 21, Firebase CLI is pinned in the workflow, and GitHub Actions
are pinned to immutable commits with read-only repository permissions.

Next.js's default TypeScript validation is enabled. A type error fails
`npm run build`, including Firebase App Hosting builds.

`npm run lint` runs ESLint with Next.js's recommended rules
(`eslint.config.mjs`). Rules that catch real bugs, such as the React hooks
rules and missing list keys, are errors and fail CI. Style rules the existing
code breaks in many places (unused variables, `any`, unescaped apostrophes)
are warnings for now; tighten them to errors as the code is cleaned up.

## Publishing changes

Both repositories require the GitHub Actions `Verify` check on `main`, with
branches up to date before merging. The protection applies to administrators,
blocks force pushes and deletion, and requires a pull request. No second-person
review is required, so the owner can merge their own passing pull requests.

1. Work on a branch such as `codex/my-change`.
2. Open a pull request and wait for `Verify` to succeed.
3. Merge the passing pull request. Firebase App Hosting automatically deploys
   `main` from `JonDevOps/wontStopMoving`.
4. Keep `wontStopMoving/wontStopMoving` synchronized through a passing pull
   request as well. The organization repository is not the App Hosting source.

Changing or renaming the `Verify` job requires updating the required-check
setting in both repositories. Do not bypass a failing check to deploy.

## Local verification

Use Node from `.nvmrc` and Java 21, then run:

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npx --yes firebase-tools@15.34.2 emulators:exec --only auth,firestore --project demo-wsm "npm run test:support"
```
