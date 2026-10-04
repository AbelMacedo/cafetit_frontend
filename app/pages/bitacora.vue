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
/*
 * `altoCompleto`: la pantalla ocupa el alto y la lista se queda con el
 * sobrante, así se desplaza ella y no la página. En una bitácora de
 * meses es la diferencia entre recorrer los registros y perder de vista
 * el periodo que se está mirando.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const {
  porDia, total, acciones, pagina, ultimaPagina, porPagina,
  desde, hasta, accion, soloDelicadas,
  filtrada, cargando, error, cargar, cargarAcciones, limpiar, irAHoy,
  recargarDesdeLaPrimera, irAPagina
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
    void recargarDesdeLaPrimera()
  }
})

const alcanceFiltro = computed({
  get: () => (soloDelicadas.value ? 'delicadas' : 'todo'),
  set: (v: string | number) => {
    soloDelicadas.value = v === 'delicadas'
    void recargarDesdeLaPrimera()
  }
})

async function limpiarFiltros() {
  limpiar()
  await recargarDesdeLaPrimera()
}

async function verHoy() {
  irAHoy()
  await recargarDesdeLaPrimera()
}

/** El renglón que se está viendo, para situarse entre páginas. */
const rango = computed(() => {
  const primero = (pagina.value - 1) * porPagina + 1
  return { primero, ultimo: Math.min(pagina.value * porPagina, total.value) }
})
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
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

    <!--
      Las dos iguales: filtrar rehace la consulta, así que un «X de Y»
      distinto sólo podría venir de la página, y eso lo dicen los
      controles de abajo.
    -->
    <BarraFiltros
      :visibles="total"
      :total="total"
    >
      <template #filtros>
        <UInput
          v-model="desde"
          type="date"
          size="lg"
          aria-label="Desde"
          @change="recargarDesdeLaPrimera"
        />
        <span class="text-sm text-apagado">a</span>
        <UInput
          v-model="hasta"
          type="date"
          size="lg"
          aria-label="Hasta"
          @change="recargarDesdeLaPrimera"
        />

        <UButton
          size="lg"
          variant="outline"
          color="neutral"
          icon="i-lucide-calendar-days"
          title="Ver sólo lo de hoy"
          aria-label="Ver sólo lo de hoy"
          @click="verHoy"
        >
          <span class="hidden 2xl:inline">Hoy</span>
        </UButton>

        <FiltroSelect
          v-model="alcanceFiltro"
          :opciones="opcionesAlcance"
          tamano="lg"
          etiqueta="Qué mostrar"
          icono="i-lucide-shield-alert"
          ancho="w-48 2xl:w-56"
        />

        <FiltroSelect
          v-model="accionFiltro"
          :opciones="opcionesAccion"
          tamano="lg"
          etiqueta="Filtrar por acción"
          icono="i-lucide-list-filter"
          ancho="w-56 2xl:w-72"
        />

        <!--
          Quitar los filtros vive aquí, con ellos, y no como enlace
          debajo del contador. Siempre presente y deshabilitado cuando no
          hay nada que quitar: un botón que brota mueve de sitio a los de
          al lado justo cuando el dedo va bajando.
        -->
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

      <template #nota>
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
      class="space-y-6 md:flex-1 md:min-h-0 md:overflow-auto"
    >
      <section
        v-for="grupo in porDia"
        :key="grupo.dia"
        class="space-y-2"
      >
        <h2 class="text-sm font-semibold text-apagado first-letter:uppercase sticky top-0 z-10 bg-lienzo py-1">
          {{ grupo.dia }}
        </h2>

        <RegistroBitacoraFila
          v-for="r in grupo.items"
          :key="r.id"
          :registro="r"
        />
      </section>
    </div>

    <!--
      Las páginas, fuera de la caja que se desplaza: dentro habría que
      bajar cien registros para encontrarlas. Sólo salen si hay más de
      una.
    -->
    <div
      v-if="ultimaPagina > 1"
      class="flex flex-wrap items-center justify-between gap-2 shrink-0"
    >
      <p class="text-xs text-apagado tabular-nums">
        {{ rango.primero }}–{{ rango.ultimo }} de {{ total }}
      </p>

      <div class="flex items-center gap-2">
        <UButton
          size="lg"
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-left"
          title="Página anterior"
          aria-label="Página anterior"
          :disabled="pagina === 1 || cargando"
          @click="irAPagina(pagina - 1)"
        />

        <span class="text-sm text-apagado tabular-nums">
          {{ pagina }} de {{ ultimaPagina }}
        </span>

        <UButton
          size="lg"
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-right"
          title="Página siguiente"
          aria-label="Página siguiente"
          :disabled="pagina === ultimaPagina || cargando"
          @click="irAPagina(pagina + 1)"
        />
      </div>
    </div>
  </div>
</template>
