import { expect, test, type Page } from '@playwright/test';

// The phone page "Steuerung" while a rehearsal runs (Plan.md 135, second test with the phone, user, 2026-11-27): the song gets the space –
// all its parts stand in the card without rolling, the bar below is whole, the page does not scroll. Measured on the sizes of the phones.
// Nothing is read from or written to the instance for this: the store is the demo store of the browser (seeded below), the song and its
// sheet are answered by `page.route`.

const NAMES = ['Intro', 'Strophe 1', 'Refrain', 'Strophe 2', 'Bridge', 'Strophe 3', 'Zwischenspiel', 'Schluss'];

const chordPro = (parts: number) =>
    `{title: Halleluja}\n{key: C}\n${NAMES.slice(0, parts)
        .map((name) => `{comment: ${name}}\n[C]Halle[G]luja`)
        .join('\n')}`;

/** The demo store with a released monitor, a running rehearsal at it and the song of the rehearsal chosen at `section`. */
async function seedRehearsal(page: Page, section: number): Promise<void> {
    await page.goto('./'); // seeds the demo store
    await page.evaluate((chosen) => {
        const key = 'infoscreen-designer.demo-store';
        const state = JSON.parse(localStorage.getItem(key)!) as { nextId: number; categories: { id: number; shorty: string; name: string }[]; values: [number, { id: number; value: string }[]][] };
        const list = (shorty: string, name: string): { id: number; value: string }[] => {
            let category = state.categories.find((c) => c.shorty === shorty);
            if (!category) state.categories.push((category = { id: state.nextId++, shorty, name }));
            let entry = state.values.find(([id]) => id === category!.id);
            if (!entry) state.values.push((entry = [category.id, []]));
            return entry[1];
        };
        const now = new Date().toISOString();
        const until = new Date(Date.now() + 3600_000).toISOString();
        const add = (target: { id: number; value: string }[], doc: unknown) => target.push({ id: state.nextId++, value: JSON.stringify(doc) });
        const control = list('steuerung', 'Steuerung');
        add(control, { kind: 'rehearsalCatalog', screens: [{ id: 's1', name: 'Confidence' }, { id: 's2', name: 'Foyer' }], playlists: [{ id: 'p1', name: 'Probenblatt' }], clickScreens: [], at: now });
        add(control, { kind: 'rehearsal', songId: 9, arrangementId: 4, section: chosen, at: now, by: 'Tobias Nikola' });
        add(list('status', 'Status'), { kind: 'position', screenId: 's1', playlistId: 'p1', playlistName: 'Probenblatt', advance: 'time', rehearsal: { until, by: 'Tobias Nikola' }, songsheet: { source: 'rehearsal' }, seq: 0, at: now });
        localStorage.setItem(key, JSON.stringify(state));
    }, section);
}

async function answerSong(page: Page, parts: number): Promise<void> {
    await page.route('**/api/songs/9**', (route) =>
        route.fulfill({ json: { data: { id: 9, name: 'Halleluja', arrangements: [{ id: 4, name: 'Standard', isDefault: true, key: 'C', files: [{ name: 'halleluja.chordpro', fileUrl: 'http://localhost/files/halleluja.chordpro' }] }] } } }),
    );
    await page.route('**/files/halleluja.chordpro', (route) => route.fulfill({ contentType: 'text/plain', body: chordPro(parts) }));
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

for (const [name, viewport] of [
    ['phone', { width: 390, height: 844 }],
    ['small phone', { width: 375, height: 667 }],
] as const) {
    for (const parts of [4, 8]) {
        test.describe(`the rehearsal on a ${name}, ${parts} parts`, () => {
            test.use({ viewport });

            test('shows all parts without rolling, and the bar whole', async ({ page }) => {
                await answerSong(page, parts);
                await seedRehearsal(page, 0);
                await page.goto('steuerung');
                await expect(page.getByTestId('monitor-chip')).toHaveText('Probe');
                await expect(page.locator('[data-testid="rehearsal-song"] .part')).toHaveCount(parts);
                await expect(page.getByTestId('step-forward')).toBeVisible();

                const view = page.viewportSize()!;
                expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
                // Nothing rolls: neither the middle nor the grid of the parts.
                const rolls = await page.evaluate(() => {
                    const over = (el: Element | null) => (el ? el.scrollHeight - el.clientHeight : 0);
                    return { middle: over(document.querySelector('[data-testid="control-middle"]')), parts: over(document.querySelector('.song-parts')) };
                });
                expect(rolls.middle).toBeLessThanOrEqual(1);
                expect(rolls.parts).toBeLessThanOrEqual(1);

                // Every part button lies whole inside the card of the song.
                const card = await box(page, '[data-testid="rehearsal-song"] .song-card');
                const buttons = await page.locator('[data-testid="rehearsal-song"] .part').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }));
                for (const b of buttons) {
                    expect(b.x).toBeGreaterThanOrEqual(card.x);
                    expect(b.x + b.width).toBeLessThanOrEqual(card.x + card.width);
                    expect(b.y).toBeGreaterThanOrEqual(card.y);
                    expect(b.y + b.height).toBeLessThanOrEqual(card.y + card.height);
                }

                // The "Jetzt" row names the running part, the tiles are 68 px (Plan.md 137 B).
                await expect(page.getByTestId('control-now')).toBeVisible();
                await expect(page.getByTestId('control-now-of')).toHaveText(`1 von ${parts}`);
                const tile = await box(page, '[data-testid="rehearsal-song"] .part');
                expect(Math.round(tile.height)).toBe(68);

                // The bar lies whole in the window, "Zurück" and "Vor" in it.
                const bar = await box(page, '[data-testid="control-bar"]');
                expect(bar.y + bar.height).toBeLessThanOrEqual(view.height);
                for (const id of ['step-back', 'step-forward']) {
                    const b = await box(page, `[data-testid="${id}"]`);
                    expect(b.y).toBeGreaterThanOrEqual(bar.y);
                    expect(b.y + b.height).toBeLessThanOrEqual(bar.y + bar.height);
                    expect(b.x + b.width).toBeLessThanOrEqual(view.width);
                }

                // The band is one line (Plan.md 137 A): word and details in one row, the whole band inside the window and the head.
                const monitor = await box(page, '[data-testid="monitor-band"]');
                const head = await box(page, '[data-testid="control-head"]');
                const nameBox = await box(page, '[data-testid="monitor-name"]');
                const chipBox = await box(page, '[data-testid="monitor-chip"]');
                expect(monitor.height).toBeLessThanOrEqual(48);
                expect(chipBox.y).toBeGreaterThanOrEqual(monitor.y);
                expect(chipBox.y + chipBox.height).toBeLessThanOrEqual(monitor.y + monitor.height);
                expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(monitor.x + monitor.width);
                expect(monitor.x).toBeGreaterThanOrEqual(0);
                expect(monitor.x + monitor.width).toBeLessThanOrEqual(view.width);
                expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(head.x + head.width);
                // One line of the song head: the key stands behind the title, the magnifier is 44 × 44.
                const lupe = await box(page, '[data-testid="rehearsal-other"]');
                expect([Math.round(lupe.width), Math.round(lupe.height)]).toEqual([44, 44]);
                const last = buttons[buttons.length - 1]!;
                test.info().annotations.push({
                    type: 'measured',
                    description: `${name}: band ${Math.round(monitor.height)} px, song card ${Math.round(card.height)} px, last part ends ${Math.round(card.y + card.height - last.y - last.height)} px above the card edge, bar ${Math.round(bar.height)} px`,
                });
                console.log(test.info().annotations.at(-1)!.description);
            });
        });
    }
}

test.describe('a button that is greyed out', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('is grey, also "Vor" at the last part – not the light face of the main button', async ({ page }) => {
        await answerSong(page, 4);
        await seedRehearsal(page, 3);
        await page.goto('steuerung');
        await expect(page.getByTestId('step-forward')).toBeDisabled();
        const colours = async (id: string) => page.getByTestId(id).evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, opacity: getComputedStyle(el).opacity }));
        const forward = await colours('step-forward');
        const back = await colours('step-back');
        // "Zurück" is enabled here: the grey of "Vor" is the one of the other buttons.
        await expect(page.getByTestId('step-back')).toBeEnabled();
        expect(forward.background).toBe(back.background);
        expect(forward.opacity).toBe('1');
        // Not the light face of "Vor" (Plan.md 137 C).
        expect(forward.background).not.toBe('rgb(241, 242, 244)');
        // The hint at the last part: "Letzter Teil" stands in the card, not beside it.
        await expect(page.locator('[data-testid="rehearsal-song"] [data-testid="rehearsal-end-note"]')).toBeVisible();
    });
});

// The reading mode (Plan.md 138): the sheet with chords instead of the tiles and the bar; the page itself does not scroll.
for (const [name, viewport] of [
    ['small phone', { width: 375, height: 667 }],
    ['iPad portrait', { width: 768, height: 1024 }],
] as const) {
    test.describe(`reading mode on a ${name}`, () => {
        test.use({ viewport });

        test('reading mode shows the sheet with chords, no bar buttons, and the page does not scroll', async ({ page }) => {
            await answerSong(page, 4);
            await seedRehearsal(page, 1);
            await page.goto('steuerung');
            await expect(page.locator('[data-testid="rehearsal-song"] .part')).toHaveCount(4);
            await page.getByTestId('control-read').click();
            await expect(page.getByTestId('control-read')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByTestId('reader-part')).toHaveCount(4);
            await expect(page.getByTestId('reader-chord').first()).toBeVisible();
            await expect(page.getByTestId('step-forward')).toHaveCount(0);
            await expect(page.getByTestId('step-back')).toHaveCount(0);
            await expect(page.getByTestId('monitor-change')).toHaveCount(0);
            const fits = () => page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight);
            expect(await fits()).toBe(true);
            await page.getByTestId('reader-larger').click();
            expect(await fits()).toBe(true);
            await expect(page.getByTestId('reader-part').nth(1)).toHaveAttribute('aria-current', 'true');
        });
    });
}
