import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export interface ChatMessageProps {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  body: string;
  createdAt: Date;
}

export type CreateChatMessageInput = Omit<ChatMessageProps, 'createdAt' | 'body'> & {
  body: string;
};

/** Un mensaje del chat general del sitio. Nunca se edita ni se borra. */
export class ChatMessage {
  private constructor(private readonly props: ChatMessageProps) {}

  static create(input: CreateChatMessageInput, maxLength: number): ChatMessage {
    const body = input.body.trim();
    if (body.length < 1) {
      throw new InvalidDomainStateException('El mensaje no puede estar vacío.');
    }
    if (body.length > maxLength) {
      throw new InvalidDomainStateException(`El mensaje no puede superar los ${maxLength} caracteres.`);
    }
    return new ChatMessage({ ...input, body, createdAt: new Date() });
  }

  static restore(props: ChatMessageProps): ChatMessage {
    return new ChatMessage({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }
  get body(): string {
    return this.props.body;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
