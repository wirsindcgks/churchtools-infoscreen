import { expect, test } from '@playwright/test';
import { addBlock, choose, openSection } from './helpers';

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
    await expect(block.getByTestId('songsheet-next')).toHaveText('Als Nächstes');
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
});
