import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test('designer lists the demo screen and opens it in the player', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('screens-heading')).toBeVisible();
    await expect(page.getByTestId('demo-notice')).toBeVisible();
    await page.screenshot({ path: 'test-results/designer.png' });

    await page.getByTestId('screen-menu').first().click();
    const [player] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('open-player').click()]);
    await expect(player.getByTestId('player')).toBeVisible();
    await expect(player.getByText('Herzlich willkommen!')).toBeVisible();
    await player.screenshot({ path: 'test-results/player-welcome.png' });
});

test('player shows real appointments from the instance', async ({ page }) => {
    await page.goto('./player?screen=demo');
    // Slide 2 (next service) after 8 s, slide 3 (list) after 18 s.
    await expect(page.getByText('Nächster Termin')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/player-next.png' });
    await expect(page.getByText('Die nächsten Termine')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/player-list.png' });
});

test('a human session left in the kiosk browser is not taken for the device account', async ({ page }) => {
    const logins: string[] = [];
    // Person 1 stays signed in whatever the token says – as with a session the token cannot replace.
    await page.route('**/api/whoami**', async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.has('login_token')) logins.push(url.searchParams.get('user_id') ?? '');
        await route.fulfill({ json: { data: { id: 1, firstName: 'Mensch', lastName: 'Vorort' } } });
    });
    await page.goto('./player?screen=demo&login_token=geraet&user_id=22');
    await expect(page.getByRole('alert')).toContainText('nicht der Geräte-Benutzer (Person 22)');
    await expect(page.getByRole('alert')).not.toContainText('Mensch');
    expect(logins).toContain('22');
});

test('way B: the player takes the token from the fragment, where it survives the ChurchTools redirect (G9)', async ({ page }) => {
    const logins: string[] = [];
    await page.route('**/api/whoami**', async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.has('login_token')) logins.push(url.searchParams.get('login_token') ?? '');
        await route.fulfill({ json: { data: { id: 1, firstName: 'Mensch', lastName: 'Vorort' } } });
    });
    // As after the redirect: the query no longer carries the token, the fragment does.
    await page.goto('./player?screen=demo&user_id=22#login_token=geraet&user_id=22');
    await expect(page.getByRole('alert')).toContainText('Person 22');
    expect(logins).toContain('geraet');
});

test('way B: the player takes the token off the address bar, and still knows it after a manual reload', async ({ page }) => {
    const logins: string[] = [];
    await page.route('**/api/whoami**', async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.has('login_token')) logins.push(url.searchParams.get('login_token') ?? '');
        await route.fulfill({ json: { data: { id: 1, firstName: 'Mensch', lastName: 'Vorort' } } });
    });
    // As in a browser that was already signed in: ChurchTools left the token in the query (no redirect).
    await page.goto('./player?screen=demo&login_token=geraet&user_id=22#login_token=geraet&user_id=22');
    await expect(page.getByRole('alert')).toContainText('Person 22');
    expect(page.url()).not.toContain('geraet');
    expect(page.url()).toContain('screen=demo');

    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Person 22');
    expect(logins.filter((t) => t === 'geraet').length).toBeGreaterThanOrEqual(2);
});

test('way B: the nightly reload goes through the address with the token, so the session is renewed daily (G32)', async ({
    page,
}) => {
    // Two hours of fake time run every timer of the player; WebKit needs longer for that than the default 30 s.
    test.setTimeout(120_000);
    await page.clock.install({ time: new Date('2026-09-26T02:50:00') });
    await page.route('**/api/whoami**', (route) =>
        route.fulfill({ json: { data: { id: 22, firstName: 'Infoscreen', lastName: 'Foyer' } } }),
    );
    await page.goto('./player?screen=demo&user_id=22#login_token=geraet&user_id=22');
    await expect(page.getByText('Herzlich willkommen!')).toBeVisible();
    const reload = page.waitForRequest((r) => r.isNavigationRequest() && new URL(r.url()).searchParams.get('login_token') === 'geraet');
    await page.clock.runFor('02:00:00');
    const url = new URL((await reload).url());
    expect(url.searchParams.get('screen')).toBe('demo');
});

test('an unknown screen is named, not shown as a black page', async ({ page }) => {
    await page.goto('./player?screen=gibt-es-nicht');
    await expect(page.getByRole('alert')).toContainText('gibt-es-nicht');
});

test('digits on the stage have equal width, so a clock does not twitch', async ({ page }) => {
    await page.goto('./player?screen=demo');
    const slide = page.locator('.player .slide').first();
    await expect(slide).toHaveCSS('font-variant-numeric', 'tabular-nums');
    // Inter has proportional digits by default: without tabular figures "1111" is narrower than "0000".
    const widths = await slide.evaluate(async (element) => {
        await document.fonts.load('400 100px "ISD Inter"');
        const measure = (text: string) => {
            const span = document.createElement('span');
            // Longhands only: the `font` shorthand would reset font-variant-numeric.
            span.style.cssText = 'font-family: "ISD Inter"; font-size: 100px; position: absolute; white-space: nowrap';
            span.textContent = text;
            element.append(span);
            const width = span.getBoundingClientRect().width;
            span.remove();
            return width;
        };
        return [measure('1111'), measure('0000')];
    });
    expect(Math.abs(widths[0]! - widths[1]!)).toBeLessThan(1);
});
