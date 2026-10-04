<script setup lang="ts">
import type { RegistroBitacora } from '~/shared/types/api'
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Una línea de la bitácora.
 *
 * El detalle —el antes y el después— viene plegado. Desplegarlo todo
 * llenaría la pantalla de pares clave-valor y haría ilegible justo lo que
 * se viene a hacer aquí: recorrer una lista buscando qué pasó.
 *
 * Cada acción guarda un contexto distinto, así que no se dibuja una
 * tabla por acción: se recorren las claves. Inventar una vista por cada
 * tipo de hecho sería catorce plantillas que se desincronizan.
 */
const props = defineProps<{ registro: RegistroBitacora }>()

const abierto = ref(false)

const iconos: Record<string, string> = {
  'Ventas': 'i-lucide-receipt',
  'Caja': 'i-lucide-wallet',
  'Catálogo e inventario': 'i-lucide-package',
  'Empleados': 'i-lucide-users'
}

const icono = computed(() => iconos[props.registro.grupo] ?? 'i-lucide-circle-dot')

const hora = computed(() =>
  new Date(props.registro.ocurrio_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
)

/** Las claves del contexto, unidas: una fila por dato, con su antes al lado. */
const detalle = computed(() => {
  const antes = props.registro.antes ?? {}
  const despues = props.registro.despues ?? {}
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])]

  return claves.map(clave => ({
    clave: rotulo(clave),
    antes: formatear(clave, antes[clave]),
    despues: formatear(clave, despues[clave])
  }))
})

const hayDetalle = computed(() => detalle.value.length > 0)

/*
 * Los registros viejos guardan los importes en centavos crudos.
 *
 * La bitácora es inmutable: esas líneas van a decir `2100` donde
 * quieren decir `$21.00` para siempre, y son justo las que se leen
 * cuando algo no cuadra. Las nuevas ya guardan el importe formateado
 * desde el servidor, así que esto es sólo para el histórico —por eso
 * se reconoce por el sufijo y no por una lista de claves.
 */
const SUFIJO_CENTAVOS = '_cents'

function rotulo(clave: string): string {
  return clave.replace(SUFIJO_CENTAVOS, '').replaceAll('_', ' ')
}

function formatear(clave: string, valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'

  if (clave.endsWith(SUFIJO_CENTAVOS) && typeof valor === 'number') {
    return formatearCentavos(valor)
  }

  if (typeof valor === 'object') return JSON.stringify(valor)

  return String(valor)
}
</script>

<template>
  <div
    class="tarjeta p-3"
    :class="registro.delicada ? 'border-l-4 border-l-naranja-400' : ''"
  >
    <div class="flex items-start gap-3">
      <span
        class="size-9 rounded-xl flex items-center justify-center shrink-0"
        :class="registro.delicada
          ? 'bg-naranja-100 text-naranja-700'
          : 'bg-lienzo text-tinta-2'"
      >
        <UIcon
          :name="icono"
          class="size-5"
        />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="font-medium text-tinta">{{ registro.accion_texto }}</span>
          <span class="text-xs tabular-nums text-apagado">{{ hora }}</span>
        </div>

        <p
          v-if="registro.descripcion"
          class="text-sm text-tinta-2 mt-0.5 break-words"
        >
          {{ registro.descripcion }}
        </p>

        <p class="text-xs text-apagado mt-1">
          <!--
            Un hecho sin nombre es media bitácora. Cuando falta, es que lo
            hizo un comando programado, y eso también se dice.
          -->
          <span v-if="registro.usuario">{{ registro.usuario }}</span>
          <span v-else>Tarea automática</span>
          <span v-if="registro.ip"> · {{ registro.ip }}</span>
        </p>

        <div v-if="hayDetalle">
          <UButton
            size="xs"
            variant="link"
            color="neutral"
            class="p-0 mt-1"
            :icon="abierto ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            @click="abierto = !abierto"
          >
            {{ abierto ? 'Ocultar detalle' : 'Ver detalle' }}
          </UButton>

          <dl
            v-if="abierto"
            class="mt-2 rounded-lg bg-hundido p-3 space-y-1.5"
          >
            <div
              v-for="d in detalle"
              :key="d.clave"
              class="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              <dt class="text-apagado capitalize w-40 shrink-0">
                {{ d.clave }}
              </dt>

              <dd class="min-w-0 break-words">
                <!-- Sin «antes» no hubo cambio: es un dato del hecho. -->
                <template v-if="d.antes !== null && d.antes !== d.despues">
                  <span class="line-through text-apagado-2">{{ d.antes }}</span>
                  <span class="mx-1 text-apagado-2">→</span>
                </template>
                <span class="text-tinta">{{ d.despues ?? d.antes ?? '—' }}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>
