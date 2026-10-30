<script setup>
import { ref } from "vue";
const hello = ref("HELLO!");
</script>

<template>
  <div class="home">
    {{ hello }}
  </div>
</template>
