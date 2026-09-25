/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Development only: "true" uses the real module of the test instance instead of the demo. */
    readonly VITE_USE_MODULE?: string;
}

/** Version of this build, e.g. `0.1.0` or `0.1.0+abc1234` (vite.config.ts). */
declare const __APP_VERSION__: string;

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent;
    export default component;
}
