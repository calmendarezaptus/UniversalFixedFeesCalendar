import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const toModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const types = await import(toModule(read('../src/types.ts')))
const api = await import(toModule(read('../src/lib/api.ts')
  .replace('import.meta.env.DEV', 'true')
  .replace('import.meta.env.VITE_API_BASE_URL', 'undefined')
  .replace('import.meta.env.VITE_FIXED_FEE_ENTRY_URL', 'undefined')))

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error('html'); return body } })

test('borrar: éxito y "ya no existe" (404 JSON con stage) quitan el cargo', async () => {
  let call
  globalThis.fetch = async (url, options) => { call = { url, options }; return json(200, { ok: true }) }
  assert.deepEqual(await api.deleteFee('636939444', 14), { ok: true, alreadyGone: false })
  assert.equal(call.url, '/api/636939444/cargos-fijos/14'); assert.equal(call.options.method, 'DELETE')
  globalThis.fetch = async () => json(404, { error: 'Cargo fijo no encontrado', stage: 'delete_cargo_fijo', outcome_unknown: false })
  assert.deepEqual(await api.deleteFee('1', 14), { ok: true, alreadyGone: true })
})

test('borrar: 404 sin stage (ruta no desplegada), 409 y red caída NO se toman como borrado', async () => {
  globalThis.fetch = async () => json(404)
  assert.match((await api.deleteFee('1', 14)).message, /HTTP 404/)
  globalThis.fetch = async () => json(404, { error: 'Ruta no encontrada en fixed_fee_services.' })
  assert.equal((await api.deleteFee('1', 14)).ok, false)
  globalThis.fetch = async () => json(409, { error: 'Ya facturado', stage: 'delete_cargo_fijo' })
  assert.deepEqual(await api.deleteFee('1', 14), { ok: false, message: 'Ya facturado' })
  globalThis.fetch = async () => { throw new Error('offline') }
  assert.equal((await api.deleteFee('1', 14)).ok, false)
})

test('listado: rechaza respuestas que no son arreglo', async () => {
  globalThis.fetch = async () => json(200, { error: 'x' })
  await assert.rejects(api.fetchFees('1'), /formato inesperado/)
})

test('enlace a la captura lleva organización, cargo y origen', () => {
  globalThis.window = { location: { href: 'https://universal-fixedfeeentry-calendar.onslate.com/?organization_id=1&x=2' } }
  const url = new URL(api.entryUrl('636939444', 11))
  assert.equal(url.origin, 'https://universal-aptus-fixedfeeentry.onslate.com')
  assert.equal(url.searchParams.get('organization_id'), '636939444')
  assert.equal(url.searchParams.get('cargo_id'), '11')
  assert.equal(url.searchParams.get('origin'), 'https://universal-fixedfeeentry-calendar.onslate.com/?organization_id=636939444')
  assert.equal(new URL(api.entryUrl('1')).searchParams.get('cargo_id'), null)
})

test('completa cliente y nombre del proyecto con el catálogo (la API no los trae)', () => {
  const fees = [{ id: 11, proyecto_id: 24, proyecto_nombre: 'Constitución', proyecto_tipo_cobro: 'fijo' }, { id: 99, proyecto_id: 77, proyecto_nombre: 'Sin catálogo', proyecto_tipo_cobro: null }]
  const proyectos = [{ id: 24, cliente_id: 2, cliente_nombre: 'Cliente de Prueba', nombre_completo: '[DEMO] Constitución de sociedad (cuota fija)', tipo_cobro: 'fijo' }]
  const [a, b] = types.enrichFees(fees, proyectos)
  assert.equal(a.cliente_id, '2'); assert.equal(a.cliente_nombre, 'Cliente de Prueba')
  assert.equal(a.proyecto_nombre, '[DEMO] Constitución de sociedad (cuota fija)')
  assert.equal(b.cliente_id, undefined); assert.equal(b.proyecto_nombre, 'Sin catálogo')
  assert.equal(types.tipoLabel({ proyecto_tipo_cobro: 'iguala' }), 'Iguala')
})

test('candado igual al de la API y totales por moneda', () => {
  assert.equal(types.feeLockReason({ facturado: 0, prebill_id: null, status: 'liberado' }), null)
  assert.match(types.feeLockReason({ facturado: 0, prebill_id: 9, status: 'en_prebill' }), /Prebill #9/)
  assert.match(types.feeLockReason({ facturado: 1, prebill_id: 9, status: 'facturado' }), /facturado/)
  assert.deepEqual(types.totalsByCurrency([{ moneda: 'MXN', monto: 25000 }, { moneda: 'MXN', monto: 22500 }, { moneda: 'USD', monto: 1000 }]),
    { MXN: { count: 2, monto: 47500 }, USD: { count: 1, monto: 1000 } })
})
