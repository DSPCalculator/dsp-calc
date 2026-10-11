// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {normalizeBase} from '../vite.config.js';

describe('deployment base paths', () => {
    it.each([
        [undefined, '/'],
        ['', '/'],
        ['/', '/'],
        ['/dsp-calc', '/dsp-calc/'],
        ['/renamed-fork/', '/renamed-fork/'],
        ['nested/project', '/nested/project/'],
        ['./', './'],
    ])('normalizes %s to %s', (input, expected) => {
        expect(normalizeBase(input)).toBe(expected);
    });
});
