import { createRouter, createWebHistory } from 'vue-router';
import DesignerHome from './views/DesignerHome.vue';
import PlayerView from './views/PlayerView.vue';
import NotFoundView from './views/NotFoundView.vue';

// No lazy routes: a kiosk tab open for weeks would request a chunk that a
// later extension update has deleted (Plan.md, Risiko 7).
export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', name: 'designer', component: DesignerHome },
        { path: '/player', name: 'player', component: PlayerView },
        // On a foyer TV an empty page is indistinguishable from a crash (G7).
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
    ],
});
