/**
 * A demo screen for development while Custom Modules are unavailable (T1).
 * Only its layout is invented: appointment blocks read real calendars of the
 * instance through the dev proxy.
 */
import { SCHEMA_VERSION, type Block, type ScreenBundle, type TextStyle } from '../model/schema';
import { DEFAULT_FONT } from '../player/fonts';
import type { ScreenRepository } from '../store/screen-repository';

const schema = { ...SCHEMA_VERSION };

const white = (fontSize: number, extra: Partial<TextStyle> = {}): TextStyle => ({
    fontFamily: DEFAULT_FONT,
    fontSize,
    fontWeight: 400,
    color: '#ffffff',
    align: 'left',
    ...extra,
});

const header: Block = {
    id: 'header',
    type: 'church-header',
    x: 80,
    y: 50,
    width: 1300,
    height: 90,
    showLogo: false,
    showName: true,
    style: white(48, { fontWeight: 600 }),
};

const clock: Block = {
    id: 'clock',
    type: 'clock',
    x: 1440,
    y: 50,
    width: 400,
    height: 90,
    format: 'time',
    style: white(64, { fontWeight: 600, align: 'right' }),
};

const rule: Block = {
    id: 'rule',
    type: 'shape',
    x: 80,
    y: 160,
    width: 1760,
    height: 4,
    fill: { kind: 'solid', color: 'rgba(255,255,255,0.5)' },
    cornerRadius: 0,
};

export const DEMO_BUNDLE: ScreenBundle = {
    screen: {
        schema,
        kind: 'screen',
        id: 'demo-screen',
        slug: 'demo',
        name: 'Demo – Foyer',
        stage: { width: 1920, height: 1080 },
        overscanPercent: 0,
        defaultPlaylistId: 'demo-playlist',
        schedule: [],
        revision: 0,
    },
    playlists: [
        {
            schema,
            kind: 'playlist',
            id: 'demo-playlist',
            name: 'Wochenüberblick',
            slideIds: ['demo-welcome', 'demo-next', 'demo-list'],
            stage: { width: 1920, height: 1080 },
            revision: 1,
        },
    ],
    slides: [
        {
            schema,
            kind: 'slide',
            id: 'demo-welcome',
            name: 'Willkommen',
            durationSeconds: 8,
            enabled: true,
            background: {
                kind: 'linear-gradient',
                angle: 135,
                stops: [
                    { color: '#1d3557', at: 0 },
                    { color: '#457b9d', at: 1 },
                ],
            },
            blocks: [
                header,
                clock,
                rule,
                {
                    id: 'welcome',
                    type: 'text',
                    x: 80,
                    y: 380,
                    width: 1760,
                    height: 200,
                    text: 'Herzlich willkommen!',
                    style: white(140, { fontWeight: 700, align: 'center' }),
                },
                {
                    id: 'welcome-sub',
                    type: 'text',
                    x: 80,
                    y: 600,
                    width: 1760,
                    height: 100,
                    text: 'Schön, dass du da bist.',
                    style: white(64, { align: 'center' }),
                },
            ],
        },
        {
            schema,
            kind: 'slide',
            id: 'demo-next',
            name: 'Nächster Gottesdienst',
            durationSeconds: 10,
            enabled: true,
            background: { kind: 'solid', color: '#111111' },
            blocks: [
                header,
                clock,
                rule,
                {
                    id: 'next',
                    type: 'next-appointment',
                    x: 80,
                    y: 220,
                    width: 1760,
                    height: 780,
                    calendarIds: [2],
                    showImage: true,
                    style: white(72, { fontWeight: 600 }),
                },
            ],
        },
        {
            schema,
            kind: 'slide',
            id: 'demo-list',
            name: 'Termine',
            durationSeconds: 12,
            enabled: true,
            background: { kind: 'solid', color: '#2a2a2a' },
            blocks: [
                header,
                clock,
                rule,
                {
                    id: 'list-title',
                    type: 'text',
                    x: 80,
                    y: 200,
                    width: 1760,
                    height: 90,
                    text: 'Die nächsten Termine',
                    style: white(64, { fontWeight: 700 }),
                },
                {
                    id: 'list',
                    type: 'appointment-list',
                    x: 80,
                    y: 320,
                    width: 1760,
                    height: 700,
                    calendarIds: [1, 2, 3],
                    horizonDays: 60,
                    limit: 7,
                    style: white(48),
                },
            ],
        },
    ],
};

export async function seedDemo(repository: ScreenRepository): Promise<void> {
    await repository.saveScreen(DEMO_BUNDLE, { expectedRevision: null, updatedBy: 'Demo' });
}
