import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../../shared/testing/test-datasource';
import type { AppConfig } from '../../../../config/configuration';
import { SuspensionGate } from '../../../../shared/trust/suspension-gate';
import { User } from '../../../auth/domain/entities/user.entity';
import type { UserRepository } from '../../../auth/domain/ports/user.repository.port';
import { Sanction } from '../../../trust/domain/entities/sanction.entity';
import { SanctionOrmEntity } from '../../../trust/infrastructure/persistence/orm/trust.orm-entities';
import { ChatMessageOrmEntity } from '../../infrastructure/persistence/orm/chat-message.orm-entity';
import { TypeOrmChatRepository } from '../../infrastructure/persistence/typeorm-chat.repository';
import { ListChatHistoryUseCase } from './list-chat-history.use-case';
import { SendChatMessageUseCase } from './send-chat-message.use-case';

// Prueba contra Postgres real. Solo corre con WALLET_TEST_DB_URL (base DESECHABLE):
//   WALLET_TEST_DB_URL=postgres://postgres:postgres@localhost:5433/pantera_wallet_test npx jest chat-use-cases
const url = process.env.WALLET_TEST_DB_URL;
const describeDb = url ? describe : describe.skip;

describeDb('chat general (Postgres real)', () => {
  let dataSource: DataSource;
  let chatRepo: TypeOrmChatRepository;
  let send: SendChatMessageUseCase;
  let history: ListChatHistoryUseCase;
  let n = 0;
  const run = Date.now();
  const users = new Map<string, User>();
  const usersRepo: UserRepository = {
    findById: (id) => Promise.resolve(users.get(id) ?? null),
    findBySteamId: () => Promise.resolve(null),
    findByEmail: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
  const configFor = (rateLimit: number, maxLength = 300) =>
    ({
      get: () => ({ rateLimit, rateLimitWindowSec: 60, maxLength }),
    }) as unknown as ConfigService<AppConfig, true>;

  beforeAll(async () => {
    dataSource = await createTestDataSource(url!, [ChatMessageOrmEntity, SanctionOrmEntity]);
    chatRepo = new TypeOrmChatRepository(dataSource);
    history = new ListChatHistoryUseCase(chatRepo);
  }, 30_000);

  afterAll(async () => {
    await dataSource.destroy();
  });

  function player(): User {
    const id = `chat-user-${run}-${n++}`;
    const u = User.create({ id, displayName: `Jugador ${n}`, role: 'customer' });
    users.set(id, u);
    return u;
  }

  it('envía un mensaje y aparece en el historial', async () => {
    send = new SendChatMessageUseCase(chatRepo, usersRepo, new SuspensionGate(dataSource), configFor(5));
    const alice = player();
    const message = await send.execute(alice.id, '  Hola a todos!  ');
    expect(message.body).toBe('Hola a todos!');

    const recent = await history.execute(10);
    expect(recent.some((m) => m.id === message.id && m.displayName === alice.displayName)).toBe(true);
  });

  it('rechaza un mensaje vacío sin guardar nada', async () => {
    send = new SendChatMessageUseCase(chatRepo, usersRepo, new SuspensionGate(dataSource), configFor(5));
    const bob = player();
    await expect(send.execute(bob.id, '   ')).rejects.toThrow('vacío');
    const recent = await history.execute(50);
    expect(recent.some((m) => m.userId === bob.id)).toBe(false);
  });

  it('un usuario con suspensión activa no puede enviar mensajes', async () => {
    send = new SendChatMessageUseCase(chatRepo, usersRepo, new SuspensionGate(dataSource), configFor(5));
    const carol = player();

    const sanction = Sanction.create({
      id: `sanction-${carol.id}`,
      userId: carol.id,
      userDisplayName: carol.displayName,
      type: 'suspension',
      reason: 'Prueba de bloqueo de chat.',
      appliedBy: 'admin-test',
    });
    const row = new SanctionOrmEntity();
    row.id = sanction.id;
    row.userId = sanction.userId;
    row.userDisplayName = sanction.userDisplayName;
    row.type = sanction.type;
    row.reason = sanction.reason;
    row.amountCents = null;
    row.suspendedUntil = null;
    row.reportId = null;
    row.appliedBy = sanction.appliedBy;
    row.appliedAt = sanction.appliedAt;
    row.revokedBy = null;
    row.revokedAt = null;
    row.revokeReason = null;
    await dataSource.manager.save(SanctionOrmEntity, row);

    await expect(send.execute(carol.id, 'Hola, estoy suspendido')).rejects.toThrow('suspendida');
    const recent = await history.execute(50);
    expect(recent.some((m) => m.userId === carol.id)).toBe(false);
  });

  it('aplica un límite de mensajes por usuario en la ventana configurada', async () => {
    send = new SendChatMessageUseCase(chatRepo, usersRepo, new SuspensionGate(dataSource), configFor(2));
    const dave = player();
    await send.execute(dave.id, 'mensaje uno');
    await send.execute(dave.id, 'mensaje dos');
    await expect(send.execute(dave.id, 'mensaje tres')).rejects.toThrow('rápido');
  });

  it('el historial trae del más viejo al más nuevo y respeta el límite pedido', async () => {
    send = new SendChatMessageUseCase(chatRepo, usersRepo, new SuspensionGate(dataSource), configFor(5));
    const eve = player();
    await send.execute(eve.id, 'primero');
    await send.execute(eve.id, 'segundo');
    await send.execute(eve.id, 'tercero');

    const last2 = await history.execute(2);
    expect(last2).toHaveLength(2);
    expect(last2[0].createdAt.getTime()).toBeLessThanOrEqual(last2[1].createdAt.getTime());
  });
});
