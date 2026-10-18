<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AuthForm from "@/components/base/AuthForm.vue";

const router = useRouter();
const mode = ref("login");
const loading = ref(false);
const error = ref("");
const success = ref(false);

// payload: { mode, ...данные формы }: login | registration | reset_password
async function onSubmit(payload) {
  error.value = "";
  success.value = false;
  loading.value = true;
  try {
    // TODO: запрос к вашему API по payload.mode, сохранение токена
    await new Promise((r) => setTimeout(r, 400));
    if (payload.mode === "reset_password") {
      success.value = true;
      return;
    }
    router.push("/dashboard");
  } catch {
    error.value = "Не удалось выполнить запрос. Попробуйте ещё раз.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="home">
    <auth-form
      v-model:mode="mode"
      :loading="loading"
      :server-error="error"
      :success="success"
      @submit="onSubmit"
    />
  </div>
</template>
