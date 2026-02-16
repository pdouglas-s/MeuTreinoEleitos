jest.mock('../src/firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  writeBatch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn() }))
}));

jest.mock('../src/services/historicoService', () => ({
  listarSessoesFinalizadasNoPeriodo: jest.fn()
}));

const { addDoc, getDocs } = require('firebase/firestore');
const { listarSessoesFinalizadasNoPeriodo } = require('../src/services/historicoService');
const { notificarResumoSemanalAluno, enviarNotificacao } = require('../src/services/notificacoesService');

describe('notificacoesService - resumo semanal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('envia resumo semanal no domingo quando ainda não existe', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    listarSessoesFinalizadasNoPeriodo.mockResolvedValue([
      { nivel_esforco: 4, feedback: 'Treino pesado' },
      { nivel_esforco: 2, feedback: 'Boa execução' }
    ]);
    addDoc.mockResolvedValue({ id: 'notif-semanal-1' });

    const resultado = await notificarResumoSemanalAluno(
      'aluno-1',
      'prof-1',
      'João',
      new Date('2026-02-15T10:00:00.000Z')
    );

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.tipo).toBe('resumo_semanal');
    expect(payload.aluno_id).toBe('aluno-1');
    expect(payload.mensagem).toContain('João, resumo da sua semana');
    expect(payload.mensagem).toContain('Treinos finalizados: 2');
    expect(payload.mensagem).toContain('Intensidade média: 3/5');
    expect(resultado).toMatchObject({
      enviada: true,
      notificacaoId: 'notif-semanal-1',
      totalTreinos: 2
    });
  });

  test('não envia se já existe resumo da mesma semana', async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            tipo: 'resumo_semanal',
            dados: { semana_chave: '2026-02-09' }
          })
        }
      ]
    });

    const resultado = await notificarResumoSemanalAluno(
      'aluno-1',
      'prof-1',
      'João',
      new Date('2026-02-15T10:00:00.000Z')
    );

    expect(listarSessoesFinalizadasNoPeriodo).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ enviada: false, motivo: 'ja_enviada', semanaChave: '2026-02-09' });
  });

  test('não envia fora do domingo', async () => {
    const resultado = await notificarResumoSemanalAluno(
      'aluno-1',
      'prof-1',
      'João',
      new Date('2026-02-14T10:00:00.000Z')
    );

    expect(getDocs).not.toHaveBeenCalled();
    expect(listarSessoesFinalizadasNoPeriodo).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ enviada: false, motivo: 'fora_do_domingo' });
  });
});

describe('notificacoesService - envio direcionado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('treino_iniciado deve aparecer apenas para professor', async () => {
    addDoc.mockResolvedValue({ id: 'notif-start-1' });

    await enviarNotificacao('prof-1', 'aluno-1', 'treino_iniciado', {
      treino_id: 'treino-1',
      treino_nome: 'Treino A',
      aluno_nome: 'Aluno X'
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.tipo).toBe('treino_iniciado');
    expect(payload.professor_id).toBe('prof-1');
    expect(payload.aluno_id).toBeNull();
  });

  test('treino_associado deve aparecer apenas para aluno', async () => {
    addDoc.mockResolvedValue({ id: 'notif-assoc-1' });

    await enviarNotificacao('prof-1', 'aluno-1', 'treino_associado', {
      treino_id: 'treino-1',
      treino_nome: 'Treino A',
      professor_nome: 'Professor X'
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.tipo).toBe('treino_associado');
    expect(payload.aluno_id).toBe('aluno-1');
    expect(payload.professor_id).toBeNull();
  });

  test('treino_atualizado deve aparecer apenas para aluno', async () => {
    addDoc.mockResolvedValue({ id: 'notif-upd-1' });

    await enviarNotificacao('prof-1', 'aluno-1', 'treino_atualizado', {
      treino_id: 'treino-1',
      treino_nome: 'Treino A',
      professor_nome: 'Professor X'
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.tipo).toBe('treino_atualizado');
    expect(payload.aluno_id).toBe('aluno-1');
    expect(payload.professor_id).toBeNull();
  });

  test('treino_excluido não deve aparecer na caixa do professor', async () => {
    addDoc.mockResolvedValue({ id: 'notif-excl-1' });

    await enviarNotificacao('prof-1', 'aluno-1', 'treino_excluido', {
      treino_id: 'treino-1',
      treino_nome: 'Treino A',
      professor_nome: 'Professor X'
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.tipo).toBe('treino_excluido');
    expect(payload.aluno_id).toBe('aluno-1');
    expect(payload.professor_id).toBeNull();
  });
});
