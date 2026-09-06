import type { InventoryGateway } from '../../../inventory/domain/ports/inventory.port';

/**
 * Token separado del INVENTORY_GATEWAY que usa el módulo `inventory` (que
 * lee el inventario de un usuario cualquiera para "vender mis items").
 * Este es el mismo tipo de gateway pero para leer el inventario de las
 * cuentas de almacén de la empresa — se registra su propio provider en
 * catalog.module.ts (reusando la misma clase SteamInventoryHttpGateway)
 * para no crear una dependencia circular entre catalog e inventory.
 */
export const WAREHOUSE_INVENTORY_GATEWAY = Symbol('WAREHOUSE_INVENTORY_GATEWAY');

export type WarehouseInventoryGateway = InventoryGateway;
