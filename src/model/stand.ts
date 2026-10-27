/**
 * The state of a playlist (Plan.md 111): the latest `updatedAt` of the playlist and its slides. `savePlaylist`
 * stamps both alike, drafts are invisible to devices, and theme and templates belong to no presentation – so
 * this is what the playlists page shows as "edited" and what a screen can report as the state it shows.
 */
export function playlistStand(
    playlist: { updatedAt?: string; slideIds: string[] },
    slides: Iterable<{ id: string; updatedAt?: string }>,
): string | null {
    const own = new Set(playlist.slideIds);
    // ISO instants of one clock: the latest is the greatest string.
    let latest = playlist.updatedAt ?? '';
    for (const slide of slides) if (own.has(slide.id) && (slide.updatedAt ?? '') > latest) latest = slide.updatedAt!;
    return latest || null;
}
