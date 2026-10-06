/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
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
        plugins: [vue(), fontLicenses(), packageNotices()],
        // Which build is installed – shown in the settings, compared with the GitHub releases (Plan.md, 12).
        define: { __APP_VERSION__: JSON.stringify(appVersion()) },
        build: {
            // The ChurchTools CSP forbids inline scripts (G15); the polyfill is one.
            modulePreload: { polyfill: false },
            sourcemap: false,
            rollupOptions: {
                // Second entry: `sw.js` (Plan.md, 37; G10) must sit in the ZIP's root to control the whole
                // module, not under assets/ – and, as a classic script, gets no hash in its name, so the
                // player's fixed `register('sw.js')` never has to learn a new one.
                input: {
                    app: path.resolve(import.meta.dirname, 'index.html'),
                    sw: path.resolve(import.meta.dirname, 'src/sw/sw.ts'),
                },
                output: {
                    entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
                },
            },
        },
        server: {
            proxy: env.CT_BASE_URL
                ? {
                      '/api': devProxy(env.CT_BASE_URL, env.CT_LOGIN_TOKEN),
                      // The image service is anonymous (G14); proxied only because the instance sends no CORS headers.
                      '/images': devProxy(env.CT_BASE_URL, undefined),
                      // The church logo, anonymous as well; it redirects to /images (G29).
                      '/logo': devProxy(env.CT_BASE_URL, undefined),
                      // The download address of a video (Plan.md 52); a regex, since it is the start page with a query – only that query, never the app itself.
                      '^/\\?q=public/filedownload': devProxy(env.CT_BASE_URL, env.CT_LOGIN_TOKEN),
                  }
                : undefined,
        },
        test: {
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'scripts/**/*.test.js'],
        },
    };
});

/**
 * `0.1.0` for a tagged release, `0.1.0+abc1234` for any other build, `0.1.0+abc1234-dirty` for one with
 * uncommitted changes – else a test build made on the tagged commit would call itself the release, and
 * „Über & Neuigkeiten" could not tell the two apart (2026-09-30).
 */
function appVersion(): string {
    const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };
    try {
        const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
        const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
        if (!dirty && git('tag', '--points-at', 'HEAD').split('\n').includes(`v${version}`)) return version;
        return `${version}+${git('rev-parse', '--short', 'HEAD')}${dirty ? '-dirty' : ''}`;
    } catch {
        return version;
    }
}

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
 * MIT and Apache-2.0 ask for copyright and licence text to travel with every copy: the package carries its
 * own LICENSE and a THIRD-PARTY-NOTICES.txt with the text of every npm package whose code ended up in the
 * app bundle or in sw.js. Which ones, the bundle itself tells – no list to keep by hand.
 */
function packageNotices(): Plugin {
    const LICENSE_FILE = /^(licen[cs]e|notice)(\.(md|txt))?$/i;
    return {
        name: 'package-notices',
        apply: 'build',
        generateBundle(_options, bundle) {
            this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: fs.readFileSync('LICENSE', 'utf8') });

            // Module id → package directory: the last node_modules/<name> (or <@scope>/<name>) in the path.
            const dirs = new Map<string, string>();
            // Plus what the app imports directly: `vue` itself is a bare re-export of @vue/*, which rollup
            // leaves out of `chunk.modules` although the package is what the app imports.
            const ids = new Set<string>();
            for (const item of Object.values(bundle)) {
                if (item.type === 'chunk') Object.keys(item.modules).forEach((id) => ids.add(id));
            }
            for (const id of this.getModuleIds()) {
                if (this.getModuleInfo(id)?.importers.some((importer) => !importer.includes('/node_modules/'))) ids.add(id);
            }
            for (const id of ids) {
                const clean = id.replace(/^\0/, '').split('?')[0] ?? '';
                const at = clean.lastIndexOf('/node_modules/');
                if (at < 0) continue;
                const match = clean.slice(at + '/node_modules/'.length).match(/^(@[^/]+\/[^/]+|[^/]+)/);
                const name = match?.[1];
                if (!name || name.startsWith('@fontsource')) continue;
                dirs.set(name, clean.slice(0, at + '/node_modules/'.length) + name);
            }

            const sections: string[] = [];
            for (const name of [...dirs.keys()].sort()) {
                const dir = dirs.get(name)!;
                const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
                    version: string;
                    license?: string;
                    main?: string;
                    module?: string;
                };
                const files = fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f) && fs.statSync(path.join(dir, f)).isFile());
                const licenseFiles = files.filter((f) => !/^notice/i.test(f)).sort();
                const noticeFiles = files.filter((f) => /^notice/i.test(f)).sort();
                const texts = [...licenseFiles, ...noticeFiles].map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim());
                if (!licenseFiles.length) {
                    // A package without a licence file (qrcode-generator) carries its notice at the top of its source.
                    const header = sourceHeader(dir, manifest.module ?? manifest.main);
                    if (!header) this.error(`No licence file or notice found for ${name} (${dir}) – its text must travel with the package.`);
                    texts.unshift(header);
                }
                sections.push(
                    [`${name} ${manifest.version}`, `Licence: ${manifest.license ?? 'unknown'}`, '', texts.join('\n\n')].join('\n'),
                );
            }

            const rule = '='.repeat(72);
            this.emitFile({
                type: 'asset',
                fileName: 'licenses/THIRD-PARTY-NOTICES.txt',
                source:
                    'Dieses Paket enthält die folgenden Bibliotheken. Ihre Lizenztexte und Hinweise stehen hier.\n\n' +
                    sections.map((section) => `${rule}\n${section}\n`).join('\n'),
            });
        },
    };
}

/** The comment lines a source file opens with, if they hold a copyright notice; else an empty string. */
function sourceHeader(dir: string, entry: string | undefined): string {
    if (!entry) return '';
    try {
        const lines = fs.readFileSync(path.join(dir, entry), 'utf8').split('\n');
        const end = lines.findIndex((line) => !line.startsWith('//'));
        const header = lines
            .slice(0, end < 0 ? lines.length : end)
            .map((line) => line.replace(/^\/\/ ?/, '').trimEnd())
            .filter((line) => !/^-+$/.test(line))
            .join('\n')
            .trim();
        return /copyright/i.test(header) ? header : '';
    } catch {
        return '';
    }
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
            // Anonymous requests of the module (getAnonymously) go without the login token, as in real ChurchTools (Plan.md 73).
            proxy.on('proxyReq', (proxyReq, req) => {
                if (req.headers['x-infoscreen-anonymous'] === '1') proxyReq.removeHeader('authorization');
            });
            proxy.on('proxyRes', (res) => {
                delete res.headers['set-cookie'];
                // Keep redirects on the proxy: the instance itself would refuse the browser (no CORS).
                const location = res.headers.location;
                if (location?.startsWith(target)) res.headers.location = location.slice(target.replace(/\/+$/, '').length);
            });
        },
    };
}
