import type { FixedFee } from '../types'

// Función del proyecto Honorarios fijos (FixedFeesForAptusFinancials): fixed_fee_services.
// Desarrollo usa el proxy de Vite (mismo origen); VITE_API_BASE_URL la reemplaza si se define.
const FALLBACK_API = 'https://fixedfeesforaptusfinancials-730085095.development.catalystserverless.com/server/fixed_fee_services'
export const API_BASE = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL || FALLBACK_API).replace(/\/$/, '')

// Slate de captura de honorarios fijos (Agregar / Editar).
export const ENTRY_URL = import.meta.env.VITE_FIXED_FEE_ENTRY_URL || 'https://universal-aptus-fixedfeeentry.onslate.com/'

export function entryUrl(orgId: string, cargoId?: number | null): string {
  const origin = new URL(window.location.href)
  origin.search = ''
  origin.searchParams.set('organization_id', orgId)
  const target = new URL(ENTRY_URL)
  target.searchParams.set('organization_id', orgId)
  if (cargoId != null) target.searchParams.set('cargo_id', String(cargoId))
  target.searchParams.set('origin', origin.toString())
  target.searchParams.set('_t', Date.now().toString())
  return target.toString()
}

export async function fetchFees(orgId: string): Promise<FixedFee[]> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(orgId)}/cargos-fijos`)
  if (!response.ok) throw new Error('Error en la respuesta del servidor')
  const data = await response.json().catch(() => null)
  if (!Array.isArray(data)) throw new Error('El listado de honorarios fijos tiene un formato inesperado.')
  return data
}

export type DeleteResult = { ok: true; alreadyGone: boolean } | { ok: false; message: string }

export async function deleteFee(orgId: string, cargoId: number): Promise<DeleteResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(orgId)}/cargos-fijos/${encodeURIComponent(String(cargoId))}`, { method: 'DELETE', signal: AbortSignal.timeout(60000) })
  } catch {
    return { ok: false, message: 'Se perdió la respuesta del servidor. Recarga el listado para comprobar si el cargo se eliminó.' }
  }
  const data = await response.json().catch(() => null)
  if (response.ok) return { ok: true, alreadyGone: false }
  // Solo un 404 en JSON de la API (con `stage`) significa "ya no existe". Otro 404 es una ruta no desplegada.
  if (response.status === 404 && data && typeof data.error === 'string' && data.stage) return { ok: true, alreadyGone: true }
  if (response.status === 404) return { ok: false, message: 'La función de Catalyst no tiene la ruta para eliminar cargos (HTTP 404). Despliega la versión actual de fixed_fee_services.' }
  return { ok: false, message: data?.error || `No se pudo eliminar el cargo (HTTP ${response.status}).` }
}
