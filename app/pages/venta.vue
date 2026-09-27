<script setup lang="ts">
import { useCashSessionStore } from '~/features/cash/stores/cashSession'
import { useCatalog } from '~/features/catalog/composables/useCatalog'
import SelectorCategoria from '~/features/catalog/components/SelectorCategoria.vue'
import TarjetaProducto from '~/features/catalog/components/TarjetaProducto.vue'
import CobroModal from '~/features/sales/components/CobroModal.vue'
import DescuentoModal from '~/features/sales/components/DescuentoModal.vue'
import { useAtajosVenta } from '~/features/sales/composables/useAtajosVenta'
import { type LineaCarrito, type TipoDescuento, useCartStore } from '~/features/sales/stores/cart'
import { useTicketPrinter } from '~/features/tickets/composables/useTicketPrinter'
import { ApiError, useApi } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'
import type { ApiResource, Product, ProductVariant, Venta } from '~/shared/types/api'

// La pantalla de venta es una superficie de trabajo a pantalla completa:
// rejilla de productos y carrito pegado al borde, sin relleno del armazón.
definePageMeta({ middleware: 'auth', anchoCompleto: true })

const api = useApi()
const toast = useToast()
const carrito = useCartStore()
const caja = useCashSessionStore()
const { categorias, productosVisibles, categoriaActiva, busqueda, cargar: cargarCatalogo } = useCatalog()

const mostrarCobro = ref(false)
const cobrando = ref(false)
const errorCobro = ref<string | null>(null)
const ultimoTicket = ref<{ id: number, folio: number, total: string, cambio: string | null } | null>(null)

/** Producto con varias variantes: hay que elegir cuál antes de agregar. */
const eligiendo = ref<Product | null>(null)

const buscador = ref<{ inputRef?: HTMLInputElement } | null>(null)

const { imprimir, imprimiendo } = useTicketPrinter()

onMounted(async () => {
  await Promise.all([caja.cargar(), cargarCatalogo()])
})

/*
 * Teclado
 */

const variantesElegibles = computed(() =>
  (eligiendo.value?.variants ?? []).filter(v => v.is_active)
)

/** Los atajos duermen mientras hay un diálogo encima. */
const atajosActivos = computed(() =>
  caja.hayTurnoAbierto && !mostrarCobro.value && ultimoTicket.value === null && descontando.value === null
)

function enfocarBuscador() {
  buscador.value?.inputRef?.focus()
}

useAtajosVenta({
  alEscribir: enfocarBuscador,

  alConfirmar: () => {
    if (eligiendo.value !== null) return
    if (carrito.vacio) return

    mostrarCobro.value = true
  },

  alCobrar: () => {
    if (carrito.vacio) return

    eligiendo.value = null
    mostrarCobro.value = true
  },

  alCancelar: () => {
    if (eligiendo.value !== null) {
      eligiendo.value = null
      return
    }

    if (busqueda.value !== '') {
      busqueda.value = ''
      return
    }
  },

  alElegirNumero: (n) => {
    // Con el selector abierto, el número elige variante; si no, no hace
    // nada: inventarle otro significado sería un atajo que sorprende.
    const v = variantesElegibles.value[n - 1]

    if (eligiendo.value !== null && v) {
      elegirVariante(eligiendo.value, v)
    }
  }
}, atajosActivos)

/*
 * Descuentos
 *
 * Los dos niveles —línea y venta— pasan por el mismo diálogo. Cuál se
 * está editando lo dice `descontando`: la línea, o `'venta'`.
 */
const descontando = ref<LineaCarrito | 'venta' | null>(null)

const lineaEnDescuento = computed(() =>
  descontando.value !== null && descontando.value !== 'venta' ? descontando.value : null
)

/** Lo que el diálogo necesita saber, según sobre qué se aplique. */
const contextoDescuento = computed(() => {
  const l = lineaEnDescuento.value

  if (l !== null) {
    return {
      concepto: l.variante.name ? `${l.productoNombre} · ${l.variante.name}` : l.productoNombre,
      base: carrito.subtotalLinea(l),
      tipo: l.descuentoTipo,
      valor: l.descuentoValor,
      motivo: l.descuentoMotivo ?? ''
    }
  }

  return {
    concepto: null,
    base: carrito.subtotal,
    tipo: carrito.descuentoTipo,
    valor: carrito.descuentoValor,
    motivo: carrito.descuentoMotivo
  }
})

/** Avisa que el de venta se suma sobre líneas ya rebajadas. */
const hayDescuentosDeLinea = computed(() =>
  carrito.lineas.some(l => carrito.descuentoLinea(l) > 0)
)

function descontarLinea(l: LineaCarrito) {
  descontando.value = l
}

function descontarVenta() {
  if (carrito.vacio) return

  descontando.value = 'venta'
}

function aplicarDescuento(tipo: TipoDescuento, valor: number, motivo: string) {
  const l = lineaEnDescuento.value

  if (l !== null) {
    carrito.aplicarDescuentoLinea(l.uid, tipo, valor, motivo || undefined)
  } else {
    carrito.descuentoTipo = tipo
    carrito.descuentoValor = valor
    carrito.descuentoMotivo = motivo
  }

  descontando.value = null
}

function quitarDescuento() {
  const l = lineaEnDescuento.value

  if (l !== null) {
    carrito.aplicarDescuentoLinea(l.uid, 'none', 0, undefined)
  } else {
    carrito.descuentoTipo = 'none'
    carrito.descuentoValor = 0
    carrito.descuentoMotivo = ''
  }

  descontando.value = null
}

/**
 * Enter en el buscador.
 *
 * Con un solo resultado, lo agrega: es el caso que hace que teclear sea
 * más rápido que apuntar. Con varios no adivina —agregar el producto
 * equivocado se descubre hasta el corte— y deja que se elija.
 */
function alEnterEnBuscador() {
  if (productosVisibles.value.length === 1 && productosVisibles.value[0]) {
    tocarProducto(productosVisibles.value[0])
    busqueda.value = ''
    return
  }

  if (productosVisibles.value.length === 0 && !carrito.vacio) {
    mostrarCobro.value = true
  }
}

/*
 * Carrito
 */

function tocarProducto(p: Product) {
  const activas = (p.variants ?? []).filter(v => v.is_active)

  if (activas.length === 1 && activas[0]) {
    carrito.agregar(p, activas[0])
    return
  }

  eligiendo.value = p
}

function elegirVariante(p: Product, v: ProductVariant) {
  carrito.agregar(p, v)
  eligiendo.value = null
  busqueda.value = ''
  enfocarBuscador()
}

async function cobrar(pagos: Array<Record<string, unknown>>) {
  cobrando.value = true
  errorCobro.value = null

  try {
    const r = await api.post<ApiResource<Venta>>('/sales', carrito.aPeticion(pagos))

    const pagoEfectivo = r.data.pagos?.find(p => p.metodo === 'cash')

    ultimoTicket.value = {
      id: r.data.id,
      folio: r.data.folio,
      total: r.data.total.formatted,
      cambio: pagoEfectivo?.cambio?.formatted ?? null
    }

    carrito.limpiar()
    mostrarCobro.value = false
    await caja.cargar()
  } catch (e) {
    errorCobro.value = e instanceof ApiError ? e.message : 'No se pudo cobrar.'
  } finally {
    cobrando.value = false
  }
}

async function imprimirUltimo() {
  if (!ultimoTicket.value) return

  try {
    await imprimir('venta', ultimoTicket.value.id)
  } catch {
    // La venta ya quedó registrada: no hay nada que deshacer y el ticket
    // se puede reimprimir desde el historial.
    toast.add({
      title: 'No se pudo imprimir',
      description: 'La venta quedó registrada. Se puede reimprimir desde Ventas.',
      color: 'warning',
      icon: 'i-lucide-printer'
    })
  }
}

function siguienteVenta() {
  ultimoTicket.value = null
  nextTick(enfocarBuscador)
}
</script>

<template>
  <div class="h-full flex min-h-0">
    <!-- Sin turno abierto no se puede cobrar: se dice de entrada, no al final -->
    <div
      v-if="caja.consultado && !caja.hayTurnoAbierto"
      class="flex-1 flex items-center justify-center p-6"
    >
      <UCard class="max-w-md text-center">
        <div class="space-y-3">
          <UIcon
            name="i-lucide-lock"
            class="size-8 text-beige-500"
          />
          <h2 class="text-lg font-semibold">
            La caja está cerrada
          </h2>
          <p class="text-sm text-beige-600">
            No se puede cobrar sin un turno abierto. Abre la caja declarando
            con cuánto empiezas.
          </p>
          <UButton
            to="/caja"
            block
            size="lg"
            class="toque"
          >
            Abrir caja
          </UButton>
        </div>
      </UCard>
    </div>

    <template v-else>
      <!-- Catálogo -->
      <section class="flex-1 flex flex-col min-w-0 p-4 gap-3">
        <div class="flex flex-wrap gap-2 items-center shrink-0">
          <UInput
            ref="buscador"
            v-model="busqueda"
            placeholder="Buscar producto..."
            icon="i-lucide-search"
            class="w-64"
            autofocus
            @keydown.enter.prevent="alEnterEnBuscador"
          />

          <SelectorCategoria
            v-model="categoriaActiva"
            :categorias="categorias"
          />
        </div>

        <SinResultados
          v-if="productosVisibles.length === 0"
          icono="i-lucide-search-x"
          titulo="Ningún producto coincide"
          :descripcion="`No hay nada que se llame «${busqueda}».`"
        >
          <template #accion>
            <UButton
              variant="outline"
              color="neutral"
              @click="busqueda = ''; enfocarBuscador()"
            >
              Limpiar búsqueda
            </UButton>
          </template>
        </SinResultados>

        <!--
          Cuadrícula de 210 px mínimo, no de 150.

          Se opera de pie y a distancia de brazo (DESIGN.md §2): con
          tarjetas de teléfono el nombre queda en letra chica y el dedo
          falla al vecino. Menos columnas y más grandes es más rápido.

          El `pt-2` con `-mt-2` no es un capricho de separación: al pasar
          el cursor la tarjeta se alza dos píxeles y proyecta sombra, y
          este contenedor recorta lo que se sale de él. Sin ese margen, la
          tarjeta de la primera fila se cortaba por arriba contra la barra
          de filtros. El margen negativo devuelve el espacio, así que el
          hueco se ve igual que antes.
        -->
        <div
          v-else
          class="flex-1 overflow-y-auto grid gap-3 content-start auto-rows-min pt-2 -mt-2 px-1 -mx-1"
          style="grid-template-columns: repeat(auto-fill, minmax(210px, 1fr))"
        >
          <TarjetaProducto
            v-for="p in productosVisibles"
            :key="p.id"
            :producto="p"
            @click="tocarProducto(p)"
          />
        </div>

        <!--
          Los atajos se muestran.

          Uno que nadie conoce no existe; y quien lo aprende deja de
          mirar esta línea sin que estorbe.
        -->
        <p class="shrink-0 text-xs text-beige-500 flex flex-wrap gap-x-4 gap-y-1">
          <span><kbd class="font-sans font-medium">Escribe</kbd> para buscar</span>
          <span><kbd class="font-sans font-medium">Enter</kbd> agrega el único resultado</span>
          <span><kbd class="font-sans font-medium">F2</kbd> cobrar</span>
          <span><kbd class="font-sans font-medium">Esc</kbd> limpiar</span>
        </p>
      </section>

      <!-- Carrito -->
      <aside class="w-96 shrink-0 border-l border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900 flex flex-col">
        <div class="p-4 border-b border-beige-200 dark:border-beige-800">
          <UInput
            v-model="carrito.cliente"
            placeholder="Nombre del cliente (opcional)"
            class="w-full"
          />
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <SinResultados
            v-if="carrito.vacio"
            variante="suelto"
            icono="i-lucide-shopping-cart"
            titulo="Carrito vacío"
            descripcion="Escribe para buscar, o toca un producto."
          />

          <div
            v-for="l in carrito.lineas"
            :key="l.uid"
            class="rounded-lg border border-beige-200 dark:border-beige-800 p-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-medium leading-tight">
                  {{ l.productoNombre }}
                </p>
                <p
                  v-if="l.variante.name"
                  class="text-xs text-beige-600"
                >
                  {{ l.variante.name }}
                </p>
              </div>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                :aria-label="`Quitar ${l.productoNombre}`"
                @click="carrito.quitar(l.uid)"
              />
            </div>

            <div class="mt-2 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1">
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-minus"
                  :aria-label="`Quitar una unidad de ${l.productoNombre}`"
                  @click="carrito.cambiarCantidad(l.uid, -1)"
                />
                <span class="w-8 text-center text-sm tabular-nums">{{ l.cantidad }}</span>
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-plus"
                  :aria-label="`Agregar una unidad de ${l.productoNombre}`"
                  @click="carrito.cambiarCantidad(l.uid, 1)"
                />

                <UButton
                  size="xs"
                  variant="ghost"
                  :color="l.descuentoTipo === 'none' ? 'neutral' : 'primary'"
                  icon="i-lucide-percent"
                  class="ml-1"
                  :aria-label="`Descuento en ${l.productoNombre}`"
                  @click="descontarLinea(l)"
                />
              </div>

              <span class="text-right">
                <!-- Tachado el original: se ve qué se rebajó, no sólo el resultado -->
                <span
                  v-if="carrito.descuentoLinea(l) > 0"
                  class="block text-xs text-beige-500 line-through tabular-nums leading-none"
                >
                  {{ formatearCentavos(carrito.subtotalLinea(l)) }}
                </span>
                <MontoDinero :valor="carrito.totalLinea(l)" />
              </span>
            </div>

            <p
              v-if="carrito.descuentoLinea(l) > 0"
              class="mt-1 text-xs text-naranja-600 flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-percent"
                class="size-3"
              />
              {{ l.descuentoTipo === 'percent'
                ? `${l.descuentoValor / 100}% de descuento`
                : `${formatearCentavos(l.descuentoValor)} de descuento` }}
              <span
                v-if="l.descuentoMotivo"
                class="text-beige-600"
              >· {{ l.descuentoMotivo }}</span>
            </p>
          </div>
        </div>

        <div class="shrink-0 border-t border-beige-200 dark:border-beige-800 p-4 space-y-3">
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-beige-600">
              {{ carrito.piezas }} {{ carrito.piezas === 1 ? 'pieza' : 'piezas' }}
            </span>
            <MontoDinero
              :valor="carrito.subtotal"
              tamano="chico"
              class="text-beige-600"
            />
          </div>

          <!-- Descuento a toda la venta -->
          <div
            v-if="carrito.descuentoVenta > 0"
            class="flex items-baseline justify-between text-sm"
          >
            <span class="text-naranja-600 flex items-center gap-1 min-w-0">
              <UIcon
                name="i-lucide-percent"
                class="size-3.5 shrink-0"
              />
              <span class="truncate">
                {{ carrito.descuentoTipo === 'percent'
                  ? `${carrito.descuentoValor / 100}% de descuento`
                  : 'Descuento' }}
                <span
                  v-if="carrito.descuentoMotivo"
                  class="text-beige-600"
                >· {{ carrito.descuentoMotivo }}</span>
              </span>
            </span>
            <MontoDinero
              :valor="carrito.descuentoVenta"
              signo="menos"
              tamano="chico"
              class="text-naranja-600"
            />
          </div>

          <div class="flex items-baseline justify-between">
            <span class="text-lg font-medium">Total</span>
            <MontoDinero
              :valor="carrito.total"
              tamano="grande"
            />
          </div>

          <div class="flex gap-2">
            <UButton
              size="xl"
              variant="outline"
              color="neutral"
              class="toque"
              icon="i-lucide-percent"
              :disabled="carrito.vacio"
              :aria-label="'Descuento a toda la venta'"
              @click="descontarVenta()"
            />

            <UButton
              block
              size="xl"
              class="toque flex-1"
              :disabled="carrito.vacio"
              trailing-icon="i-lucide-corner-down-left"
              @click="mostrarCobro = true"
            >
              Cobrar
            </UButton>
          </div>
        </div>
      </aside>
    </template>

    <!-- Elegir variante: numerada, para poder elegirla con el teclado -->
    <UModal
      :open="eligiendo !== null"
      :title="eligiendo?.name ?? ''"
      description="Elige la presentación"
      @update:open="eligiendo = null"
    >
      <template #body>
        <div class="grid gap-2">
          <UButton
            v-for="(v, i) in variantesElegibles"
            :key="v.id"
            block
            size="lg"
            variant="outline"
            color="neutral"
            class="toque justify-between"
            @click="eligiendo && elegirVariante(eligiendo, v)"
          >
            <span class="flex items-center gap-2">
              <kbd
                v-if="i < 9"
                class="font-sans text-xs text-beige-500 border border-beige-300 dark:border-beige-700 rounded px-1"
              >{{ i + 1 }}</kbd>
              {{ v.name ?? 'Único' }}
            </span>
            <MontoDinero :valor="v.price" />
          </UButton>
        </div>
      </template>
    </UModal>

    <DescuentoModal
      v-if="descontando !== null"
      :concepto="contextoDescuento.concepto"
      :base="contextoDescuento.base"
      :tipo="contextoDescuento.tipo"
      :valor="contextoDescuento.valor"
      :motivo="contextoDescuento.motivo"
      :avisar-acumulacion="hayDescuentosDeLinea"
      @aplicar="aplicarDescuento"
      @quitar="quitarDescuento"
      @cerrar="descontando = null"
    />

    <CobroModal
      v-if="mostrarCobro"
      :total="carrito.total"
      :cobrando="cobrando"
      :error="errorCobro"
      @cobrar="cobrar"
      @cerrar="mostrarCobro = false"
    />

    <!--
      Confirmación del cobro.

      El cambio va en grande y solo: es el número que el cajero tiene que
      leer de un vistazo mientras cuenta billetes con la otra mano.
    -->
    <UModal
      :open="ultimoTicket !== null"
      title="Venta cobrada"
      @update:open="siguienteVenta"
    >
      <template #body>
        <div class="text-center space-y-3 py-2">
          <UIcon
            name="i-lucide-circle-check"
            class="size-10 text-success-500"
          />
          <p class="text-sm text-beige-600">
            Venta #{{ ultimoTicket?.folio }} · {{ ultimoTicket?.total }}
          </p>
          <div v-if="ultimoTicket?.cambio && ultimoTicket.cambio !== '$0.00'">
            <p class="text-sm text-beige-600">
              Cambio
            </p>
            <p class="text-5xl font-semibold tabular-nums text-primary-600">
              {{ ultimoTicket.cambio }}
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            block
            size="lg"
            variant="outline"
            color="neutral"
            class="toque"
            icon="i-lucide-printer"
            :loading="imprimiendo"
            @click="imprimirUltimo"
          >
            Imprimir
          </UButton>
          <UButton
            block
            size="lg"
            class="toque"
            @click="siguienteVenta"
          >
            Siguiente venta
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
