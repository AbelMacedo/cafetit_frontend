<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import { useCashSession } from '~/features/cash/composables/useCashSession'
import { useCatalog } from '~/features/catalog/composables/useCatalog'
import { useCartStore } from '~/features/sales/stores/cart'
import CobroModal from '~/features/sales/components/CobroModal.vue'
import { ApiError, useApi } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'
import type { ApiResource, Product, ProductVariant, Venta } from '~/shared/types/api'

definePageMeta({ middleware: 'auth', layout: false })

const auth = useAuthStore()
const api = useApi()
const carrito = useCartStore()
const { turno, hayTurnoAbierto, cargando: cargandoTurno, cargar: cargarTurno } = useCashSession()
const { categorias, productosVisibles, categoriaActiva, busqueda, cargar: cargarCatalogo } = useCatalog()

const mostrarCobro = ref(false)
const cobrando = ref(false)
const errorCobro = ref<string | null>(null)
const ultimoTicket = ref<{ folio: number, total: string, cambio: string | null } | null>(null)

/** Producto con varias variantes: hay que elegir cuál antes de agregar. */
const eligiendo = ref<Product | null>(null)

onMounted(async () => {
  await Promise.all([cargarTurno(), cargarCatalogo()])
})

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
}

async function cobrar(pagos: Array<Record<string, unknown>>) {
  cobrando.value = true
  errorCobro.value = null

  try {
    const r = await api.post<ApiResource<Venta>>('/sales', carrito.aPeticion(pagos))

    const pagoEfectivo = r.data.pagos?.find(p => p.metodo === 'cash')

    ultimoTicket.value = {
      folio: r.data.folio,
      total: r.data.total.formatted,
      cambio: pagoEfectivo?.cambio?.formatted ?? null
    }

    carrito.limpiar()
    mostrarCobro.value = false
    await cargarTurno()
  } catch (e) {
    errorCobro.value = e instanceof ApiError ? e.message : 'No se pudo cobrar.'
  } finally {
    cobrando.value = false
  }
}
</script>

<template>
  <div class="h-screen flex flex-col bg-beige-50 dark:bg-beige-950">
    <header class="shrink-0 border-b border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900">
      <div class="px-4 h-14 flex items-center justify-between gap-4">
        <div class="flex items-baseline gap-3">
          <NuxtLink
            to="/"
            class="font-semibold text-cafe-800 dark:text-beige-100"
          >
            Cafetit
          </NuxtLink>
          <span
            v-if="turno"
            class="text-sm text-beige-600"
          >
            Turno #{{ turno.turno.folio }} · {{ turno.turno.etiqueta }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-sm text-beige-600">{{ auth.user?.name }}</span>
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            @click="auth.logout()"
          >
            Salir
          </UButton>
        </div>
      </div>
    </header>

    <!-- Sin turno abierto no se puede cobrar: se dice de entrada, no al final -->
    <div
      v-if="!cargandoTurno && !hayTurnoAbierto"
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

    <div
      v-else
      class="flex-1 flex min-h-0"
    >
      <!-- Catálogo -->
      <section class="flex-1 flex flex-col min-w-0 p-4 gap-3">
        <div class="flex flex-wrap gap-2 items-center shrink-0">
          <UInput
            v-model="busqueda"
            placeholder="Buscar producto..."
            icon="i-lucide-search"
            class="w-56"
            autofocus
          />
          <UButton
            size="sm"
            :variant="categoriaActiva === null ? 'solid' : 'outline'"
            color="neutral"
            @click="categoriaActiva = null"
          >
            Todo
          </UButton>
          <UButton
            v-for="c in categorias"
            :key="c.id"
            size="sm"
            :variant="categoriaActiva === c.id ? 'solid' : 'outline'"
            color="neutral"
            @click="categoriaActiva = c.id"
          >
            {{ c.name }}
          </UButton>
        </div>

        <div
          class="flex-1 overflow-y-auto grid gap-3 content-start"
          style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))"
        >
          <button
            v-for="p in productosVisibles"
            :key="p.id"
            type="button"
            class="toque text-left rounded-lg border border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900 p-3 space-y-2 hover:border-primary-500 hover:ring-2 hover:ring-primary-500/40 transition"
            @click="tocarProducto(p)"
          >
            <ImagenPendiente
              descripcion="Foto del producto"
              ratio="4/3"
            />
            <p class="font-medium text-sm leading-tight">
              {{ p.name }}
            </p>
            <p class="text-base font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
              {{ p.variants?.[0]?.price.formatted ?? '—' }}
            </p>
            <p
              v-if="(p.variants?.length ?? 0) > 1"
              class="text-[11px] text-beige-600"
            >
              {{ p.variants?.length }} opciones
            </p>
          </button>
        </div>
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
          <p
            v-if="carrito.vacio"
            class="text-sm text-beige-500 text-center py-12"
          >
            Toca un producto para empezar
          </p>

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
                  @click="carrito.cambiarCantidad(l.uid, -1)"
                />
                <span class="w-8 text-center text-sm tabular-nums">{{ l.cantidad }}</span>
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-plus"
                  @click="carrito.cambiarCantidad(l.uid, 1)"
                />
              </div>

              <span class="text-sm font-semibold tabular-nums">
                {{ formatearCentavos(carrito.totalLinea(l)) }}
              </span>
            </div>
          </div>
        </div>

        <div class="shrink-0 border-t border-beige-200 dark:border-beige-800 p-4 space-y-3">
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-beige-600">{{ carrito.piezas }} piezas</span>
            <span class="text-sm tabular-nums text-beige-600">
              {{ formatearCentavos(carrito.subtotal) }}
            </span>
          </div>

          <div class="flex items-baseline justify-between">
            <span class="text-lg font-medium">Total</span>
            <span class="text-3xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
              {{ formatearCentavos(carrito.total) }}
            </span>
          </div>

          <UButton
            block
            size="xl"
            class="toque"
            :disabled="carrito.vacio"
            @click="mostrarCobro = true"
          >
            Cobrar
          </UButton>
        </div>
      </aside>
    </div>

    <!-- Elegir variante -->
    <UModal
      :open="eligiendo !== null"
      :title="eligiendo?.name ?? ''"
      @update:open="eligiendo = null"
    >
      <template #body>
        <div class="grid gap-2">
          <UButton
            v-for="v in (eligiendo?.variants ?? []).filter(x => x.is_active)"
            :key="v.id"
            block
            size="lg"
            variant="outline"
            color="neutral"
            class="toque justify-between"
            @click="eligiendo && elegirVariante(eligiendo, v)"
          >
            <span>{{ v.name ?? 'Único' }}</span>
            <span class="tabular-nums font-semibold">{{ v.price.formatted }}</span>
          </UButton>
        </div>
      </template>
    </UModal>

    <CobroModal
      v-if="mostrarCobro"
      :total="carrito.total"
      :cobrando="cobrando"
      :error="errorCobro"
      @cobrar="cobrar"
      @cerrar="mostrarCobro = false"
    />

    <!-- Confirmación del cobro: el cambio en grande, que es lo que el
         cajero necesita leer de un vistazo -->
    <UModal
      :open="ultimoTicket !== null"
      title="Venta cobrada"
      @update:open="ultimoTicket = null"
    >
      <template #body>
        <div class="text-center space-y-3 py-2">
          <UIcon
            name="i-lucide-check-circle"
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
        <UButton
          block
          size="lg"
          class="toque"
          @click="ultimoTicket = null"
        >
          Siguiente venta
        </UButton>
      </template>
    </UModal>
  </div>
</template>
