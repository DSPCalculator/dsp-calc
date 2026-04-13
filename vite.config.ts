import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import packageJson from './package.json';
import {defineConfig} from 'vite';

function get_manual_chunks(id: string): string | undefined {
    if (id.includes('node_modules')) {
        if (id.includes('javascript-lp-solver')) return 'solver-vendor';
        if (id.includes('/antd/') || id.includes('/@ant-design/') || id.includes('/rc-')) return 'antd-vendor';
        if (id.includes('/react-bootstrap/') || id.includes('/bootstrap/') || id.includes('/@popperjs/core/')) return 'bootstrap-vendor';
        if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
        if (id.includes('/ahooks/') || id.includes('/fuzzysort/') || id.includes('/pinyin-pro/')) return 'search-vendor';
        return 'vendor';
    }

    if (id.includes('/src/ui/components/icons/ItemIcon')) {
        return 'icon-ui';
    }

    if (id.includes('/src/ui/components/icons/iconRegistryLoader')
        || id.includes('/src/ui/components/icons/iconRegistryHelpers')) {
        return 'icon-ui';
    }

    if (id.includes('/src/ui/components/icons/registries/Vanilla')) {
        return 'icon-registry-vanilla';
    }

    if (id.includes('/src/ui/components/icons/registries/MoreMegaStructure')) {
        return 'icon-registry-mms';
    }

    if (id.includes('/src/ui/components/icons/registries/TheyComeFromVoid')) {
        return 'icon-registry-tcfv';
    }

    if (id.includes('/src/ui/components/icons/registries/GenesisBook')) {
        return 'icon-registry-genesis';
    }

    if (id.includes('/src/ui/components/icons/registries/OrbitalRing')) {
        return 'icon-registry-orbital';
    }

    if (id.includes('/src/ui/components/icons/registries/FractionateEverything')) {
        return 'icon-registry-fractionate';
    }

    if (id.includes('/src/ui/components/selectors/ItemPickerButton')) {
        return 'item-select-ui';
    }

    if (id.includes('/src/engine/calculation/globalState')
        || id.includes('/src/engine/calculation/globalStateDerivations')
        || id.includes('/src/engine/solver/javascriptLpSolverBrowser')
        || id.includes('/src/engine/data/gameData')) {
        return 'calc-core';
    }

    if (id.includes('/src/ui/features/result/ResultPanel')
        || id.includes('/src/ui/features/result/ResultRecipeSelectors')
        || id.includes('/src/ui/features/result/resultSelectorClasses')
        || id.includes('/src/ui/features/result/RecipeDisplay')
        || id.includes('/src/ui/features/result/BatchPresetControls')
        || id.includes('/src/ui/features/result/NaturalProductionLinesTable')
        || id.includes('/src/ui/features/settings/SettingsPanel')
        || id.includes('/src/ui/components/controls/HorizontalMultiButtonSelect')) {
        return 'calc-ui';
    }

    if (id.includes('/src/ui/features/needs/NeedsPanel')
        || id.includes('/src/ui/features/needs/NeedsStorageControls')) {
        return 'selection-ui';
    }
}

export default defineConfig(() => ({
    base: './',
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    },
    resolve: {
        alias: {
            '@engine': path.resolve(process.cwd(), 'src/engine'),
            '@ui': path.resolve(process.cwd(), 'src/ui'),
            '@lib': path.resolve(process.cwd(), 'src/lib'),
            '~bootstrap': path.resolve(process.cwd(), 'node_modules/bootstrap'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: get_manual_chunks,
            },
        },
    },
    plugins: [
        react(),
        legacy({
            targets: ['ie>=11'],
            additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        }),
    ],
}));
