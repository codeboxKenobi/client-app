<script setup>
import BaseCalendar from "@/components/base/BaseCalendar.vue";
</script>

<template>
  <!-- высота ровно по окну дашборда: без max-height, иначе внизу остаётся пустая полоса -->
  <div class="desktop">
    <base-calendar />
  </div>
</template>

<style scoped>
.desktop {
  height: 100%;
  min-height: 0;
}
</style>
