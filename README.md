# Calendario de Honorarios Fijos (Fixed Fees Calendar)

Lista y calendario (mes, semana, día) de los **cargos fijos e igualas** de Aptus. Mismo stack,
componentes y diseño que el calendario de gastos y el de tiempos: React + Vite + TypeScript,
Tailwind CSS v3, shadcn/ui (`base-nova`, Base UI), lucide, jsPDF y fuente Geist. Tema por omisión
**Ámbar** (Tiempos: Índigo; Gastos: Turquesa).

## Qué hace

- **Lista** con orden y filtros por columna (fecha, concepto, tipo de cobro, estado), agrupación por
  cliente, proyecto, tipo, periodo, estado o moneda, totales por moneda y exportación a CSV y PDF.
- **Calendario** de mes, semana y día con totales por día (número de cargos y monto por moneda).
- **Filtros globales** de cliente y proyecto en el encabezado (guardados por organización).
- **Detalle** lateral: monto, tipo de cobro (cuota fija / iguala y su periodo), liberado, estado y Prebill.
- **Agregar / Editar** abren la captura (`UniversalAptusFixedFeeEntry`) con `origin` para regresar
  aquí. **Eliminar** llama a `DELETE /{org}/cargos-fijos/{id}`.
- Un cargo **en Prebill o facturado** no se edita ni se elimina (misma regla que la API, 409).

La API de cargos fijos no trae el cliente: se completa con el catálogo de proyectos (`enrichFees`).

## Parámetros de URL

| Parámetro | Uso |
|---|---|
| `organization_id` | **Requerido.** Sin él se muestra un error. |

## Llamadas al backend (función `fixed_fee_services`)

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/{org}/cargos-fijos` | Listado completo |
| GET | `/{org}/clientes`, `/{org}/proyectos` | Filtros del encabezado y cliente de cada cargo (caché 6 h) |
| DELETE | `/{org}/cargos-fijos/{id}` | Eliminar |

Solo un 404 **en JSON con `stage`** ("Cargo fijo no encontrado") se toma como "ya no existe".

## Variables de entorno (opcionales)

| Variable | Por omisión |
|---|---|
| `VITE_API_BASE_URL` | `https://fixedfeesforaptusfinancials-730085095.development.catalystserverless.com/server/fixed_fee_services` |
| `VITE_FIXED_FEE_ENTRY_URL` | `https://universal-aptus-fixedfeeentry.onslate.com/` |

En desarrollo todas las llamadas pasan por el proxy de Vite `/api`.

## Comandos

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas de src/lib y src/types (node:test)
npm run build    # compilación para la Slate (dist/)
```

## Proyecto

Forma parte del proyecto de Catalyst **Honorarios fijos**. Configuración, despliegue y pendientes:
`03-honorarios-fijos/PROYECTO.md` en el repositorio de trabajo `AptusWidgets`.
