<script setup lang="ts">
/**
 * Gráfica de barras.
 *
 * En SVG a mano y sin librería, por lo mismo que el PDF usa dompdf en
 * lugar de un Chromium entero: traer doscientos kilobytes y una API nueva
 * para dibujar cuatro barras no se paga, y menos en la tableta del
 * mostrador.
 *
 * **La escala arranca en cero siempre.** Una gráfica que empieza en el
 * valor más bajo hace que $2,000 y $2,100 parezcan el doble uno del otro.
 * En un reporte de ventas eso no es un detalle estético: es la diferencia
 * entre creer que el martes fue malo y saber que fue igual que el lunes.
 *
 * No lleva eje vertical con números: el valor va encima de cada barra,
 * que es lo que de verdad se lee. Un eje con marcas obliga a estimar la
 * altura y después buscar la marca más cercana.
 */
export interface BarraDato {
  /** Lo que va debajo de la barra. Corto: es un eje, no una frase. */
  etiqueta: string
  valor: number
  /** Ya formateado —dinero, piezas—; se muestra encima de la barra. */
  texto: string
}

const props = withDefaults(defineProps<{
  datos: BarraDato[]
  /** Alto del área de barras, sin contar rótulos. */
  alto?: number
  /** Para quien use lector de pantalla. */
  titulo: string
}>(), {
  alto: 160
})

/**
 * El tope de la escala es el valor más alto, nunca cero.
 *
 * Con todo en cero —un día sin ventas— dividir entre el máximo daría
 * `NaN` y las barras desaparecerían sin explicación.
 */
const tope = computed(() => Math.max(1, ...props.datos.map(d => d.valor)))

const barras = computed(() =>
  props.datos.map(d => ({
    ...d,
    // Mínimo visible: una barra de cero píxeles parece un dato que falta,
    // no un día en el que no se vendió nada.
    porcentaje: d.valor === 0 ? 0 : Math.max(4, Math.round(d.valor * 100 / tope.value))
  }))
)

/**
 * Con muchos días, los rótulos se pisan.
 *
 * En lugar de girarlos —que obliga a ladear la cabeza frente a una
 * tableta apoyada en la barra— se enseña uno de cada N. Las barras siguen
 * todas ahí; lo que se alivia es el texto.
 */
const saltoRotulo = computed(() => Math.ceil(props.datos.length / 12))

function seRotula(i: number): boolean {
  return i % saltoRotulo.value === 0
}
</script>

<template>
  <div
    role="img"
    :aria-label="titulo"
  >
    <div
      class="flex items-end gap-1 sm:gap-2"
      :style="{ height: `${alto}px` }"
    >
      <div
        v-for="(b, i) in barras"
        :key="i"
        class="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1"
        :title="`${b.etiqueta}: ${b.texto}`"
      >
        <!--
          El importe encima de la barra, no en un eje lateral. Se oculta
          cuando hay tantas barras que los números se tocarían.
        -->
        <span
          v-if="barras.length <= 8"
          class="text-[11px] tabular-nums text-apagado whitespace-nowrap"
        >{{ b.texto }}</span>

        <div
          class="w-full rounded-t-md transition-all"
          :class="b.valor === 0 ? 'bg-relleno' : 'bg-naranja-400'"
          :style="{ height: `${b.porcentaje}%` }"
        />
      </div>
    </div>

    <!-- Los rótulos van fuera del alto fijo: si no, se lo comen. -->
    <div class="flex gap-1 sm:gap-2 mt-2">
      <div
        v-for="(b, i) in barras"
        :key="i"
        class="flex-1 min-w-0 text-center"
      >
        <span
          v-if="seRotula(i)"
          class="text-[11px] text-apagado block truncate"
        >{{ b.etiqueta }}</span>
      </div>
    </div>
  </div>
</template>
