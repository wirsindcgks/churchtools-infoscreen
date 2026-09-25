<script setup lang="ts">
/**
 * The bar below the ChurchTools navigation, built after the one of "Gruppen"
 * ("Gruppen | Einstellungen" left, "+ Gruppe erstellen" right): the same
 * place for the same things on every page of the module. With `current` it
 * shows the two sections – "Einstellungen" only to administrators, whose job
 * it is (role concept, Plan.md F); the editor puts its own title in the
 * default slot.
 */
import Icon from './Icon.vue';

withDefaults(defineProps<{ current?: 'screens' | 'schedules' | 'playlists' | 'media' | 'design' | 'about' | 'setup'; showSetup?: boolean }>(), { current: undefined, showSetup: true });
</script>

<template>
    <header class="d-appbar">
        <nav v-if="current" class="sections" aria-label="Infoscreen Designer">
            <Icon name="tv" class="module-icon" :size="20" />
            <RouterLink
                :to="{ name: 'designer' }"
                :class="{ active: current === 'screens' }"
                :aria-current="current === 'screens' ? 'page' : undefined"
                data-testid="nav-screens"
            >
                Screens
            </RouterLink>
            <RouterLink
                v-if="showSetup"
                :to="{ name: 'setup' }"
                :class="{ active: current === 'setup' }"
                :aria-current="current === 'setup' ? 'page' : undefined"
                data-testid="open-setup"
            >
                Einstellungen
            </RouterLink>
        </nav>
        <div v-else class="start"><slot /></div>
        <div class="end"><slot name="actions" /></div>
    </header>
</template>

<style scoped>
.d-appbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    min-height: 56px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--d-divider);
    background: var(--d-surface);
}
.sections,
.start,
.end {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.start {
    flex: 1;
    overflow: hidden;
}
.end {
    flex-wrap: wrap;
    justify-content: flex-end;
}
.module-icon {
    color: var(--d-text-muted);
}
.sections a {
    padding: 4px 10px;
    color: var(--d-text-muted);
    font-size: 1.15em;
    text-decoration: none;
    white-space: nowrap;
}
.sections a + a {
    border-left: 1px solid var(--d-divider);
}
.sections a:hover {
    color: var(--d-text);
}
.sections a.active {
    color: var(--d-text);
    font-weight: 700;
}
@media (max-width: 40rem) {
    .d-appbar {
        padding: 6px 12px;
    }
    /* Title and actions each get a line of their own instead of overlapping. */
    .start {
        flex-basis: 100%;
    }
    .end {
        flex: 1;
    }
    .module-icon {
        display: none;
    }
    .sections a {
        padding: 4px 8px;
        font-size: 1em;
    }
}
</style>
