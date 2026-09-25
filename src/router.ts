import { createRouter, createWebHistory } from 'vue-router';
import DesignerHome from './views/DesignerHome.vue';
import ScreenEditor from './views/ScreenEditor.vue';
import PlayerView from './views/PlayerView.vue';
import NotFoundView from './views/NotFoundView.vue';
import SetupView from './views/SetupView.vue';
import MediaView from './views/MediaView.vue';

// No lazy routes: a kiosk tab open for weeks would request a chunk that a
// later extension update has deleted (Plan.md, Risiko 7).
export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', name: 'designer', component: DesignerHome },
        { path: '/screens/:slug', name: 'editor', component: ScreenEditor },
        { path: '/player', name: 'player', component: PlayerView },
        { path: '/mediathek', name: 'media', component: MediaView },
        { path: '/einstellungen', name: 'setup', component: SetupView },
        // The first name of the page (until 2026-09-24); links to it keep working.
        { path: '/einrichtung', redirect: (to) => ({ name: 'setup', hash: to.hash }) },
        // On a foyer TV an empty page is indistinguishable from a crash (G7).
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
    ],
});
