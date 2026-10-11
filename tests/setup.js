import {vi} from 'vitest';

// Browser APIs used by responsive layouts and Radix components.
if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
