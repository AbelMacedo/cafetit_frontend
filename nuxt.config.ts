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
   * Claro por omisión, oscuro si alguien lo pide. Nunca por el sistema.
   *
   * Estuvo forzado a claro un tiempo, y con razón: la paleta del negocio
   * —beige, café y naranja— se diseñó para claro, y lo que había era
   * media docena de `dark:` sueltos que dejaban texto café sobre fondo
   * café. Ahora el oscuro tiene su propia paleta, en `main.css`.
   *
   * `preference` y no `'system'` a propósito: es un aparato de mostrador,
   * no la computadora de alguien. Quien lo usa no eligió el tema de
   * Windows de esa terminal, y heredarlo haría que dos cajas del mismo
   * negocio se vieran distintas sin que nadie lo hubiera decidido. Se
   * cambia desde el menú de la cuenta y se queda guardado en ese aparato.
   */
  colorMode: {
    preference: 'light',
    fallback: 'light',

    /*
     * El sufijo del módulo se deja vacío: la clase tiene que ser `dark` a
     * secas, que es la que esperan tanto Nuxt UI como el bloque `.dark`
     * de `main.css`. Con el sufijo por omisión sería `dark-mode` y no
     * coincidiría con ninguno de los dos.
     */
    classSuffix: '',

    /*
     * La llave cambia de nombre al cambiar el significado.
     *
     * El módulo guarda la preferencia en el navegador y lo guardado gana
     * sobre lo configurado. La llave anterior se puso para anular un
     * 'system' viejo que dejaba terminales en oscuro; ahora que el oscuro
     * se elige a mano, una terminal con aquel valor escrito arrancaría
     * con una preferencia que su dueño nunca tomó.
     */
    storageKey: 'cafetit-tema'
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
