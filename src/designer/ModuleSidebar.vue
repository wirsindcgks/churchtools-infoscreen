<script setup lang="ts">
/**
 * The left column of the module: a light card with a soft shadow on the workspace, one entry per area with
 * its symbol in a small field (Plan.md 79, B3). It reaches down to the lower edge of the window and stays there while
 * the page scrolls; "Über & Neuigkeiten" and "Einstellungen" (the latter for administrators only, role concept,
 * Plan.md F) stand at its end after a rule. The format filters left it – they stand beside the search of the pages
 * that filter. Below 48rem this used to turn into one row to swipe – seven of its ten entries sat
 * unseen to the right (Plan.md 44, M1). Now a button names the current page and opens a panel with the same
 * list as on a desktop, stacked vertically.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { t } from '../i18n/designer';
import { administrator, isAdministrator } from './administrator';
import { ensureSectionCounts, sectionCounts, type Section } from './section-counts';
import { unseenRelease } from '../about/seen';
import Icon, { type IconName } from './Icon.vue';

const route = useRoute();
onMounted(() => {
    void ensureSectionCounts();
    void isAdministrator();
});
const admin = computed(() => administrator.value === true);

interface PageLink {
    name: string;
    label: string;
    icon: IconName;
    testid: string;
    /** The area whose number stands behind the entry (`section-counts.ts`); none for design, about and settings. */
    count?: Section;
}

const PAGES: PageLink[] = [
    { name: 'designer', label: t.common.screens, icon: 'tv', testid: 'sidebar-screens', count: 'screens' },
    { name: 'schedules', label: t.schedules.title, icon: 'calendar', testid: 'sidebar-schedules', count: 'schedules' },
    { name: 'notices', label: t.notices.title, icon: 'megaphone', testid: 'sidebar-notices', count: 'notices' },
    { name: 'playlists', label: t.common.playlists, icon: 'list', testid: 'sidebar-playlists', count: 'playlists' },
    { name: 'media', label: t.media.title, icon: 'image', testid: 'sidebar-media', count: 'media' },
    { name: 'design', label: t.design.title, icon: 'palette', testid: 'sidebar-design' },
];
const ABOUT: PageLink = { name: 'about', label: t.about.title, icon: 'info', testid: 'sidebar-about' };
/** The four settings routes are one entry. */
const SETUP: PageLink = { name: 'setup', label: t.common.settings, icon: 'settings', testid: 'sidebar-setup' };
const isSetup = computed(() => String(route.name ?? '').startsWith('setup'));

/** What the phone's menu button shows: icon and name of the page open right now. */
const currentPage = computed(() => {
    const name = String(route.name ?? '');
    return [...PAGES, ABOUT].find((p) => p.name === name) ?? (isSetup.value ? SETUP : { label: t.sidebar.pages, icon: 'list' as IconName });
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
    <nav ref="nav" class="module-sidebar" :aria-label="t.common.moduleName">
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
        <div id="module-pages" :class="{ open: menuOpen }">
            <ul class="library">
                <li v-for="p in PAGES" :key="p.name">
                    <RouterLink
                        :to="{ name: p.name }"
                        :class="{ active: route.name === p.name }"
                        :aria-current="route.name === p.name ? 'page' : undefined"
                        :data-testid="p.testid"
                    >
                        <span class="nav-icon"><Icon :name="p.icon" :size="16" /></span>
                        {{ p.label }}
                        <span v-if="p.count && sectionCounts[p.count] !== undefined" class="count" :data-testid="`${p.testid}-count`">{{ sectionCounts[p.count] }}</span>
                    </RouterLink>
                </li>
            </ul>
            <ul class="library last" data-testid="sidebar-last">
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
                            :aria-label="t.sidebar.new"
                            :title="t.sidebar.newTitle"
                            data-testid="about-new"
                        />
                    </RouterLink>
                </li>
                <li v-if="admin">
                    <RouterLink
                        :to="{ name: SETUP.name }"
                        :class="{ active: isSetup }"
                        :aria-current="isSetup ? 'page' : undefined"
                        :data-testid="SETUP.testid"
                    >
                        <span class="nav-icon"><Icon :name="SETUP.icon" :size="16" /></span>
                        {{ SETUP.label }}
                    </RouterLink>
                </li>
            </ul>
        </div>
    </nav>
</template>

<style scoped>
.module-sidebar {
    position: sticky;
    top: calc(var(--page-top, 0px) + var(--d-space-4));
    box-sizing: border-box;
    /* Below the host's navigation, which stays put, and down to the window's lower edge (`--page-top`, ModulePage). */
    height: calc(100vh - var(--page-top, 0px) - 2 * var(--d-space-4));
    padding: var(--d-space-3);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow-card);
}
.page-menu {
    display: none;
}
ul.library {
    margin-top: var(--d-space-2);
    padding-top: var(--d-space-2);
    border-top: 1px solid var(--d-divider);
}
ul.library:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
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
    gap: var(--d-space-3);
    width: 100%;
    min-height: 44px;
    padding: 0 var(--d-space-3);
    border-radius: var(--d-radius-lg);
    color: var(--d-text);
    font-weight: 400;
    text-decoration: none;
    transition: background-color var(--d-transition);
}
a:hover {
    background: var(--d-panel);
}
a.active {
    font-weight: var(--d-weight-heading);
    background: color-mix(in oklab, var(--d-accent-pale) 45%, var(--d-surface));
    color: var(--d-accent-strong);
}
.nav-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: var(--d-radius);
    background: var(--d-workspace);
    color: var(--d-text-muted);
}
a.active .nav-icon {
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
    color: var(--d-text-faint);
    font-weight: 400;
}

@media (min-width: 48.0625rem) {
    .module-sidebar {
        display: flex;
        flex-direction: column;
    }
    #module-pages {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: var(--d-space-2);
        min-height: 0;
        overflow-y: auto;
    }
    ul.library.last {
        margin-top: auto;
    }
}

@media (max-width: 48rem) {
    .module-sidebar {
        position: relative;
        top: auto;
        height: auto;
        padding: 0;
        background: none;
        box-shadow: none;
    }
    .page-menu {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--d-space-3);
        width: 100%;
        height: 44px;
        padding: 0 var(--d-space-3);
        border: 0;
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow-card);
        color: var(--d-text);
        font: inherit;
        font-weight: var(--d-weight-heading);
        text-align: left;
        cursor: pointer;
    }
    .page-menu-label {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .page-menu-chevron {
        flex: none;
        transition: transform var(--d-transition);
    }
    .page-menu-chevron.open {
        transform: rotate(180deg);
    }
    /* Closed: nothing; open: a panel right below the button, like a menu (below the 1100 of dialogs). */
    #module-pages {
        display: none;
    }
    #module-pages.open {
        display: block;
        position: absolute;
        top: calc(44px + var(--d-space-2));
        left: 0;
        right: 0;
        z-index: 1000;
        padding: var(--d-space-2);
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow);
    }
}
</style>
