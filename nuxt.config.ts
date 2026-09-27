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

  components: [
    { path: '~/components', pathPrefix: false },
    { path: '~/shared/ui', pathPrefix: false }
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  /*
   * Los composables de feature se importan EXPLÍCITAMENTE, no por
   * auto-import.
   *
   * Con auto-import, `useCatalog()` aparece en una pantalla sin decir de
   * dónde sale, y en una arquitectura por features eso esconde justo lo
   * que importa: qué dominio usa a cuál. Los componentes de shared/ui sí
   * se auto-importan, porque son primitivas sin dominio.
   */

  /*
   * El POS va siempre en claro, sin seguir la preferencia del sistema.
   *
   * No es una manía: la paleta del negocio es beige, café y naranja —
   * colores cálidos y claros— y en oscuro no queda ninguno de los tres,
   * sólo un panel casi negro con un botón naranja. La marca desaparece.
   *
   * Y es un aparato de mostrador, no la computadora de alguien: quien lo
   * usa no eligió el tema del sistema operativo de esa terminal, así que
   * heredarlo sólo hace que dos cajas se vean distintas sin motivo.
   *
   * La landing sí podrá tener modo oscuro: ahí la decisión es de quien
   * visita, no del negocio.
   */
  colorMode: {
    preference: 'light',
    fallback: 'light',

    /*
     * La llave lleva sufijo porque el módulo guarda la preferencia en el
     * navegador y lo guardado gana sobre lo configurado. Una terminal que
     * ya hubiera abierto el POS tendría 'system' escrito y seguiría en
     * oscuro por más que aquí diga 'light'. Cambiar la llave hace que ese
     * valor viejo deje de aplicar, sin pedirle a nadie que borre nada.
     */
    storageKey: 'cafetit-tema-claro'
  },

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
