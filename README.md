# American Outlet - Sistema de Envios

Sistema de rastreo y gestion de envios entre franquicias American Outlet.

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Hono + tRPC + Drizzle ORM
- **Database**: MySQL (TiDB Cloud)

## Franquicias

| Tienda | Usuario | Password |
|--------|---------|----------|
| Los Chiles | los_chiles | american2025 |
| Pavon | pavon | american2025 |
| Santa Rosa | santa_rosa | american2025 |
| Boca Arenal | boca_arenal | american2025 |
| Florencia | florencia | american2025 |
| Fortuna | fortuna | american2025 |
| Ciudad Quesada | ciudad_quesada | american2025 |
| Bodega Central | bodega | american2025 |

## Deploy en Railway

1. Conectar repo en Railway
2. Variables de entorno:
   - `DATABASE_URL` (URL de TiDB Cloud)
   - `JWT_SECRET` (clave secreta)
   - `NODE_ENV` = production

## Scripts

- `npm run dev` - Desarrollo
- `npm run build` - Produccion
- `npm start` - Iniciar servidor
