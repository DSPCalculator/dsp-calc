# Archived push deployments

These two inherited YAML files remain outside `.github/workflows`, so none of their triggers execute. Both would deploy on ordinary branch pushes and conflict with the fork's chosen Pages deployment path.

- `branch_preview.yml`: originally every push (all branches and tags), plus manual dispatch; publishes to upstream's branch-preview service
- `deploy_release.yml`: originally pushes to `main`; writes generated files to the `release` branch using the old Pages deployment action, from baseline `d53123399a7ab6278d3d1b704e111bef728b727e`

The current deployment is `.github/workflows/pages.yml`. The inherited PR-only and two tag-only workflows are restored in that active directory with updated build steps and fork-safe publication boundaries. See [the workflow inventory](../../docs/github-actions.md) for exact triggers, artifacts and permissions. None of the inherited files had a schedule.
