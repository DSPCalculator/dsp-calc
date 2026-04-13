module.exports = {
    root: true,
    env: {browser: true, es2020: true, node: true},
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {jsx: true},
    },
    settings: {react: {version: '18.2'}},
    plugins: ['@typescript-eslint', 'react-refresh'],
    rules: {
        'react/prop-types': 'off',
        '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
        'react-refresh/only-export-components': [
            'warn',
            {allowConstantExport: true},
        ],
    },
}
