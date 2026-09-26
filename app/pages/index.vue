<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import { useCatalog } from '~/features/catalog/composables/useCatalog'

definePageMeta({ middleware: 'auth', layout: false })

const auth = useAuthStore()
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
</script>

<template>
  <div class="min-h-screen bg-beige-50 dark:bg-beige-950">
    <header class="border-b border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900">
      <div class="px-4 h-14 flex items-center justify-between gap-4">
        <div class="flex items-baseline gap-3">
          <span class="font-semibold">Cafetit</span>
          <span class="text-sm text-beige-600">{{ auth.sucursal?.name }}</span>
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

    <main class="p-4 space-y-4">
      <div class="flex flex-wrap gap-2 items-center">
        <UInput
          v-model="busqueda"
          placeholder="Buscar producto..."
          icon="i-lucide-search"
          class="w-64"
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

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
      />

      <div
        v-if="cargando"
        class="text-sm text-beige-600"
      >
        Cargando catálogo...
      </div>

      <div
        v-else
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
      >
        <UCard
          v-for="p in productosVisibles"
          :key="p.id"
          class="cursor-pointer hover:ring-2 hover:ring-primary-500 transition"
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
            <p class="text-lg font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
              {{ precioDesde(p.variants)?.formatted ?? '—' }}
            </p>
            <p
              v-if="(p.variants?.length ?? 0) > 1"
              class="text-xs text-beige-600"
            >
              {{ p.variants?.length }} variantes
            </p>
          </div>
        </UCard>
      </div>

      <p
        v-if="!cargando && productosVisibles.length === 0"
        class="text-sm text-beige-600"
      >
        No hay productos que coincidan.
      </p>
    </main>
  </div>
</template>
