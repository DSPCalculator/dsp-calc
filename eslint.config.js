import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
    {
        ignores: ['dist/**', 'src-tauri/**', '.eslintrc.cjs'],
    },
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {...globals.browser},
        },
    },
    js.configs.recommended,
    reactPlugin.configs.flat.recommended,
    reactPlugin.configs.flat['jsx-runtime'],
    reactHooksPlugin.configs.flat.recommended,
    {
        plugins: {'react-refresh': reactRefreshPlugin},
        rules: {
            'react-refresh/only-export-components': 'off',
            'react/prop-types': 'off',
            'no-constant-condition': ['error', {checkLoops: false}],
            // Unused function args / catch bindings are common patterns — match original intent
            'no-unused-vars': ['error', {vars: 'all', args: 'none', caughtErrors: 'none'}],
            // react-hooks v7 introduced these rules; not in original config
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/immutability': 'off',
        },
        settings: {react: {version: '18.2'}},
    },
    {
        files: ['vite.config.js'],
        languageOptions: {
            globals: {...globals.node},
        },
    },
];
