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

Firebase App Hosting deploys `main` from the organization repository,
`wontStopMoving/wontStopMoving`. `main` requires the GitHub Actions `Verify`
check, with branches up to date before merging. The protection applies to
administrators, blocks force pushes and deletion, and requires a pull request.
No second-person review is required.

Pushing a branch to the organization repository ships it automatically (the
`Auto ship` workflow):

1. Push any branch other than `main`.
2. `Auto ship` opens a pull request into `main`, starts `Verify`, and turns on
   auto-merge. Later pushes to the same branch update that pull request.
3. When `Verify` passes, GitHub merges the pull request, deletes the branch,
   and App Hosting deploys. A failing check never merges.

To push without shipping, name the branch `wip/...` or `draft/...`, or put
`[no-ship]` in the commit message. To stop an open pull request, turn off its
auto-merge. Work on the `JonDevOps/wontStopMoving` fork does not deploy until a
pull request brings it into the organization repository.

Changing or renaming the `Verify` job requires updating the required-check
setting in the organization repository. Do not bypass a failing check to deploy.

## Local verification

Use Node from `.nvmrc` and Java 21, then run:

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npx --yes firebase-tools@15.34.2 emulators:exec --only auth,firestore --project demo-wsm "npm run test:support"
```
