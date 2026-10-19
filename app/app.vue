<script setup lang="ts">
import { es } from '@nuxt/ui/locale'

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },

    // El POS no es contenido público: no debe indexarse nunca.
    { name: 'robots', content: 'noindex, nofollow' }
  ],
  htmlAttrs: { lang: 'es' }
})

useSeoMeta({ title: 'La Cafetit · Punto de venta' })
</script>

<template>
  <!--
    El idioma de los componentes de la librería.

    Sin esto, el buscador de un selector dice «Search...» y el aviso de
    «sin resultados» sale en inglés, en medio de un POS escrito entero
    en español. Son cadenas que vienen de dentro de Nuxt UI y no hay
    forma de traducirlas una por una desde fuera.
  -->
  <UApp :locale="es">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
