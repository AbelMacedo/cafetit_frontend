import { describe, expect, it } from 'vitest'
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Formato del dinero que el carrito calcula en vivo.
 *
 * Importa que sea idéntico al de `Money::format()` del backend: el cajero
 * ve esta cifra mientras captura y la del servidor al cobrar, y si
 * cambiaran de aspecto pensaría que cambió el precio.
 */
describe('formatearCentavos', () => {
  it('separa pesos y centavos', () => {
    expect(formatearCentavos(5500)).toBe('$55.00')
    expect(formatearCentavos(5)).toBe('$0.05')
    expect(formatearCentavos(50)).toBe('$0.50')
    expect(formatearCentavos(0)).toBe('$0.00')
  })

  it('agrupa los miles', () => {
    expect(formatearCentavos(276600)).toBe('$2,766.00')
    expect(formatearCentavos(100000000)).toBe('$1,000,000.00')
  })

  it('pone el signo antes del peso, no después', () => {
    // «-$13.00», no «$-13.00»: es lo que hace el backend.
    expect(formatearCentavos(-1300)).toBe('-$13.00')
  })

  it('no pierde el centavo suelto', () => {
    expect(formatearCentavos(1)).toBe('$0.01')
    expect(formatearCentavos(199)).toBe('$1.99')
    expect(formatearCentavos(-1)).toBe('-$0.01')
  })
})
