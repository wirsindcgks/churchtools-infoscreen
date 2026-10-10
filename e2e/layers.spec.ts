import { expect, test, type Page } from '@playwright/test';
import { addBlock, openSlides } from './helpers';

// The list of the slide's blocks, "Mehrere auswählen" at the finger, and the sheet of slides sorted on the grid (Plan.md 79, D6, D7).

async function openEditor(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
}

/** A fresh, empty slide, then `count` shapes on it, the last one chosen. On a phone the slide is added from the sheet of slides. */
async function freshSlideWith(page: Page, count: number): Promise<void> {
    if (await page.getByTestId('phone-bar').count()) {
        await page.getByTestId('phone-slides').tap();
        await page.getByTestId('add-slide').tap();
        if (await page.getByTestId('slides-sheet').count()) await page.getByTestId('slides-sheet-close').tap();
    } else {
        await page.getByTestId('add-slide').click();
    }
    for (let i = 0; i < count; i++) await addBlock(page, 'shape');
}

test.describe('on a desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('the list of the slide\'s blocks chooses, adds with Shift, locks and outlines the block under the mouse', async ({ page }) => {
        await openEditor(page);
        await freshSlideWith(page, 3);
        await page.keyboard.press('Escape');
        await expect(page.locator('.frame--selected')).toHaveCount(0);

        // Nothing is chosen: the blocks stand first in the inspector.
        const section = page.getByTestId('slide-blocks');
        await expect(section).toContainText('Bausteine dieser Folie');
        await expect(section).toContainText('oben = vorne');
        const rows = section.getByTestId('layer-row');
        await expect(rows).toHaveCount(3);

        // The mouse over a row outlines the block on the stage – not the chosen one.
        await rows.nth(1).hover();
        await expect(page.locator('.frame--hinted')).toHaveCount(1);
        await page.mouse.move(5, 5);
        await expect(page.locator('.frame--hinted')).toHaveCount(0);

        // A click chooses the block (the short menu stands), Shift-click adds the next.
        await rows.nth(0).click();
        await expect(page.getByTestId('quick-menu')).toBeVisible();
        const arrange = page.getByTestId('block-inspector').getByTestId('layer-row');
        await arrange.nth(1).click({ modifiers: ['Shift'] });
        await expect(page.getByTestId('multi-title')).toHaveText('2 Bausteine');

        // The lock button of a row locks and unlocks in one step.
        const lock = arrange.nth(2).getByTestId('layer-lock');
        await expect(lock).toHaveAttribute('aria-pressed', 'false');
        await lock.click();
        await expect(lock).toHaveAttribute('aria-pressed', 'true');
        await lock.click();
        await expect(lock).toHaveAttribute('aria-pressed', 'false');
    });
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('"⋯ → Mehrere auswählen": three taps, "3 gewählt", the short menu acts on them, "Fertig" brings the slide row back', async ({ page }) => {
        await openEditor(page);
        await freshSlideWith(page, 3);
        await page.getByTestId('quick-deselect').tap();
        await expect(page.locator('.frame--selected')).toHaveCount(0);

        await page.getByTestId('phone-slide-more').tap();
        await page.getByTestId('phone-multi-select').tap();
        const bar = page.getByTestId('multi-select-bar');
        await expect(bar).toContainText('0 gewählt');
        await expect(page.getByTestId('phone-block-row')).toHaveCount(0);
        await expect(page.getByTestId('phone-slide-row')).toHaveCount(0);

        // New blocks lie one over the other, shifted: the top left corner of each one is free.
        const frames = page.getByTestId('frame-shape');
        for (let i = 0; i < 3; i++) await frames.nth(i).tap({ position: { x: 4, y: 4 } });
        await expect(bar).toContainText('3 gewählt');
        await expect(page.locator('.frame--selected')).toHaveCount(3);
        // A tap on the empty stage does nothing in the mode.
        await page.locator('.editor-stage').tap({ position: { x: 4, y: 4 } });
        await expect(bar).toContainText('3 gewählt');

        // The short menu stands above the count all along and acts on the three.
        await expect(page.getByTestId('quick-count')).toHaveText('3 Bausteine');
        await page.getByTestId('quick-more').tap();
        await page.getByTestId('quick-duplicate').tap();
        await expect(frames).toHaveCount(6);
        await expect(bar).toContainText('3 gewählt');

        await page.getByTestId('multi-select-done').tap();
        await expect(bar).toHaveCount(0);
        await expect(page.getByTestId('phone-slide-row')).toBeVisible();
        await page.getByTestId('quick-more').tap();
        await page.getByTestId('quick-delete').tap();
        await expect(frames).toHaveCount(3);
    });

    test('"⋯ → Bausteine dieser Folie" opens the sheet with the list; a tap on a row chooses and closes the sheet', async ({ page }) => {
        await openEditor(page);
        await freshSlideWith(page, 2);
        await page.getByTestId('phone-slide-more').tap();
        await page.getByTestId('phone-slide-blocks').tap();
        await expect(page.getByTestId('inspector-sheet')).toHaveClass(/open/);
        const section = page.getByTestId('slide-blocks');
        await expect(section.getByTestId('layer-row')).toHaveCount(2);
        await section.getByTestId('layer-row').nth(1).tap();
        await expect(page.getByTestId('inspector-sheet')).not.toHaveClass(/open/);
        await expect(page.getByTestId('phone-block-row')).toBeVisible();
        await expect(page.locator('.frame--selected')).toHaveCount(1);
    });

    test('the sheet of slides sorts on its grid: a tile dragged with the mouse takes the place of another', async ({ page }) => {
        await openEditor(page);
        const sheet = await openSlides(page);
        const names = async (): Promise<string[]> => {
            const labels = await sheet.getByTestId('slide-item').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label') ?? ''));
            return labels.map((label) => label.replace(/^\d+\. /, ''));
        };
        await expect(sheet.getByTestId('slide-item')).toHaveCount(3);
        await expect(sheet.getByTestId('slide-handle').first()).toBeHidden();
        const [a, b, c] = await names();
        const from = (await sheet.getByTestId('slide-item').first().boundingBox())!;
        const to = (await sheet.getByTestId('slide-item').nth(2).boundingBox())!;
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
        await page.mouse.up();
        await expect.poll(names).toEqual([b, c, a]);
        // The drop did not choose the tile it ended on: the sheet is still open.
        await expect(sheet).toBeVisible();
    });
});
