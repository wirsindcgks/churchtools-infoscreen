#!/usr/bin/env node
/**
 * Watches the ChurchTools API for changes that touch us (user, 2026-11-27): reads the version of the instance in `.env`, and where it is
 * newer than the last recording in `fixtures/schema/`, pulls its OpenAPI specification and compares, for each endpoint the code calls,
 * parameters, request and answer with the recording before. Only reads; the specification lands in `fixtures/` (not versioned).
 *
 *   npm run ct:check                     the version of the instance against the last recording
 *   npm run ct:check -- --from 3.137     against an older recording
 *   npm run ct:check -- --offline        compare the two newest recordings, nothing fetched
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = path.join(ROOT, 'fixtures', 'schema');

/** `3.139.1` → [3, 139, 1], for sorting. */
const parts = (version) => version.split('.').map(Number);
export function compareVersions(a, b) {
    const x = parts(a);
    const y = parts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
}

/** The recordings in `fixtures/schema/`, oldest first. */
function recordings() {
    if (!fs.existsSync(SCHEMA_DIR)) return [];
    return fs
        .readdirSync(SCHEMA_DIR)
        .map((f) => /^openapi-(\d+\.\d+(?:\.\d+)?)\.json$/.exec(f)?.[1])
        .filter(Boolean)
        .sort(compareVersions);
}

/**
 * The endpoints the code calls through `churchtoolsClient`: method and path, a `${…}` in the path as `{}`. Paths that begin with a
 * placeholder (the KV store under `/custommodules/{id}`) keep it – the specification does not describe them (G68).
 */
export function usedEndpoints(sources) {
    const found = new Map();
    const call = /churchtoolsClient\.(get|post|put|patch|delete)\b[^(]*?\(\s*([`'])([^`']*)\2/g;
    for (const [file, text] of sources) {
        for (const m of text.matchAll(call)) {
            const route = m[3].replace(/\$\{[^}]*\}/g, '{}').split('?')[0];
            const key = `${m[1].toUpperCase()} ${route}`;
            if (!found.has(key)) found.set(key, { method: m[1], route, files: new Set() });
            found.get(key).files.add(file);
        }
    }
    return [...found.values()];
}

function sourceFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...sourceFiles(full));
        else if (/\.(ts|vue)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** The path of the specification an own route stands for: equal segments, or a placeholder on either side; the most literal wins. */
export function matchPath(route, specPaths) {
    const ours = route.split('/');
    let best = null;
    let bestScore = -1;
    for (const candidate of specPaths) {
        const theirs = candidate.split('/');
        if (theirs.length !== ours.length) continue;
        let score = 0;
        let ok = true;
        for (let i = 0; i < ours.length; i++) {
            const a = ours[i];
            const b = theirs[i];
            if (a === b) score += 2;
            else if (/^\{.*\}$/.test(b) || a === '{}') score += 0;
            else {
                ok = false;
                break;
            }
        }
        if (ok && score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }
    return best;
}

/**
 * A schema as flat lines – `data[].song.arrangementId: integer` –, `$ref` resolved, cycles and depth cut off. The lines are what is
 * compared: a field gone, a new one, a type changed, required or not.
 */
export function flatten(spec, node, prefix = '', seen = new Set(), depth = 0, out = new Map()) {
    if (!node || typeof node !== 'object' || depth > 12) return out;
    if (node.$ref) {
        if (seen.has(node.$ref)) {
            out.set(prefix || '(root)', `→ ${node.$ref.split('/').pop()}`);
            return out;
        }
        const target = node.$ref.split('/').slice(1).reduce((o, k) => o?.[k], spec);
        return flatten(spec, target, prefix, new Set([...seen, node.$ref]), depth + 1, out);
    }
    for (const key of ['allOf', 'oneOf', 'anyOf']) {
        if (Array.isArray(node[key])) node[key].forEach((sub) => flatten(spec, sub, prefix, seen, depth + 1, out));
    }
    const type = [].concat(node.type ?? []).join('|');
    if (type && !node.properties && !node.items) {
        const extra = node.enum ? ` (${node.enum.join(', ')})` : node.format ? ` (${node.format})` : '';
        out.set(prefix || '(root)', type + extra);
    }
    const required = new Set(node.required ?? []);
    for (const [name, child] of Object.entries(node.properties ?? {})) {
        const key = `${prefix ? `${prefix}.` : ''}${name}${required.has(name) ? '!' : ''}`;
        flatten(spec, child, key, seen, depth + 1, out);
    }
    if (node.items) flatten(spec, node.items, `${prefix}[]`, seen, depth + 1, out);
    return out;
}

/** An operation as flat lines: parameters, request and the answers with 2xx. */
export function describeOperation(spec, op) {
    const out = new Map();
    for (const p of op.parameters ?? []) {
        const param = p.$ref ? p.$ref.split('/').slice(1).reduce((o, k) => o?.[k], spec) : p;
        if (!param) continue;
        const schema = flatten(spec, param.schema ?? {}, '');
        out.set(`param ${param.in} ${param.name}${param.required ? '!' : ''}`, [...schema.values()].join(' ') || '?');
    }
    const body = op.requestBody?.content?.['application/json']?.schema;
    if (body) for (const [k, v] of flatten(spec, body, '')) out.set(`request ${k}`, v);
    for (const [status, response] of Object.entries(op.responses ?? {})) {
        if (!/^2/.test(status)) continue;
        const schema = response?.content?.['application/json']?.schema;
        if (schema) for (const [k, v] of flatten(spec, schema, '')) out.set(`answer ${status} ${k}`, v);
    }
    return out;
}

/** Old against new: lines gone, new and changed. */
export function diffLines(before, after) {
    const removed = [...before.keys()].filter((k) => !after.has(k)).map((k) => `- ${k}: ${before.get(k)}`);
    const added = [...after.keys()].filter((k) => !before.has(k)).map((k) => `+ ${k}: ${after.get(k)}`);
    const changed = [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k)).map((k) => `~ ${k}: ${before.get(k)} → ${after.get(k)}`);
    return [...removed, ...changed, ...added];
}

/** The report for the endpoints we call: what changed, what is gone, what the specification does not describe. */
export function compare(oldSpec, newSpec, endpoints) {
    const report = { changed: [], gone: [], undocumented: [], same: 0 };
    const oldPaths = Object.keys(oldSpec.paths ?? {});
    const newPaths = Object.keys(newSpec.paths ?? {});
    for (const e of endpoints) {
        const label = `${e.method.toUpperCase()} ${e.route}`;
        if (e.route.startsWith('{}')) {
            report.undocumented.push(`${label} (KV-Store, nicht in der Spezifikation)`);
            continue;
        }
        const oldPath = matchPath(e.route, oldPaths);
        const newPath = matchPath(e.route, newPaths);
        const oldOp = oldPath && oldSpec.paths[oldPath][e.method];
        const newOp = newPath && newSpec.paths[newPath][e.method];
        if (!oldOp && !newOp) report.undocumented.push(label);
        else if (oldOp && !newOp) report.gone.push(`${label} (vorher ${oldPath})`);
        else if (!oldOp && newOp) report.changed.push({ label, path: newPath, lines: ['+ neu beschrieben in der Spezifikation'] });
        else {
            const lines = diffLines(describeOperation(oldSpec, oldOp), describeOperation(newSpec, newOp));
            if (oldOp.deprecated !== newOp.deprecated) lines.unshift(`~ deprecated: ${!!oldOp.deprecated} → ${!!newOp.deprecated}`);
            if (lines.length) report.changed.push({ label, path: newPath, lines });
            else report.same++;
        }
    }
    return report;
}

function readEnv() {
    const file = path.join(ROOT, '.env');
    if (!fs.existsSync(file)) throw new Error('.env fehlt (siehe .env-example).');
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    if (!env.CT_BASE_URL || !env.CT_LOGIN_TOKEN) throw new Error('CT_BASE_URL und CT_LOGIN_TOKEN fehlen in .env.');
    return { base: env.CT_BASE_URL.replace(/\/$/, ''), token: env.CT_LOGIN_TOKEN };
}

async function fetchJson(url, token) {
    const response = await fetch(url, { headers: { Authorization: `Login ${token}` } });
    if (!response.ok) throw new Error(`${url.replace(/^https?:\/\/[^/]+/, '<instanz>')}: HTTP ${response.status}`);
    return response.json();
}

function printReport(from, to, report, count) {
    console.log(`\nChurchTools ${from} → ${to}: ${count} genutzte Endpunkte geprüft.\n`);
    console.log(`  unverändert: ${report.same}`);
    console.log(`  geändert:    ${report.changed.length}`);
    console.log(`  entfallen:   ${report.gone.length}`);
    console.log(`  nicht beschrieben: ${report.undocumented.length}\n`);
    for (const g of report.gone) console.log(`ENTFALLEN  ${g}`);
    for (const c of report.changed) {
        console.log(`GEÄNDERT   ${c.label}  (${c.path})`);
        for (const line of c.lines.slice(0, 40)) console.log(`    ${line}`);
        if (c.lines.length > 40) console.log(`    … und ${c.lines.length - 40} weitere Zeilen`);
    }
    if (report.undocumented.length) console.log(`\nNicht in der Spezifikation (wie bisher, G68): ${report.undocumented.join('; ')}`);
}

async function main(args) {
    const fromArg = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
    const offline = args.includes('--offline');
    const known = recordings();
    const endpoints = usedEndpoints(sourceFiles(path.join(ROOT, 'src')).map((f) => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]));

    let to;
    if (offline) {
        if (known.length < 2) throw new Error('Für --offline braucht es zwei Aufzeichnungen in fixtures/schema/.');
        to = known.at(-1);
    } else {
        const { base, token } = readEnv();
        const info = await fetchJson(`${base}/api/info`, token);
        to = info.version;
        const file = path.join(SCHEMA_DIR, `openapi-${to}.json`);
        if (!known.includes(to)) {
            console.log(`Neue Version ${to} (Build ${info.build}) – lade die Spezifikation …`);
            const spec = await fetchJson(`${base}/system/runtime/swagger/openapi.json`, token);
            fs.mkdirSync(SCHEMA_DIR, { recursive: true });
            fs.writeFileSync(file, JSON.stringify(spec, null, 2));
            const today = new Date().toISOString().slice(0, 10);
            fs.writeFileSync(
                path.join(SCHEMA_DIR, `openapi-${to}.md`),
                `# openapi-${to}.json\n\nGezogen am ${today} von der Instanz aus \`.env\`, Version ${to}, Build ${info.build}, mit \`npm run ct:check\`\nüber \`/system/runtime/swagger/openapi.json\` (Login-Token). Nur lesend.\n${Object.keys(spec.paths).length} Pfade, ${Object.keys(spec.components?.schemas ?? {}).length} Schemas.\n`,
            );
            known.push(to);
            known.sort(compareVersions);
        } else if (!fromArg) {
            console.log(`ChurchTools ${to}: schon aufgezeichnet – nichts Neues. Vergleich der beiden letzten Aufzeichnungen mit --offline.`);
            return;
        }
    }
    const from = fromArg ?? known.filter((v) => compareVersions(v, to) < 0).at(-1);
    if (!from) throw new Error(`Keine ältere Aufzeichnung als ${to} zum Vergleichen.`);
    const load = (v) => JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `openapi-${v}.json`), 'utf8'));
    const report = compare(load(from), load(to), endpoints);
    printReport(from, to, report, endpoints.length);
    process.exitCode = report.gone.length || report.changed.length ? 2 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
