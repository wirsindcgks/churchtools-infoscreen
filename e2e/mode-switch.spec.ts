import { expect, test } from '@playwright/test';

// The switch "Designer | Bühne" (Plan.md 121) for those who may steer the song sheet. The test login is an administrator: its visit
// creates the category `steuerung` in the demo store, so the switch shows. Pure designers do not see it – the demo cannot play that.

test.describe('switch between designer and stage on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('leads to the stage page and back; the side one is on is no link', async ({ page }) => {
        await page.goto('./');
        const sidebarSwitch = page.locator('.module-sidebar').getByTestId('mode-switch');
        await expect(sidebarSwitch).toBeVisible();
        await expect(sidebarSwitch.getByTestId('mode-designer')).toHaveAttribute('aria-current', 'page');
        await expect(sidebarSwitch.locator('a')).toHaveCount(1);

        await sidebarSwitch.getByTestId('mode-stage').click();
        await expect(page).toHaveURL(/\/steuerung$/);
        const stageSwitch = page.getByTestId('mode-switch');
        await expect(stageSwitch.getByTestId('mode-stage')).toHaveAttribute('aria-current', 'page');

        await stageSwitch.getByTestId('mode-designer').click();
        await expect(page.getByTestId('screens-heading')).toBeVisible();
    });
});

test.describe('switch between designer and stage on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('stands above the page menu, whose panel still opens below the button', async ({ page }) => {
        await page.goto('./');
        const modeSwitch = page.getByTestId('mode-switch');
        const button = page.getByTestId('page-menu');
        await expect(modeSwitch).toBeVisible();
        const above = (await modeSwitch.boundingBox())!;
        const menu = (await button.boundingBox())!;
        expect(above.y + above.height).toBeLessThanOrEqual(menu.y);

        await button.click();
        const panel = (await page.locator('#module-pages').boundingBox())!;
        expect(panel.y).toBeGreaterThanOrEqual(menu.y + menu.height);
    });

});

// The bar of ChurchTools hid the switch while the stage page lay fixed over the window (user, 2026-11-13, PC and phone); now the page
// stands in the flow like the designer. The dev server has no bar: a sticky one of 56 px comes first in the body, after the page has
// mounted, as ChurchTools does (Befunde G55).
for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    test.describe(`the stage page below the bar of ChurchTools on a ${name}`, () => {
        test.use({ viewport });

        test('starts below the bar, the switch can be clicked', async ({ page }) => {
            await page.goto('steuerung');
            const stageSwitch = page.getByTestId('mode-switch');
            await expect(stageSwitch).toBeVisible();
            await page.evaluate(() => {
                const bar = document.createElement('div');
                bar.style.cssText = 'position:sticky;top:0;height:56px;z-index:1000;background:#1e3a8a';
                document.body.prepend(bar);
            });
            await expect.poll(async () => (await stageSwitch.boundingBox())!.y).toBeGreaterThanOrEqual(56);
            // No white frame: the margins of the host page are dark while the page is open, and light again after it.
            const body = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
            expect(await body()).toBe('rgb(16, 17, 20)');
            await stageSwitch.getByTestId('mode-designer').click();
            await expect(page.getByTestId('screens-heading')).toBeVisible();
            expect(await body()).not.toBe('rgb(16, 17, 20)');
        });
    });
}

// The switch keeps place and size on the way to the stage – only the colours change (user, 2026-11-13: on the phone, then on the iPad).
for (const [name, viewport] of [
    ['phone', { width: 390, height: 844 }],
    ['iPad upright', { width: 820, height: 1180 }],
    ['iPad across', { width: 1180, height: 820 }],
    ['desktop', { width: 1440, height: 900 }],
] as const) {
    test.describe(`the switch on a ${name}`, () => {
        test.use({ viewport });

        test('stands at the same place and in the same size on the stage page', async ({ page }) => {
            const box = async () => {
                const b = (await page.getByTestId('mode-switch').boundingBox())!;
                return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
            };
            await page.goto('./');
            await expect(page.getByTestId('mode-switch')).toBeVisible();
            const designer = await box();
            await page.getByTestId('mode-switch').getByTestId('mode-stage').click();
            await expect(page).toHaveURL(/\/steuerung$/);
            await expect(page.getByTestId('mode-switch').getByTestId('mode-stage')).toHaveAttribute('aria-current', 'page');
            expect(await box()).toEqual(designer);
        });
    });
}
