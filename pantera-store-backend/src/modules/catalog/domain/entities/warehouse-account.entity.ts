export interface WarehouseAccountProps {
  id: string;
  /** SteamID64 de la cuenta que la empresa usa como almacén de items. */
  steamId: string;
  /** Nombre para reconocerla en el admin (ej. "Cuenta principal", "Cuenta 2"). */
  label: string;
  addedAt: Date;
}

/**
 * Una cuenta de Steam que la empresa registró como "almacén" — su
 * inventario real es lo que alimenta el catálogo público (ver
 * SyncWarehouseCatalogUseCase). Los usuarios nunca ven esta entidad, solo
 * el admin.
 */
export class WarehouseAccount {
  private constructor(private props: WarehouseAccountProps) {}

  static create(props: WarehouseAccountProps): WarehouseAccount {
    return new WarehouseAccount(props);
  }

  get id(): string {
    return this.props.id;
  }

  get steamId(): string {
    return this.props.steamId;
  }

  get label(): string {
    return this.props.label;
  }

  get addedAt(): Date {
    return this.props.addedAt;
  }
}
