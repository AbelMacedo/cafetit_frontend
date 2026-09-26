// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  /*
   * El POS vive detrás de un login: renderizar en servidor no aporta nada
   * (no hay SEO que ganar) y sí agrega latencia en cada pantalla. Va como
   * SPA pura, que además es lo que permitirá el modo offline de la fase 2.
   */
  ssr: false,

  /*
   * Los componentes base viven en shared/ui (arquitectura por features,
   * ver ARCHITECTURE.md §4.1). Sin esto Nuxt sólo auto-importa components/.
   */
  components: [
    { path: '~/components', pathPrefix: false },
    { path: '~/shared/ui', pathPrefix: false }
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // Sólo la URL. Ninguna credencial vive en el frontend.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'
    }
  },

  devServer: {
    // Debe coincidir con SANCTUM_STATEFUL_DOMAINS del backend, o el
    // navegador no mandará la cookie de sesión.
    port: 3000
  },

  compatibilityDate: '2026-06-30',

  typescript: {
    strict: true,
    typeCheck: false
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
