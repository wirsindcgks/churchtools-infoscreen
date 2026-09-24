/// <reference types="vitest/config" />
import fs from 'node:fs';
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';

const EXTENSION_KEY = 'infoscreen-designer';

export default defineConfig(({ mode }) => {
    // Loaded without prefix filter: CT_* values stay in the Node process and
    // never reach import.meta.env, so they cannot end up in the bundle.
    const env = loadEnv(mode, process.cwd(), '');
    const key = env.VITE_KEY || EXTENSION_KEY;

    return {
        base: `/ccm/${key}/`,
        plugins: [vue(), fontLicenses()],
        build: {
            // The ChurchTools CSP forbids inline scripts (G15); the polyfill is one.
            modulePreload: { polyfill: false },
            sourcemap: false,
        },
        server: {
            proxy: env.CT_BASE_URL
                ? {
                      '/api': devProxy(env.CT_BASE_URL, env.CT_LOGIN_TOKEN),
                      // The image service is anonymous (G14); proxied only because the instance sends no CORS headers.
                      '/images': devProxy(env.CT_BASE_URL, undefined),
                      // The church logo, anonymous as well; it redirects to /images (G29).
                      '/logo': devProxy(env.CT_BASE_URL, undefined),
                  }
                : undefined,
        },
        test: {
            environment: 'jsdom',
            include: ['src/**/*.test.ts'],
        },
    };
});

/**
 * The SIL Open Font License asks for its text to travel with the fonts:
 * every bundled font package leaves its LICENSE under licenses/ in dist.
 */
function fontLicenses(): Plugin {
    return {
        name: 'font-licenses',
        apply: 'build',
        generateBundle() {
            const { dependencies } = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
                dependencies: Record<string, string>;
            };
            for (const name of Object.keys(dependencies).filter((d) => d.startsWith('@fontsource'))) {
                this.emitFile({
                    type: 'asset',
                    fileName: `licenses/${name.slice(1).replace('/', '-')}.txt`,
                    source: fs.readFileSync(`node_modules/${name}/LICENSE`, 'utf8'),
                });
            }
        },
    };
}

/**
 * Forwards /api to the test instance and authenticates there with the login
 * token as a header. The browser never sees a credential or a cookie, which
 * also sidesteps Safari's refusal of `Secure; SameSite=None` on localhost.
 */
function devProxy(target: string, loginToken: string | undefined): ProxyOptions {
    return {
        target,
        changeOrigin: true,
        headers: loginToken ? { Authorization: `Login ${loginToken}` } : {},
        configure(proxy) {
            proxy.on('proxyRes', (res) => {
                delete res.headers['set-cookie'];
                // Keep redirects on the proxy: the instance itself would refuse the browser (no CORS).
                const location = res.headers.location;
                if (location?.startsWith(target)) res.headers.location = location.slice(target.replace(/\/+$/, '').length);
            });
        },
    };
}
