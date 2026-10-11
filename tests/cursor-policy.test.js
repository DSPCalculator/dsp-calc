// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
function sources(directory) {
    return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? sources(filename)
            : /\.(?:css|[jt]sx?)$/.test(filename) ? [[filename, readFileSync(filename, 'utf8')]] : [];
    });
}
const read = filename => readFileSync(path.join(sourceRoot, filename), 'utf8');

describe('default instead of pointer cursor policy', () => {
    it('has no pointer cursor declarations or utilities in any application source', () => {
        for (const [filename, source] of sources(sourceRoot)) {
            expect(source, filename).not.toMatch(/cursor-pointer\b|cursor\s*:\s*['"]?pointer\b|\.cursor\s*=\s*['"]pointer['"]/);
        }
    });

    it('targets buttons and native links without a blanket or important cursor override', () => {
        const css = read('index.css');
        expect(css).toContain('button:not(:disabled), [role="button"]:not(:disabled), a[href], area[href] { cursor: default; }');
        expect(css).not.toMatch(/(?:\*|body|input|textarea)\s*\{[^}]*cursor\s*:/);
        expect(css).not.toMatch(/cursor\s*:[^;}]+!important/);
        expect(css).toContain('@layer base');
    });

    it('retains disabled cursors and pointer-event behavior', () => {
        for (const file of ['select.tsx', 'input.tsx', 'switch.tsx', 'checkbox.tsx']) {
            expect(read(`components/ui/${file}`)).toContain('disabled:cursor-not-allowed');
        }
        expect(read('components/ui/label.tsx')).toContain('peer-disabled:cursor-not-allowed');
        expect(read('App.jsx')).toContain('cursor-not-allowed opacity-50');
        expect(read('index.css')).toContain('pointer-events: none;');
        expect(read('index.css')).toContain('pointer-events: auto;');
        expect(read('logistics_overview.jsx')).toContain("event.pointerType === 'touch'");
    });
});
