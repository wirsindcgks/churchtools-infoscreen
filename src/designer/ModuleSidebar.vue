<script setup lang="ts">
/**
 * The left column of the module, as in "Gruppen" of ChurchTools: the same on
 * the start page and in the settings. Filters are links with the format in
 * the query, so they work from any page and survive going back. Below 48rem
 * this used to turn into one row to swipe – seven of its ten entries sat
 * unseen to the right (Plan.md 44, M1). Now a button names the current page
 * and opens a panel with the same list as on a desktop, stacked vertically;
 * the format filters stay a swipeable row, but only on "Screens", where they
 * belong. "Einstellungen" (administrators only) moved into the header bar
 * (Plan.md 36); this column no longer needs to know who is one.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FILTERS, formatFilter, type FormatFilter } from './format-filter';
import { unseenRelease } from '../about/seen';
import Icon, { type IconName } from './Icon.vue';

defineProps<{ counts?: Record<FormatFilter, number> }>();

const route = useRoute();
const active = computed(() => (route.name === 'designer' ? formatFilter(route.query.format) : null));
/** Below 48rem the format filters only make sense on "Screens" itself. */
const onScreens = computed(() => route.name === 'designer');

interface PageLink {
    name: string;
    label: string;
    icon: IconName;
    testid: string;
    /** "Screens" stands for what the filters do at a desktop – only shown below 48rem. */
    phoneOnly?: boolean;
}

const PAGES: PageLink[] = [
    { name: 'designer', label: 'Screens', icon: 'tv', testid: 'sidebar-screens', phoneOnly: true },
    { name: 'schedules', label: 'Zeitpläne', icon: 'calendar', testid: 'sidebar-schedules' },
    { name: 'notices', label: 'Hinweise', icon: 'megaphone', testid: 'sidebar-notices' },
    { name: 'playlists', label: 'Playlists', icon: 'list', testid: 'sidebar-playlists' },
    { name: 'media', label: 'Mediathek', icon: 'image', testid: 'sidebar-media' },
    { name: 'design', label: 'Design', icon: 'palette', testid: 'sidebar-design' },
];
const ABOUT: PageLink = { name: 'about', label: 'Über & Neuigkeiten', icon: 'info', testid: 'sidebar-about' };

/** What the phone's menu button shows: icon and name of the page open right now. */
const SETUP: Pick<PageLink, 'label' | 'icon'> = { label: 'Einstellungen', icon: 'settings' };
const currentPage = computed(() => {
    const name = String(route.name ?? '');
    return [...PAGES, ABOUT].find((p) => p.name === name) ?? (name.startsWith('setup') ? SETUP : { label: 'Seiten', icon: 'list' as IconName });
});

const menuOpen = ref(false);
const nav = ref<HTMLElement | null>(null);
const menuButton = ref<HTMLButtonElement | null>(null);

function toggleMenu(): void {
    menuOpen.value = !menuOpen.value;
}
function closeOnOutside(event: Event): void {
    if (!nav.value?.contains(event.target as Node)) menuOpen.value = false;
}
/**
 * Escape closes the panel, focus goes back to the button. A document
 * listener, not `@keydown.esc` on the `nav`: WebKit does not focus a button
 * on click (real Safari behaviour, not a test quirk), so a key handler tied
 * to focus inside the `nav` would never fire there.
 */
function closeOnEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    menuOpen.value = false;
    menuButton.value?.focus();
}
watch(menuOpen, (open) => {
    if (open) {
        document.addEventListener('pointerdown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
    } else {
        document.removeEventListener('pointerdown', closeOnOutside);
        document.removeEventListener('keydown', closeOnEscape);
    }
});
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', closeOnOutside);
    document.removeEventListener('keydown', closeOnEscape);
});
// A new page closes the panel by itself – also on the back button.
watch(
    () => route.fullPath,
    () => (menuOpen.value = false),
);
</script>

<template>
    <nav ref="nav" class="module-sidebar" aria-label="Infoscreen Designer">
        <button
            ref="menuButton"
            type="button"
            class="page-menu"
            :aria-expanded="menuOpen"
            aria-controls="module-pages"
            data-testid="page-menu"
            @click="toggleMenu"
        >
            <span class="nav-icon"><Icon :name="currentPage.icon" :size="16" /></span>
            <span class="page-menu-label">{{ currentPage.label }}</span>
            <span v-if="unseenRelease" class="new" aria-hidden="true" data-testid="page-menu-new" />
            <Icon name="chevron-down" :size="16" :class="['page-menu-chevron', { open: menuOpen }]" />
        </button>
        <ul class="filters" :class="{ 'on-screens': onScreens }">
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
        <div id="module-pages" :class="{ open: menuOpen }">
            <ul class="library">
                <li v-for="p in PAGES" :key="p.name" :class="{ 'phone-only': p.phoneOnly }">
                    <RouterLink
                        :to="{ name: p.name }"
                        :class="{ active: route.name === p.name }"
                        :aria-current="route.name === p.name ? 'page' : undefined"
                        :data-testid="p.testid"
                    >
                        <span class="nav-icon"><Icon :name="p.icon" :size="16" /></span>
                        {{ p.label }}
                    </RouterLink>
                </li>
            </ul>
            <ul class="library about">
                <li>
                    <RouterLink
                        :to="{ name: ABOUT.name }"
                        :class="{ active: route.name === 'about' }"
                        :aria-current="route.name === 'about' ? 'page' : undefined"
                        :data-testid="ABOUT.testid"
                    >
                        <span class="nav-icon"><Icon :name="ABOUT.icon" :size="16" /></span>
                        {{ ABOUT.label }}
                        <span
                            v-if="unseenRelease"
                            class="new"
                            role="img"
                            aria-label="Neu"
                            title="Neue Version – noch nicht angesehen"
                            data-testid="about-new"
                        />
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
.page-menu {
    display: none;
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
.new {
    flex: none;
    width: 8px;
    height: 8px;
    margin-left: auto;
    border-radius: 50%;
    background: var(--d-accent);
}
.count {
    margin-left: auto;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.phone-only {
    display: none;
}

@media (max-width: 48rem) {
    .module-sidebar {
        position: relative;
        top: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 12px 0;
    }
    .page-menu {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        height: 44px;
        padding: 0 10px;
        border: 1px solid var(--d-divider);
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        color: var(--d-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .page-menu:hover {
        border-color: var(--d-interactive);
    }
    .page-menu-label {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .page-menu-chevron {
        flex: none;
        transition: transform 0.15s;
    }
    .page-menu-chevron.open {
        transform: rotate(180deg);
    }
    .filters {
        display: none;
    }
    .filters.on-screens {
        display: flex;
        gap: 6px;
        overflow-x: auto;
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
    /* Closed: nothing; open: a panel right below the button, like a menu (below the 1100 of dialogs). */
    #module-pages {
        display: none;
    }
    #module-pages.open {
        display: block;
        position: absolute;
        top: 64px;
        left: 12px;
        right: 12px;
        z-index: 1000;
        padding: 6px;
        border: 1px solid var(--d-divider);
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow);
    }
    #module-pages a {
        min-height: 44px;
    }
    /* In the panel nothing stands above the first list that a line would divide it from. */
    #module-pages ul.library:first-child {
        margin-top: 0;
        padding-top: 0;
        border-top: 0;
    }
    .phone-only {
        display: block;
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
