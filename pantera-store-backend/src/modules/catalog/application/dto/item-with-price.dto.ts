import { Item } from '../../domain/entities/item.entity';

/**
 * Lo que devuelven los casos de uso: el item de dominio + su precio ya
 * calculado con el markup vigente. La capa de interfaz (HTTP) solo lo
 * serializa, no vuelve a calcular nada.
 */
export class ItemWithPrice {
  constructor(
    public readonly item: Item,
    public readonly sellPrice: number,
    public readonly buybackPrice: number,
  ) {}
}
