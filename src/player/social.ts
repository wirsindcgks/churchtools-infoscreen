/**
 * What a `social` block draws for an address (Plan.md 80): the platform it belongs to and the name one searches for in
 * its app, without "@". Pure and read at drawing time, never stored – a later version that knows more platforms
 * improves old blocks too.
 */
import { SOCIAL_MARKS, type SocialPlatform } from './social-marks';
import { withScheme } from './web';

export type SocialKind = SocialPlatform | 'website' | 'email';

export interface SocialProfile {
    platform: SocialKind;
    name: string;
}

/** The first path segments that are no profile name on their platform: a post, a video, a group, a settings page. */
const SYSTEM_PATHS: Partial<Record<SocialPlatform, ReadonlySet<string>>> = {
    instagram: new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 'direct', 'about']),
    x: new Set(['i', 'home', 'intent', 'share', 'search', 'hashtag', 'explore', 'messages', 'settings', 'notifications', 'compose']),
    facebook: new Set([
        'groups', 'profile.php', 'watch', 'events', 'pages', 'sharer', 'sharer.php', 'share', 'share.php', 'story.php', 'photo',
        'photos', 'permalink.php', 'marketplace', 'login', 'people', 'hashtag', 'gaming', 'reel', 'reels', 'stories', 'video',
        'videos', 'dialog', 'plugins', 'tr', 'l.php',
    ]),
    telegram: new Set(['s', 'joinchat', 'addstickers', 'share', 'c']),
    twitch: new Set(['videos', 'directory', 'downloads', 'p', 'settings', 'subscriptions', 'turbo']),
    pinterest: new Set(['pin', 'ideas', 'search', 'today', 'business', '_']),
    soundcloud: new Set(['discover', 'search', 'you', 'upload', 'stream', 'pages', 'charts', 'tags', 'feed']),
    vimeo: new Set(['channels', 'groups', 'album', 'showcase', 'ondemand', 'categories', 'watch', 'stock', 'search', 'user']),
};

/** Hosts (without `www.` and `m.`) whose profile name is the first path segment. */
const NAMED_BY_FIRST_SEGMENT: Record<string, SocialPlatform> = {
    'instagram.com': 'instagram',
    'x.com': 'x',
    'twitter.com': 'x',
    'facebook.com': 'facebook',
    't.me': 'telegram',
    'telegram.me': 'telegram',
    'twitch.tv': 'twitch',
    'soundcloud.com': 'soundcloud',
    'vimeo.com': 'vimeo',
};

/** Hosts whose address names the platform only – no profile name worth showing. */
const NAMED_BY_PLATFORM: Record<string, SocialPlatform> = {
    'wa.me': 'whatsapp',
    'whatsapp.com': 'whatsapp',
    'api.whatsapp.com': 'whatsapp',
    'chat.whatsapp.com': 'whatsapp',
    'open.spotify.com': 'spotify',
    'spotify.com': 'spotify',
    'podcasts.apple.com': 'apple-podcasts',
    'signal.me': 'signal',
    'signal.group': 'signal',
    'youtu.be': 'youtube',
};

/** The platforms whose profile name stands behind an "@" in the first path segment. */
const NAMED_BY_AT: Record<string, SocialPlatform> = {
    'tiktok.com': 'tiktok',
    'threads.net': 'threads',
    'threads.com': 'threads',
};

const MASTODON_HOSTS = new Set(['mastodon.social', 'mastodon.online']);

function decode(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

function platformName(platform: SocialPlatform): string {
    return SOCIAL_MARKS[platform].title;
}

/** The profile an address stands for; a `label` set on the link wins over its name (see `socialName`). */
export function socialProfile(input: string): SocialProfile {
    const text = input.trim();
    const mail = /^mailto:/i.test(text) ? text.slice(7).split('?')[0]! : !text.includes('/') && /^[^\s@:]+@[^\s@:]+$/.test(text) ? text : null;
    if (mail !== null) return { platform: 'email', name: decode(mail) };

    let url: URL;
    try {
        url = new URL(withScheme(text));
    } catch {
        return { platform: 'website', name: text };
    }
    // A host without a dot ("Unsinn") is no address anyone typed on purpose.
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return { platform: 'website', name: text };

    const host = url.hostname.replace(/^(www|m)\./, '');
    const segments = url.pathname.split('/').filter(Boolean).map(decode);
    const first = segments[0] ?? '';

    const bySegment = NAMED_BY_FIRST_SEGMENT[host] ?? (/^pinterest\.[a-z.]+$/.test(host) ? 'pinterest' : null);
    if (bySegment) {
        const system = SYSTEM_PATHS[bySegment];
        const numericVideo = bySegment === 'vimeo' && /^\d+$/.test(first);
        const sharedLink = bySegment === 'telegram' && first.startsWith('+');
        return { platform: bySegment, name: !first || system?.has(first) || numericVideo || sharedLink ? platformName(bySegment) : first };
    }

    const byPlatform = NAMED_BY_PLATFORM[host];
    if (byPlatform) return { platform: byPlatform, name: platformName(byPlatform) };

    const byAt = NAMED_BY_AT[host];
    if (byAt) return { platform: byAt, name: first.startsWith('@') && first.length > 1 ? first.slice(1) : platformName(byAt) };

    if (host === 'youtube.com') {
        const name = first.startsWith('@') ? first.slice(1) : first === 'c' || first === 'user' ? (segments[1] ?? '') : '';
        return { platform: 'youtube', name: name || platformName('youtube') };
    }
    if (host === 'bsky.app') return { platform: 'bluesky', name: first === 'profile' && segments[1] ? segments[1] : platformName('bluesky') };
    if (MASTODON_HOSTS.has(host)) {
        return { platform: 'mastodon', name: first.startsWith('@') && first.length > 1 ? `${first.slice(1)}@${host}` : platformName('mastodon') };
    }

    return { platform: 'website', name: host + url.pathname.replace(/\/+$/, '') };
}

/** The name a line shows: the link's own `label` when it has one, else the one read from the address. */
export function socialName(link: { url: string; label?: string }): string {
    return link.label?.trim() || socialProfile(link.url).name;
}
