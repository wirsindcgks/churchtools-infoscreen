/**
 * Colour name → hex (Tailwind 500): the API names colours, not values
 * (a group's `{ key: "teal" }`, G37; a calendar's `sky`); the keys are those of its colour enum.
 * Not in the table – `accent`, `basic` and anything unknown – falls back to the
 * theme's accent colour, the same way DateTile and CalendarBadge already treat
 * a missing colour.
 */
export const GROUP_COLORS: Record<string, string> = {
    amber: '#f59e0b',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    emerald: '#10b981',
    fuchsia: '#d946ef',
    green: '#22c55e',
    indigo: '#6366f1',
    lime: '#84cc16',
    orange: '#f97316',
    pink: '#ec4899',
    purple: '#a855f7',
    red: '#ef4444',
    rose: '#f43f5e',
    sky: '#0ea5e9',
    teal: '#14b8a6',
    violet: '#8b5cf6',
    yellow: '#eab308',
    constructive: '#22c55e',
    success: '#22c55e',
    critical: '#ef4444',
    destructive: '#ef4444',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    magic: '#a855f7',
};
