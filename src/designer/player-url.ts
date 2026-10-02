/**
 * The address of the player without any login, to open and copy in the designer. It lives where
 * the designer lives, so the origin is right in ChurchTools and in development alike. The address
 * for a TV, with the device account's login token, is made in the settings (`withDeviceLogin`).
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
