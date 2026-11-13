import { expect, test, type Locator } from '@playwright/test';
import { addBlock, choose, expectSlides, openSection } from './helpers';

// The block "Ablauf" (Plan.md 118, Stück 1): in the designer it reads the live agenda with the designer's rights and falls back
// to an example where there is none – the example is the test of G81: "Begrüßung" running, "Predigt" next.

test.use({ viewport: { width: 1440, height: 900 } });

test('the agenda block shows the current and the next point, and its inspector keeps its sections in order', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();

    await addBlock(page, 'agenda');
    const block = page.locator('.editor-stage .block--agenda');
    await expect(block.getByTestId('agenda-now')).toHaveText('Begrüßung');
    await expect(block.getByTestId('agenda-next')).toHaveText('Predigt');
    await expect(block.getByTestId('agenda-now-label')).toHaveText('Jetzt');
    await expect(block.getByTestId('agenda-circle')).toBeVisible();
    await expect(block.getByTestId('agenda-delay')).toBeVisible();

    // Calendars, then "Darstellung", then "Schrift" (AGENTS.md, Ordnung im Inspektor); nothing is open at the start.
    const ids = await page.locator('[data-testid^="section-"]:not([data-testid$="-toggle"]):not([data-testid$="-help"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    const order = ['section-calendars', 'section-appearance', 'section-font'];
    expect(ids.filter((id) => order.includes(id!))).toEqual(order);
    await expect(page.getByTestId('section-appearance')).not.toHaveAttribute('open', '');

    await openSection(page, 'appearance');
    const inspector = page.getByTestId('block-inspector');
    await inspector.getByTestId('agenda-show-countdown').uncheck();
    await expect(block.getByTestId('agenda-circle')).toHaveCount(0);
    await expect(block.getByTestId('agenda-delay')).toBeVisible();
    await inspector.getByTestId('agenda-show-delay').uncheck();
    await expect(block.getByTestId('agenda-delay')).toHaveCount(0);
    await expect(block.getByTestId('agenda-now')).toHaveText('Begrüßung');
    await page.screenshot({ path: 'test-results/editor-agenda.png' });
});

test('the own look of the agenda block shows cards, with tile, service, people and "Dann" to choose', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();

    await addBlock(page, 'agenda');
    const block = page.locator('.editor-stage .block--agenda');
    await openSection(page, 'appearance');
    const inspector = page.getByTestId('block-inspector');
    await expect(inspector.getByTestId('agenda-tile-kind')).toHaveCount(0);
    await choose(inspector, 'agenda-layout', 'card');

    await expect(block.getByTestId('agenda-card')).toBeVisible();
    await expect(block.getByTestId('agenda-now')).toHaveText('Begrüßung');
    await expect(block.getByTestId('agenda-service')).toHaveText('Leitung');
    await expect(block.getByTestId('agenda-tile')).toBeVisible();
    await expect(block.getByTestId('agenda-countdown')).toBeVisible();
    await expect(block.getByTestId('agenda-signal')).toHaveAttribute('data-state', 'ok');

    await choose(inspector, 'agenda-countdown-style', 'ring');
    await expect(block.getByTestId('agenda-ring')).toBeVisible();

    await choose(inspector, 'agenda-tile-kind', 'position');
    await expect(block.getByTestId('agenda-tile')).toContainText('von');

    await expect(block.getByTestId('agenda-responsible')).toHaveCount(0);
    await inspector.getByTestId('agenda-show-responsible').check();
    await expect(block.getByTestId('agenda-responsible')).toContainText('Anna Beispiel');
    await inspector.getByTestId('agenda-show-note').check();
    await expect(inspector.getByTestId('agenda-show-song')).toBeChecked();
    await block.screenshot({ path: 'test-results/editor-agenda-card.png' });

    await expect(block.getByTestId('agenda-next-card')).toBeVisible();
    await inspector.getByTestId('agenda-show-next').uncheck();
    await expect(block.getByTestId('agenda-next-card')).toHaveCount(0);
});

test('the block "Liedblatt" shows the next song of the example with chords, and the chords can be switched off (Plan.md 121 B)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();

    await addBlock(page, 'songsheet');
    const block = page.locator('.editor-stage .block--songsheet');
    // "Als Nächstes" from the example agenda, or – while it waits, or a real agenda has no song now – the designer's example (user, 2026-11-13).
    await expect(block.locator('.head .next')).toHaveText(/^(Als Nächstes|Beispiel)$/);
    await expect(block.getByTestId('songsheet-title')).toHaveText('Segenslied');
    await expect(block.getByTestId('songsheet-text')).toContainText('Gott segne');
    await expect(block.getByTestId('songsheet-chord').first()).toBeVisible();
    await expect(block.getByTestId('songsheet-footer')).toContainText('CCLI');

    // Calendars, then "Darstellung", then "Schrift"; nothing is open at the start.
    const ids = await page.locator('[data-testid^="section-"]:not([data-testid$="-toggle"]):not([data-testid$="-help"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    const order = ['section-calendars', 'section-appearance', 'section-font'];
    expect(ids.filter((id) => order.includes(id!))).toEqual(order);

    await openSection(page, 'appearance');
    await page.getByTestId('block-inspector').getByTestId('songsheet-show-chords').uncheck();
    await expect(block.getByTestId('songsheet-chord')).toHaveCount(0);
    await expect(block.getByTestId('songsheet-text')).toContainText('Gott segne dich auf allen Wegen');
    await block.screenshot({ path: 'test-results/editor-songsheet.png' });
    // A large font is for the text, not for the head: the title stands at half the size of the lines of the song (user, 2026-11-13).
    await openSection(page, 'font');
    await page.getByTestId('font-size').locator('input').or(page.getByTestId('font-size')).fill('150');
    const size = (locator: Locator) => locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await expect.poll(async () => (await size(block.getByTestId('songsheet-title'))) <= (await size(block.locator('.columns .line').first())) * 0.5 + 0.5).toBe(true);
    await block.screenshot({ path: 'test-results/editor-songsheet-large.png' });
    // A still larger font leaves the text where the block holds it: no jump to the floor of the search (user, 2026-11-13: 180 to 190 px).
    const text = () => size(block.locator('.columns .line').first());
    const at150 = await text();
    for (const px of ['230', '300']) {
        await page.getByTestId('font-size').locator('input').or(page.getByTestId('font-size')).fill(px);
        await expect.poll(async () => Math.abs((await text()) - at150)).toBeLessThan(3);
    }
});

test('in the narrow quarter beside the song sheet the agenda stacks its parts and keeps the titles whole (user, 2026-11-13)', async ({ page }) => {
    await page.goto('playlists');
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    await expectSlides(page);
    await page.getByTestId('add-slide').click();
    await openSection(page, 'layout');
    await page.getByTestId('layout-split').locator('input[value="narrow-wide:quarter"]').check({ force: true });
    const add = (id: string) => page.locator(`[data-testid="layout-region"][data-region="${id}"]`).getByTestId('layout-region-add');
    await add('b').click();
    await page.getByTestId('sheet-add-songsheet').click();
    await page.getByTestId('grid').click({ position: { x: 5, y: 5 } });
    await openSection(page, 'layout');
    await add('a').click();
    await page.getByTestId('sheet-add-agenda').click();

    const stage = page.locator('.editor-stage');
    const block = stage.locator('.block--agenda');
    /** No title runs out of its box: a cut word ("Be…") is wider than the room it has. */
    const whole = (testid: string) => block.getByTestId(testid).evaluate((el) => el.scrollWidth <= el.clientWidth + 1);

    await expect(block.locator('.agenda--tall')).toBeVisible();
    await expect(block.getByTestId('agenda-circle')).toBeVisible();
    expect(await whole('agenda-now')).toBe(true);
    expect(await whole('agenda-next')).toBe(true);
    await stage.screenshot({ path: 'test-results/editor-agenda-quarter.png' });

    await openSection(page, 'appearance');
    await choose(page.getByTestId('block-inspector'), 'agenda-layout', 'card');
    await expect(block.locator('.agenda-card--tall')).toBeVisible();
    expect(await whole('agenda-now')).toBe(true);
    expect(await whole('agenda-next')).toBe(true);
    // The countdown stands below the title, not beside it.
    const title = await block.getByTestId('agenda-now').boundingBox();
    const countdown = await block.getByTestId('agenda-countdown').boundingBox();
    expect(countdown!.y).toBeGreaterThan(title!.y + title!.height);
    await stage.screenshot({ path: 'test-results/editor-agenda-quarter-card.png' });
});
