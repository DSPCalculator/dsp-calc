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

    if (id.includes('/src/shared/icons/ItemIcon')) {
        return 'icon-ui';
    }

    if (id.includes('/src/shared/icons/iconRegistryLoader')
        || id.includes('/src/shared/icons/iconRegistryHelpers')) {
        return 'icon-ui';
    }

    if (id.includes('/src/shared/icons/registries/Vanilla')) {
        return 'icon-registry-vanilla';
    }

    if (id.includes('/src/shared/icons/registries/MoreMegaStructure')) {
        return 'icon-registry-mms';
    }

    if (id.includes('/src/shared/icons/registries/TheyComeFromVoid')) {
        return 'icon-registry-tcfv';
    }

    if (id.includes('/src/shared/icons/registries/GenesisBook')) {
        return 'icon-registry-genesis';
    }

    if (id.includes('/src/shared/icons/registries/OrbitalRing')) {
        return 'icon-registry-orbital';
    }

    if (id.includes('/src/shared/icons/registries/FractionateEverything')) {
        return 'icon-registry-fractionate';
    }

    if (id.includes('/src/shared/selectors/ItemPickerButton')) {
        return 'item-select-ui';
    }

    if (id.includes('/src/core/calculation/globalState')
        || id.includes('/src/core/calculation/globalStateDerivations')
        || id.includes('/src/core/vendor/javascriptLpSolverBrowser')
        || id.includes('/src/core/game-data/gameData')) {
        return 'calc-core';
    }

    if (id.includes('/src/features/result/ResultPanel')
        || id.includes('/src/features/result/ResultRecipeSelectors')
        || id.includes('/src/features/result/resultSelectorClasses')
        || id.includes('/src/features/result/RecipeDisplay')
        || id.includes('/src/features/result/BatchPresetControls')
        || id.includes('/src/features/result/NaturalProductionLinesTable')
        || id.includes('/src/features/settings/SettingsPanel')
        || id.includes('/src/shared/ui/HorizontalMultiButtonSelect')) {
        return 'calc-ui';
    }

    if (id.includes('/src/features/needs/NeedsPanel')
        || id.includes('/src/features/needs/NeedsStorageControls')) {
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
