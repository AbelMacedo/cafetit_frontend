<script setup lang="ts">
import SelectorCategoria from '~/features/catalog/components/SelectorCategoria.vue'
import { useCatalog } from '~/features/catalog/composables/useCatalog'

definePageMeta({ middleware: 'auth' })

const {
  categorias, productosVisibles, categoriaActiva, busqueda, cargando, error, cargar
} = useCatalog()

onMounted(cargar)

/** Precio de la variante por omisión, o el menor si no hay default. */
function precioDesde(variantes: { price: { cents: number, formatted: string }, is_default: boolean }[] = []) {
  if (variantes.length === 0) return null

  const predeterminada = variantes.find(v => v.is_default)
  if (predeterminada) return predeterminada.price

  return variantes.reduce((min, v) => (v.price.cents < min.price.cents ? v : min), variantes[0]!).price
}

const filtrada = computed(() => busqueda.value !== '' || categoriaActiva.value !== null)

function limpiarFiltros() {
  busqueda.value = ''
  categoriaActiva.value = null
}
</script>

<template>
  <div class="space-y-6">
    <PaginaTitulo
      titulo="Catálogo"
      descripcion="Lo que hay a la venta. Para cobrar, ve a Vender."
    >
      <template #acciones>
        <UButton
          to="/venta"
          icon="i-lucide-shopping-cart"
          class="toque"
        >
          Vender
        </UButton>
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <BarraFiltros
      :filtrada="filtrada"
      @limpiar="limpiarFiltros"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Buscar producto..."
          icon="i-lucide-search"
          class="w-64"
        />
      </template>

      <template #filtros>
        <SelectorCategoria
          v-model="categoriaActiva"
          :categorias="categorias"
        />
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="4"
      alto="h-40"
    />

    <SinResultados
      v-else-if="productosVisibles.length === 0"
      icono="i-lucide-coffee"
      :titulo="filtrada ? 'Ningún producto coincide' : 'Todavía no hay productos'"
      :descripcion="filtrada
        ? 'Prueba con otro nombre o quita el filtro de categoría.'
        : 'Da de alta el primero desde Productos.'"
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
          to="/productos"
          icon="i-lucide-plus"
        >
          Ir a Productos
        </UButton>
      </template>
    </SinResultados>

    <div
      v-else
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
    >
      <UCard
        v-for="p in productosVisibles"
        :key="p.id"
      >
        <div class="space-y-2">
          <!-- Aquí va la foto del producto (products.image_path, en R2) -->
          <ImagenPendiente
            v-if="!p.image_url"
            descripcion="Foto del producto"
            ratio="4/3"
          />
          <img
            v-else
            :src="p.image_url"
            :alt="p.name"
            class="aspect-[4/3] w-full rounded-lg object-cover"
          >

          <p class="font-medium leading-tight">
            {{ p.name }}
          </p>
          <p class="text-xs text-beige-600">
            {{ p.category?.name }}
          </p>

          <MontoDinero
            :valor="precioDesde(p.variants)"
            class="text-lg font-semibold text-cafe-800 dark:text-beige-100 block"
          />

          <p
            v-if="(p.variants?.length ?? 0) > 1"
            class="text-xs text-beige-600"
          >
            {{ p.variants?.length }} variantes
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
