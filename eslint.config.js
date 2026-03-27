import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    {
        ignores: ['dist/', 'src-tauri/'],
    },

    js.configs.recommended,
    reactPlugin.configs.flat.recommended,
    reactPlugin.configs.flat['jsx-runtime'],
    reactHooks.configs.flat.recommended,

    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2020,
            },
        },
        settings: {
            react: {version: 'detect'},
        },
        plugins: {
            'react-refresh': reactRefresh,
        },
        rules: {
            'react-refresh/only-export-components': 'off',
            'react/prop-types': 'off',
            'no-constant-condition': ['error', {checkLoops: false}],
            // These rules are new in react-hooks v7 and flag existing valid patterns
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/immutability': 'off',
        },
    },

    // vite.config.js runs in Node.js, not the browser
    {
        files: ['vite.config.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
