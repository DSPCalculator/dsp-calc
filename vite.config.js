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

    if (id.includes('/src/global_state.jsx')
        || id.includes('/src/vendor/javascript_lp_solver_browser.js')
        || id.includes('/src/GameData.jsx')) {
        return 'calc-core';
    }

    if (id.includes('/src/result.jsx')
        || id.includes('/src/settings.jsx')
        || id.includes('/src/batch_setting.jsx')
        || id.includes('/src/natural_production_line.jsx')) {
        return 'calc-ui';
    }

    if (id.includes('/src/item_select.jsx')
        || id.includes('/src/icon.jsx')
        || id.includes('/src/needs_list.jsx')) {
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
