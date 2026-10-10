import { expect, test, type Page } from '@playwright/test';
import { addBlock, dragRow, openSection } from './helpers';

// Grouping blocks (Plan.md 79, D9): a group is chosen and moved as one; a double click picks one member.

async function openWithThree(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();
    const places = [
        { x: 200, y: 200, width: 400, height: 200 },
        { x: 800, y: 200, width: 400, height: 200 },
        { x: 1400, y: 600, width: 300, height: 200 },
    ];
    for (const place of places) {
        await addBlock(page, 'shape');
        await openSection(page, 'measures');
        for (const [key, value] of Object.entries(place)) {
            await page.getByTestId(`inspector-${key}`).fill(String(value));
            await page.getByTestId(`inspector-${key}`).blur();
        }
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.frame--selected')).toHaveCount(0);
}

const frames = (page: Page) => page.getByTestId('frame-shape');
const selected = (page: Page) => page.locator('.frame--selected');

async function lefts(page: Page): Promise<number[]> {
    return Promise.all([0, 1, 2].map(async (i) => (await frames(page).nth(i).boundingBox())!.x));
}

test.describe('on a desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('Ctrl+G groups, a click chooses both, dragging moves both, a double click chooses one, Ctrl+Shift+G ungroups', async ({ page }) => {
        await openWithThree(page);
        await frames(page).nth(0).click();
        await frames(page).nth(1).click({ modifiers: ['Shift'] });
        await expect(selected(page)).toHaveCount(2);
        await page.keyboard.press('ControlOrMeta+g');
        await expect(page.getByTestId('multi-title')).toHaveText('Gruppe · 2 Bausteine');
        await expect(page.getByTestId('layer-group')).toHaveCount(1); // the list stands in "Anordnen"

        // A click on one member chooses the whole group.
        await page.keyboard.press('Escape');
        await expect(selected(page)).toHaveCount(0);
        await frames(page).nth(0).click();
        await expect(selected(page)).toHaveCount(2);

        // Dragging one moves both by the same amount; the third stays.
        const before = await lefts(page);
        const box = (await frames(page).nth(0).boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
        await page.mouse.up();
        const after = await lefts(page);
        expect(after[0]! - before[0]!).toBeGreaterThan(40);
        expect(after[1]! - before[1]!).toBeCloseTo(after[0]! - before[0]!, 0);
        expect(after[2]).toBe(before[2]);

        // A double click on a member of the chosen group chooses it alone.
        await page.keyboard.press('Escape');
        await frames(page).nth(1).dblclick();
        await expect(selected(page)).toHaveCount(1);
        await expect(page.locator('.handle')).toHaveCount(8);

        // Ungroup: with the group chosen again, then a click chooses one block only.
        await frames(page).nth(0).click();
        await expect(selected(page)).toHaveCount(2);
        await page.keyboard.press('ControlOrMeta+Shift+g');
        await expect(page.getByTestId('multi-title')).toHaveText('2 Bausteine');
        await page.keyboard.press('Escape');
        await frames(page).nth(0).click();
        await expect(selected(page)).toHaveCount(1);
    });

    test('a chosen group aligns to the slide as one block; its members keep their distance (user, 2026-10-10)', async ({ page }) => {
        await openWithThree(page);
        await frames(page).nth(0).click();
        await frames(page).nth(1).click({ modifiers: ['Shift'] });
        await page.keyboard.press('ControlOrMeta+g');
        const [a0, b0] = await lefts(page);
        await openSection(page, 'arrange');
        await page.getByTestId('block-inspector').getByTestId('arrange-right').click();
        const [a1, b1] = await lefts(page);
        expect(Math.abs(b1! - a1! - (b0! - a0!))).toBeLessThan(1);
        // The right edge of the second member meets the slide's right edge.
        const stage = (await page.getByTestId('grid').boundingBox())!;
        const second = (await frames(page).nth(1).boundingBox())!;
        expect(Math.abs(second.x + second.width - (stage.x + stage.width))).toBeLessThan(2);
    });

    test('the inspector and the short menu group and ungroup; the list shows the group as one row', async ({ page }) => {
        await openWithThree(page);
        await frames(page).nth(0).click();
        await frames(page).nth(1).click({ modifiers: ['Shift'] });
        await expect(page.getByTestId('inspector-ungroup')).toHaveCount(0);
        await page.getByTestId('inspector-group').click();
        await expect(page.getByTestId('inspector-group')).toHaveCount(0);
        await expect(page.getByTestId('inspector-ungroup')).toBeVisible();
        await openSection(page, 'arrange');
        await expect(page.getByTestId('layer-group')).toHaveCount(1);
        await expect(page.getByTestId('layer-group')).toContainText('2 Bausteine');

        // The lock of the group row locks both members.
        await page.getByTestId('layer-group-row').getByTestId('layer-lock').click();
        await expect(page.getByTestId('layer-group-row').getByTestId('layer-lock')).toHaveAttribute('aria-pressed', 'true');
        await page.getByTestId('layer-group-toggle').click();
        await expect(page.locator('.layer-lock--on')).toHaveCount(3);

        await page.getByTestId('quick-more').click();
        await page.getByTestId('quick-ungroup').click();
        await expect(page.getByTestId('layer-group')).toHaveCount(0);
        await page.getByTestId('quick-more').click();
        await expect(page.getByTestId('quick-group')).toBeVisible();
    });

    test('the group is one row: a member goes to the front inside it, dragging the row moves both (user, 2026-10-10)', async ({ page }) => {
        await openWithThree(page);
        const [a, b, c] = await lefts(page);
        await frames(page).nth(0).click();
        await frames(page).nth(1).click({ modifiers: ['Shift'] });
        await page.keyboard.press('ControlOrMeta+g');
        await openSection(page, 'arrange');
        const toggle = page.getByTestId('layer-group-toggle');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('layer-row')).toHaveCount(1);
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');

        // The members list top first: the lower one chosen alone goes to the front – inside the group.
        const members = page.getByTestId('layer-group-members').getByTestId('layer-row');
        await members.nth(1).click();
        await expect(selected(page)).toHaveCount(1);
        await page.getByTestId('block-inspector').getByTestId('layer-front').click();
        expect(await lefts(page)).toEqual([b, a, c]);

        // The row of the group drags above the third block and takes both along.
        await dragRow(page, page.getByTestId('layer-group-row').getByTestId('layer-handle'), page.getByTestId('layer-row').first());
        await expect.poll(() => lefts(page)).toEqual([c, b, a]);
    });
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('"Mehrere auswählen" then "⋯ → Gruppieren"; a tap chooses the group, "⋯ → Gruppierung aufheben" ends it', async ({ page }) => {
        await page.goto('./');
        await page.getByTestId('open-editor').first().click();
        await expect(page.getByTestId('save-status')).toHaveText('Alles veröffentlicht');
        await page.getByTestId('phone-slides').tap();
        await page.getByTestId('add-slide').tap();
        if (await page.getByTestId('slides-sheet').count()) await page.getByTestId('slides-sheet-close').tap();
        for (let i = 0; i < 3; i++) await addBlock(page, 'shape');
        await page.getByTestId('quick-deselect').tap();
        await page.getByTestId('phone-slide-more').tap();
        await page.getByTestId('phone-multi-select').tap();
        // New blocks lie one over the other, shifted: the top left corner of each one is free.
        for (let i = 0; i < 2; i++) await frames(page).nth(i).tap({ position: { x: 4, y: 4 } });
        await expect(page.locator('.frame--selected')).toHaveCount(2);
        await page.getByTestId('quick-more').tap();
        await page.getByTestId('quick-group').tap();
        await page.getByTestId('multi-select-done').tap();
        await expect(page.getByTestId('quick-count')).toHaveText('Gruppe · 2 Bausteine');

        await page.getByTestId('quick-deselect').tap();
        await expect(selected(page)).toHaveCount(0);
        await frames(page).nth(0).tap({ position: { x: 4, y: 4 } });
        await expect(selected(page)).toHaveCount(2);
        // A double tap on a member of the chosen group chooses it alone – the second tap's release must not take the group back.
        const corner = (await frames(page).nth(0).boundingBox())!;
        await page.touchscreen.tap(corner.x + 4, corner.y + 4);
        await page.touchscreen.tap(corner.x + 4, corner.y + 4);
        await expect(selected(page)).toHaveCount(1);

        await page.getByTestId('quick-more').tap();
        await page.getByTestId('quick-ungroup').tap();
        await page.getByTestId('quick-more').tap();
        await expect(page.getByTestId('quick-ungroup')).toHaveCount(0);
        // Without the group a tap chooses only the block itself.
        await page.keyboard.press('Escape');
        await page.getByTestId('quick-deselect').tap();
        await frames(page).nth(0).tap({ position: { x: 4, y: 4 } });
        await expect(selected(page)).toHaveCount(1);
    });
});
