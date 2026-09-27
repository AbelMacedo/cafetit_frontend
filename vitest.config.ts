import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Pruebas de lógica, no de componentes.
 *
 * Lo que se cubre aquí es la aritmética del carrito y el formato del
 * dinero: código puro que no necesita DOM ni el runtime de Nuxt, y que
 * por eso corre en milisegundos. Una suite lenta se deja de correr, y una
 * suite que se deja de correr no protege nada.
 *
 * Los auto-imports de Nuxt se suplen en `tests/setup.ts`; ahí está
 * explicado por qué no se usa el entorno `nuxt` de @nuxt/test-utils.
 */
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup.ts']
  }
})
