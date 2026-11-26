/**
 * Where "‹ ChurchTools" in the head of the phone page leads (Plan.md 135): back to the page before when it belongs to the same instance,
 * otherwise to the start page of the instance. A phone that came by the QR code or a link from elsewhere has nothing to go back to.
 */
export function backTarget(referrer: string, origin: string): 'back' | 'home' {
    if (!referrer) return 'home';
    try {
        return new URL(referrer).origin === origin ? 'back' : 'home';
    } catch {
        return 'home';
    }
}

/** Leaves the phone page by `backTarget`. */
export function leaveControl(): void {
    if (backTarget(document.referrer, window.location.origin) === 'back') window.history.back();
    else window.location.assign('/');
}
