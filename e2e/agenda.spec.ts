import { expect, test } from '@playwright/test';
import { addBlock, openSection } from './helpers';

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
