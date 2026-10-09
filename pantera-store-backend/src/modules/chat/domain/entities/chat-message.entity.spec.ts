import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import { ChatMessage } from './chat-message.entity';

const base = { id: 'm1', userId: 'u1', displayName: 'Jugador' };

describe('ChatMessage.create', () => {
  it('crea un mensaje con el texto recortado', () => {
    const m = ChatMessage.create({ ...base, body: '  hola gente  ' }, 300);
    expect(m.body).toBe('hola gente');
    expect(m.createdAt).toBeInstanceOf(Date);
  });

  it('rechaza un mensaje vacío (incluso solo espacios)', () => {
    expect(() => ChatMessage.create({ ...base, body: '   ' }, 300)).toThrow(InvalidDomainStateException);
    expect(() => ChatMessage.create({ ...base, body: '' }, 300)).toThrow('vacío');
  });

  it('rechaza un mensaje más largo que el máximo configurado', () => {
    expect(() => ChatMessage.create({ ...base, body: 'x'.repeat(301) }, 300)).toThrow('300 caracteres');
  });

  it('acepta un mensaje justo en el límite', () => {
    const m = ChatMessage.create({ ...base, body: 'x'.repeat(300) }, 300);
    expect(m.body).toHaveLength(300);
  });
});
