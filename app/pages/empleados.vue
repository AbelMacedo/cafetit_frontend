<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import EmpleadoModal from '~/features/users/components/EmpleadoModal.vue'
import { type AltaEmpleado, type CambioEmpleado, useUsers } from '~/features/users/composables/useUsers'
import { ApiError } from '~/shared/composables/useApi'
import type { User } from '~/shared/types/api'

/*
 * `altoCompleto`: la tabla se queda con el alto sobrante y es lo único
 * que se desplaza.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const auth = useAuthStore()
const {
  empleados, visibles, activos, busqueda, incluirInactivos,
  cargando, error, cargar, crear, editar, darDeBaja, reactivar
} = useUsers()

onMounted(cargar)

/**
 * El filtro es un sí/no, pero se presenta como selector igual que los
 * demás: un botón que se enciende obliga a recordar qué significa que
 * esté apagado, y dos opciones nombradas no dejan duda.
 */
const altas = [
  { value: 'todos', label: 'Todas las cuentas' },
  { value: 'activos', label: 'Sólo activas' }
]

/**
 * El estado cuenta como filtro: abrir en «sólo activas» es un recorte
 * y quien no encuentre a alguien tiene que poder quitarlo de un toque.
 */
const filtrada = computed(() => busqueda.value !== '' || incluirInactivos.value)

function limpiarFiltros(): void {
  busqueda.value = ''
  incluirInactivos.value = false
}

const filtroAlta = computed({
  get: () => (incluirInactivos.value ? 'todos' : 'activos'),
  set: (v: string | number) => {
    incluirInactivos.value = v === 'todos'
  }
})

const creando = ref(false)
const editando = ref<User | null>(null)
const modalAbierto = computed(() => creando.value || editando.value !== null)

const guardando = ref(false)
const errorForm = ref<string | null>(null)
const erroresForm = ref<Record<string, string>>({})

/** Fuerza un modal nuevo al cambiar de empleado: los `ref` del formulario
 *  se inicializan una sola vez, al montarse. */
const claveModal = computed(() => editando.value?.id ?? 'alta')

function cerrar() {
  creando.value = false
  editando.value = null
  errorForm.value = null
  erroresForm.value = {}
}

function recogerError(e: unknown) {
  erroresForm.value = {}

  if (!(e instanceof ApiError)) {
    errorForm.value = 'No se pudo guardar.'
    return
  }

  errorForm.value = e.message

  // Cada mensaje junto a su campo: un «la contraseña no cumple» suelto
  // arriba no dice cuál de los dos inputs es.
  for (const [campo, mensajes] of Object.entries(e.errors)) {
    if (mensajes[0]) erroresForm.value[campo] = mensajes[0]
  }
}

async function alAlta(datos: AltaEmpleado) {
  guardando.value = true
  errorForm.value = null

  try {
    await crear(datos)
    cerrar()
  } catch (e) {
    recogerError(e)
  } finally {
    guardando.value = false
  }
}

async function alCambio(id: number, datos: CambioEmpleado) {
  guardando.value = true
  errorForm.value = null

  try {
    await editar(id, datos)
    cerrar()
  } catch (e) {
    recogerError(e)
  } finally {
    guardando.value = false
  }
}

/*
 * La baja es reversible y queda en la bitácora, así que no hace falta un
 * diálogo de confirmación aparte: se pide confirmación en la misma fila,
 * que es donde está la mirada.
 */
const confirmandoBaja = ref<number | null>(null)
const errorBaja = ref<string | null>(null)

async function alDarDeBaja(u: User) {
  errorBaja.value = null

  try {
    await darDeBaja(u.id)
    confirmandoBaja.value = null
  } catch (e) {
    errorBaja.value = e instanceof ApiError ? e.message : 'No se pudo dar de baja.'
  }
}

async function alReactivar(u: User) {
  errorBaja.value = null

  try {
    await reactivar(u.id)
  } catch (e) {
    errorBaja.value = e instanceof ApiError ? e.message : 'No se pudo reactivar.'
  }
}

function ultimoAcceso(iso: string | null): string {
  if (iso === null) return 'Nunca ha entrado'

  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
    <PaginaTitulo
      titulo="Empleados"
      descripcion="No hay permisos por puesto: todas las cuentas pueden hacer lo mismo. Lo que sí queda es el registro de quién hizo cada cosa."
    >
      <template #acciones>
        <UButton
          icon="i-lucide-user-plus"
          class="toque"
          @click="creando = true"
        >
          Nuevo empleado
        </UButton>
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <UAlert
      v-if="errorBaja"
      color="error"
      variant="subtle"
      :title="errorBaja"
      close
      @update:open="errorBaja = null"
    />

    <BarraFiltros
      :visibles="visibles.length"
      :total="empleados.length"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Nombre o correo"
          icon="i-lucide-search"
          size="lg"
          class="w-44 2xl:w-56"
        />
      </template>

      <template #filtros>
        <FiltroSelect
          v-model="filtroAlta"
          :opciones="altas"
          tamano="lg"
          etiqueta="Filtrar por estado de la cuenta"
          icono="i-lucide-user-check"
          ancho="w-48 2xl:w-52"
        />

        <UButton
          size="lg"
          variant="ghost"
          color="neutral"
          icon="i-lucide-filter-x"
          title="Quitar los filtros"
          aria-label="Quitar los filtros"
          :disabled="!filtrada"
          @click="limpiarFiltros"
        >
          <span class="hidden 2xl:inline">Limpiar</span>
        </UButton>
      </template>

      <template #resumen>
        {{ activos }} {{ activos === 1 ? 'cuenta activa' : 'cuentas activas' }}
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="3"
    />

    <SinResultados
      v-else-if="visibles.length === 0"
      icono="i-lucide-users"
      titulo="Ningún empleado coincide"
      descripcion="Prueba con otro nombre, o incluye a los dados de baja."
    />

    <div
      v-else
      class="tarjeta overflow-hidden md:flex-1 md:min-h-0"
    >
      <div class="overflow-auto max-h-[60vh] md:max-h-none md:h-full">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10">
            <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Empleado
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                Correo
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap">
                PIN
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap hidden lg:table-cell">
                Último acceso
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="u in visibles"
              :key="u.id"
              class="border-b border-borde-suave last:border-0 transition
                     [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0"
              :class="u.is_active ? '' : 'text-apagado-2'"
            >
              <td class="px-3 lg:px-4 py-4 text-center w-1/2 lg:w-1/4 max-w-0">
                <span class="flex items-center justify-center gap-2 min-w-0">
                  <span class="font-medium truncate">{{ u.name }}</span>

                  <UBadge
                    v-if="u.id === auth.user?.id"
                    color="primary"
                    variant="subtle"
                    size="md"
                    class="shrink-0"
                  >
                    Tú
                  </UBadge>
                  <UBadge
                    v-if="!u.is_active"
                    color="neutral"
                    variant="subtle"
                    size="md"
                    class="shrink-0"
                  >
                    Dado de baja
                  </UBadge>
                </span>

                <!-- En angosto el correo se mete aquí: su columna se oculta. -->
                <span class="block truncate text-xs text-apagado lg:hidden">{{ u.email }}</span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-1/3 max-w-0 truncate text-apagado hidden lg:table-cell">
                {{ u.email }}
              </td>

              <!--
                Si tiene PIN, nunca cuál.

                Desde que existe el cambio rápido de cajero, una cuenta sin
                PIN no puede relevar a nadie en el mostrador, y hasta ahora
                eso se descubría intentándolo con la fila esperando.
              -->
              <td class="px-3 lg:px-4 py-4 text-center w-px whitespace-nowrap">
                <UBadge
                  v-if="u.tiene_pin"
                  color="success"
                  variant="subtle"
                  size="md"
                >
                  Puesto
                </UBadge>
                <UBadge
                  v-else
                  color="warning"
                  variant="subtle"
                  size="md"
                >
                  Sin PIN
                </UBadge>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-px text-apagado whitespace-nowrap hidden lg:table-cell">
                {{ ultimoAcceso(u.last_login_at) }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-px whitespace-nowrap">
                <template v-if="confirmandoBaja === u.id">
                  <span class="inline-flex items-center gap-1">
                    <UButton
                      size="sm"
                      variant="outline"
                      color="neutral"
                      @click="confirmandoBaja = null"
                    >
                      Mejor no
                    </UButton>
                    <UButton
                      size="sm"
                      color="error"
                      @click="alDarDeBaja(u)"
                    >
                      Sí, dar de baja
                    </UButton>
                  </span>
                </template>

                <template v-else>
                  <span class="inline-flex items-center gap-1">
                    <UButton
                      size="sm"
                      variant="outline"
                      color="neutral"
                      icon="i-lucide-pencil"
                      title="Editar"
                      aria-label="Editar"
                      @click="editando = u"
                    >
                      <span class="hidden lg:inline">Editar</span>
                    </UButton>

                    <!--
                      La razón va como texto y no como `title` del botón: en
                      un botón deshabilitado el `title` sustituye a su nombre
                      accesible, y el lector anunciaría la explicación en
                      lugar de «Dar de baja».
                    -->
                    <span
                      v-if="u.is_active && u.id === auth.user?.id"
                      class="text-xs text-apagado"
                    >Te da de baja otro</span>

                    <UButton
                      v-else-if="u.is_active"
                      size="sm"
                      variant="ghost"
                      color="error"
                      icon="i-lucide-user-minus"
                      title="Dar de baja"
                      aria-label="Dar de baja"
                      @click="confirmandoBaja = u.id"
                    >
                      <span class="hidden lg:inline">Dar de baja</span>
                    </UButton>

                    <UButton
                      v-else
                      size="sm"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-rotate-ccw"
                      title="Reactivar"
                      aria-label="Reactivar"
                      @click="alReactivar(u)"
                    >
                      <span class="hidden lg:inline">Reactivar</span>
                    </UButton>
                  </span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <EmpleadoModal
      v-if="modalAbierto"
      :key="claveModal"
      :empleado="editando"
      :usuario-actual-id="auth.user?.id ?? null"
      :guardando="guardando"
      :error="errorForm"
      :errores="erroresForm"
      @alta="alAlta"
      @cambio="alCambio"
      @cerrar="cerrar"
    />
  </div>
</template>
