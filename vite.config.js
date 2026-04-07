import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import legacy from '@vitejs/plugin-legacy';

function get_manual_chunks(id) {
    if (id.includes('node_modules')) {
        if (id.includes('javascript-lp-solver')) return 'solver-vendor';
        if (id.includes('/antd/') || id.includes('/@ant-design/') || id.includes('/rc-')) return 'antd-vendor';
        if (id.includes('/react-bootstrap/') || id.includes('/bootstrap/') || id.includes('/@popperjs/core/')) return 'bootstrap-vendor';
        if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
        if (id.includes('/ahooks/') || id.includes('/fuzzysort/') || id.includes('/pinyin-pro/')) return 'search-vendor';
        return 'vendor';
    }

    if (id.includes('/src/shared/icons/ItemIcon.jsx')) {
        return 'icon-ui';
    }

    if (id.includes('/src/shared/icons/iconRegistryLoader.js')
        || id.includes('/src/shared/icons/iconRegistryHelpers.js')) {
        return 'icon-ui';
    }

    if (id.includes('/src/shared/icons/registries/Vanilla.js')) {
        return 'icon-registry-vanilla';
    }

    if (id.includes('/src/shared/icons/registries/MoreMegaStructure.js')) {
        return 'icon-registry-mms';
    }

    if (id.includes('/src/shared/icons/registries/TheyComeFromVoid.js')) {
        return 'icon-registry-tcfv';
    }

    if (id.includes('/src/shared/icons/registries/GenesisBook.js')) {
        return 'icon-registry-genesis';
    }

    if (id.includes('/src/shared/icons/registries/OrbitalRing.js')) {
        return 'icon-registry-orbital';
    }

    if (id.includes('/src/shared/icons/registries/FractionateEverything.js')) {
        return 'icon-registry-fractionate';
    }

    if (id.includes('/src/shared/selectors/ItemPickerButton.jsx')) {
        return 'item-select-ui';
    }

    if (id.includes('/src/core/calculation/globalState.js')
        || id.includes('/src/core/calculation/globalStateDerivations.js')
        || id.includes('/src/core/vendor/javascriptLpSolverBrowser.js')
        || id.includes('/src/core/game-data/gameData.js')) {
        return 'calc-core';
    }

    if (id.includes('/src/features/result/ResultPanel.jsx')
        || id.includes('/src/features/result/ResultRecipeSelectors.jsx')
        || id.includes('/src/features/result/resultSelectorClasses.js')
        || id.includes('/src/features/result/RecipeDisplay.jsx')
        || id.includes('/src/features/result/BatchPresetControls.jsx')
        || id.includes('/src/features/result/NaturalProductionLinesTable.jsx')
        || id.includes('/src/features/settings/SettingsPanel.jsx')
        || id.includes('/src/shared/ui/HorizontalMultiButtonSelect.jsx')) {
        return 'calc-ui';
    }

    if (id.includes('/src/features/needs/NeedsPanel.jsx')
        || id.includes('/src/features/needs/NeedsStorageControls.jsx')) {
        return 'selection-ui';
    }
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
    base: "./",
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(require('./package.json').version),
    },
    resolve: {
        alias: {
            '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
        }
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
            additionalLegacyPolyfills:['regenerator-runtime/runtime'],
        })
    ]
}))
