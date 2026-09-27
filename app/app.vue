<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },

    // El POS no es contenido público: no debe indexarse nunca.
    { name: 'robots', content: 'noindex, nofollow' }
  ],
  htmlAttrs: { lang: 'es' }
})

useSeoMeta({ title: 'Cafetit · Punto de venta' })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
