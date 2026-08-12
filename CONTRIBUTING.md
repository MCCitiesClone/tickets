# Contributing

## Workflow

- Branch off `main`, open a **pull request**, and reference the issue it closes
  (e.g. `Closes #12`) so merging auto-closes it.
- CI (lint, typecheck, build, Docker build) must pass — see
  [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
- Local development uses [aube](https://github.com/); CI and Docker install with
  `npm ci` from the committed `package-lock.json`.

## Conventional Commits

Commit messages (and PR titles, when squashing) follow
[Conventional Commits](https://www.conventionalcommits.org/). The type prefix
drives automated versioning and the changelog:

| Type       | Use for                                   | Version bump (pre-1.0) |
| ---------- | ----------------------------------------- | ---------------------- |
| `feat:`    | a user-facing feature                     | minor (`0.x.0`)        |
| `fix:`     | a bug fix                                 | patch (`0.0.x`)        |
| `docs:`    | documentation only                        | none                   |
| `refactor:`| code change that isn't a feature or fix   | none                   |
| `perf:`    | performance improvement                   | patch                  |
| `ci:`      | CI/CD changes                             | none                   |
| `build:`   | build system / dependencies               | none                   |
| `chore:`   | maintenance (hidden from changelog)       | none                   |

A `!` after the type (e.g. `feat!:`) or a `BREAKING CHANGE:` footer marks a
breaking change. While the project is pre-1.0, breaking changes bump the
**minor** version rather than the major.

Examples:

```
feat: add per-user blacklist
fix: reset multi-panel dropdown after opening a ticket
docs: document canned-response placeholders
```

## Releases

Releases are fully automated with
[semantic-release](https://github.com/semantic-release/semantic-release) — there
is **no release PR to approve**. When a releasable change (a `feat:` or `fix:`,
or a breaking change) lands on `main`, the
[`release` workflow](.github/workflows/release.yml):

1. computes the next version from the Conventional Commits since the last
   release,
2. updates `CHANGELOG.md` and `package.json`, commits them, and tags the
   release,
3. creates the GitHub Release, and
4. builds and pushes the `web` and `bot` images to the GitHub Container Registry
   (GHCR).

Commits that don't affect users (`docs:`, `ci:`, `chore:`, `refactor:`,
`build:`) don't trigger a release. You never bump the version or edit
`CHANGELOG.md` by hand.
