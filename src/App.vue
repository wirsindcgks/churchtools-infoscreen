<script setup lang="ts">
import ConfirmDialog from './designer/ConfirmDialog.vue';
</script>

<template>
    <div class="infoscreen-app">
        <RouterView />
        <ConfirmDialog />
    </div>
</template>
