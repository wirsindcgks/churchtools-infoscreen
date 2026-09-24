/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Development only: "true" uses the real module of the test instance instead of the demo. */
    readonly VITE_USE_MODULE?: string;
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent;
    export default component;
}
