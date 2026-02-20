import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, Pressable, ScrollView, ImageBackground } from 'react-native';
import theme from '../theme';
import { Alert } from '../utils/alert';
import { listItensByTreino, addItemToTreino, deleteItem, reorderItensByTreino, updateTreinoItem } from '../services/treinoItensService';
import { updateTreino, deleteTreino, duplicateTreinoParaAluno } from '../services/treinoService';
import { listAllExercicios } from '../services/exerciciosService';
import { listAllAlunos } from '../services/userService';
import { enviarNotificacao } from '../services/notificacoesService';
import { auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrors';
import CardMedia from '../components/CardMedia';

const treinoDetailHeroImage = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80';
const treinoDetailBackgroundImage = 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1600&q=80';

export default function TreinoDetail({ route, navigation }) {
  const { treino } = route.params;
  const { profile } = useAuth();
  const isProfessor = ['professor', 'admin_academia', 'admin_sistema'].includes(profile?.role);
  const isAcademyStaff = ['professor', 'admin_academia'].includes(profile?.role);
  const currentUserId = auth.currentUser?.uid || profile?.id || profile?.uid || null;
  const isTreinoOwner = treino?.professor_id === currentUserId;
  const isSameAcademiaTreino = String(treino?.academia_id || '').trim() === String(profile?.academia_id || '').trim();
  const isAcademiaEditableTreino = isAcademyStaff
    && isSameAcademiaTreino
    && treino?.is_padrao !== true;
  const canEditTreino = isAcademiaEditableTreino
    || (profile?.role === 'admin_sistema' && treino?.is_padrao === true)
    || (profile?.role === 'professor' && isTreinoOwner && treino?.is_padrao !== true);
  const canManageItens = isAcademiaEditableTreino;
  const [itens, setItens] = useState([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemNome, setEditItemNome] = useState('');
  const [editItemSeries, setEditItemSeries] = useState('');
  const [editItemRepeticoes, setEditItemRepeticoes] = useState('');
  const [editItemCarga, setEditItemCarga] = useState('');
  const [loading, setLoading] = useState(true);
  const originalTreinoRef = useRef({
    nome_treino: treino.nome_treino || '',
    aluno_id: treino.aluno_id || ''
  });
  const originalItensRef = useRef(null);

  // campos para novo item
  const [exercicioSelecionadoId, setExercicioSelecionadoId] = useState(null);
  const [exNome, setExNome] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [carga, setCarga] = useState('');
  const [editNome, setEditNome] = useState(treino.nome_treino || '');
  
  // Busca de exercícios
  const [busca, setBusca] = useState('');
  const [todosExercicios, setTodosExercicios] = useState([]);
  const [exerciciosEncontrados, setExerciciosEncontrados] = useState([]);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  
  // Lista de alunos
  const [alunos, setAlunos] = useState([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState(treino.aluno_id || '');
  const temAlunoAssociado = String(treino?.aluno_id || '').trim().length > 0;

  useEffect(() => {
    navigation.setOptions({ title: treino.nome_treino });
    loadItens();
    if (isProfessor) {
      loadExercicios();
      loadAlunos();
    }
  }, []);

  async function loadExercicios() {
    try {
      const all = await listAllExercicios({ academiaId: profile?.academia_id });
      setTodosExercicios(all);
      setExerciciosEncontrados(all);
    } catch (err) {}
  }

  async function loadAlunos() {
    try {
      const list = await listAllAlunos();
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setAlunos(list);
    } catch (err) {}
  }

  async function loadItens() {
    try {
      const list = await listItensByTreino(treino.id);
      setItens(list);
      if (originalItensRef.current === null) {
        originalItensRef.current = list.map((item) => ({
          exercicio_id: item.exercicio_id,
          exercicio_nome: item.exercicio_nome,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga,
          descanso: item.descanso,
          ordem: item.ordem
        }));
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  function normalizeNomeExercicio(value) {
    return String(value || '').trim().toLowerCase();
  }

  function buildItensDiff(originalItens = [], itensAtuais = []) {
    const mapOriginal = new Map();
    originalItens.forEach((item) => {
      const chave = normalizeNomeExercicio(item?.exercicio_nome);
      if (!chave || mapOriginal.has(chave)) return;
      mapOriginal.set(chave, String(item?.exercicio_nome || '').trim());
    });

    const mapAtual = new Map();
    itensAtuais.forEach((item) => {
      const chave = normalizeNomeExercicio(item?.exercicio_nome);
      if (!chave || mapAtual.has(chave)) return;
      mapAtual.set(chave, String(item?.exercicio_nome || '').trim());
    });

    const itensIncluidos = Array.from(mapAtual.entries())
      .filter(([chave]) => !mapOriginal.has(chave))
      .map(([, nome]) => nome);

    const itensExcluidos = Array.from(mapOriginal.entries())
      .filter(([chave]) => !mapAtual.has(chave))
      .map(([, nome]) => nome);

    return { itensIncluidos, itensExcluidos };
  }

  function getAlunoDestinoNotificacao() {
    const candidato = String(alunoSelecionado || treino.aluno_id || '').trim();
    return candidato || null;
  }

  async function notificarTreinoAtualizado(treinoId, treinoNome, alteracoes = {}) {
    const alunoDestinoId = getAlunoDestinoNotificacao();
    if (!alunoDestinoId) return;

    try {
      await enviarNotificacao(auth.currentUser?.uid, alunoDestinoId, 'treino_atualizado', {
        treino_id: treinoId,
        treino_nome: treinoNome,
        professor_nome: profile?.nome || 'Professor',
        academia_id: treino?.academia_id || profile?.academia_id || null,
        itens_incluidos: alteracoes.itensIncluidos || [],
        itens_excluidos: alteracoes.itensExcluidos || []
      });
    } catch (notifyErr) {}
  }

  async function restoreOriginalTreinoSnapshot() {
    const originalTreino = originalTreinoRef.current;
    const originalItens = originalItensRef.current || [];

    await updateTreino(treino.id, {
      nome_treino: originalTreino.nome_treino,
      aluno_id: originalTreino.aluno_id
    });

    const itensAtuais = await listItensByTreino(treino.id);
    await Promise.all(itensAtuais.map((item) => deleteItem(item.id)));
    await Promise.all(
      originalItens.map((item) =>
        addItemToTreino({
          treino_id: treino.id,
          exercicio_id: item.exercicio_id,
          exercicio_nome: item.exercicio_nome,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga,
          descanso: item.descanso,
          ordem: item.ordem,
          allowDuplicate: true
        })
      )
    );
  }

  async function handleMoveItem(itemId, direction) {
    if (!ensureCanManageItens() || isSavingOrder) return;

    const currentIndex = itens.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= itens.length) return;

    const previous = [...itens];
    const reordered = [...itens];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setItens(reordered);
    setIsSavingOrder(true);
    try {
      await reorderItensByTreino(treino.id, reordered.map((item) => item.id));
    } catch (err) {
      setItens(previous);
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível reordenar os exercícios.'));
    } finally {
      setIsSavingOrder(false);
    }
  }

  function ensureCanManageItens() {
    if (canManageItens) return true;
    Alert.alert('Acesso negado', 'Você não pode editar exercícios deste treino');
    return false;
  }

  function ensureCanEditTreino() {
    if (canEditTreino) return true;
    Alert.alert('Acesso negado', 'Você não tem permissão para salvar alterações neste treino');
    return false;
  }

  async function handleAddItem() {
    if (!ensureCanManageItens()) return;
    if (!exNome) return Alert.alert('Erro', 'Nome do exercício é obrigatório');

    const nomeNovo = String(exNome || '').trim().toLowerCase();
    const jaExiste = itens.some((item) => String(item?.exercicio_nome || '').trim().toLowerCase() === nomeNovo);
    if (jaExiste) return Alert.alert('Atenção', 'Este exercício já foi adicionado neste treino');

    try {
      const seriesValue = String(series || '').trim();
      const repeticoesValue = String(reps || '').trim();
      const cargaValue = String(carga || '').trim();
      const cargaNumerica = Number(cargaValue.replace(',', '.'));

      await addItemToTreino({
        treino_id: treino.id,
        exercicio_id: exercicioSelecionadoId || undefined,
        exercicio_nome: exNome,
        series: seriesValue ? Number(seriesValue) : null,
        repeticoes: repeticoesValue || null,
        carga: cargaValue
          ? (Number.isNaN(cargaNumerica) ? cargaValue : cargaNumerica)
          : null
      });
      await notificarTreinoAtualizado(treino.id, editNome || treino.nome_treino || 'Treino');
      setExercicioSelecionadoId(null);
      setExNome(''); setSeries(''); setReps(''); setCarga('');
      loadItens();
      Alert.alert('Sucesso', 'Item adicionado com sucesso.');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível adicionar o exercício.'));
    }
  }

  async function handleDeleteItem(itemId) {
    if (!ensureCanManageItens()) return;
    try {
      await deleteItem(itemId);
      await notificarTreinoAtualizado(treino.id, editNome || treino.nome_treino || 'Treino');
      loadItens();
      Alert.alert('Sucesso', 'Item removido com sucesso.');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível remover o exercício.'));
    }
  }

  function startEditItem(item) {
    setEditingItemId(item.id);
    setEditItemNome(String(item?.exercicio_nome || ''));
    setEditItemSeries(String(item?.series ?? ''));
    setEditItemRepeticoes(String(item?.repeticoes ?? ''));
    setEditItemCarga(String(item?.carga ?? ''));
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditItemNome('');
    setEditItemSeries('');
    setEditItemRepeticoes('');
    setEditItemCarga('');
  }

  async function handleSaveEditedItem(item) {
    if (!ensureCanManageItens()) return;

    const nomeNormalizado = String(editItemNome || '').trim();
    if (!nomeNormalizado) {
      Alert.alert('Erro', 'Nome do exercício é obrigatório');
      return;
    }

    const duplicado = itens.some((it) =>
      it.id !== item.id && String(it?.exercicio_nome || '').trim().toLowerCase() === nomeNormalizado.toLowerCase()
    );
    if (duplicado) {
      Alert.alert('Atenção', 'Já existe outro exercício com esse nome neste treino');
      return;
    }

    const seriesValue = String(editItemSeries || '').trim();
    const repeticoesValue = String(editItemRepeticoes || '').trim();
    const cargaValue = String(editItemCarga || '').trim();
    const cargaNumerica = Number(cargaValue.replace(',', '.'));

    try {
      const payload = {
        exercicio_nome: nomeNormalizado,
        series: seriesValue ? Number(seriesValue) : null,
        repeticoes: repeticoesValue || null,
        carga: cargaValue
          ? (Number.isNaN(cargaNumerica) ? cargaValue : cargaNumerica)
          : null
      };

      await updateTreinoItem(item.id, payload);
      await notificarTreinoAtualizado(treino.id, editNome || treino.nome_treino || 'Treino');
      cancelEditItem();
      await loadItens();
      Alert.alert('Sucesso', 'Exercício atualizado com sucesso.');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível editar o exercício.'));
    }
  }

  async function confirmCreateNovoVinculo() {
    const mensagem = 'Ao continuar, será criado um novo vínculo para o aluno selecionado e o vínculo anterior será preservado. Deseja continuar?';
    return Alert.confirm('Confirmar criação de vínculo', mensagem, {
      confirmText: 'Criar vínculo'
    });
  }

  async function handleCreateNovoVinculo() {
    const { id: novoTreinoId } = await duplicateTreinoParaAluno(treino.id, {
      aluno_id: alunoSelecionado,
      nome_treino: editNome
    });

    await restoreOriginalTreinoSnapshot();

    try {
      await enviarNotificacao(auth.currentUser?.uid, alunoSelecionado, 'treino_associado', {
        treino_id: novoTreinoId,
        treino_nome: editNome,
        professor_nome: profile?.nome || 'Professor',
        aluno_nome: alunos.find((item) => item.id === alunoSelecionado)?.nome || null,
        academia_id: treino?.academia_id || profile?.academia_id || null
      });
    } catch (notifyErr) {}

    Alert.alert('Sucesso', 'Novo vínculo criado para o aluno selecionado sem alterar o vínculo anterior.');
    navigation.goBack();
  }

  async function handleUpdateTreino() {
    if (!ensureCanEditTreino()) return;
    if (!editNome) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      const alunoAnterior = treino.aluno_id || '';
      const alunoDestinoId = getAlunoDestinoNotificacao();
      const itensAtuais = await listItensByTreino(treino.id);
      const alteracoesItens = buildItensDiff(originalItensRef.current || [], itensAtuais);

      if (alunoSelecionado && alunoSelecionado !== alunoAnterior) {
        const confirmado = await confirmCreateNovoVinculo();
        if (!confirmado) return;
        await handleCreateNovoVinculo();
        return;
      }

      const updates = { nome_treino: editNome };
      if (alunoSelecionado !== treino.aluno_id) {
        updates.aluno_id = alunoSelecionado;
      }
      const result = await updateTreino(treino.id, updates);
      treino.aluno_id = alunoSelecionado; // Atualizar objeto local
      treino.nome_treino = editNome;

      const mensagemSucesso = result?.convertedFromStandard
        ? 'Treino padrão convertido para treino da sua academia e atualizado com sucesso'
        : 'Treino atualizado';

      if (alunoSelecionado && alunoSelecionado !== alunoAnterior) {
        try {
          await enviarNotificacao(auth.currentUser?.uid, alunoSelecionado, 'treino_associado', {
            treino_id: treino.id,
            treino_nome: editNome,
            professor_nome: profile?.nome || 'Professor',
            aluno_nome: alunos.find((item) => item.id === alunoSelecionado)?.nome || null,
            academia_id: treino?.academia_id || profile?.academia_id || null
          });
        } catch (notifyErr) {}
      } else if (alunoDestinoId) {
        await notificarTreinoAtualizado(treino.id, editNome, alteracoesItens);
      }

      originalItensRef.current = itensAtuais.map((item) => ({
        exercicio_id: item.exercicio_id,
        exercicio_nome: item.exercicio_nome,
        series: item.series,
        repeticoes: item.repeticoes,
        carga: item.carga,
        descanso: item.descanso,
        ordem: item.ordem
      }));

      Alert.alert('Sucesso', mensagemSucesso);
      navigation.setOptions({ title: editNome });
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível atualizar o treino.'));
    }
  }

  async function handleDeleteTreino() {
    if (!ensureCanEditTreino()) return;
    try {
      const alunoAssociadoId = String(treino?.aluno_id || '').trim();
      if (alunoAssociadoId) {
        await updateTreino(treino.id, { aluno_id: '' });
        treino.aluno_id = '';
        setAlunoSelecionado('');
        Alert.alert('Sucesso', 'Associação entre treino e aluno removida com sucesso.');
        navigation.goBack();
        return;
      }

      const treinoExcluido = await deleteTreino(treino.id);
      const alunoNome = treinoExcluido?.aluno_id
        ? (alunos.find((item) => item.id === treinoExcluido.aluno_id)?.nome || null)
        : null;

      if (treinoExcluido?.aluno_id) {
        try {
          await enviarNotificacao(auth.currentUser?.uid, treinoExcluido.aluno_id, 'treino_excluido', {
            treino_id: treinoExcluido.id,
            treino_nome: treinoExcluido.nome_treino || treino.nome_treino || 'Treino',
            professor_nome: profile?.nome || 'Professor',
            academia_id: treinoExcluido.academia_id || treino?.academia_id || profile?.academia_id || null
          });
        } catch (notifyErr) {}
      }

      try {
        await enviarNotificacao(auth.currentUser?.uid, null, 'treino_excluido_academia', {
          treino_id: treinoExcluido.id,
          treino_nome: treinoExcluido.nome_treino || treino.nome_treino || 'Treino',
          professor_nome: profile?.nome || 'Professor',
          aluno_nome: alunoNome,
          academia_id: treinoExcluido.academia_id || treino?.academia_id || profile?.academia_id || null
        });
      } catch (notifyErr) {}

      Alert.alert('Sucesso', 'Treino excluído com sucesso.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o treino.'));
    }
  }

  async function confirmDeleteTreino() {
    const possuiAlunoVinculado = String(treino?.aluno_id || '').trim().length > 0;
    const alunoNomeAssociado = possuiAlunoVinculado
      ? (alunos.find((item) => item.id === treino.aluno_id)?.nome || 'aluno associado')
      : '';
    const confirmado = await Alert.confirm(
      possuiAlunoVinculado ? 'Confirmar remoção de associação' : 'Confirmar exclusão',
      possuiAlunoVinculado
        ? `Deseja realmente remover a associação do treino "${treino.nome_treino}" com ${alunoNomeAssociado}?`
        : `Deseja realmente excluir o treino "${treino.nome_treino}"? Todos os exercícios serão perdidos.`,
      { confirmText: possuiAlunoVinculado ? 'Remover associação' : 'Excluir', destructive: true }
    );
    if (!confirmado) return;
    handleDeleteTreino();
  }

  async function buscarExercicios(termo) {
    setBusca(termo);
    const termoBusca = String(termo || '').trim().toLowerCase();
    if (termoBusca.length < 2) {
      setExerciciosEncontrados(todosExercicios);
      return;
    }

    const filtradosPorNome = todosExercicios.filter((ex) =>
      String(ex.nome || '').toLowerCase().includes(termoBusca)
    );

    if (filtradosPorNome.length > 0) {
      setExerciciosEncontrados(filtradosPorNome);
      return;
    }

    const filtradosPorCategoria = todosExercicios.filter((ex) =>
      String(ex.categoria || '').toLowerCase().includes(termoBusca)
    );

    setExerciciosEncontrados(filtradosPorCategoria);
  }

  function selecionarExercicio(exercicio) {
    setExercicioSelecionadoId(exercicio?.id || null);
    setExNome(exercicio.nome);
    setSeries(String(exercicio.series_padrao || ''));
    setReps(String(exercicio.repeticoes_padrao || ''));
    setCarga(String(exercicio.carga_padrao || ''));
    setMostrarBusca(false);
    setBusca('');
  }

  function formatExercicioResumo(item) {
    const seriesText = String(item?.series ?? '').trim();
    const repeticoesText = String(item?.repeticoes ?? '').trim();
    const cargaText = String(item?.carga ?? '').trim();

    const partes = [];
    if (seriesText && repeticoesText) {
      partes.push(`${seriesText} x ${repeticoesText}`);
    } else if (seriesText) {
      partes.push(`${seriesText} séries`);
    } else if (repeticoesText) {
      partes.push(repeticoesText);
    }

    if (cargaText) {
      const cargaNumero = Number(cargaText.replace(',', '.'));
      partes.push(Number.isNaN(cargaNumero) ? cargaText : `${cargaText}kg`);
    }

    return partes.join(' • ');
  }

  function formatExercicioBancoResumo(exercicio) {
    const categoria = String(exercicio?.categoria || '').trim();
    const seriesPadrao = exercicio?.series_padrao;
    const repeticoesPadrao = exercicio?.repeticoes_padrao;

    const temSeries = seriesPadrao !== null && seriesPadrao !== undefined && String(seriesPadrao).trim() !== '';
    const temRepeticoes = repeticoesPadrao !== null && repeticoesPadrao !== undefined && String(repeticoesPadrao).trim() !== '';

    const partes = [];
    if (categoria) partes.push(categoria);

    if (temSeries && temRepeticoes) {
      partes.push(`${seriesPadrao}x${repeticoesPadrao}`);
    } else if (temSeries) {
      partes.push(`${seriesPadrao} séries`);
    } else if (temRepeticoes) {
      partes.push(`${repeticoesPadrao} repetições`);
    }

    return partes.join(' • ');
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: treinoDetailBackgroundImage }}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View style={styles.screenBackgroundTint} />
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.contentContainer}>
      <ImageBackground
        source={{ uri: treinoDetailHeroImage }}
        style={styles.heroCard}
        imageStyle={styles.heroCardImage}
      >
        <View style={styles.heroCardTint} />
        <View style={styles.heroCardContent}>
          <Text style={styles.heroTag}>DETALHES DO TREINO</Text>
          <Text style={styles.heroTitle}>{treino.nome_treino}</Text>
          <Text style={styles.heroHint}>{itens.length} exercício(s) • {canEditTreino ? 'Edição habilitada' : 'Visualização'}</Text>
        </View>
      </ImageBackground>

      <View style={styles.cardBlock}>
        <CardMedia variant="exercicio" label="EXERCÍCIOS DO TREINO" />
        <Text style={styles.section}>Exercícios do Treino</Text>
        {loading && <Text style={styles.mutedText}>Carregando...</Text>}
        {!loading && itens.length === 0 && <Text style={styles.mutedText}>Nenhum exercício adicionado ainda</Text>}
        {!loading && itens.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Pressable style={{ flex: 1 }} onPress={() => canManageItens && startEditItem(item)}>
              <Text style={{ fontSize: 16, color: theme.colors.text }}>{item.exercicio_nome}</Text>
              {!!formatExercicioResumo(item) && (
                <Text style={{ color: theme.colors.muted }}>{formatExercicioResumo(item)}</Text>
              )}
              {canManageItens && <Text style={styles.itemHint}>Toque para editar este exercício</Text>}

              {editingItemId === item.id && (
                <View style={styles.itemEditBox}>
                  <TextInput placeholder="Nome do exercício" style={styles.input} value={editItemNome} onChangeText={setEditItemNome} />
                  <TextInput placeholder="Séries" style={styles.input} value={editItemSeries} onChangeText={setEditItemSeries} keyboardType="numeric" />
                  <TextInput placeholder="Repetições" style={styles.input} value={editItemRepeticoes} onChangeText={setEditItemRepeticoes} />
                  <TextInput placeholder="Carga (kg)" style={styles.input} value={editItemCarga} onChangeText={setEditItemCarga} keyboardType="numeric" />
                  <View style={styles.itemEditActions}>
                    <Pressable style={styles.itemEditSaveBtn} onPress={() => handleSaveEditedItem(item)}>
                      <Text style={styles.itemEditSaveText}>Salvar</Text>
                    </Pressable>
                    <Pressable style={styles.itemEditCancelBtn} onPress={cancelEditItem}>
                      <Text style={styles.itemEditCancelText}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Pressable>
            {canManageItens && (
              <View style={styles.itemActions}>
                <Pressable
                  onPress={() => handleMoveItem(item.id, 'up')}
                  style={styles.orderBtn}
                  disabled={isSavingOrder}
                >
                  <Text style={styles.orderBtnText}>↑</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleMoveItem(item.id, 'down')}
                  style={styles.orderBtn}
                  disabled={isSavingOrder}
                >
                  <Text style={styles.orderBtnText}>↓</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteItem(item.id)} style={{ padding: 8 }}>
                  <Text style={{ color: '#dc2626' }}>Remover</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>

      {canManageItens && (
        <View style={styles.cardBlock}>
        <CardMedia variant="exercicio" label="ADICIONAR EXERCÍCIO" />
        <Text style={styles.section}>Adicionar exercício</Text>
        
        <Button 
          title={mostrarBusca ? "Fechar banco de exercícios" : "📚 Buscar no banco de exercícios"} 
          onPress={() => setMostrarBusca(!mostrarBusca)} 
        />

        {mostrarBusca && (
          <View style={styles.buscaContainer}>
            <TextInput 
              placeholder="Buscar por categoria (ex.: Peito)" 
              style={styles.input} 
              value={busca} 
              onChangeText={buscarExercicios} 
            />
            <ScrollView style={styles.listaExercicios} nestedScrollEnabled>
              {exerciciosEncontrados.map((ex) => {
                const resumoBanco = formatExercicioBancoResumo(ex);
                return (
                  <Pressable 
                    key={ex.id} 
                    style={styles.exercicioItem} 
                    onPress={() => selecionarExercicio(ex)}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '500' }}>{ex.nome}</Text>
                    {!!resumoBanco && (
                      <Text style={{ fontSize: 12, color: '#666' }}>
                        {resumoBanco}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <TextInput
          placeholder="Nome do exercício"
          style={styles.input}
          value={exNome}
          onChangeText={(value) => {
            setExNome(value);
            setExercicioSelecionadoId(null);
          }}
        />
        <TextInput placeholder="Séries" style={styles.input} value={series} onChangeText={setSeries} keyboardType="numeric" />
        <TextInput placeholder="Repetições" style={styles.input} value={reps} onChangeText={setReps} />
        <TextInput placeholder="Carga (kg)" style={styles.input} value={carga} onChangeText={setCarga} keyboardType="numeric" />
        <Button title="Adicionar" onPress={handleAddItem} />
        </View>
      )}

      {canEditTreino && (
        <View style={styles.cardBlock}>
          <CardMedia variant="treino" label="EDIÇÃO DO TREINO" />
          <Text style={styles.section}>Editar treino</Text>
          <TextInput placeholder="Nome do treino" style={styles.input} value={editNome} onChangeText={setEditNome} />
          
          <Text style={styles.section}>Associar a um aluno</Text>
          <View style={styles.pickerContainer}>
            <select 
              style={styles.picker}
              value={alunoSelecionado}
              onChange={(e) => setAlunoSelecionado(e.target.value)}
            >
              <option value="">Nenhum aluno (treino modelo)</option>
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome} ({aluno.email})
                </option>
              ))}
            </select>
          </View>

          {alunoSelecionado && alunoSelecionado !== (treino.aluno_id || '') && (
            <Text style={styles.warningText}>
              Ao salvar, será criado um novo vínculo para o aluno selecionado. O vínculo anterior permanecerá inalterado.
            </Text>
          )}
          
          <Button
            title={alunoSelecionado && alunoSelecionado !== (treino.aluno_id || '') ? '🔗 Criar novo vínculo' : '💾 Salvar alterações'}
            onPress={handleUpdateTreino}
            color={alunoSelecionado && alunoSelecionado !== (treino.aluno_id || '') ? '#d97706' : '#059669'}
          />
        </View>
      )}

      {canEditTreino && (
        <Pressable style={styles.deleteButton} onPress={confirmDeleteTreino}>
          <Text style={styles.deleteButtonText}>
            {temAlunoAssociado ? '🗑️ Excluir associação' : '🗑️ Excluir treino'}
          </Text>
        </Pressable>
      )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  contentContainer: {
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(2)
  },
  screenBackground: {
    ...StyleSheet.absoluteFillObject
  },
  screenBackgroundImage: {
    opacity: 0.12
  },
  screenBackgroundTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    opacity: 0.08
  },
  heroCard: {
    minHeight: 136,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing(1.5),
    justifyContent: 'flex-end'
  },
  heroCardImage: {
    borderRadius: theme.radii.lg
  },
  heroCardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text,
    opacity: 0.56
  },
  heroCardContent: {
    padding: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.32)'
  },
  heroTag: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8
  },
  heroTitle: {
    color: theme.colors.card,
    fontSize: theme.fontSizes.xl,
    fontWeight: '800',
    marginTop: 4
  },
  heroHint: {
    color: theme.colors.card,
    fontSize: 12,
    marginTop: 4
  },
  cardBlock: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5)
  },
  mutedText: { color: theme.colors.muted, marginBottom: 10 },
  warningText: {
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: theme.radii.sm, padding: theme.spacing(1.5), marginBottom: theme.spacing(1), backgroundColor: theme.colors.background },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  itemHint: {
    marginTop: 2,
    fontSize: 11,
    color: theme.colors.muted
  },
  itemEditBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: 8,
    backgroundColor: theme.colors.background
  },
  itemEditActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  itemEditSaveBtn: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radii.sm
  },
  itemEditSaveText: {
    color: theme.colors.card,
    fontWeight: '600'
  },
  itemEditCancelBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radii.sm
  },
  itemEditCancelText: {
    color: theme.colors.text,
    fontWeight: '600'
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  orderBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background
  },
  orderBtnText: {
    color: theme.colors.text,
    fontWeight: '700'
  },
  deleteButton: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fee',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#fca',
    alignItems: 'center'
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 16
  },
  buscaContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: theme.radii.md,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  listaExercicios: {
    maxHeight: 200,
    marginTop: 8
  },
  exercicioItem: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: theme.radii.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing(1),
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  picker: {
    width: '100%',
    padding: theme.spacing(1.5),
    fontSize: 16,
    backgroundColor: 'transparent'
  }
});
