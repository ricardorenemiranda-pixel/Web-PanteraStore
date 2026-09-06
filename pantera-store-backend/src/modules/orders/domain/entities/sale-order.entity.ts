import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type OrderStatus = 'pendiente' | 'procesado' | 'rechazado';

export interface SaleOrderLineItem {
  itemId: string;
  itemName: string;
  /** Precio de recompra congelado al momento de crear la orden (S/) */
  price: number;
}

export interface SaleOrderProps {
  id: string;
  userSteamId: string;
  userDisplayName: string;
  tradeUrl: string;
  lineItems: SaleOrderLineItem[];
  status: OrderStatus;
  createdAt: Date;
}

const STEAM_TRADE_URL_PATTERN = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=\w+$/;

/**
 * Una orden de venta: el usuario eligió items de su inventario para
 * vendérselos a la empresa. Nadie transfiere plata automáticamente — un
 * humano del equipo revisa y aprueba/rechaza desde el panel de admin
 * (ver application/use-cases). El total nunca se guarda suelto: siempre se
 * deriva de los line items, así no se puede desincronizar.
 */
export class SaleOrder {
  private constructor(private props: SaleOrderProps) {}

  static create(props: Omit<SaleOrderProps, 'status' | 'createdAt'>): SaleOrder {
    const order = new SaleOrder({ ...props, status: 'pendiente', createdAt: new Date() });
    order.validateTradeUrl(props.tradeUrl);
    order.validateLineItems(props.lineItems);
    return order;
  }

  static restore(props: SaleOrderProps): SaleOrder {
    return new SaleOrder(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userSteamId(): string {
    return this.props.userSteamId;
  }

  get userDisplayName(): string {
    return this.props.userDisplayName;
  }

  get tradeUrl(): string {
    return this.props.tradeUrl;
  }

  get lineItems(): SaleOrderLineItem[] {
    return [...this.props.lineItems];
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get total(): number {
    return Math.round(this.props.lineItems.reduce((sum, li) => sum + li.price, 0) * 100) / 100;
  }

  approve(): void {
    this.ensurePending();
    this.props.status = 'procesado';
  }

  reject(): void {
    this.ensurePending();
    this.props.status = 'rechazado';
  }

  private ensurePending(): void {
    if (this.props.status !== 'pendiente') {
      throw new InvalidDomainStateException(
        `La orden ya fue ${this.props.status === 'procesado' ? 'procesada' : 'rechazada'}, no se puede modificar de nuevo.`,
      );
    }
  }

  private validateTradeUrl(tradeUrl: string): void {
    if (!STEAM_TRADE_URL_PATTERN.test(tradeUrl)) {
      throw new InvalidDomainStateException(
        'El Trade URL no tiene el formato válido de Steam (steamcommunity.com/tradeoffer/new/?partner=...&token=...).',
      );
    }
  }

  private validateLineItems(lineItems: SaleOrderLineItem[]): void {
    if (lineItems.length === 0) {
      throw new InvalidDomainStateException('La orden debe incluir al menos un item.');
    }
  }
}
