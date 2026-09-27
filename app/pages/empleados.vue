<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import EmpleadoModal from '~/features/users/components/EmpleadoModal.vue'
import { type AltaEmpleado, type CambioEmpleado, useUsers } from '~/features/users/composables/useUsers'
import { ApiError } from '~/shared/composables/useApi'
import type { User } from '~/shared/types/api'

definePageMeta({ middleware: 'auth' })

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
  <div class="space-y-6">
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
      :filtrada="busqueda !== ''"
      @limpiar="busqueda = ''"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Nombre o correo"
          icon="i-lucide-search"
          class="w-56"
        />
      </template>

      <template #filtros>
        <FiltroSelect
          v-model="filtroAlta"
          :opciones="altas"
          etiqueta="Filtrar por estado de la cuenta"
          icono="i-lucide-user-check"
          ancho="w-52"
        />
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
      class="space-y-2"
    >
      <div
        v-for="u in visibles"
        :key="u.id"
        class="tarjeta p-3"
        :class="u.is_active ? '' : 'opacity-60'"
      >
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span class="min-w-0 flex-1">
            <span class="font-medium">{{ u.name }}</span>
            <UBadge
              v-if="u.id === auth.user?.id"
              color="primary"
              variant="subtle"
              size="sm"
              class="ml-2"
            >
              Tú
            </UBadge>
            <UBadge
              v-if="!u.is_active"
              color="neutral"
              variant="subtle"
              size="sm"
              class="ml-2"
            >
              Dado de baja
            </UBadge>
            <span class="block text-sm text-beige-600">{{ u.email }}</span>
            <span class="block text-xs text-beige-600">{{ ultimoAcceso(u.last_login_at) }}</span>
          </span>

          <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <template v-if="confirmandoBaja === u.id">
              <span class="text-sm">¿Darle de baja?</span>
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
            </template>

            <template v-else>
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-pencil"
                @click="editando = u"
              >
                Editar
              </UButton>

              <!--
                La razón va como texto, no como `title` del botón: en un
                botón deshabilitado, el `title` sustituye a su nombre
                accesible y un lector de pantalla anuncia la explicación
                en lugar de «Dar de baja».
              -->
              <span
                v-if="u.is_active && u.id === auth.user?.id"
                class="text-xs text-beige-600 max-w-40 text-right"
              >
                Tu propia cuenta la da de baja otro compañero.
              </span>

              <UButton
                v-else-if="u.is_active"
                size="sm"
                variant="ghost"
                color="error"
                @click="confirmandoBaja = u.id"
              >
                Dar de baja
              </UButton>

              <UButton
                v-else
                size="sm"
                variant="ghost"
                color="neutral"
                @click="alReactivar(u)"
              >
                Reactivar
              </UButton>
            </template>
          </div>
        </div>
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
