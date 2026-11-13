import { t } from '../../i18n/designer';
import type { Block, SlideLayout, ThemeDoc } from '../../model/schema';
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
        { value: 'visitor', label: t.inspector.layoutVisitorTile, pictogram: 'list-visitor' },
    ];
}

export function nextAppointmentTiles(block: Extract<Block, { type: 'next-appointment' }>, theme: ThemeDoc): TileOption[] {
    return [
        { value: '', label: t.inspector.layoutDesign, pictogram: nextLayout({ ...block, layout: undefined }, theme) === 'card' ? 'next-card' : 'next-classic' },
        { value: 'classic', label: t.inspector.layoutClassic, pictogram: 'next-classic' },
        { value: 'card', label: t.inspector.layoutCard, pictogram: 'next-card' },
    ];
}

/** The looks of the block "Ablauf" (Plan.md 118). */
export const AGENDA_TILES: TileOption[] = [
    { value: 'churchtools', label: t.inspector.agendaLayoutChurchtools, pictogram: 'agenda-churchtools' },
    { value: 'card', label: t.inspector.agendaLayoutCard, pictogram: 'agenda-card' },
];

export const POSTS_TILES: TileOption[] = [
    { value: 'card', label: t.inspector.postsLayoutCard, pictogram: 'card-image' },
    { value: 'list', label: t.inspector.layoutList, pictogram: 'list-thumbs' },
];

export const GROUPS_TILES: TileOption[] = [
    { value: 'card', label: t.inspector.groupsLayoutCard, pictogram: 'card-image' },
    { value: 'list', label: t.inspector.layoutList, pictogram: 'list-thumbs' },
];

export const PEOPLE_TILES: TileOption[] = [
    { value: 'card', label: t.inspector.peopleLayoutCard, pictogram: 'card-image' },
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

/**
 * The tiles for the division of a slide (Plan.md 87 B): a portrait slide divides into rows, a landscape one into columns. The
 * quarters (schema 1.64) are `split` plus `share: 'quarter'`; a tile carries both as `split:quarter` (`splitValue`, `readSplit`).
 */
export function splitTiles(portrait: boolean): TileOption[] {
    return portrait
        ? [
              { value: 'none', label: t.inspector.layoutNone, pictogram: 'split-none' },
              { value: 'halves', label: t.inspector.layoutHalves, pictogram: 'split-halves-rows' },
              { value: 'wide-narrow', label: t.inspector.layoutWideNarrowRows, pictogram: 'split-wide-narrow-rows' },
              { value: 'narrow-wide', label: t.inspector.layoutNarrowWideRows, pictogram: 'split-narrow-wide-rows' },
              { value: 'wide-narrow:quarter', label: t.inspector.layoutWideNarrowQuarterRows, pictogram: 'split-wide-narrow-quarter-rows' },
              { value: 'narrow-wide:quarter', label: t.inspector.layoutNarrowWideQuarterRows, pictogram: 'split-narrow-wide-quarter-rows' },
          ]
        : [
              { value: 'none', label: t.inspector.layoutNone, pictogram: 'split-none' },
              { value: 'halves', label: t.inspector.layoutHalves, pictogram: 'split-halves' },
              { value: 'wide-narrow', label: t.inspector.layoutWideNarrowColumns, pictogram: 'split-wide-narrow' },
              { value: 'narrow-wide', label: t.inspector.layoutNarrowWideColumns, pictogram: 'split-narrow-wide' },
              { value: 'wide-narrow:quarter', label: t.inspector.layoutWideNarrowQuarterColumns, pictogram: 'split-wide-narrow-quarter' },
              { value: 'narrow-wide:quarter', label: t.inspector.layoutNarrowWideQuarterColumns, pictogram: 'split-narrow-wide-quarter' },
          ];
}

/** The tile of a division: `split`, with `:quarter` for three quarters and one quarter. */
export function splitValue(layout: Pick<SlideLayout, 'split' | 'share'>): string {
    return layout.share === 'quarter' && (layout.split === 'wide-narrow' || layout.split === 'narrow-wide') ? `${layout.split}:quarter` : layout.split;
}

/** The division a tile stands for. */
export function readSplit(value: string): Pick<SlideLayout, 'split' | 'share'> {
    const [split, share] = value.split(':') as [SlideLayout['split'], string | undefined];
    return { split, share: share === 'quarter' ? 'quarter' : undefined };
}
