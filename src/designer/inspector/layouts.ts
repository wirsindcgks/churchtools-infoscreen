import { t } from '../../i18n/designer';
import type { Block, ThemeDoc } from '../../model/schema';
import { listLayout, nextLayout } from '../../player/theme';
import type { TileOption } from './fields/TileField.vue';

/**
 * The picture tiles of the blocks with a choice of look (Plan.md 79, B2). The tile "Wie im Design" (value '') shows the
 * picture of the layout the theme takes right now, so a designer sees what "follows the theme" means.
 */
export function appointmentListTiles(block: Extract<Block, { type: 'appointment-list' }>, theme: ThemeDoc): TileOption[] {
    return [
        { value: '', label: t.inspector.layoutDesign, pictogram: listLayout({ ...block, layout: undefined }, theme) === 'cards' ? 'list-cards' : 'list-rows' },
        { value: 'rows', label: t.inspector.layoutRows, pictogram: 'list-rows' },
        { value: 'cards', label: t.inspector.layoutCards, pictogram: 'list-cards' },
    ];
}

export function nextAppointmentTiles(block: Extract<Block, { type: 'next-appointment' }>, theme: ThemeDoc): TileOption[] {
    return [
        { value: '', label: t.inspector.layoutDesign, pictogram: nextLayout({ ...block, layout: undefined }, theme) === 'card' ? 'next-card' : 'next-classic' },
        { value: 'classic', label: t.inspector.layoutClassic, pictogram: 'next-classic' },
        { value: 'card', label: t.inspector.layoutCard, pictogram: 'next-card' },
    ];
}

export const POSTS_TILES: TileOption[] = [
    { value: 'card', label: t.inspector.postsLayoutCard, pictogram: 'card-image' },
    { value: 'list', label: t.inspector.layoutList, pictogram: 'list-thumbs' },
];

export const GROUPS_TILES: TileOption[] = [
    { value: 'card', label: t.inspector.groupsLayoutCard, pictogram: 'card-image' },
    { value: 'list', label: t.inspector.layoutList, pictogram: 'list-thumbs' },
];

export const ROOMS_TILES: TileOption[] = [
    { value: 'overview', label: t.inspector.roomsOverview, pictogram: 'rooms-overview' },
    { value: 'door', label: t.inspector.roomsDoor, pictogram: 'rooms-door' },
];

export const TRANSITION_TILES: TileOption[] = [
    { value: 'fade', label: t.inspector.transitions.fade, pictogram: 'transition-fade' },
    { value: 'slide', label: t.inspector.transitions.slide, pictogram: 'transition-slide' },
    { value: 'wipe', label: t.inspector.transitions.wipe, pictogram: 'transition-wipe' },
    { value: 'none', label: t.inspector.transitions.none, pictogram: 'transition-none' },
];

export const MOTION_TILES: TileOption[] = [
    { value: 'none', label: t.inspector.motions.none, pictogram: 'motion-none' },
    { value: 'in', label: t.inspector.motions.in, pictogram: 'motion-in' },
    { value: 'out', label: t.inspector.motions.out, pictogram: 'motion-out' },
    { value: 'alternate', label: t.inspector.motions.alternate, pictogram: 'motion-alternate' },
];
