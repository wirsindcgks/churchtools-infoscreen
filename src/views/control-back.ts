/**
 * Where "ChurchTools" in the head of the phone page leads (Plan.md 135). Since the pencil went (user, 2026-11-26) it is the one way out:
 * - `app` – the phone page was opened from within the module (the designer's menu or the QR dialog): back there, so a designer is back
 *   in the designer;
 * - `back` – the page before belongs to the same instance: back to it;
 * - `home` – otherwise (the QR code, a link from elsewhere): the start page of the instance.
 */
export function backTarget(appBack: boolean, referrer: string, origin: string): 'app' | 'back' | 'home' {
    if (appBack) return 'app';
    if (!referrer) return 'home';
    try {
        return new URL(referrer).origin === origin ? 'back' : 'home';
    } catch {
        return 'home';
    }
}

/** Leaves the phone page by `backTarget`; `appBack` – the router knows a page of the module before this one. */
export function leaveControl(appBack: boolean): void {
    if (backTarget(appBack, document.referrer, window.location.origin) === 'home') window.location.assign('/');
    else window.history.back();
}
