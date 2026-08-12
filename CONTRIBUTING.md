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

Releases are automated with
[release-please](https://github.com/googleapis/release-please):

1. Merging Conventional Commits to `main` keeps an open **"release" PR** that
   bumps the version in `package.json` and updates `CHANGELOG.md`.
2. Merging that release PR tags the release, creates a GitHub Release, and — in
   the same [`release` workflow](.github/workflows/release.yml) — builds and
   pushes the `web` and `bot` images to the GitHub Container Registry (GHCR).

You never bump the version or edit `CHANGELOG.md` by hand.
