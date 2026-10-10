import { t } from '../i18n/designer';
import type { IconName } from './Icon.vue';

/** The format filters of the start page (Plan.md, Nächste Schritte 10). */
export type FormatFilter = 'all' | 'landscape' | 'portrait';

export const FILTERS: { key: FormatFilter; label: string; icon: IconName }[] = [
    { key: 'all', label: t.common.filters.all, icon: 'grid' },
    { key: 'landscape', label: t.common.filters.landscape, icon: 'landscape' },
    { key: 'portrait', label: t.common.filters.portrait, icon: 'portrait' },
];

/** The filter a start page address asks for (`?format=`); anything unknown shows all. */
export function formatFilter(value: unknown): FormatFilter {
    return value === 'landscape' || value === 'portrait' ? value : 'all';
}
