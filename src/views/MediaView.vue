<script setup lang="ts">
/**
 * The media library as a section of its own (Plan.md, Nächste Schritte 16):
 * all pictures, upload and delete – without opening a screen first. Uploads
 * from here go to the wiki page "Mediathek"; the editor puts its uploads on
 * the page of its screen. The wiki category stays the storage behind it (G8).
 */
import { onMounted, ref } from 'vue';
import Icon from '../designer/Icon.vue';
import MediaLibraryPanel from '../designer/MediaLibraryPanel.vue';
import ModulePage from '../designer/ModulePage.vue';
import { canManagePermissions } from '../setup/load';

/** The wiki page for pictures that belong to no screen in particular. */
const GENERAL = { slug: 'mediathek', name: 'Mediathek' };

const admin = ref(false);
onMounted(async () => {
    admin.value = await canManagePermissions().catch(() => false);
});
</script>

<template>
    <ModulePage current="media" :admin="admin">
        <div class="page-title">
            <span class="title-icon"><Icon name="image" :size="20" /></span>
            <h1 data-testid="media-heading">Mediathek</h1>
        </div>
        <p class="lead muted">
            Bilder für alle Screens. Sie liegen im Wiki-Bereich „Infoscreen" von ChurchTools – dort bitte nichts löschen,
            sonst fehlt das Bild auf den Fernsehern. Wer ein Bild kennt, kann es ohne Anmeldung abrufen; nichts
            Vertrauliches hochladen.
        </p>
        <MediaLibraryPanel class="d-card panel" :target="GENERAL" />
    </ModulePage>
</template>

<style scoped>
.page-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
.page-title h1 {
    margin: 0;
    font-size: 1.8em;
}
.title-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.lead {
    max-width: 75ch;
    margin: 0;
}
.muted {
    color: var(--d-text-muted);
}
.panel {
    border-width: 1px;
}
@media (max-width: 48rem) {
    .page-title h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
}
</style>
