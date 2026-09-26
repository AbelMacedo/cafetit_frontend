import { useAuthStore } from '~/features/auth/stores/auth'

/**
 * Exige sesión iniciada.
 *
 * Es una comodidad de navegación, no una medida de seguridad: quien tenga
 * curiosidad puede saltarse cualquier guardia del cliente. La autorización
 * de verdad la aplica la API en cada petición.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  await auth.recuperarSesion()

  if (!auth.autenticado) {
    return navigateTo({
      path: '/login',
      query: to.path === '/' ? undefined : { redirect: to.fullPath }
    })
  }
})
