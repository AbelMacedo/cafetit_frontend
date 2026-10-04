<script setup lang="ts">
/**
 * Campo para capturar dinero.
 *
 * Se escribe en **pesos** y se guarda en **centavos**. Esa traducción
 * vive aquí y en ningún otro sitio.
 *
 * Antes varios formularios pedían el monto directamente en centavos: para
 * cobrar veinticinco pesos había que teclear `2500`. Es correcto por
 * dentro y absurdo por fuera — nadie en un mostrador piensa en centavos, y
 * un cero de más son doscientos cincuenta pesos cobrados de más. Que el
 * sistema guarde centavos enteros es una decisión de precisión; hacer que
 * el cajero los teclee era confundir la implementación con la interfaz.
 *
 * El redondeo es explícito: 25.005 pesos no existe como precio, así que se
 * resuelve al centavo más cercano en lugar de arrastrar un float.
 */
const props = withDefaults(defineProps<{
  /** Centavos. Es lo que el resto del sistema maneja. */
  modelValue: number
  /** Permite negativos; por omisión no. */
  minimo?: number
  autofocus?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  minimo: 0,
  autofocus: false,
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{ 'update:modelValue': [centavos: number] }>()

/**
 * El texto se guarda aparte del número.
 *
 * Si el campo escribiera directo sobre el valor, teclear «25.» se
 * normalizaría a «25» y el punto desaparecería bajo el dedo antes de
 * poder escribir los decimales.
 */
const texto = ref(aPesos(props.modelValue))

function aPesos(centavos: number): string {
  return centavos === 0 ? '' : (centavos / 100).toFixed(2).replace(/\.00$/, '')
}

watch(() => props.modelValue, (nuevo) => {
  // Sólo se reescribe si el valor llegó de fuera; si no, el campo pelearía
  // con lo que se está tecleando.
  if (Math.round(Number(texto.value.replace(',', '.')) * 100) !== nuevo) {
    texto.value = aPesos(nuevo)
  }
})

function alEscribir(valor: string | number) {
  const crudo = String(valor).replace(',', '.')
  texto.value = crudo

  const pesos = Number(crudo)

  if (crudo === '' || Number.isNaN(pesos)) {
    emit('update:modelValue', 0)
    return
  }

  emit('update:modelValue', Math.max(props.minimo, Math.round(pesos * 100)))
}

/** Al salir, se deja el texto en su forma canónica. */
function alSalir() {
  texto.value = aPesos(props.modelValue)
}
</script>

<template>
  <UInput
    :model-value="texto"
    type="number"
    inputmode="decimal"
    step="0.5"
    :min="minimo / 100"
    :size="size"
    :autofocus="autofocus"
    :disabled="disabled"
    placeholder="0.00"
    :ui="{ base: 'tabular-nums text-right' }"
    @update:model-value="alEscribir"
    @blur="alSalir"
  >
    <template #leading>
      <span class="text-apagado-2">$</span>
    </template>
  </UInput>
</template>
