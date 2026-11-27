import { expect, test, type Page } from '@playwright/test';

// The button "Steuerung" in the designer and the head of the phone page (Plan.md 121) for those who may steer the song sheet. The test
// login is an administrator: its visit creates the category `steuerung` in the demo store, so the button shows. Pure designers do not
// see it – the demo cannot play that.

/** The way from the designer: the menu entry on a phone, the entry and the link of its dialog from a tablet up. */
async function goToControl(page: Page): Promise<void> {
    const menu = page.getByTestId('page-menu');
    if (await menu.isVisible()) {
        await menu.click();
        await page.locator('.module-sidebar').getByTestId('mode-stage').click();
    } else {
        await page.locator('.module-sidebar').getByTestId('mode-stage').click();
        await page.getByTestId('control-qr-open').click();
    }
}

test.describe('between designer and phone page on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('shows the QR code, leads to the phone page and back with the pencil', async ({ page }) => {
        await page.goto('./');
        const toStage = page.locator('.module-sidebar').getByTestId('mode-stage');
        await expect(toStage).toBeVisible();
        await expect(toStage).toHaveText('Steuerung');
        // At the lower end of the sidebar, below the line, as the last entries are.
        const entry = (await toStage.boundingBox())!;
        const last = (await page.getByTestId('sidebar-last').boundingBox())!;
        expect(entry.y).toBeGreaterThanOrEqual(last.y + last.height);

        // From a tablet up the entry shows the QR code of the phone page instead of leading there.
        await toStage.click();
        const dialog = page.getByTestId('control-qr-dialog');
        await expect(dialog).toBeVisible();
        // A popup in the middle of the window, not unstyled at the end of the page (user, PC and iPad, 2026-11-13).
        const box = (await dialog.boundingBox())!;
        const view = page.viewportSize()!;
        expect(box.y).toBeGreaterThan(0);
        expect(box.y + box.height).toBeLessThanOrEqual(view.height);
        expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(20);
        await expect(page).not.toHaveURL(/\/steuerung$/);
        await expect(dialog.getByTestId('qr-code')).toBeVisible();
        await expect(dialog.getByTestId('control-qr-address')).toContainText('/steuerung');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);

        await toStage.click();
        await dialog.getByTestId('control-qr-open').click();
        await expect(page).toHaveURL(/\/steuerung$/);
        await expect(dialog).toHaveCount(0);
        // Without a released screen the page shows the service alone: no card, no choice of areas (Plan.md 135 C).
        await expect(page.getByTestId('control-middle')).toBeVisible();
        await expect(page.getByTestId('control-monitor')).toHaveCount(0);

        // The pencil went (user, 2026-11-26): "ChurchTools" leads back into the designer the page was opened from.
        await page.getByTestId('control-back').click();
        await expect(page.getByTestId('screens-heading')).toBeVisible();
        // The phone page held the page behind still (Plan.md 135 A); now it may scroll again.
        expect(await page.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow])).toEqual(['', '']);
    });
});

test.describe('between designer and phone page on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the entry is the last one of the opened page menu', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('page-menu').click();
        const entries = page.locator('#module-pages a');
        await expect(entries.last()).toBeVisible();
        await expect(entries.last()).toHaveAttribute('data-testid', 'mode-stage');
        await page.getByTestId('mode-stage').click();
        await expect(page).toHaveURL(/\/steuerung$/);
    });
});

// The phone page lies over the whole window, above the bar of ChurchTools (Plan.md 135 A, user, 2026-11-26: "alles auf die Handygröße, ohne
// dass gescrollt werden muss … vielleicht blenden wir das CT-Menü oben aus"). The dev server has no bar: a sticky one of 56 px with the
// z-index of ChurchTools comes first in the body, after the page has mounted, as ChurchTools does (Befunde G55, G57).
for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['phone', { width: 390, height: 844 }],
    ['small phone', { width: 375, height: 667 }],
] as const) {
    test.describe(`the stage page over the bar of ChurchTools on a ${name}`, () => {
        test.use({ viewport });

        test('covers the bar and does not scroll', async ({ page }) => {
            await page.goto('steuerung');
            const head = page.getByTestId('control-head');
            await expect(head).toBeVisible();
            await page.evaluate(() => {
                const bar = document.createElement('div');
                bar.id = 'navigation';
                bar.style.cssText = 'position:sticky;top:0;height:56px;z-index:1040;background:#1e3a8a';
                document.body.prepend(bar);
            });
            // The head stands at the top, and what lies there is the page, not the bar.
            await expect.poll(async () => (await head.boundingBox())!.y).toBeLessThan(8);
            const back = page.getByTestId('control-back');
            await expect(back).toHaveText('');
            await expect(back).toHaveAttribute('aria-label', 'Zurück zu ChurchTools');
            const box = (await back.boundingBox())!;
            expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="control-back"]') !== null, { x: box.x + 4, y: box.y + box.height / 2 })).toBe(true);
            // Nothing to scroll: the page fits the window, only its middle may scroll inside.
            expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
            // The demo has no event, so the bar below is empty and hidden: the middle reaches down to the edge of the window and not past it.
            const middle = (await page.getByTestId('control-middle').boundingBox())!;
            expect(middle.y + middle.height).toBeLessThanOrEqual(viewport.height + 1);
        });
    });
}

// The head of the phone page has to fit everywhere: nothing runs over the side, the whole head is visible.
for (const [name, viewport] of [
    ['phone', { width: 390, height: 844 }],
    ['iPad upright', { width: 820, height: 1180 }],
    ['iPad across', { width: 1180, height: 820 }],
    ['desktop', { width: 1440, height: 900 }],
] as const) {
    test.describe(`the head of the phone page on a ${name}`, () => {
        test.use({ viewport });

        test('does not run over the side and shows the button whole', async ({ page }) => {
            await page.goto('./');
            await goToControl(page);
            await expect(page).toHaveURL(/\/steuerung$/);
            const head = (await page.getByTestId('control-head').boundingBox())!;
            expect(head.x).toBeGreaterThanOrEqual(0);
            expect(head.x + head.width).toBeLessThanOrEqual(viewport.width);
            for (const id of ['control-back']) {
                const box = (await page.getByTestId(id).boundingBox())!;
                expect(box.x).toBeGreaterThanOrEqual(head.x);
                expect(box.x + box.width).toBeLessThanOrEqual(head.x + head.width + 1);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
    });
}

// The way looked like a reload of the whole page on the way to the stage (user, 2026-11-13): the head came only after the rights
// were read, and every visit showed "Wird geladen …". Now the head stands at once, and a second visit shows what the first one read.
test.describe('the way to the stage page', () => {
    test.use({ viewport: { width: 820, height: 1180 } });

    test('shows the head at once and, the second time, no loading line', async ({ page }) => {
        await page.goto('./');
        const loadingLine = page.locator('.control .note', { hasText: 'Wird geladen' });
        const toStage = async () => {
            await goToControl(page);
            // In the first frame of the stage page, not after the rights are read.
            expect(await page.evaluate(() => document.querySelector('.control [data-testid="control-head"]') !== null)).toBe(true);
        };
        await toStage();
        await expect(loadingLine).toHaveCount(0);
        await page.getByTestId('control-back').click();
        await expect(page.getByTestId('screens-heading')).toBeVisible();

        await toStage();
        expect(await page.evaluate(() => document.querySelector('.control')?.textContent?.includes('Wird geladen') ?? true)).toBe(false);
    });
});
