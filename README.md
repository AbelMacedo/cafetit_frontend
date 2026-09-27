# Cafetit — POS

Punto de venta de la cafetería. SPA en Nuxt 4, sin renderizado en
servidor: vive detrás de un login, no hay SEO que ganar y el SSR sólo
agregaría latencia en cada pantalla.

**La API es la fuente de verdad del dinero.** Los totales que calcula esta
aplicación son para que el cajero vea la cifra mientras captura; el que se
cobra lo calcula el servidor. Por eso la aritmética del carrito replica el
orden del backend al centavo, y por eso tiene pruebas.

## Arranque

```bash
npm install
cp .env.example .env    # NUXT_PUBLIC_API_BASE apunta a la API
npm run dev
```

Necesita la API corriendo. Ver el repositorio `cafetit_backend`, que además
guarda la documentación del sistema completo: alcance, arquitectura, diseño
y despliegue.

## Comandos

```bash
npm run dev          # servidor de desarrollo en :3000
npm run test         # pruebas (Vitest)
npm run test:watch   # en modo continuo
npm run lint         # ESLint
npm run typecheck    # vue-tsc
npm run build        # producción
```

## Estructura

Por **features**, no por tipo de archivo: lo que cambia junto vive junto.

```
app/
  layouts/default.vue     armazón: navegación, estado del turno, campanita
  pages/                  una por pantalla, sin encabezado propio
  features/<dominio>/     stores, composables y componentes de ese dominio
  shared/ui/              primitivas sin dominio (auto-importadas)
  shared/composables/     cliente de API
  shared/types/api.ts     la forma de lo que devuelve el servidor
```

**Los composables y componentes de feature se importan explícitamente.**
Con auto-import, `useCatalog()` aparece en una pantalla sin decir de dónde
sale, y en una arquitectura por dominios eso esconde justo lo que importa:
qué dominio usa a cuál. Lo de `shared/ui/` sí se auto-importa, porque son
piezas sin dominio.

## Pruebas

29 pruebas sobre la aritmética del carrito, el cliente de API y el formato
del dinero. Corren en Node, sin DOM ni runtime de Nuxt: la suite tarda
menos de medio segundo, que es lo que hace que se siga corriendo.

Lo que se prueba del carrito no es «suma bien», sino que replique el orden
del backend —descuento de línea primero, descuento de venta después— y el
redondeo mitad-hacia-arriba con enteros. Si divergieran, el cajero vería un
número y cobraría otro.

Los auto-imports de Nuxt se suplen en `tests/setup.ts`; ahí está explicado
por qué, y cuál es la contrapartida.

## Compuertas de calidad

Corren en cada push ([.github/workflows/ci.yml](.github/workflows/ci.yml)):
ESLint, `vue-tsc`, Vitest y build. Si alguna falla, no se mezcla.

## Sesión

Autenticación por **cookie HttpOnly** (Sanctum en modo SPA), no por token
en `localStorage`. Un token en `localStorage` lo lee cualquier script
inyectado en la página; una cookie `HttpOnly`, no. En un sistema que maneja
el dinero del negocio esa diferencia no es teórica.

Todo el tráfico pasa por `shared/composables/useApi`: un solo lugar donde
viven la cookie CSRF, el manejo de errores y la sesión caducada.

## Despliegue

Cloudflare Pages. Ver `docs/DEPLOY.md` en `cafetit_backend`.
