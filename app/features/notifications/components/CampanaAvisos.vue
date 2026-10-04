<script setup lang="ts">
import { useNotifications } from '~/features/notifications/composables/useNotifications'
import type { Aviso, SeveridadAviso } from '~/shared/types/api'

/**
 * Campanita del mostrador.
 *
 * Los avisos son del negocio, no de cada empleado: atender uno lo atiende
 * para todos. Es lo correcto para «saca los cuernitos», que se hace una
 * vez, pero conviene saberlo porque no es lo que hace una bandeja de
 * correo.
 */
const { avisos, sinLeer, urgentes, atender, atenderTodo } = useNotifications()

const colorPorSeveridad: Record<SeveridadAviso, string> = {
  critical: 'text-error-600 dark:text-error-400',
  warning: 'text-warning-600 dark:text-warning-400',
  info: 'text-apagado-2'
}

const iconoPorSeveridad: Record<SeveridadAviso, string> = {
  critical: 'i-lucide-circle-alert',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-info'
}

async function irA(aviso: Aviso) {
  await atender(aviso.id)

  if (aviso.enlace) await navigateTo(aviso.enlace)
}

function haceCuanto(iso: string | null): string {
  if (iso === null) return ''

  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)

  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`

  return `hace ${Math.round(horas / 24)} d`
}
</script>

<template>
  <UPopover>
    <UButton
      variant="ghost"
      color="neutral"
      size="sm"
      :aria-label="sinLeer === 0
        ? 'Avisos: ninguno pendiente'
        : `Avisos: ${sinLeer} sin atender`"
    >
      <span class="relative inline-flex">
        <UIcon
          name="i-lucide-bell"
          class="size-5"
          :class="urgentes > 0 ? 'text-error-600 dark:text-error-400' : ''"
        />

        <!--
          El número va dentro del botón y no como texto aparte para que el
          lector de pantalla lo anuncie una sola vez, desde el aria-label.
        -->
        <span
          v-if="sinLeer > 0"
          aria-hidden="true"
          class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold
                 leading-4 text-center tabular-nums text-white"
          :class="urgentes > 0 ? 'bg-error-600' : 'bg-primary-500'"
        >
          {{ sinLeer > 9 ? '9+' : sinLeer }}
        </span>
      </span>
    </UButton>

    <template #content>
      <div class="w-80 max-w-[calc(100vw-2rem)]">
        <div class="flex items-baseline justify-between gap-2 px-3 py-2 border-b border-borde">
          <span class="font-medium text-sm">Avisos</span>

          <UButton
            v-if="avisos.length > 0"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="atenderTodo"
          >
            Marcar todo
          </UButton>
        </div>

        <p
          v-if="avisos.length === 0"
          class="text-sm text-apagado px-3 py-8 text-center"
        >
          Nada pendiente.
        </p>

        <div
          v-else
          class="max-h-96 overflow-y-auto divide-y divide-borde-suave"
        >
          <div
            v-for="a in avisos"
            :key="a.id"
            class="flex items-start gap-2 px-3 py-2.5"
          >
            <UIcon
              :name="iconoPorSeveridad[a.severidad]"
              class="size-4 shrink-0 mt-0.5"
              :class="colorPorSeveridad[a.severidad]"
            />

            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="irA(a)"
            >
              <span class="block text-sm font-medium leading-snug">{{ a.titulo }}</span>
              <span
                v-if="a.cuerpo"
                class="block text-xs text-apagado leading-snug mt-0.5"
              >{{ a.cuerpo }}</span>
              <span class="block text-xs text-apagado-2 mt-0.5">{{ haceCuanto(a.creada_en) }}</span>
            </button>

            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-check"
              :aria-label="`Marcar como atendido: ${a.titulo}`"
              @click="atender(a.id)"
            />
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
