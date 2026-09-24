/**
 * The address a TV opens (way A, decided 2026-09-24): no secret in it, the
 * browser of the TV signs in once as the device account – like the built-in
 * info screen. It lives where the designer lives, so the origin is right in
 * ChurchTools and in development alike.
 */
export function playerUrl(slug: string): string {
    return new URL(`player?screen=${encodeURIComponent(slug)}`, window.location.origin + import.meta.env.BASE_URL).toString();
}

/** Copies the player address; false without clipboard access, where it stays to be copied by hand. */
export async function copyPlayerUrl(slug: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(playerUrl(slug));
        return true;
    } catch {
        return false;
    }
}
