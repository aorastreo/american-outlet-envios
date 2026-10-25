# American Outlet - Sistema de Envios

Sistema de rastreo y gestion de envios entre franquicias American Outlet.

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Hono + tRPC + Drizzle ORM
- **Database**: MySQL (TiDB Cloud)

## Franquicias

Cada tienda entra con su usuario. La clave no se escribe en este archivo: es la que ya usa cada franquicia. Una cuenta nueva solo se crea si en el servidor existe la variable `FRANCHISE_SEED_PASSWORD`.

| Tienda | Usuario |
|--------|---------|
| Los Chiles | los_chiles |
| Pavon | pavon |
| Santa Rosa | santa_rosa |
| Boca Arenal | boca_arenal |
| Florencia | florencia |
| Fortuna | fortuna |
| Ciudad Quesada | ciudad_quesada |
| Bodega Central | bodega |

## Deploy en Railway

1. Conectar repo en Railway
2. Variables de entorno:
   - `DATABASE_URL` (URL de TiDB Cloud)
   - `JWT_SECRET` (clave secreta)
   - `NODE_ENV` = production
   - `FRANCHISE_SEED_PASSWORD` solo si hay que crear una cuenta nueva
   - `INIT_TABLES_SECRET` si se van a usar las direcciones internas de reparación. Sin esta variable, esas direcciones no responden.

## Scripts

- `npm run dev` - Desarrollo
- `npm run build` - Produccion
- `npm start` - Iniciar servidor

