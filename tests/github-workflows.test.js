// @vitest-environment node
import {readFileSync, readdirSync} from 'node:fs';
import {load} from 'js-yaml';
import {describe, expect, it} from 'vitest';

const directory = new URL('../.github/workflows/', import.meta.url);
const restored = ['pr_preview.yml', 'tag_release.yml', 'tauri_release.yml'];
const readWorkflow = name => load(readFileSync(new URL(name, directory), 'utf8'));
const allSteps = workflow => Object.values(workflow.jobs).flatMap(job => job.steps);
const commands = job => job.steps.map(step => step.run ?? '').join('\n');

describe('selectively restored GitHub workflows', () => {
    it('keeps competing push deployments archived while retaining Pages', () => {
        expect(readdirSync(directory).filter(name => /\.ya?ml$/.test(name)).sort())
            .toEqual(['pages.yml', ...restored].sort());
        expect(readdirSync(new URL('../.github/disabled-workflows/', import.meta.url))
            .filter(name => /\.ya?ml$/.test(name)).sort())
            .toEqual(['branch_preview.yml', 'deploy_release.yml']);
        const pages = readWorkflow('pages.yml');
        expect(pages.on).toHaveProperty('push.branches');
        expect(pages.jobs.deploy.if).toContain("github.event_name != 'pull_request'");
        expect(pages.jobs.deploy.if).toContain('github.ref_name == github.event.repository.default_branch');
    });

    it('runs the preview only on PR events, never on push, dispatch or privileged PR events', () => {
        expect(readWorkflow('pr_preview.yml').on).toEqual({pull_request: null});
    });

    it.each(['tag_release.yml', 'tauri_release.yml'])('%s keeps only the original tag filter and rejects tag deletion', name => {
        const workflow = readWorkflow(name);
        expect(workflow.on).toEqual({push: {tags: ['*']}});
        const build = workflow.jobs.build ?? workflow.jobs['build-windows'];
        expect(build.if).toBe('github.event.deleted == false');
    });

    it('keeps untrusted PR code read-only without secrets, environments or publication', () => {
        const workflow = readWorkflow('pr_preview.yml');
        expect(workflow.permissions).toEqual({contents: 'read'});
        for (const job of Object.values(workflow.jobs)) {
            expect(job.permissions ?? workflow.permissions).toEqual({contents: 'read'});
            expect(job).not.toHaveProperty('environment');
            expect(commands(job)).not.toMatch(/curl|netlify|gh release|git push/);
        }
        expect(JSON.stringify(workflow)).not.toMatch(/secrets\.|pull_request_target|workflow_run|deploy-pages|upload-pages-artifact/);
        const upload = allSteps(workflow).find(step => step.uses?.startsWith('actions/upload-artifact@'));
        expect(upload.with).toMatchObject({path: 'dist', 'if-no-files-found': 'error'});
    });

    it('isolates upstream Netlify credentials from the web build and all forks', () => {
        const workflow = readWorkflow('tag_release.yml');
        const deploy = workflow.jobs['deploy-upstream'];
        expect(workflow.permissions).toEqual({contents: 'read'});
        expect(deploy.if).toBe("github.repository == 'DSPCalculator/dsp-calc'");
        expect(deploy.needs).toBe('build');
        expect(JSON.stringify(workflow.jobs.build)).not.toMatch(/secrets\.|environment/);
        expect(deploy.steps.some(step => step.uses?.startsWith('actions/checkout@'))).toBe(false);
        expect(commands(deploy)).not.toMatch(/npm (?:ci|run)|git clone/);
        expect(commands(deploy)).toContain('--no-build');
    });

    it('grants release writes only after the read-only Windows build, and keeps the release a draft', () => {
        const workflow = readWorkflow('tauri_release.yml');
        const build = workflow.jobs['build-windows'];
        const release = workflow.jobs['draft-release'];
        expect(build.permissions ?? workflow.permissions).toEqual({contents: 'read'});
        expect(release.needs).toBe('build-windows');
        expect(release.permissions).toEqual({contents: 'write'});
        expect(release.steps.some(step => step.uses?.startsWith('actions/checkout@'))).toBe(false);
        expect(commands(release)).toContain('.draft == false');
        const publish = release.steps.find(step => step.uses?.startsWith('softprops/action-gh-release@'));
        expect(publish.with).toMatchObject({draft: true, make_latest: false, fail_on_unmatched_files: true});
        expect(publish.with).not.toHaveProperty('target_commitish');
    });

    it('uses the installed Tauri v2 CLI, one frontend build and the Cargo lockfile', () => {
        const build = readWorkflow('tauri_release.yml').jobs['build-windows'];
        const script = commands(build);
        expect(script).toContain('npm run tauri:build -- --target x86_64-pc-windows-msvc --no-bundle --ci -- --locked');
        expect(script).not.toMatch(/cargo tauri|--bundles none|npm run build/);
        expect(script).toContain('$env:GITHUB_REF_NAME');
        expect(script).not.toContain('${{ github.ref_name }}');
    });

    it.each(restored)('%s pins its actions and uses locked Node.js 24 builds', name => {
        const workflow = readWorkflow(name);
        for (const step of allSteps(workflow)) {
            if (step.uses) expect(step.uses).toMatch(/^[\w-]+\/[\w-]+@[0-9a-f]{40}$/);
            if (step.uses?.startsWith('actions/checkout@')) expect(step.with['persist-credentials']).toBe(false);
            if (step.uses?.startsWith('actions/setup-node@')) expect(step.with['node-version']).toBe(24);
        }
        const build = workflow.jobs.build ?? workflow.jobs['build-windows'];
        expect(commands(build)).toContain('npm ci');
        expect(commands(build)).not.toMatch(/npm install/);
    });
});
