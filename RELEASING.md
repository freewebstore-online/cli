# Releasing @freewebstore/cli

**Never `npm publish` from your laptop.** Every published version of this
CLI ships through GitHub Actions with OIDC trusted publishing — that gives
us npm provenance attestations, a CI run linked to every release, and no
NPM_TOKEN secrets sitting in anyone's `~/.npmrc`.

## How to cut a release

```sh
# 1. From a clean main branch:
git checkout main && git pull

# 2. Bump version. npm version updates package.json, makes a commit, and
#    tags it. Use `patch` / `minor` / `major` per semver.
npm version patch       # 0.1.0 → 0.1.1

# 3. Push the bump + tag.
git push --follow-tags
```

That's it. The push triggers `.github/workflows/publish.yml`, which:

1. Installs deps + runs the test suite (publish aborts if tests fail).
2. Compares `package.json` version against `npm view @freewebstore/cli version`.
3. If the local version is newer, runs `pnpm publish --access public --provenance` via OIDC.
4. If the version is unchanged, exits cleanly — the workflow is safe to
   re-trigger.

Verify after the workflow goes green:

```sh
npm view @freewebstore/cli version
# should match the bumped version
```

The published tarball will have a verifiable provenance attestation
pointing back at the exact commit + workflow run that produced it. Anyone
can check with `npm audit signatures`.

## One-time setup (already done, here for reference)

OIDC trusted publishing requires a one-time registration on npmjs.com
that links the package to this GitHub repo's Actions workflow. The
registration is what lets the workflow mint a publish-scoped auth token
at runtime without storing an NPM_TOKEN anywhere.

To re-do or audit:

1. Open https://www.npmjs.com/package/@freewebstore/cli/access
2. Under **Trusted Publisher**, click **Add**.
3. Configure GitHub Actions:
   - Repository owner: `freewebstore-online`
   - Repository name: `cli`
   - Workflow filename: `publish.yml`
   - Environment: *(leave blank)*

Once registered, the workflow's `id-token: write` permission + the
`--provenance` flag are enough — no secrets in this repo's settings.

## Why CI/CD, not local

| Concern | Local `npm publish` | CI/CD via OIDC |
|---|---|---|
| Supply-chain provenance | No attestation | Signed attestation per release |
| Auth secret | `~/.npmrc` NPM_TOKEN | None (OIDC short-lived) |
| Tied to a commit | Loose ("trust me") | Hard link (workflow + commit hash) |
| Repeatable | Depends on dev's node + pnpm | Same node + pnpm every time |
| Anyone can release | Only people with NPM_TOKEN | Anyone with repo merge rights |

The earlier v0.1.0 was published from a laptop because the workflow
didn't exist yet. Every subsequent release ships through CI.

## Cross-workspace pattern

Same shape across the six-store workspace:

| Store | Workflow path |
|---|---|
| FAS | `freeappstore-online/platform/.github/workflows/publish.yml` (matrix across `cli`, `sdk`, `compliance`, `quality`) |
| FGS | `freegamestore-online/platform/.github/workflows/publish.yml` |
| FWS | `freewebstore-online/cli/.github/workflows/publish.yml` (this repo) |

When PAS / PGS / PWS ship a CLI, vendor-port this workflow file. See
`~/.claude/projects/-Users-serge-ivo-dev-stores/memory/ci-cd-canonical.md`
(if present) for the workspace-wide policy.
