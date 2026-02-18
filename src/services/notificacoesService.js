import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { listarSessoesFinalizadasNoPeriodo } from './historicoService';
import { listAllExercicios } from './exerciciosService';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inicioSemana(date) {
  const base = new Date(date);
  const diaSemana = base.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  base.setDate(base.getDate() + ajuste);
  base.setHours(0, 0, 0, 0);
  return base;
}

function fimSemana(date) {
  const inicio = inicioSemana(date);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  return fim;
}

function toSemanaChave(date) {
  const inicio = inicioSemana(date);
  const y = inicio.getFullYear();
  const m = String(inicio.getMonth() + 1).padStart(2, '0');
  const d = String(inicio.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarIntervaloSemana(inicio, fim) {
  const ini = inicio.toLocaleDateString('pt-BR');
  const end = fim.toLocaleDateString('pt-BR');
  return `${ini} a ${end}`;
}

function resumirIntensidade(sessoes) {
  const intensidades = sessoes
    .map((s) => Number(s?.nivel_esforco))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  if (!intensidades.length) return null;
  const media = intensidades.reduce((acc, n) => acc + n, 0) / intensidades.length;
  return Math.round(media * 10) / 10;
}

function coletarFeedbacks(sessoes) {
  const lista = sessoes
    .map((s) => String(s?.feedback || '').trim())
    .filter(Boolean);

  return Array.from(new Set(lista)).slice(0, 3);
}

function normalizarListaNomes(lista = []) {
  return Array.from(
    new Set(
      lista
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
}

function formatarListaAlteracoes(prefixo, itens = []) {
  if (!itens.length) return '';
  const limite = 5;
  const exibidos = itens.slice(0, limite);
  const resto = itens.length - exibidos.length;
  const sufixo = resto > 0 ? ` e mais ${resto}` : '';
  return `\n${prefixo}: ${exibidos.join(', ')}${sufixo}`;
}

function distribuirNivel(distribuicao, nivel) {
  const chave = String(nivel);
  distribuicao[chave] = (distribuicao[chave] || 0) + 1;
}

function sanitizeForFirestore(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, sanitizeForFirestore(item)])
        .filter(([, item]) => item !== undefined)
    );
  }
  return value;
}

function formatarDuracaoSegundos(segundos) {
  const total = Number.isFinite(Number(segundos)) ? Math.max(0, Math.floor(Number(segundos))) : 0;
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segs = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
}

/**
 * Relatório estatístico por categoria muscular a partir de notificações de treino finalizado
 */
export async function gerarRelatorioEsforcoPorCategoria({ professorId = null, academiaId = null, dias = 30 } = {}) {
  const periodoDias = Number.isFinite(Number(dias)) ? Math.max(1, Number(dias)) : 30;
  const limiteData = new Date();
  limiteData.setDate(limiteData.getDate() - periodoDias);

  const notificacoes = academiaId
    ? await listarNotificacoesAcademia(academiaId)
    : await listarNotificacoesProfessor(professorId);

  const finalizacoes = notificacoes
    .filter((item) => item?.tipo === 'treino_finalizado')
    .filter((item) => {
      const createdAt = toDateValue(item?.created_at);
      return createdAt && createdAt >= limiteData;
    })
    .filter((item) => {
      const nivel = Number(item?.dados?.nivel_esforco);
      const treinoId = String(item?.dados?.treino_id || '').trim();
      return Number.isFinite(nivel) && nivel >= 1 && nivel <= 5 && !!treinoId;
    });

  if (!finalizacoes.length) {
    return {
      periodoDias,
      totalNotificacoesConsideradas: 0,
      mediaGeral: null,
      tempoTotalSegundos: 0,
      tempoTotalFormatado: formatarDuracaoSegundos(0),
      tempoMedioSegundos: 0,
      tempoMedioFormatado: formatarDuracaoSegundos(0),
      totalTreinosComTempo: 0,
      distribuicaoGeral: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categorias: []
    };
  }

  const exercicios = await listAllExercicios();
  const categoriaPorExercicioId = {};
  const categoriaPorNomeExercicio = {};

  exercicios.forEach((exercicio) => {
    const categoria = String(exercicio?.categoria || '').trim() || 'Sem categoria';
    if (exercicio?.id) categoriaPorExercicioId[exercicio.id] = categoria;

    const nomeNormalizado = normalizeText(exercicio?.nome);
    if (nomeNormalizado && !categoriaPorNomeExercicio[nomeNormalizado]) {
      categoriaPorNomeExercicio[nomeNormalizado] = categoria;
    }
  });

  const treinoIds = Array.from(new Set(finalizacoes.map((item) => String(item?.dados?.treino_id || '').trim()).filter(Boolean)));
  const treinoCategoriasMap = {};

  const itensPorTreino = await Promise.all(
    treinoIds.map(async (treinoId) => {
      const snap = await getDocs(query(collection(db, 'treino_itens'), where('treino_id', '==', treinoId)));
      return { treinoId, itens: snap.docs.map((docSnap) => docSnap.data() || {}) };
    })
  );

  itensPorTreino.forEach(({ treinoId, itens }) => {
    const categorias = new Set();

    itens.forEach((item) => {
      const categoriaPorId = item?.exercicio_id ? categoriaPorExercicioId[item.exercicio_id] : null;
      const categoriaPorNome = categoriaPorNomeExercicio[normalizeText(item?.exercicio_nome)];
      const categoria = categoriaPorId || categoriaPorNome || null;
      if (categoria) categorias.add(categoria);
    });

    treinoCategoriasMap[treinoId] = categorias.size ? Array.from(categorias) : ['Sem categoria'];
  });

  const categoriasAgg = {};
  const distribuicaoGeral = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let somaGeral = 0;
  let totalGeral = 0;
  let somaTempoSegundos = 0;
  let totalComTempo = 0;

  finalizacoes.forEach((item) => {
    const treinoId = String(item?.dados?.treino_id || '').trim();
    const nivel = Number(item?.dados?.nivel_esforco);
    const tempoTreinoSegundos = Number(item?.dados?.tempo_treino_segundos);
    const categorias = treinoCategoriasMap[treinoId] || ['Sem categoria'];

    somaGeral += nivel;
    totalGeral += 1;
    distribuirNivel(distribuicaoGeral, nivel);

    const tempoValido = Number.isFinite(tempoTreinoSegundos) && tempoTreinoSegundos >= 0;
    if (tempoValido) {
      somaTempoSegundos += tempoTreinoSegundos;
      totalComTempo += 1;
    }

    categorias.forEach((categoria) => {
      if (!categoriasAgg[categoria]) {
        categoriasAgg[categoria] = {
          categoria,
          total_treinos: 0,
          soma_esforco: 0,
          soma_tempo_segundos: 0,
          total_com_tempo: 0,
          distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
      }

      categoriasAgg[categoria].total_treinos += 1;
      categoriasAgg[categoria].soma_esforco += nivel;
      if (tempoValido) {
        categoriasAgg[categoria].soma_tempo_segundos += tempoTreinoSegundos;
        categoriasAgg[categoria].total_com_tempo += 1;
      }
      distribuirNivel(categoriasAgg[categoria].distribuicao, nivel);
    });
  });

  const categorias = Object.values(categoriasAgg)
    .map((item) => {
      const tempoMedioSegundosCategoria = item.total_com_tempo
        ? Math.round(item.soma_tempo_segundos / item.total_com_tempo)
        : 0;

      return {
        categoria: item.categoria,
        total_treinos: item.total_treinos,
        media_esforco: Math.round((item.soma_esforco / item.total_treinos) * 10) / 10,
        tempo_medio_segundos: tempoMedioSegundosCategoria,
        tempo_medio_formatado: item.total_com_tempo ? formatarDuracaoSegundos(tempoMedioSegundosCategoria) : '—',
        distribuicao: item.distribuicao
      };
    })
    .sort((a, b) => {
      if (b.total_treinos !== a.total_treinos) return b.total_treinos - a.total_treinos;
      return String(a.categoria || '').localeCompare(String(b.categoria || ''));
    });

  const tempoMedioSegundos = totalComTempo ? Math.round(somaTempoSegundos / totalComTempo) : 0;

  return {
    periodoDias,
    totalNotificacoesConsideradas: finalizacoes.length,
    mediaGeral: totalGeral ? Math.round((somaGeral / totalGeral) * 10) / 10 : null,
    tempoTotalSegundos: somaTempoSegundos,
    tempoTotalFormatado: formatarDuracaoSegundos(somaTempoSegundos),
    tempoMedioSegundos,
    tempoMedioFormatado: totalComTempo ? formatarDuracaoSegundos(tempoMedioSegundos) : '—',
    totalTreinosComTempo: totalComTempo,
    distribuicaoGeral,
    categorias
  };
}

/**
 * Envia notificação
 */
export async function enviarNotificacao(professorId, alunoId, tipo, dados) {
  const notifRef = collection(db, 'notificacoes');
  const dadosLimpos = sanitizeForFirestore(dados || {}) || {};
  const tiposSomenteAluno = ['treino_associado', 'treino_atualizado', 'treino_excluido'];
  const tiposSomenteProfessor = ['treino_iniciado', 'exercicio_concluido', 'treino_finalizado'];
  const tiposSomenteAcademia = ['treino_criado', 'treino_excluido_academia'];
  const professorDestinoId = (tiposSomenteAluno.includes(tipo) || tiposSomenteAcademia.includes(tipo) ? null : professorId) ?? null;
  const alunoDestinoId = (tiposSomenteProfessor.includes(tipo) || tiposSomenteAcademia.includes(tipo) ? null : alunoId) ?? null;

  const intensidadeTexto = {
    1: '😄 Muito leve',
    2: '🙂 Leve',
    3: '😐 Moderado',
    4: '😓 Pesado',
    5: '🥵 Muito pesado'
  };
  
  let mensagem = '';
  switch (tipo) {
    case 'treino_iniciado':
      mensagem = `${dadosLimpos.aluno_nome} iniciou o treino "${dadosLimpos.treino_nome}"`;
      break;
    case 'exercicio_concluido':
      {
        const seriesText = String(dadosLimpos.series ?? '').trim();
        const repeticoesText = String(dadosLimpos.repeticoes ?? '').trim();
        const cargaText = String(dadosLimpos.carga ?? '').trim();

        const partesResumo = [];
        if (seriesText && repeticoesText) {
          partesResumo.push(`${seriesText}x${repeticoesText}`);
        } else if (seriesText) {
          partesResumo.push(`${seriesText} séries`);
        } else if (repeticoesText) {
          partesResumo.push(repeticoesText);
        }

        if (cargaText) {
          partesResumo.push(`${cargaText}kg`);
        }

        const sufixo = partesResumo.length ? ` (${partesResumo.join(' • ')})` : '';
        mensagem = `${dadosLimpos.aluno_nome} concluiu ${dadosLimpos.exercicio_nome}${sufixo}`;
      }
      break;
    case 'treino_finalizado':
      mensagem = `${dadosLimpos.aluno_nome} finalizou o treino "${dadosLimpos.treino_nome}" - ${dadosLimpos.total_exercicios} exercícios`;
      if (dadosLimpos.tempo_treino_formatado) {
        mensagem += `\nTempo total: ${dadosLimpos.tempo_treino_formatado}`;
      }
      if (dadosLimpos.tempo_medio_academia_formatado) {
        mensagem += `\nMédia da academia: ${dadosLimpos.tempo_medio_academia_formatado}`;
      }
      if (dadosLimpos.nivel_esforco && intensidadeTexto[dadosLimpos.nivel_esforco]) {
        mensagem += `\nIntensidade: ${intensidadeTexto[dadosLimpos.nivel_esforco]}`;
      }
      if (dadosLimpos.feedback && String(dadosLimpos.feedback).trim()) {
        mensagem += `\nFeedback: ${String(dadosLimpos.feedback).trim()}`;
      }
      break;
    case 'treino_associado':
      mensagem = `${dadosLimpos.professor_nome || 'Professor'} associou o treino "${dadosLimpos.treino_nome}" para você`;
      break;
    case 'treino_criado':
      mensagem = `${dadosLimpos.professor_nome || 'Professor'} criou o treino "${dadosLimpos.treino_nome}"`;
      if (dadosLimpos.aluno_nome) {
        mensagem += ` para ${dadosLimpos.aluno_nome}`;
      } else {
        mensagem += ' (modelo)';
      }
      break;
    case 'treino_atualizado':
      mensagem = `${dadosLimpos.professor_nome || 'Professor'} atualizou o treino "${dadosLimpos.treino_nome}"`;
      {
        const incluidos = normalizarListaNomes(dadosLimpos?.itens_incluidos || []);
        const excluidos = normalizarListaNomes(dadosLimpos?.itens_excluidos || []);
        mensagem += formatarListaAlteracoes('Incluídos', incluidos);
        mensagem += formatarListaAlteracoes('Excluídos', excluidos);
      }
      break;
    case 'treino_excluido':
      mensagem = `${dadosLimpos.professor_nome || 'Professor'} removeu o treino "${dadosLimpos.treino_nome}" da sua lista`;
      break;
    case 'treino_excluido_academia':
      mensagem = `${dadosLimpos.professor_nome || 'Professor'} excluiu o treino "${dadosLimpos.treino_nome}"`;
      if (dadosLimpos.aluno_nome) {
        mensagem += ` de ${dadosLimpos.aluno_nome}`;
      } else {
        mensagem += ' (modelo)';
      }
      break;
    default:
      mensagem = 'Nova atividade do aluno';
  }
  
  const docRef = await addDoc(notifRef, {
    professor_id: professorDestinoId,
    aluno_id: alunoDestinoId,
    academia_id: String(dadosLimpos?.academia_id || '').trim() || null,
    tipo,
    mensagem,
    dados: dadosLimpos,
    lida: false,
    created_at: new Date()
  });
  
  return docRef.id;
}

/**
 * Gera notificação semanal para atleta aos domingos
 */
export async function notificarResumoSemanalAluno(alunoId, professorId, alunoNome = 'Atleta', dataReferencia = new Date()) {
  if (!alunoId) return { enviada: false, motivo: 'aluno_invalido' };

  const agora = toDateValue(dataReferencia) || new Date();
  if (agora.getDay() !== 0) {
    return { enviada: false, motivo: 'fora_do_domingo' };
  }

  const semanaInicio = inicioSemana(agora);
  const semanaFim = fimSemana(agora);
  const semanaChave = toSemanaChave(agora);

  const qExistentes = query(collection(db, 'notificacoes'), where('aluno_id', '==', alunoId));
  const existentesSnap = await getDocs(qExistentes);
  const jaEnviada = existentesSnap.docs.some((docSnap) => {
    const data = docSnap.data();
    return data?.tipo === 'resumo_semanal' && data?.dados?.semana_chave === semanaChave;
  });

  if (jaEnviada) {
    return { enviada: false, motivo: 'ja_enviada', semanaChave };
  }

  const sessoesSemana = await listarSessoesFinalizadasNoPeriodo(alunoId, semanaInicio, semanaFim);
  const totalTreinos = sessoesSemana.length;
  const mediaIntensidade = resumirIntensidade(sessoesSemana);
  const feedbacks = coletarFeedbacks(sessoesSemana);
  const faixaSemana = formatarIntervaloSemana(semanaInicio, semanaFim);

  let mensagem = `${alunoNome}, resumo da sua semana (${faixaSemana}):\n`;
  mensagem += `Treinos finalizados: ${totalTreinos}`;
  mensagem += mediaIntensidade ? `\nIntensidade média: ${String(mediaIntensidade).replace('.', ',')}/5` : '\nIntensidade média: não informada';
  if (feedbacks.length) {
    mensagem += `\nFeedbacks: ${feedbacks.join(' | ')}`;
  }

  const dados = {
    semana_chave: semanaChave,
    semana_inicio: semanaInicio,
    semana_fim: semanaFim,
    total_treinos: totalTreinos,
    media_intensidade: mediaIntensidade,
    feedbacks
  };

  const docRef = await addDoc(collection(db, 'notificacoes'), {
    professor_id: professorId || null,
    aluno_id: alunoId,
    tipo: 'resumo_semanal',
    mensagem,
    dados,
    lida: false,
    created_at: new Date()
  });

  return {
    enviada: true,
    notificacaoId: docRef.id,
    semanaChave,
    totalTreinos,
    mediaIntensidade,
    feedbacks
  };
}

/**
 * Lista notificações de um professor
 */
export async function listarNotificacoesProfessor(professorId, somenteNaoLidas = false) {
  const baseCollection = collection(db, 'notificacoes');
  const orderedQuery = somenteNaoLidas
    ? query(
        baseCollection,
        where('professor_id', '==', professorId),
        where('lida', '==', false),
        orderBy('created_at', 'desc')
      )
    : query(
        baseCollection,
        where('professor_id', '==', professorId),
        orderBy('created_at', 'desc')
      );

  try {
    const snapshot = await getDocs(orderedQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const needsIndex = err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('requires an index');
    if (!needsIndex) throw err;

    const fallbackQuery = somenteNaoLidas
      ? query(baseCollection, where('professor_id', '==', professorId), where('lida', '==', false))
      : query(baseCollection, where('professor_id', '==', professorId));

    const snapshot = await getDocs(fallbackQuery);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return sortByCreatedAtDesc(notifs);
  }
}

/**
 * Lista notificações de um aluno
 */
export async function listarNotificacoesAluno(alunoId, somenteNaoLidas = false) {
  const baseCollection = collection(db, 'notificacoes');
  const orderedQuery = somenteNaoLidas
    ? query(
        baseCollection,
        where('aluno_id', '==', alunoId),
        where('lida', '==', false),
        orderBy('created_at', 'desc')
      )
    : query(
        baseCollection,
        where('aluno_id', '==', alunoId),
        orderBy('created_at', 'desc')
      );

  try {
    const snapshot = await getDocs(orderedQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const needsIndex = err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('requires an index');
    if (!needsIndex) throw err;

    const fallbackQuery = somenteNaoLidas
      ? query(baseCollection, where('aluno_id', '==', alunoId), where('lida', '==', false))
      : query(baseCollection, where('aluno_id', '==', alunoId));

    const snapshot = await getDocs(fallbackQuery);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return sortByCreatedAtDesc(notifs);
  }
}

/**
 * Lista notificações de uma academia
 */
export async function listarNotificacoesAcademia(academiaId, somenteNaoLidas = false) {
  const academia = String(academiaId || '').trim();
  if (!academia) return [];

  const baseCollection = collection(db, 'notificacoes');
  const orderedQuery = query(
    baseCollection,
    where('academia_id', '==', academia),
    orderBy('created_at', 'desc')
  );

  try {
    const snapshot = await getDocs(orderedQuery);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return somenteNaoLidas ? notifs.filter((item) => item.lida === false) : notifs;
  } catch (err) {
    const needsIndex = err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('requires an index');
    if (!needsIndex) throw err;

    const fallbackQuery = query(baseCollection, where('academia_id', '==', academia));
    const snapshot = await getDocs(fallbackQuery);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sorted = sortByCreatedAtDesc(notifs);
    return somenteNaoLidas ? sorted.filter((item) => item.lida === false) : sorted;
  }
}

/**
 * Marca notificação como lida
 */
export async function marcarComoLida(notificacaoId) {
  const notifRef = doc(db, 'notificacoes', notificacaoId);
  await updateDoc(notifRef, { lida: true });
}

/**
 * Marca todas notificações de um professor como lidas
 */
export async function marcarTodasComoLidas(professorId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('professor_id', '==', professorId),
    where('lida', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { lida: true });
  });
  
  await batch.commit();
}

/**
 * Marca todas notificações de um aluno como lidas
 */
export async function marcarTodasComoLidasAluno(alunoId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('aluno_id', '==', alunoId),
    where('lida', '==', false)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { lida: true });
  });

  await batch.commit();
}

/**
 * Marca todas notificações de uma academia como lidas
 */
export async function marcarTodasComoLidasAcademia(academiaId) {
  const academia = String(academiaId || '').trim();
  if (!academia) return;

  const q = query(
    collection(db, 'notificacoes'),
    where('academia_id', '==', academia)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach(docSnap => {
    if (docSnap.data()?.lida === false) {
      batch.update(docSnap.ref, { lida: true });
    }
  });

  await batch.commit();
}

/**
 * Conta notificações não lidas
 */
export async function contarNaoLidas(professorId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('professor_id', '==', professorId),
    where('lida', '==', false)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Conta notificações não lidas de um aluno
 */
export async function contarNaoLidasAluno(alunoId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('aluno_id', '==', alunoId),
    where('lida', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Conta notificações não lidas de uma academia
 */
export async function contarNaoLidasAcademia(academiaId) {
  const academia = String(academiaId || '').trim();
  if (!academia) return 0;

  const q = query(
    collection(db, 'notificacoes'),
    where('academia_id', '==', academia)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.filter((docSnap) => docSnap.data()?.lida === false).length;
}
