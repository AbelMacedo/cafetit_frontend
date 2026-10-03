<script setup lang="ts">
import RegistroBitacoraFila from '~/features/audit/components/RegistroBitacoraFila.vue'
import { useAuditLog } from '~/features/audit/composables/useAuditLog'

/**
 * La bitácora.
 *
 * Es el único contrapeso del sistema. No hay roles: cualquiera con cuenta
 * puede cancelar una venta cobrada, sacar dinero del cajón o bajar un
 * precio, venderlo y volver a subirlo. Nada de eso se impide —en una
 * cafetería de cinco personas, impedirlo estorbaría más de lo que
 * protege— pero todo queda escrito con nombre, hora e IP en una tabla
 * que la base de datos no deja modificar ni borrar.
 *
 * Durante semanas esa tabla no tuvo pantalla. Escribía, y nadie podía
 * leerla: el contrapeso existía en el diseño y no en el mostrador.
 */
definePageMeta({ middleware: 'auth' })

const {
  porDia, total, acciones, desde, hasta, accion, soloDelicadas,
  filtrada, cargando, error, cargar, cargarAcciones, limpiar
} = useAuditLog()

onMounted(async () => {
  await cargarAcciones()
  await cargar()
})

/** El catálogo del servidor, con «todas» al frente. */
const opcionesAccion = computed(() => [
  { value: 'todas', label: 'Todas las acciones' },
  ...acciones.value.map(a => ({ value: a.valor, label: `${a.grupo} · ${a.texto}` }))
])

const opcionesAlcance = [
  { value: 'delicadas', label: 'Sólo lo que se revisa' },
  { value: 'todo', label: 'Todo lo registrado' }
]

/**
 * Los filtros recargan desde el servidor, no filtran en memoria: el
 * periodo es parte de la consulta y la lista puede ser de meses.
 */
const accionFiltro = computed({
  get: () => accion.value,
  set: (v: string | number) => {
    accion.value = String(v)
    void cargar()
  }
})

const alcanceFiltro = computed({
  get: () => (soloDelicadas.value ? 'delicadas' : 'todo'),
  set: (v: string | number) => {
    soloDelicadas.value = v === 'delicadas'
    void cargar()
  }
})

async function limpiarFiltros() {
  limpiar()
  await cargar()
}
</script>

<template>
  <div class="space-y-6">
    <PaginaTitulo
      titulo="Bitácora"
      descripcion="Quién hizo qué y cuándo. Los registros no se pueden modificar ni borrar, ni siquiera desde aquí."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <BarraFiltros
      :visibles="total"
      :total="total"
      :filtrada="filtrada"
      @limpiar="limpiarFiltros"
    >
      <template #filtros>
        <UInput
          v-model="desde"
          type="date"
          size="sm"
          aria-label="Desde"
          @change="cargar"
        />
        <span class="text-sm text-beige-600">a</span>
        <UInput
          v-model="hasta"
          type="date"
          size="sm"
          aria-label="Hasta"
          @change="cargar"
        />

        <FiltroSelect
          v-model="alcanceFiltro"
          :opciones="opcionesAlcance"
          etiqueta="Qué mostrar"
          icono="i-lucide-shield-alert"
          ancho="w-56"
        />

        <FiltroSelect
          v-model="accionFiltro"
          :opciones="opcionesAccion"
          etiqueta="Filtrar por acción"
          icono="i-lucide-list-filter"
          ancho="w-72"
        />
      </template>

      <template #resumen>
        Salidas de efectivo, cancelaciones y cambios de precio van marcados.
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="6"
    />

    <SinResultados
      v-else-if="porDia.length === 0"
      icono="i-lucide-scroll-text"
      :titulo="filtrada ? 'Nada de eso pasó en el periodo' : 'Sin movimientos en el periodo'"
      :descripcion="filtrada
        ? 'Prueba con otras fechas o muestra todo lo registrado.'
        : 'Aquí aparecen las cancelaciones, los retiros de efectivo, las mermas y los cambios de precio.'"
    >
      <template #accion>
        <UButton
          v-if="filtrada"
          variant="outline"
          color="neutral"
          @click="limpiarFiltros"
        >
          Mostrar todo
        </UButton>
      </template>
    </SinResultados>

    <div
      v-else
      class="space-y-6"
    >
      <section
        v-for="grupo in porDia"
        :key="grupo.dia"
        class="space-y-2"
      >
        <h2 class="text-sm font-semibold text-beige-600 capitalize sticky top-0 bg-beige-100 py-1">
          {{ grupo.dia }}
        </h2>

        <RegistroBitacoraFila
          v-for="r in grupo.items"
          :key="r.id"
          :registro="r"
        />
      </section>
    </div>
  </div>
</template>
