#!/usr/bin/env node
// Applies the fixture cleanup rule from Plan.md ("Konventionen") to a recorded
// API response: usage: node scripts/sanitize-fixture.js <raw.json> <out.json>
// Needs CT_BASE_URL so the instance host can be replaced.
import fs from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output || !process.env.CT_BASE_URL) {
    console.error('usage: CT_BASE_URL=… node scripts/sanitize-fixture.js <raw.json> <out.json>');
    process.exit(1);
}

const host = new URL(process.env.CT_BASE_URL).host;
const REDACTED = '<redigiert>';
const PERSONAL = /^(email|e?mails?|phone.*|mobile|street|zip|city|address.*|birth.*|dateOfBirth|latitude|longitude|guid|firstName|lastName|nickname)$/i;
// randomUrl is the secret iCal subscription address of a calendar.
const SECRET = /(licensekey|_apikey|apikey|_token|token_secret|_secret|csrfToken|loginToken|randomUrl|iCalUid)$/i;
const HASH = /\b[0-9a-f]{32,}\b/g;

function clean(value, key = '') {
    if (Array.isArray(value)) return value.map((v) => clean(v));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
    }
    if (typeof value !== 'string') return value;
    if ((PERSONAL.test(key) || SECRET.test(key)) && value !== '') return REDACTED;
    return value.replaceAll(host, 'INSTANZ.church.tools').replace(HASH, '<hash>');
}

const cleaned = clean(JSON.parse(fs.readFileSync(input, 'utf8')));
const text = JSON.stringify(cleaned, null, 2);
if (text.includes(host)) throw new Error('instance host survived sanitizing');
fs.writeFileSync(output, text + '\n');
console.log(`sanitized ${input} → ${output}`);
