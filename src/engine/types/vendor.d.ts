declare module 'javascript-lp-solver/src/Model.js';
declare module 'javascript-lp-solver/src/Polyopt.js';
declare module 'javascript-lp-solver/src/Tableau/index.js';
declare module 'javascript-lp-solver/src/Tableau/branchAndCut.js';
declare module 'javascript-lp-solver/src/expressions.js';
declare module 'javascript-lp-solver/src/Validation.js';

interface ImportMetaEnv {
    readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
