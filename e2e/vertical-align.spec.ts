import { expect, test, type Locator, type Page } from '@playwright/test';
import { addBlock, openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
}

async function setHeight(page: Page, height: number): Promise<void> {
    const inspector = page.getByTestId('block-inspector');
    await openSection(page, 'position');
    // Inside the slide, so a screenshot shows the whole box.
    await inspector.getByTestId('inspector-y').fill('40');
    await inspector.getByTestId('inspector-height').fill(String(height));
    await inspector.getByTestId('inspector-height').blur();
}

async function box(locator: Locator): Promise<{ top: number; bottom: number }> {
    const b = (await locator.boundingBox())!;
    return { top: b.y, bottom: b.y + b.height };
}

test('a text block sits at the top, middle or bottom of a tall box (Plan.md 70)', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill('Kurzer Text');
    await page.getByTestId('text-input').blur();
    await setHeight(page, 900);
    await openSection(page, 'font');

    const stage = page.locator('.editor-stage');
    const frame = stage.locator('.block--text').last();
    const inner = frame.getByTestId('text-inner');
    const select = page.getByTestId('text-vertical-align');
    await expect(select).toHaveValue('top'); // the default shows as the effective value
    await expect(frame).toBeVisible();

    for (const [value, name] of [['top', 'oben'], ['middle', 'mitte'], ['bottom', 'unten']] as const) {
        await select.selectOption(value);
        await expect(select).toHaveValue(value);
        await page.waitForTimeout(200);
        const f = await box(frame);
        const t = await box(inner);
        if (value === 'top') expect(Math.abs(t.top - f.top)).toBeLessThan(3);
        if (value === 'bottom') expect(Math.abs(t.bottom - f.bottom)).toBeLessThan(3);
        if (value === 'middle') expect(Math.abs((t.top + t.bottom) / 2 - (f.top + f.bottom) / 2)).toBeLessThan(3);
        await page.screenshot({ path: `test-results/vertical-text-${name}.png` });
    }

    // Undo takes the choice back like any other style change.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(select).toHaveValue('middle');
});

test('text that does not fit starts at the top even when set to "Unten"', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill(Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1}`).join('\n'));
    await page.getByTestId('text-input').blur();
    await setHeight(page, 200);
    await openSection(page, 'font');
    await page.getByTestId('text-vertical-align').selectOption('bottom');

    const frame = page.locator('.editor-stage .block--text').last();
    const f = await box(frame);
    const t = await box(frame.getByTestId('text-inner'));
    expect(t.bottom - t.top).toBeGreaterThan(f.bottom - f.top);
    expect(Math.abs(t.top - f.top)).toBeLessThan(3);
});

test('the field is missing on a list', async ({ page }) => {
    await openEditor(page);
    await addBlock(page, 'appointment-list');
    await openSection(page, 'font');
    await expect(page.getByTestId('block-inspector')).toBeVisible();
    await expect(page.getByTestId('text-vertical-align')).toHaveCount(0);
    await page.getByTestId('block-inspector').evaluate((el) => {
        let parent: Element | null = el;
        while (parent && parent.scrollHeight <= parent.clientHeight) parent = parent.parentElement;
        parent?.scrollTo(0, 100_000);
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/vertical-list-no-field.png' });
});

test('a countdown and a clock keep their old place and can be moved', async ({ page }) => {
    await openEditor(page);
    const stage = page.locator('.editor-stage');
    const inspector = page.getByTestId('block-inspector');

    await addBlock(page, 'countdown');
    await setHeight(page, 700);
    await openSection(page, 'font');
    const countdown = stage.locator('.block--countdown').last();
    const content = countdown.locator('.countdown-inner');
    await expect(page.getByTestId('text-vertical-align')).toHaveValue('middle');
    let f = await box(countdown);
    let c = await box(content);
    expect(Math.abs((c.top + c.bottom) / 2 - (f.top + f.bottom) / 2)).toBeLessThan(3);
    await page.getByTestId('text-vertical-align').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/vertical-countdown-mitte.png' });
    await page.getByTestId('text-vertical-align').selectOption('bottom');
    await page.waitForTimeout(200);
    f = await box(countdown);
    c = await box(content);
    expect(Math.abs(c.bottom - f.bottom)).toBeLessThan(3);
    await page.screenshot({ path: 'test-results/vertical-countdown-unten.png' });
    await page.getByTestId('text-vertical-align').selectOption('top');
    await page.waitForTimeout(200);
    c = await box(content);
    expect(Math.abs(c.top - (await box(countdown)).top)).toBeLessThan(3);

    await addBlock(page, 'clock');
    await setHeight(page, 600);
    await openSection(page, 'font');
    const clock = stage.locator('.block--clock').last();
    await expect(inspector.getByTestId('text-vertical-align')).toHaveValue('top');
    expect(Math.abs((await box(clock.locator('.clock-inner'))).top - (await box(clock)).top)).toBeLessThan(3);

});

test('a next appointment places image and text together', async ({ page }) => {
    await openEditor(page);
    const stage = page.locator('.editor-stage');
    const inspector = page.getByTestId('block-inspector');
    await addBlock(page, 'next-appointment');
    await setHeight(page, 700);
    await openSection(page, 'font');
    const next = stage.locator('.block--next-appointment').last();
    await expect(inspector.getByTestId('text-vertical-align')).toHaveValue('middle');
    const text = next.locator('.hero-text, .text').first();
    await expect(text).toBeVisible();
    let f = await box(next);
    let c = await box(text);
    expect(Math.abs((c.top + c.bottom) / 2 - (f.top + f.bottom) / 2)).toBeLessThan(5);
    await page.screenshot({ path: 'test-results/vertical-next-mitte.png' });
    await inspector.getByTestId('text-vertical-align').selectOption('bottom');
    await page.waitForTimeout(200);
    f = await box(next);
    c = await box(text);
    expect(f.bottom - c.bottom).toBeLessThan(25); // the card's padding
    await page.screenshot({ path: 'test-results/vertical-next-unten.png' });
});
