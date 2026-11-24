/**
 * A whole presentation inside another (Plan.md 120): the embedded presentation's slides take the place of its entry among the
 * outer presentation's own slides. One level only – the embeds of an embedded presentation are skipped, which also rules out loops.
 */
import { sameStage, type PlaylistEmbed } from './schema';
import { playlistStand } from './stand';

interface EmbeddingPlaylist {
    id: string;
    slideIds: readonly string[];
    embeds?: readonly PlaylistEmbed[];
    stage?: { width: number; height: number };
}

/**
 * The slide ids a presentation shows, in order: its own, with the slides of each embedded presentation at its position. An unknown
 * presentation, the presentation itself and one of another format are skipped; several embeds at one position keep their order.
 * Disabled slides are still in the list – the callers filter them, as for the own slides.
 */
export function shownSlideIds(playlist: EmbeddingPlaylist, playlists: readonly EmbeddingPlaylist[]): string[] {
    if (!playlist.embeds?.length) return [...playlist.slideIds];
    const byId = new Map(playlists.map((p) => [p.id, p]));
    const at = new Map<number, string[]>();
    for (const embed of playlist.embeds) {
        const inner = byId.get(embed.playlistId);
        if (!inner || inner.id === playlist.id) continue;
        if (playlist.stage && inner.stage && !sameStage(playlist.stage, inner.stage)) continue;
        const position = Math.min(embed.position, playlist.slideIds.length);
        at.set(position, [...(at.get(position) ?? []), ...inner.slideIds]);
    }
    const ids: string[] = [];
    for (let i = 0; i <= playlist.slideIds.length; i++) {
        ids.push(...(at.get(i) ?? []));
        if (i < playlist.slideIds.length) ids.push(playlist.slideIds[i]!);
    }
    return ids;
}

/** The ids of the presentations embedded in these, without those already among them – what a screen has to load as well. */
export function embeddedPlaylistIds(playlists: readonly EmbeddingPlaylist[]): string[] {
    const own = new Set(playlists.map((p) => p.id));
    return [...new Set(playlists.flatMap((p) => (p.embeds ?? []).map((e) => e.playlistId)))].filter((id) => !own.has(id));
}

/**
 * The state a screen shows of a presentation (Plan.md 111): like {@link playlistStand}, with the embedded presentations and their
 * slides – a publish of the main part changes what every presentation embedding it shows.
 */
export function shownStand(
    playlist: EmbeddingPlaylist & { updatedAt?: string },
    playlists: readonly (EmbeddingPlaylist & { updatedAt?: string })[],
    slides: Iterable<{ id: string; updatedAt?: string }>,
): string | null {
    const embedded = new Set((playlist.embeds ?? []).map((e) => e.playlistId));
    // ISO instants of one clock: the latest is the greatest string.
    const updatedAt = playlists.reduce((latest, p) => (embedded.has(p.id) && (p.updatedAt ?? '') > latest ? p.updatedAt! : latest), playlist.updatedAt ?? '');
    return playlistStand({ updatedAt: updatedAt || undefined, slideIds: shownSlideIds(playlist, playlists) }, slides);
}
