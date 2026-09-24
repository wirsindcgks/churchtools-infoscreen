import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test('an open player follows what the designer saves, without reloading', async ({ context }) => {
    test.setTimeout(90_000);
    const designer = await context.newPage();
    await designer.goto('./');
    await designer.getByTestId('open-editor').first().click();
    await expect(designer.getByTestId('slide-item')).toHaveCount(3);

    const player = await context.newPage();
    await player.goto('./player?screen=demo');
    await expect(player.getByText('Herzlich willkommen!')).toBeVisible();

    // A change to the slide on screen shows within seconds.
    await designer.getByTestId('frame-text').first().click();
    await designer.getByTestId('text-input').fill('Willkommen zum Test');
    await designer.getByTestId('text-input').blur();
    await designer.getByTestId('save').click();
    await expect(designer.getByTestId('save-status')).toHaveText('Gespeichert');
    await expect(player.getByText('Willkommen zum Test')).toBeVisible({ timeout: 5_000 });

    // Slide 1 down to 2 seconds, and a new fourth slide with its own text.
    await designer.keyboard.press('Escape');
    await designer.getByTestId('duration-input').fill('2');
    await designer.getByTestId('duration-input').blur();
    await designer.getByTestId('slide-item').last().click();
    await designer.getByTestId('add-slide').click();
    await designer.getByTestId('add-text').click();
    await designer.getByTestId('text-input').fill('Neue Slide 4');
    await designer.getByTestId('text-input').blur();
    await designer.getByTestId('save').click();
    await expect(designer.getByTestId('save-status')).toHaveText('Gespeichert');

    // The player keeps its position and reaches slide 4 within one round (2 + 10 + 12 s).
    await expect(player.getByText('Neue Slide 4')).toBeVisible({ timeout: 40_000 });
});

test('the new-screen form lines up', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('./');
    await expect(page.getByTestId('new-name')).toBeVisible();
    const boxes = await Promise.all(
        [page.getByTestId('new-name'), page.getByTestId('new-slug'), page.locator('form.create select')].map((l) =>
            l.boundingBox(),
        ),
    );
    const tops = boxes.map((b) => Math.round(b!.y));
    expect(new Set(tops).size).toBe(1); // all three fields on one line
    await page.locator('form.create').screenshot({ path: 'test-results/new-screen-form.png' });
});
