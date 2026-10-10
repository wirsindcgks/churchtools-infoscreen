import { describe, expect, it } from 'vitest';
import { socialName, socialProfile } from './social';

describe('socialProfile (Plan.md 80)', () => {
    const cases: [string, string, string, string][] = [
        // [title, input, platform, name]
        ['Instagram', 'https://www.instagram.com/wirsindcgks/', 'instagram', 'wirsindcgks'],
        ['without scheme', 'instagram.com/wirsindcgks', 'instagram', 'wirsindcgks'],
        ['www. and m. do not count, nor the case of the host', 'HTTPS://M.Instagram.COM/wirsindcgks', 'instagram', 'wirsindcgks'],
        ['trailing slash', 'instagram.com/wirsindcgks/', 'instagram', 'wirsindcgks'],
        ['query and fragment', 'instagram.com/wirsindcgks?igsh=abc#top', 'instagram', 'wirsindcgks'],
        ['Instagram post', 'instagram.com/p/AbC123/', 'instagram', 'Instagram'],
        ['Instagram reel', 'instagram.com/reel/AbC123', 'instagram', 'Instagram'],
        ['Instagram start page', 'instagram.com', 'instagram', 'Instagram'],
        ['X', 'https://x.com/gemeinde', 'x', 'gemeinde'],
        ['Twitter', 'twitter.com/gemeinde', 'x', 'gemeinde'],
        ['X system path', 'x.com/i/status/1', 'x', 'X'],
        ['Facebook', 'facebook.com/gemeinde.ks', 'facebook', 'gemeinde.ks'],
        ['Facebook profile.php', 'facebook.com/profile.php?id=123', 'facebook', 'Facebook'],
        ['Facebook group', 'facebook.com/groups/123', 'facebook', 'Facebook'],
        ['TikTok', 'tiktok.com/@gemeinde', 'tiktok', 'gemeinde'],
        ['TikTok without @', 'tiktok.com/gemeinde', 'tiktok', 'TikTok'],
        ['Threads (net)', 'threads.net/@gemeinde', 'threads', 'gemeinde'],
        ['Threads (com)', 'threads.com/@gemeinde', 'threads', 'gemeinde'],
        ['YouTube handle', 'https://www.youtube.com/@Gemeinde', 'youtube', 'Gemeinde'],
        ['YouTube /c/', 'youtube.com/c/Gemeinde', 'youtube', 'Gemeinde'],
        ['YouTube /user/', 'youtube.com/user/Gemeinde', 'youtube', 'Gemeinde'],
        ['YouTube channel id', 'youtube.com/channel/UCabc', 'youtube', 'YouTube'],
        ['YouTube video', 'youtube.com/watch?v=abc', 'youtube', 'YouTube'],
        ['YouTube short link', 'youtu.be/abc', 'youtube', 'YouTube'],
        ['Telegram', 't.me/gemeinde', 'telegram', 'gemeinde'],
        ['Telegram invite', 't.me/+abc', 'telegram', 'Telegram'],
        ['Bluesky', 'bsky.app/profile/gemeinde.bsky.social', 'bluesky', 'gemeinde.bsky.social'],
        ['Twitch', 'twitch.tv/gemeinde', 'twitch', 'gemeinde'],
        ['Pinterest (.com)', 'pinterest.com/gemeinde', 'pinterest', 'gemeinde'],
        ['Pinterest (.de)', 'pinterest.de/gemeinde/', 'pinterest', 'gemeinde'],
        ['SoundCloud', 'soundcloud.com/gemeinde', 'soundcloud', 'gemeinde'],
        ['Vimeo', 'vimeo.com/gemeinde', 'vimeo', 'gemeinde'],
        ['Vimeo video', 'vimeo.com/123456', 'vimeo', 'Vimeo'],
        ['WhatsApp number is not shown', 'wa.me/4917012345', 'whatsapp', 'WhatsApp'],
        ['WhatsApp channel', 'whatsapp.com/channel/abc', 'whatsapp', 'WhatsApp'],
        ['Spotify', 'open.spotify.com/show/abc', 'spotify', 'Spotify'],
        ['Apple Podcasts', 'podcasts.apple.com/de/podcast/x/id1', 'apple-podcasts', 'Apple Podcasts'],
        ['Signal', 'signal.me/#eu/abc', 'signal', 'Signal'],
        ['Signal group', 'signal.group/#abc', 'signal', 'Signal'],
        ['Mastodon on a known host', 'https://mastodon.social/@gemeinde', 'mastodon', 'gemeinde@mastodon.social'],
        ['Mastodon on another host is a website', 'https://chaos.social/@gemeinde', 'website', 'chaos.social/@gemeinde'],
        ['email with mailto:', 'mailto:info@gemeinde.de', 'email', 'info@gemeinde.de'],
        ['email with mailto: and subject', 'mailto:info@gemeinde.de?subject=Hallo', 'email', 'info@gemeinde.de'],
        ['bare email', 'info@gemeinde.de', 'email', 'info@gemeinde.de'],
        ['website with host only', 'https://www.gemeinde.de/', 'website', 'gemeinde.de'],
        ['website with path, query and fragment', 'gemeinde.de/gottesdienst/?a=1#x', 'website', 'gemeinde.de/gottesdienst'],
        ['LinkedIn has no mark and gets the globe', 'linkedin.com/company/gemeinde', 'website', 'linkedin.com/company/gemeinde'],
        ['nonsense', 'hallo welt', 'website', 'hallo welt'],
        ['a word without a dot', 'Unsinn', 'website', 'Unsinn'],
        ['another scheme', 'tel:+4917012345', 'website', 'tel:+4917012345'],
        ['empty', '  ', 'website', ''],
    ];

    it.each(cases)('%s: %s', (_title, input, platform, name) => {
        expect(socialProfile(input)).toEqual({ platform, name });
    });

    it('lets a label win over the name read from the address', () => {
        expect(socialName({ url: 'instagram.com/wirsindcgks' })).toBe('wirsindcgks');
        expect(socialName({ url: 'instagram.com/wirsindcgks', label: '  ' })).toBe('wirsindcgks');
        expect(socialName({ url: 'instagram.com/wirsindcgks', label: '@wirsindcgks' })).toBe('@wirsindcgks');
    });
});
