<template>
  <div class="home">
    <auth-form />
  </div>
</template>

<script>
// @ is an alias to /src
import AuthForm from "@/components/base/AuthForm.vue";

export default {
  name: "HomeView",
  components: {
    AuthForm,
  },
};
</script>
