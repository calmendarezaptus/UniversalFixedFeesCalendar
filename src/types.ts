// Cargo fijo tal como lo devuelve ReportesSandbox (GET /cargos-fijos) a través de la función de
// Catalyst. La API no trae cliente: se completa con el catálogo de proyectos (enrichFees).
export type TipoCobro = 'fijo' | 'iguala'
export type FeeStatus = 'capturado' | 'liberado' | 'en_prebill' | 'facturado'

export interface FixedFee {
  id: number
  proyecto_id: number
  fecha: string
  concepto: string
  monto: number
  moneda: string
  periodo: string | null
  proyecto_nombre: string
  proyecto_tipo_cobro: TipoCobro | string | null
  liberado: number
  prebill_id: number | null
  facturado: number
  zoho_id: string | null
  status: FeeStatus | string
  cliente_zoho_id: string
  // Completados con el catálogo de proyectos
  cliente_id?: string
  cliente_nombre?: string
}

export interface ProyectoRef { id: number | string; cliente_id: string | number; cliente_nombre?: string; nombre_completo?: string; nombre?: string; tipo_cobro?: string }

export const STATUS_LABEL: Record<string, string> = {
  capturado: 'Capturado',
  liberado: 'Liberado',
  en_prebill: 'En Prebill',
  facturado: 'Facturado',
}

export const TIPO_COBRO_LABEL: Record<TipoCobro, string> = { fijo: 'Cuota fija', iguala: 'Iguala' }
export const tipoLabel = (fee: Pick<FixedFee, 'proyecto_tipo_cobro'>) => TIPO_COBRO_LABEL[fee.proyecto_tipo_cobro as TipoCobro] || fee.proyecto_tipo_cobro || '—'

export function enrichFees(fees: FixedFee[], proyectos: ProyectoRef[]): FixedFee[] {
  if (!proyectos.length) return fees
  const byId = new Map(proyectos.map(p => [String(p.id), p]))
  return fees.map(fee => {
    const p = byId.get(String(fee.proyecto_id))
    if (!p) return fee
    return {
      ...fee,
      cliente_id: String(p.cliente_id),
      cliente_nombre: p.cliente_nombre || fee.cliente_nombre,
      proyecto_nombre: p.nombre_completo || p.nombre || fee.proyecto_nombre,
      proyecto_tipo_cobro: fee.proyecto_tipo_cobro || p.tipo_cobro || null,
    }
  })
}

export function isFeeFacturado(fee?: Partial<FixedFee> | null): boolean {
  if (!fee) return false
  return fee.status?.toString().trim().toLowerCase() === 'facturado' || fee.facturado === 1
}

// Mismo candado que la API (409): facturado o dentro de una Prebill.
export function feeLockReason(fee: Pick<FixedFee, 'facturado' | 'prebill_id' | 'status'>): string | null {
  if (fee.facturado === 1 || fee.status === 'facturado') return 'Este cargo ya está facturado y no puede modificarse ni eliminarse.'
  if (fee.prebill_id != null || fee.status === 'en_prebill') return `Este cargo está en la Prebill #${fee.prebill_id}. Quítalo de la Prebill antes de modificarlo o eliminarlo.`
  return null
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'facturado': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'en_prebill': return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'liberado': return 'bg-sky-50 text-sky-700 border-sky-200'
    default: return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

// Totales por moneda: número de cargos y monto.
export function totalsByCurrency(fees: FixedFee[]): Record<string, { count: number; monto: number }> {
  return fees.reduce((acc, fee) => {
    const currency = fee.moneda || 'MXN'
    if (!acc[currency]) acc[currency] = { count: 0, monto: 0 }
    acc[currency].count += 1
    acc[currency].monto += fee.monto || 0
    return acc
  }, {} as Record<string, { count: number; monto: number }>)
}

export const formatMoney = (val: number) => `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`
