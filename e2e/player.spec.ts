import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test('designer lists the demo screen and opens it in the player', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('greeting')).toBeVisible();
    await expect(page.getByTestId('demo-notice')).toBeVisible();
    await page.screenshot({ path: 'test-results/designer.png' });

    await page.getByTestId('open-player').click();
    await expect(page.getByTestId('player')).toBeVisible();
    await expect(page.getByText('Herzlich willkommen!')).toBeVisible();
    await page.screenshot({ path: 'test-results/player-welcome.png' });
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

test('an unknown screen is named, not shown as a black page', async ({ page }) => {
    await page.goto('./player?screen=gibt-es-nicht');
    await expect(page.getByRole('alert')).toContainText('gibt-es-nicht');
});
