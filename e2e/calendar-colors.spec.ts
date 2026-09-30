import { expect, test, type Page } from '@playwright/test';
import { openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

// ChurchTools sends `black` for a calendar set to black (measured on the test instance), not #000000.
const CALENDARS = [
    { id: 1, name: 'Jugend', color: '#16a765' },
    { id: 2, name: 'Gottesdienst', color: 'black' },
    { id: 3, name: 'Bandproben', color: '#b99aff' },
];

function appointments(): unknown[] {
    return [
        [1, 2, 'Gottesdienst', 1, 10],
        [2, 1, 'Jugendtreff', 2, 19],
        [3, 3, 'Bandprobe', 3, 19],
        [4, 2, 'Gottesdienst', 8, 10],
    ].map(([id, calendar, title, inDays, hour]) => {
        const start = new Date();
        start.setDate(start.getDate() + Number(inDays));
        start.setHours(Number(hour), 0, 0, 0);
        const c = CALENDARS.find((x) => x.id === calendar)!;
        return {
            appointment: {
                base: { id, title, allDay: false, calendar: { id: c.id, name: c.name, color: c.color }, image: null },
                calculated: { startDate: start.toISOString(), endDate: new Date(start.getTime() + 5_400_000).toISOString() },
            },
        };
    });
}

/** Answers the calendar reads of the demo screen with made-up calendars; nothing reaches the instance. */
async function fakeCalendars(page: Page): Promise<void> {
    await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (path === '/whoami') return json({ id: 1, firstName: 'Anna', lastName: 'Beispiel' });
        if (path === '/calendars') return json(CALENDARS);
        if (path === '/calendars/appointments') return json(appointments());
        return json([]);
    });
}

/** Modern look, and a white background for the slides at these positions of the demo playlist. */
async function whiteModern(page: Page, positions: number[]): Promise<void> {
    await page.goto('design');
    await page.getByTestId('appointments-large').check();
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    for (const position of positions) {
        await page.getByTestId('slide-item').nth(position).click();
        await openSection(page, 'background');
        const hex = page.getByTestId('fill-color');
        await hex.fill('#ffffff');
        await hex.blur();
    }
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
}

/** Red, green, blue (0–1) and alpha of a computed colour: Chromium answers `color(srgb …)`, WebKit `rgba(…)`. */
function channels(value: string): [number, number, number, number] {
    const numbers = (value.match(/[\d.]+/g) ?? []).map(Number);
    const scale = value.startsWith('color(') ? 1 : 255;
    return [numbers[0]! / scale, numbers[1]! / scale, numbers[2]! / scale, numbers[3] ?? 1];
}

test('a calendar in black keeps its badge and date tile on a white slide', async ({ page }) => {
    await fakeCalendars(page);
    await whiteModern(page, [2]);
    await page.goto('./player?screen=demo');
    const badge = page.locator('.badge', { hasText: 'Gottesdienst' }).first();
    await expect(badge).toBeVisible({ timeout: 30_000 });
    const look = await badge.evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, color: style.color };
    });
    const [r, g, b, alpha] = channels(look.background);
    expect(r + g + b).toBeLessThan(0.3);
    expect(alpha).toBeGreaterThan(0.85);
    expect(channels(look.color).slice(0, 3)).toEqual([1, 1, 1]);
    const tile = await page.locator('.tile').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const [tr, tg, tb, tAlpha] = channels(tile);
    expect(tr + tg + tb).toBeLessThan(0.3);
    expect(tAlpha).toBeCloseTo(0.28, 2);
});
