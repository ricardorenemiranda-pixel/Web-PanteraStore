import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'chat_messages' })
@Index(['createdAt'])
export class ChatMessageOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
