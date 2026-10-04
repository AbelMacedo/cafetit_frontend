<script setup lang="ts">
import VentaDetalleModal from '~/features/sales/components/VentaDetalleModal.vue'
import { type FiltroEstado, useSalesHistory } from '~/features/sales/composables/useSalesHistory'
import { ApiError } from '~/shared/composables/useApi'
import type { Venta } from '~/shared/types/api'

/*
 * `altoCompleto`: la pantalla ocupa el alto y la tabla se queda con
 * el sobrante. Así se desplaza la lista y no la página, que en una
 * tableta es la diferencia entre recorrer las ventas y perder de
 * vista los filtros.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const toast = useToast()

const {
  visibles, total, totalCobrado, pagina, ultimaPagina, porPagina,
  desde, hasta, estado, busqueda,
  cargando, error, cargar, detalle, cancelar, hoy,
  recargarDesdeLaPrimera, irAPagina
} = useSalesHistory()

onMounted(cargar)

const seleccionada = ref<Venta | null>(null)
const abriendo = ref(false)
const cancelando = ref(false)
const errorCancelacion = ref<string | null>(null)

async function abrir(v: Venta) {
  abriendo.value = true
  errorCancelacion.value = null

  try {
    // El listado no trae líneas ni pagos: se piden al abrir el detalle.
    seleccionada.value = await detalle(v.id)
  } catch {
    toast.add({
      title: 'No se pudo abrir la venta',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    abriendo.value = false
  }
}

async function alCancelar(motivo: string) {
  if (!seleccionada.value) return

  const folio = seleccionada.value.folio
  cancelando.value = true
  errorCancelacion.value = null

  try {
    await cancelar(seleccionada.value.id, motivo)
    seleccionada.value = null

    toast.add({
      title: `Venta #${folio} cancelada`,
      description: 'El inventario volvió a existencias.',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    errorCancelacion.value = e instanceof ApiError ? e.message : 'No se pudo cancelar.'
  } finally {
    cancelando.value = false
  }
}

const estados = [
  { value: 'todas', label: 'Todas' },
  { value: 'paid', label: 'Cobradas' },
  { value: 'cancelled', label: 'Canceladas' }
]

/**
 * El filtro recarga desde el servidor, no filtra en memoria: el estado es
 * parte de la consulta. Por eso pasa por un `computed` con escritura en
 * lugar de un `v-model` directo.
 */
const estadoFiltro = computed({
  get: () => estado.value as string,
  set: (v: string | number) => {
    estado.value = String(v) as FiltroEstado
    void recargarDesdeLaPrimera()
  }
})

async function irAHoy() {
  hoy()
  await recargarDesdeLaPrimera()
}

/*
 | El buscador va al servidor, así que no se consulta en cada tecla:
 | «Mariana» serían siete consultas y seis listas que nadie llega a ver.
 | Medio segundo de quietud es lo que tarda alguien en dejar de escribir.
 */
let temporizador: ReturnType<typeof setTimeout> | undefined

watch(busqueda, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => void recargarDesdeLaPrimera(), 400)
})

onBeforeUnmount(() => clearTimeout(temporizador))

/** El renglón que se está viendo, para situarse entre páginas. */
const rango = computed(() => {
  const primero = (pagina.value - 1) * porPagina + 1
  return { primero, ultimo: Math.min(pagina.value * porPagina, total.value) }
})

/** Las fechas cuentan como filtro: «quitar filtros» también las borra. */
const filtrada = computed(() =>
  estado.value !== 'todas'
  || busqueda.value.trim() !== ''
  || desde.value !== ''
  || hasta.value !== ''
)

async function limpiarFiltros() {
  estado.value = 'todas'
  busqueda.value = ''
  desde.value = ''
  hasta.value = ''

  // El `watch` del buscador dispararía otra consulta medio segundo
  // después; se adelanta y se cancela para no pedir dos veces.
  clearTimeout(temporizador)
  await recargarDesdeLaPrimera()
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/**
 * El día, y sólo cuando no es hoy.
 *
 * La columna decía la hora a secas. Como la pantalla abre SIN fechas y
 * trae lo más reciente del histórico, cuatro ventas de cuatro días
 * distintos se leían como cuatro ventas de esta tarde: «10:33 p.m.» no
 * dice de qué 10:33 se habla.
 *
 * En «hoy» el día sobra y estorba —es el caso de todos los días—, así
 * que sólo aparece cuando la venta es de otra fecha.
 */
function dia(iso: string): string | null {
  const f = new Date(iso)
  const hoyMismo = new Date()

  const mismoDia = f.getFullYear() === hoyMismo.getFullYear()
    && f.getMonth() === hoyMismo.getMonth()
    && f.getDate() === hoyMismo.getDate()

  if (mismoDia) return null

  // Con el año sólo si no es el corriente: en una lista del año en curso
  // repetir «2026» en cada renglón es ruido.
  return f.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: f.getFullYear() === hoyMismo.getFullYear() ? undefined : 'numeric'
  })
}
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
    <!--
      `space-y-3` y no 6: entre la descripción y los filtros, y entre el
      contador y la tabla, sobraba hueco. Son bloques encadenados —esto
      filtra aquello— y separarlos tanto los hacía parecer independientes.
    -->
    <PaginaTitulo
      titulo="Ventas"
      descripcion="Lo cobrado en el periodo. Abre una para reimprimir su ticket o cancelarla."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <!--
      Las dos cifras iguales a propósito: el «X de Y» de la barra avisa
      de un filtro, y aquí filtrar ya rehace la consulta. En qué página
      vamos lo dicen los controles de abajo, con su «101–135 de 135».
    -->
    <BarraFiltros
      :visibles="total"
      :total="total"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Folio o cliente"
          icon="i-lucide-search"
          size="lg"
          class="w-44 2xl:w-56"
        />
      </template>

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
          title="Ver sólo las de hoy"
          aria-label="Ver sólo las de hoy"
          @click="irAHoy"
        >
          <span class="hidden 2xl:inline">Hoy</span>
        </UButton>

        <FiltroSelect
          v-model="estadoFiltro"
          :opciones="estados"
          tamano="lg"
          etiqueta="Filtrar por estado"
          icono="i-lucide-circle-check"
          ancho="w-44 2xl:w-52"
        />

        <!--
          Limpiar vive con los filtros, no debajo del contador, donde era
          un enlace diminuto que se perdía.

          Está siempre, deshabilitado cuando no hay nada que quitar, en
          vez de aparecer y desaparecer: en una tableta, un botón que
          brota mueve de sitio a los de al lado justo cuando el dedo va
          bajando. `ms-auto` lo manda al extremo porque quitar no es un
          filtro más, es deshacerlos todos.
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

        <!--
          El total, al otro extremo de la fila de filtros.

          `ms-auto` lo empuja a la derecha y deja un hueco en medio: a un
          lado lo que acota la lista, al otro lo que esa lista suma. Sin
          el rótulo, una cifra suelta entre controles parecería otro
          filtro más.
        -->
        <div class="ms-auto tarjeta h-9 px-3 flex items-center gap-2">
          <span class="text-sm text-apagado">Cobrado:</span>
          <MontoDinero
            :valor="totalCobrado"
            tamano="normal"
          />
        </div>
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="5"
    />

    <SinResultados
      v-else-if="visibles.length === 0"
      icono="i-lucide-receipt"
      :titulo="filtrada ? 'Ninguna venta coincide' : 'Todavía no hay ventas'"
      :descripcion="filtrada
        ? 'Prueba con otro rango de fechas o quita los filtros.'
        : 'Las ventas aparecen aquí en cuanto se cobran.'"
    >
      <template #accion>
        <UButton
          v-if="filtrada"
          variant="outline"
          color="neutral"
          @click="limpiarFiltros"
        >
          Quitar filtros
        </UButton>
        <UButton
          v-else
          to="/venta"
          icon="i-lucide-shopping-cart"
        >
          Ir a vender
        </UButton>
      </template>
    </SinResultados>

    <!--
      Tabla, no tarjetas.

      Una venta es un renglón de datos —folio, hora, quién, cuánto— y lo
      que se hace aquí es recorrerlos comparando: buscar el folio, ver
      cuál falta, cuál se canceló. En columnas alineadas eso se hace con
      la vista; en tarjetas hay que leer cada una entera.

      Sigue siendo una fila por venta y se abre al tocarla: el detalle
      —líneas, pagos, reimprimir, cancelar— vive en el modal.
    -->
    <div
      v-else
      class="tarjeta overflow-hidden md:flex-1 md:min-h-0"
    >
      <!--
        La tabla hace scroll dentro de su caja, no hacia abajo.

        Con un mes de ventas la página crecía hasta donde hiciera falta y
        el total y los filtros quedaban kilómetros arriba: para cambiar el
        rango había que volver al principio. Acotada, los controles se
        quedan a la vista y lo que se mueve es la lista.

        El alto es relativo a la pantalla y no fijo en píxeles: en el
        monitor del mostrador caben el doble de renglones que en una
        tableta, y desperdiciarlos sería peor que no acotar.
      -->
      <div class="overflow-auto max-h-[60vh] md:max-h-none md:h-full">
        <table class="w-full text-sm">
          <!--
            El encabezado se queda pegado arriba al desplazar. Sin esto,
            a treinta renglones ya nadie sabe qué columna es cuál. El
            borde y el fondo van en las celdas y no en la fila: una fila
            pegajosa no arrastra su propio borde.
          -->
          <thead class="sticky top-0 z-10">
            <!--
              Los bordes verticales van en las celdas, con la última sin
              él. Puestos por columna se romperían al esconder «Cajero»
              en pantalla angosta: sobraría una raya al final.
            -->
            <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Folio
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Cuándo
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Cliente
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                Cajero
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Estado
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="v in visibles"
              :key="v.id"
              tabindex="0"
              role="button"
              :aria-label="`Abrir la venta #${v.folio}`"
              class="border-b border-borde-suave last:border-0 cursor-pointer transition
                     [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0
                     hover:bg-hundido active:bg-lienzo
                     focus-visible:outline-2 focus-visible:-outline-offset-2
                     focus-visible:outline-naranja-500"
              :class="v.estado === 'cancelled' ? 'text-apagado-2' : ''"
              @click="abrir(v)"
              @keydown.enter.prevent="abrir(v)"
              @keydown.space.prevent="abrir(v)"
            >
              <td class="px-3 lg:px-4 py-4 text-center font-semibold tabular-nums whitespace-nowrap">
                #{{ v.folio }}
              </td>

              <!-- `whitespace-nowrap`: «10:01 p.m.» partido en dos renglones
                   descuadraba el alto de toda la fila. -->
              <td class="px-3 lg:px-4 py-4 text-center tabular-nums text-apagado whitespace-nowrap">
                <span
                  v-if="dia(v.cobrado_en)"
                  class="block text-xs text-apagado-2"
                >{{ dia(v.cobrado_en) }}</span>
                {{ hora(v.cobrado_en) }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-1/3 max-w-0 truncate">
                <span v-if="v.cliente">{{ v.cliente }}</span>
                <span
                  v-else
                  class="text-apagado-2"
                >Sin nombre</span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center text-apagado w-1/4 max-w-0 truncate hidden lg:table-cell">
                {{ v.cajero }}
              </td>

              <!--
                El estado tiene columna propia.

                Colgado del nombre del cliente había que buscarlo renglón
                por renglón; en su columna, las canceladas se ven de un
                vistazo recorriendo una sola línea vertical.
              -->
              <td class="px-3 lg:px-4 py-4 text-center whitespace-nowrap">
                <UBadge
                  v-if="v.estado === 'cancelled'"
                  color="error"
                  variant="subtle"
                  size="md"
                >
                  Cancelada
                </UBadge>
                <UBadge
                  v-else
                  color="neutral"
                  variant="subtle"
                  size="md"
                >
                  Cobrada
                </UBadge>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center tabular-nums font-medium whitespace-nowrap">
                <span :class="v.estado === 'cancelled' ? 'line-through' : ''">
                  {{ v.total.formatted }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!--
      Las páginas, fuera de la caja que se desplaza: dentro habría que
      bajar hasta el final de cien renglones para encontrarlas.

      Sólo salen si hay más de una. Una lista de cuatro ventas con un
      «1 de 1» debajo es ruido.
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

    <VentaDetalleModal
      v-if="seleccionada"
      :venta="seleccionada"
      :cancelando="cancelando"
      :error-cancelacion="errorCancelacion"
      @cancelar="alCancelar"
      @cerrar="seleccionada = null"
    />
  </div>
</template>
