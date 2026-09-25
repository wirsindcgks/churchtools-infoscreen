<script setup lang="ts">
/**
 * The left column of the module, as in "Gruppen" of ChurchTools: the same on
 * the start page and in the settings. Filters are links with the format in
 * the query, so they work from any page and survive going back. The
 * administration part is only for administrators (role concept, Plan.md F).
 * Below 48rem filters and sections become one row to swipe, on every page –
 * otherwise a phone could not get from "Playlists" to "Zeitpläne"; the
 * administration links stay in the bar above.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { FILTERS, formatFilter, type FormatFilter } from './format-filter';
import Icon from './Icon.vue';

defineProps<{ counts?: Record<FormatFilter, number>; admin: boolean }>();

const route = useRoute();
const active = computed(() => (route.name === 'designer' ? formatFilter(route.query.format) : null));
</script>

<template>
    <nav class="module-sidebar" aria-label="Infoscreen Designer">
        <ul class="filters">
            <li v-for="f in FILTERS" :key="f.key">
                <RouterLink
                    :to="{ name: 'designer', query: f.key === 'all' ? {} : { format: f.key } }"
                    :class="{ active: active === f.key }"
                    :aria-current="active === f.key ? 'page' : undefined"
                    :data-testid="`filter-${f.key}`"
                >
                    <span class="nav-icon"><Icon :name="f.icon" :size="16" /></span>
                    {{ f.label }}
                    <span v-if="counts" class="count">{{ counts[f.key] }}</span>
                </RouterLink>
            </li>
        </ul>
        <ul class="library">
            <li>
                <RouterLink
                    :to="{ name: 'schedules' }"
                    :class="{ active: route.name === 'schedules' }"
                    :aria-current="route.name === 'schedules' ? 'page' : undefined"
                    data-testid="sidebar-schedules"
                >
                    <span class="nav-icon"><Icon name="calendar" :size="16" /></span>
                    Zeitpläne
                </RouterLink>
            </li>
            <li>
                <RouterLink
                    :to="{ name: 'playlists' }"
                    :class="{ active: route.name === 'playlists' }"
                    :aria-current="route.name === 'playlists' ? 'page' : undefined"
                    data-testid="sidebar-playlists"
                >
                    <span class="nav-icon"><Icon name="list" :size="16" /></span>
                    Playlists
                </RouterLink>
            </li>
            <li>
                <RouterLink
                    :to="{ name: 'media' }"
                    :class="{ active: route.name === 'media' }"
                    :aria-current="route.name === 'media' ? 'page' : undefined"
                    data-testid="sidebar-media"
                >
                    <span class="nav-icon"><Icon name="image" :size="16" /></span>
                    Mediathek
                </RouterLink>
            </li>
            <li>
                <RouterLink
                    :to="{ name: 'design' }"
                    :class="{ active: route.name === 'design' }"
                    :aria-current="route.name === 'design' ? 'page' : undefined"
                    data-testid="sidebar-design"
                >
                    <span class="nav-icon"><Icon name="palette" :size="16" /></span>
                    Design
                </RouterLink>
            </li>
        </ul>
        <div v-if="admin" class="admin">
            <h2>Verwaltung</h2>
            <ul>
                <li>
                    <RouterLink
                        :to="{ name: 'setup' }"
                        :class="{ active: route.name === 'setup' }"
                        data-testid="sidebar-settings"
                    >
                        <span class="nav-icon"><Icon name="settings" :size="16" /></span>
                        Einstellungen
                    </RouterLink>
                </li>
            </ul>
        </div>
    </nav>
</template>

<style scoped>
.module-sidebar {
    position: sticky;
    top: 0;
    padding: 16px 10px;
}
ul.library {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--d-divider);
}
ul {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}
h2 {
    margin: 20px 10px 6px;
    font-size: 1em;
}
a {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 36px;
    padding: 6px 10px;
    border-radius: var(--d-radius-lg);
    color: var(--d-text);
    text-decoration: none;
}
a:hover {
    background: var(--d-surface);
}
a.active {
    background: var(--d-accent-pale);
}
.nav-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: var(--d-radius);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.count {
    margin-left: auto;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}

@media (max-width: 48rem) {
    .module-sidebar {
        position: static;
        overflow-x: auto;
        padding: 10px 12px 0;
    }
    .filters {
        display: flex;
        gap: 6px;
    }
    .filters a {
        width: auto;
        border: 1px solid var(--d-divider);
        border-radius: 999px;
        background: var(--d-surface);
        white-space: nowrap;
    }
    .filters a.active {
        border-color: var(--d-accent);
        background: var(--d-accent-pale);
    }
    .admin {
        display: none;
    }
    /* Phone: schedules, playlists and media library join the row of filters. */
    .module-sidebar {
        display: flex;
        gap: 6px;
    }
    ul.library {
        display: flex;
        gap: 6px;
        margin: 0;
        padding: 0;
        border: 0;
    }
    ul.library a {
        width: auto;
        border: 1px solid var(--d-divider);
        border-radius: 999px;
        background: var(--d-surface);
        white-space: nowrap;
    }
    ul.library a.active {
        border-color: var(--d-accent);
        background: var(--d-accent-pale);
    }
    .nav-icon {
        width: 20px;
        height: 20px;
        background: none;
    }
    .count {
        margin-left: 2px;
    }
}
</style>
