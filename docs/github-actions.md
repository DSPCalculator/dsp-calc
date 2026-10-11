# GitHub Actions triggers and publication

The inherited workflows were audited against the archived copies at `afc196f` and the original files at `d53123399a7ab6278d3d1b704e111bef728b727e`. The three workflows that do not run on ordinary branch pushes are active again. The two old push deployment workflows remain archived. No new manual or scheduled trigger was added.

| Workflow | Original trigger | Current fork behavior |
| --- | --- | --- |
| `pages.yml` | Replacement workflow: branch pushes, pull requests, manual dispatch | Checks PRs targeting the current default branch; builds and deploys only the default branch on push/manual runs |
| `pr_preview.yml` | `pull_request` | Validates PRs targeting any branch and uploads a downloadable preview; never publishes externally |
| `tag_release.yml` | Pushes matching tag `*` | Validates and uploads a web release artifact; external Netlify deploy is restricted to `DSPCalculator/dsp-calc` |
| `tauri_release.yml` | Pushes matching tag `*` | Validates, builds a Windows executable and creates or updates a draft GitHub release in this repository |
| `branch_preview.yml` (archived) | Every push, including branches and tags; manual dispatch | Does not run |
| `deploy_release.yml` (archived) | Pushes to `main` | Does not run |

The inherited tag pattern `*` is unchanged: tags such as `v0.5.7` match; slash-containing tags such as `release/v0.5.7` do not. Deleting a tag does not produce a build. There were no inherited schedules or other named-branch filters. GitHub's default PR activity types are `opened`, `synchronize` and `reopened`; draft PRs are included.

An ordinary push to `master`/the default branch therefore keeps the existing Pages behavior without starting either tag release. A push to a PR's head branch may also produce the PR event. Default-branch PRs intentionally run both the existing Pages validation and the restored preview build; the preview adds a downloadable artifact and also covers PRs to other branches. They use separate concurrency groups and neither can cancel a production deployment.

## Pull-request preview

The `Validate pull request preview` workflow uses `pull_request`, read-only repository permissions and checkout without persisted credentials. It runs Node.js 24, `npm ci`, lint, typechecking, tests, the web build and asset verification. It has no environment, secrets, release write permission, Pages upload or external preview POST.

Download `pr-preview-<number>` from that run's **Artifacts** section within seven days. Extract it and serve it as a static site at `/`; the build uses root-relative assets. This is a review artifact, not a hosted preview URL. GitHub's usual approval policy still applies to workflows from outside contributors.

## Tagged web build

`Build tagged web release` runs the same checks and uploads `tagged-web-release`, retained for 14 days. Its assets are built for `/`. This workflow does not replace the fork's Pages site, which still follows the current default branch and its configured Pages base path.

The original Netlify destination belongs to upstream. The deploy job retains the strict `github.repository == 'DSPCalculator/dsp-calc'` guard, so it is skipped on this fork even if similarly named secrets exist. Upstream deploys use their existing environment, `NETLIFY_AUTH_TOKEN` secret and `NETLIFY_SITE_ID` variable. No new credential, secret or token permission is required. The job downloads the validated artifact on a fresh runner without checking out or executing project code, and uses pinned Netlify CLI `27.10.2` with build execution disabled.

## Tagged Windows draft release

`Build Tauri desktop app on tag` runs Node.js 24 with `npm ci`, lint, typechecking and tests on Windows. The npm-installed, lockfile-pinned Tauri v2 CLI invokes the configured frontend build once, setting the Tauri environment so assets are relative and the web service worker is omitted. `--no-bundle` builds the executable without an installer, and Cargo receives `--locked`.

The executable and `LICENSE` are zipped and uploaded as the `tauri-windows-x64` workflow artifact for 14 days. A separate job downloads only that archive and uses the inherited `contents: write` permission to create or update a **draft** release for the pushed tag. The build job remains read-only; it has no signing secret. An existing published release causes the release job to stop without changing it. The tag is provided by the user; this workflow does not create or push tags.

Review and publish the draft separately when ready. The executable is unsigned and requires the WebView2 runtime. This restoration does not prove a Windows binary runs: that needs the Windows workflow and a Windows smoke test. No tag, draft release or Netlify publication was created as part of local workflow validation.

## Maintenance and validation

Restored workflow actions are pinned to reviewed commit SHAs, including the Rust toolchain installer and release action. JavaScript actions use Node.js 24-compatible versions. The existing Pages workflow is unchanged. Updating a pin should include reviewing the action's release notes and `action.yml`; package and Cargo lockfiles remain the dependency sources of truth.

`tests/github-workflows.test.js` checks the trigger boundaries, read-only PR path, upstream-only Netlify publication, isolated draft-release permission and current Tauri invocation. Use `npm test -- tests/github-workflows.test.js` for those regressions. Run [actionlint](https://github.com/rhysd/actionlint) against the active workflow directory for syntax, expressions and shell checks. Actual hosted execution remains the integration check for GitHub environments, artifact transfer, the Windows compiler and external service configuration.

Sources: [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [events and tag filters](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push), [Tauri CLI](https://v2.tauri.app/reference/cli/), [release action](https://github.com/softprops/action-gh-release), [Netlify deploy command](https://cli.netlify.com/commands/deploy/).
