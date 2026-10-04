<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import { useCashSessionStore } from '~/features/cash/stores/cashSession'
import CambiarCajeroModal from '~/features/auth/components/CambiarCajeroModal.vue'
import CampanaAvisos from '~/features/notifications/components/CampanaAvisos.vue'

/**
 * Armazón del POS.
 *
 * Barra lateral oscura en café sobre superficie clara. No es decoración:
 * un menú permanente fija la orientación —siempre se sabe dónde se está y
 * qué más hay— y el contraste separa de un vistazo el sistema (la barra)
 * del contenido (lo blanco). Una barra superior con todo apretado en una
 * fila obligaba a leerla entera cada vez.
 *
 * **La navegación va agrupada.** Vender y Caja se usan cien veces al día,
 * de pie y con prisa; lo demás se abre una vez por turno, sentado. Los
 * grupos con su rótulo dicen a qué mundo pertenece cada cosa sin tener
 * que probarlas.
 *
 * En la pantalla de venta la barra se encoge a iconos: ahí el ancho es
 * para la cuadrícula de productos y el carrito, no para un menú que el
 * cajero ya se sabe.
 */
const auth = useAuthStore()
const caja = useCashSessionStore()

const ruta = useRoute()

onMounted(() => {
  void caja.cargarSiHaceFalta()
})

const cajonAbierto = ref(false)
const cambiandoCajero = ref(false)

/*
 * El tema, a mano y por aparato.
 *
 * No sigue a Windows a propósito: quien atiende el mostrador no eligió
 * el tema de esa terminal, y heredarlo haría que dos cajas del mismo
 * negocio se vieran distintas sin que nadie lo decidiera. Se elige aquí
 * y se queda guardado en ese navegador.
 */
const tema = useColorMode()
const esOscuro = computed(() => tema.value === 'dark')

function alternarTema(): void {
  tema.preference = esOscuro.value ? 'light' : 'dark'
}

const secciones = [
  {
    titulo: 'Mostrador',
    items: [
      { ruta: '/venta', etiqueta: 'Vender', icono: 'i-lucide-shopping-cart' },
      { ruta: '/caja', etiqueta: 'Caja', icono: 'i-lucide-wallet' }
    ]
  },
  {
    titulo: 'Día a día',
    items: [
      { ruta: '/ventas', etiqueta: 'Ventas', icono: 'i-lucide-receipt' },
      { ruta: '/inventario', etiqueta: 'Inventario', icono: 'i-lucide-package' },
      { ruta: '/reportes', etiqueta: 'Reportes', icono: 'i-lucide-chart-column' }
    ]
  },
  {
    titulo: 'Configuración',
    items: [
      { ruta: '/', etiqueta: 'Catálogo', icono: 'i-lucide-coffee' },
      { ruta: '/productos', etiqueta: 'Productos', icono: 'i-lucide-package-2' },
      { ruta: '/categorias', etiqueta: 'Categorías', icono: 'i-lucide-tags' },
      { ruta: '/empleados', etiqueta: 'Empleados', icono: 'i-lucide-users' },
      { ruta: '/bitacora', etiqueta: 'Bitácora', icono: 'i-lucide-scroll-text' }
    ]
  }
]

const planos = secciones.flatMap(s => s.items)

const tituloActual = computed(() =>
  planos.find(i => i.ruta === ruta.path)?.etiqueta ?? 'La Cafetit'
)

/** En venta el ancho vale más que el rótulo del menú. */
const compacta = computed(() => ruta.path === '/venta')

/** La pantalla pide el lienzo completo, sin el contenedor centrado. */
const anchoCompleto = computed(() => ruta.meta.anchoCompleto === true)

/**
 * La pantalla ocupa el alto disponible y maneja su propio desplazamiento.
 *
 * Existe por la tableta del mostrador. Con la página desplazándose por
 * fuera Y una tabla desplazándose por dentro, el dedo mueve lo que no
 * era: se intenta recorrer la lista y se va la página entera, o al
 * revés. Con esto hay **un solo sitio que se mueve**, y los filtros y
 * el total se quedan siempre a la vista.
 *
 * Sólo desde `md`. En un teléfono el alto es tan corto que encajar
 * encabezado, filtros y una caja con scroll deja una rendija de tres
 * renglones; ahí es mejor el desplazamiento de toda la página.
 */
const altoCompleto = computed(() => ruta.meta.altoCompleto === true)

const iniciales = computed(() => {
  const nombre = auth.user?.name ?? 'Usuario'

  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || 'U'
})

function esActiva(destino: string): boolean {
  return ruta.path === destino
}

watch(() => ruta.path, () => {
  cajonAbierto.value = false
})
</script>

<template>
  <div class="h-dvh flex bg-lienzo overflow-hidden">
    <!-- Fondo oscuro cuando el cajón está abierto en móvil -->
    <div
      v-if="cajonAbierto"
      class="fixed inset-0 bg-cafe-950/50 z-30 md:hidden"
      @click="cajonAbierto = false"
    />

    <aside
      class="fixed md:static top-0 left-0 h-dvh z-40 bg-hundido text-tinta
             border-r border-borde flex flex-col shrink-0 transition-all duration-200"
      :class="[
        compacta ? 'w-60 md:w-[4.5rem] xl:w-60' : 'w-60',
        cajonAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <!-- Marca -->
      <div class="h-16 flex items-center gap-3 px-4 shrink-0">
        <span
          class="size-10 rounded-xl bg-naranja-500 text-white flex items-center justify-center
                 font-bold text-lg shrink-0"
        >C</span>

        <span
          class="text-xl font-bold text-tinta truncate"
          :class="compacta ? 'md:hidden xl:block' : ''"
        >La Cafetit</span>

        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          class="md:hidden ml-auto"
          aria-label="Cerrar menú"
          @click="cajonAbierto = false"
        />
      </div>

      <nav class="flex-1 px-2.5 py-4 overflow-y-auto">
        <div
          v-for="s in secciones"
          :key="s.titulo"
          class="mb-4 last:mb-0"
        >
          <p
            class="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-apagado-2"
            :class="compacta ? 'md:hidden xl:block' : ''"
          >
            {{ s.titulo }}
          </p>

          <div class="space-y-1">
            <NuxtLink
              v-for="i in s.items"
              :key="i.ruta"
              :to="i.ruta"
              :title="i.etiqueta"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
              :class="[
                esActiva(i.ruta)
                  ? 'bg-naranja-500 text-white shadow-sm'
                  : 'text-tinta-2 hover:bg-relleno/70 hover:text-tinta',
                compacta ? 'md:justify-center md:px-0 xl:justify-start xl:px-3' : ''
              ]"
            >
              <UIcon
                :name="i.icono"
                class="size-5 shrink-0"
              />
              <span :class="compacta ? 'md:hidden xl:block' : ''">{{ i.etiqueta }}</span>
            </NuxtLink>
          </div>
        </div>
      </nav>

      <!--
        Estado del turno, al pie y siempre visible.

        Sin caja abierta no se puede cobrar. Que eso se descubra al
        intentar cobrar —con el carrito ya capturado— es el peor momento
        posible para enterarse.
      -->
      <NuxtLink
        to="/caja"
        class="mx-2.5 mb-2 rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition"
        :class="caja.hayTurnoAbierto
          ? 'bg-relleno/60 hover:bg-relleno'
          : 'bg-naranja-100 hover:bg-naranja-200'"
      >
        <span
          class="size-2 rounded-full shrink-0"
          :class="caja.hayTurnoAbierto ? 'bg-emerald-400' : 'bg-naranja-400'"
        />

        <span
          class="min-w-0 flex-1"
          :class="compacta ? 'md:hidden xl:block' : ''"
        >
          <span class="block text-xs text-apagado leading-none">
            {{ caja.consultado ? (caja.hayTurnoAbierto ? 'Caja abierta' : 'Caja cerrada') : '···' }}
          </span>
          <span
            v-if="caja.turno"
            class="block text-sm text-tinta font-medium truncate mt-0.5 capitalize"
          >
            Turno #{{ caja.turno.turno.folio }} · {{ caja.turno.turno.etiqueta }}
          </span>
        </span>
      </NuxtLink>

      <!--
        Usuario.

        Con la barra encogida se apila en vertical en lugar de esconder
        los botones. Escondiéndolos, en una tableta de 1024 px —el
        formato más probable del mostrador— la pantalla de venta se
        quedaba sin forma de cambiar de cajero ni de salir. Son iconos:
        caben de sobra en 4.5 rem, y lo único que estorbaba era el
        nombre.
      -->
      <div class="border-t border-borde p-2.5 shrink-0">
        <div
          class="flex flex-wrap items-center gap-3 px-1"
          :class="compacta ? 'md:flex-col md:gap-2 md:px-0 xl:flex-row xl:gap-3 xl:px-3' : ''"
        >
          <span
            class="size-9 rounded-full bg-cafe-500 text-white flex items-center justify-center
                   font-semibold text-sm shrink-0"
          >{{ iniciales }}</span>

          <span
            class="min-w-0 flex-1"
            :class="compacta ? 'md:hidden xl:block' : ''"
          >
            <span class="block text-sm font-medium text-tinta truncate">{{ auth.user?.name }}</span>
            <span class="block text-xs text-apagado-2 truncate">{{ auth.sucursal?.name }}</span>
          </span>

          <!--
            Los botones, en su propio renglón.

            Iban en la misma fila que el nombre y nunca cupo: «Administrador»
            pide 93 px y le quedaban 43, así que el cajero aparecía como
            «Adm...». Saber quién está cobrando es la mitad de para qué
            existe este rincón de la barra.

            En la barra encogida —la de vender— se quedan al lado, que es
            donde hay sitio: ahí el nombre ya está escondido a propósito.

            El tema va primero de los tres porque es el que menos se
            toca: se elige una vez cuando se estrena la terminal y no se
            vuelve a mirar. Poniéndolo junto a «Salir» se acabaría
            tocando por error al terminar la jornada.

            No sale en la barra encogida —la de vender—: ahí entran la
            inicial del cajero y dos botones justos, y el cuarto icono
            dejaba el nombre en «A...». Un ajuste que se toca una vez no
            vale lo que cuesta saber quién está cobrando.

            `ClientOnly` porque el tema real no se conoce hasta que el
            navegador lee lo guardado: pintarlo antes haría que el icono
            parpadeara de sol a luna al cargar.
          -->
          <span
            class="flex items-center gap-1 shrink-0"
            :class="compacta ? '' : 'basis-full justify-end'"
          >
            <ClientOnly>
              <UButton
                v-if="!compacta"
                size="sm"
                variant="ghost"
                color="neutral"
                :icon="esOscuro ? 'i-lucide-sun' : 'i-lucide-moon'"
                class="shrink-0"
                :aria-label="esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
                :title="esOscuro ? 'Tema claro' : 'Tema oscuro'"
                @click="alternarTema"
              />
            </ClientOnly>

            <!--
              Cambiar de cajero está junto a Salir y antes que él: es lo
              que se hace varias veces al día, mientras que cerrar sesión
              se hace al terminar la jornada. Si sólo estuviera «Salir»,
              el relevo pasaría por cerrar y volver a entrar con
              contraseña, y eso acaba en una cuenta compartida.
            -->
            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              icon="i-lucide-user-round-cog"
              class="shrink-0"
              aria-label="Cambiar de cajero"
              title="Cambiar de cajero"
              @click="cambiandoCajero = true"
            />

            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              icon="i-lucide-log-out"
              class="shrink-0"
              aria-label="Salir"
              title="Salir"
              @click="auth.logout()"
            />
          </span>
        </div>
      </div>
    </aside>

    <!-- Área principal -->
    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="h-16 bg-superficie border-b border-borde flex items-center justify-between
               gap-4 px-4 sm:px-6 shrink-0"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-lucide-menu"
            class="md:hidden"
            aria-label="Abrir menú"
            @click="cajonAbierto = true"
          />

          <h2 class="font-semibold text-tinta truncate">
            {{ tituloActual }}
          </h2>
        </div>

        <div class="flex items-center gap-1">
          <CampanaAvisos />
        </div>
      </header>

      <!-- Aviso de caja cerrada, sólo donde estorba no saberlo -->
      <div
        v-if="caja.consultado && !caja.hayTurnoAbierto && ruta.path === '/venta'"
        class="px-4 sm:px-6 py-2.5 bg-naranja-50 dark:bg-naranja-950
               border-b border-naranja-200 dark:border-naranja-900
               flex items-center justify-between gap-3 shrink-0"
      >
        <span class="text-sm text-naranja-900 dark:text-naranja-200">
          No hay caja abierta. Sin turno no se puede cobrar.
        </span>
        <UButton
          to="/caja"
          size="xs"
        >
          Abrir caja
        </UButton>
      </div>

      <!--
        El contenido ocupa todo el ancho disponible. Sólo respira por el
        relleno, que crece con la pantalla.

        Nada de columna centrada: la barra lateral ya acota el ancho, y
        encima un `max-width` deja el contenido apretado en medio con dos
        franjas vacías a los lados. En una lista de productos eso es peor
        que feo — desperdicia el sitio donde caben las columnas que el
        mostrador necesita leer.

        Y lo decide el armazón, no cada pantalla. Antes cada una elegía el
        suyo —`max-w-3xl` en Empleados, `max-w-5xl` en Productos— y el
        contenido cambiaba de ancho al navegar, como si cada sección fuera
        de otro sistema.

        `anchoCompleto` en el `definePageMeta` saca a una pantalla incluso
        del relleno: la de venta es una superficie de trabajo con su
        propia rejilla y el carrito pegado al borde.
      -->
      <main class="flex-1 overflow-y-auto min-h-0">
        <div
          :class="anchoCompleto
            ? 'h-full'
            : ['p-4 sm:p-6 lg:p-8 space-y-6', altoCompleto ? 'md:h-full' : '']"
        >
          <slot />
        </div>
      </main>
    </div>

    <CambiarCajeroModal
      v-if="cambiandoCajero"
      @cerrar="cambiandoCajero = false"
    />
  </div>
</template>
