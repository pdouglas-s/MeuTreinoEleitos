import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, Pressable as TouchableOpacity, Pressable as TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import theme from '../../theme';
import { Alert } from '../../utils/alert';
import { listAllExercicios, createExercicio, deleteExercicio, inicializarBancoExercicios, existemExerciciosPadrao, deleteExerciciosPadrao, updateExercicio, personalizarExercicioPadraoParaAcademia, exercicioTemAlunoAssociado, ocultarExercicioPadraoParaAcademia } from '../../services/exerciciosService';
import { listAllProfessores, listAcademias } from '../../services/userService';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/authErrors';
import CardMedia from '../../components/CardMedia';

export default function GerenciarExercicios({ navigation }) {
  const { logout, profile } = useAuth();
  const isSystemAdmin = profile?.role === 'admin_sistema';
  const isAcademyAdmin = profile?.role === 'admin_academia';
  const [exercicios, setExercicios] = useState([]);
  const [buscaExercicio, setBuscaExercicio] = useState('');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [statusMensagem, setStatusMensagem] = useState('');
  const [temExerciciosPadrao, setTemExerciciosPadrao] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [categoriaEditada, setCategoriaEditada] = useState('');
  const [seriesEditadas, setSeriesEditadas] = useState('');
  const [repsEditadas, setRepsEditadas] = useState('');
  const [professoresAcademia, setProfessoresAcademia] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [academiasSistema, setAcademiasSistema] = useState([]);
  const [academiaSelecionadaSistema, setAcademiaSelecionadaSistema] = useState('');
  const [academiaSelecionadaSistemaInfo, setAcademiaSelecionadaSistemaInfo] = useState(null);
  const [buscaAcademiaSistema, setBuscaAcademiaSistema] = useState('');
  const [academiaEditadaSistema, setAcademiaEditadaSistema] = useState('');

  useEffect(() => {
    if (!['admin_sistema', 'admin_academia'].includes(profile?.role)) {
      Alert.alert('Acesso negado', 'Esta área é exclusiva de administradores.');
      const fallbackRoute = profile?.role === 'admin_academia'
        ? 'AdminAcademiaHome'
        : profile?.role === 'professor'
          ? 'ProfessorHome'
          : 'AlunoHome';
      navigation.replace(fallbackRoute);
      return;
    }

    loadExercicios();
  }, [profile?.role]);

  useEffect(() => {
    if (isSystemAdmin) {
      setFiltroAtivo('todos');
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;

    (async () => {
      try {
        const list = await listAcademias();
        setAcademiasSistema(list);
        if (!academiaSelecionadaSistema && list.length > 0) {
          const primeira = list[0] || null;
          setAcademiaSelecionadaSistema(String(primeira?.id || ''));
          setAcademiaSelecionadaSistemaInfo(primeira);
        } else {
          const selecionada = list.find((item) => String(item?.id || '') === String(academiaSelecionadaSistema || '')) || null;
          setAcademiaSelecionadaSistemaInfo(selecionada);
        }
      } catch (err) {
        Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar academias para vincular exercício.'));
      }
    })();
  }, [isSystemAdmin]);

  // Atualiza exercícios ao trocar academia selecionada (admin_sistema)
  useEffect(() => {
    if (isSystemAdmin && academiaSelecionadaSistema) {
      loadExercicios();
    }
  }, [academiaSelecionadaSistema]);

  const academiasSistemaEncontradas = useMemo(() => {
    const termo = String(buscaAcademiaSistema || '').trim().toLowerCase();
    if (termo.length < 2) return [];

    return academiasSistema
      .filter((item) => String(item?.nome || '').toLowerCase().includes(termo))
      .slice(0, 8);
  }, [academiasSistema, buscaAcademiaSistema]);

  function handleSelecionarAcademiaSistema(item) {
    setAcademiaSelecionadaSistema(String(item?.id || ''));
    setAcademiaSelecionadaSistemaInfo(item || null);
    setBuscaAcademiaSistema('');
  }

  async function loadExercicios() {
    try {
      let academiaIdAtual = String(profile?.academia_id || '').trim();
      if (isSystemAdmin && academiaSelecionadaSistema) {
        academiaIdAtual = String(academiaSelecionadaSistema).trim();
      }
      const promises = [listAllExercicios({ academiaId: academiaIdAtual })];
      if (isAcademyAdmin) {
        promises.push(listAllProfessores());
      }

      const [list, professoresList] = await Promise.all(promises);
      list.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
      setExercicios(list);
      setProfessoresAcademia(Array.isArray(professoresList) ? professoresList : []);

      // Verificar se existem exercícios padrão
      const temPadrao = await existemExerciciosPadrao();
      setTemExerciciosPadrao(temPadrao);
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar os exercícios.'));
    }
  }

  async function handleCreateExercicio() {
    if (!nome || !categoria) return Alert.alert('Erro', 'Nome e categoria são obrigatórios');
    if (isSystemAdmin && !academiaSelecionadaSistema) {
      return Alert.alert('Erro', 'Selecione a academia para criar o exercício.');
    }
    try {
      const seriesTexto = String(series || '').trim();
      const repsTexto = String(reps || '').trim();
      const academiaIdAtual = isSystemAdmin
        ? String(academiaSelecionadaSistema || '').trim()
        : String(profile?.academia_id || '').trim();
      const payloadCreate = {
        nome, 
        categoria, 
        series_padrao: seriesTexto || null,
        repeticoes_padrao: repsTexto || null,
        criado_por: auth.currentUser?.uid, // Identifica quem criou
        academia_id: academiaIdAtual || null,
        is_padrao: false
      };

      await createExercicio(payloadCreate);
      Alert.alert('Sucesso', 'Exercício criado com sucesso.');
      setNome('');
      setCategoria('');
      setSeries('');
      setReps('');
      loadExercicios();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível criar o exercício.'));
    }
  }

  async function handleDeleteExercicio(exercicio) {
    try {
      const isOcultacaoPadraoAcademia = isAcademyAdmin && exercicio?.is_padrao === true;

      if (isOcultacaoPadraoAcademia) {
        const academiaIdAtual = String(profile?.academia_id || '').trim();
        try {
          await ocultarExercicioPadraoParaAcademia({
            exercicioPadraoId: exercicio?.id,
            academiaId: academiaIdAtual
          });

          setExercicios((prev) => prev.filter((item) => item?.id !== exercicio?.id));
          Alert.alert('Sucesso', 'Exercício padrão ocultado para esta academia.');
          await loadExercicios();
        } catch (err) {
          const errorCode = String(err?.code || 'desconhecido').trim();
          const errorMessage = getAuthErrorMessage(err, 'Não foi possível ocultar o exercício padrão para esta academia.');
          Alert.alert(
            'Erro ao ocultar exercício padrão',
            `${errorMessage}\n\ncode: ${errorCode}\nacademia_id: ${academiaIdAtual || 'não informado'}`
          );
        }
        return;
      }

      let temAssociacao = false;
      try {
        temAssociacao = await exercicioTemAlunoAssociado({
          exercicioId: exercicio?.id,
          exercicioNome: exercicio?.nome,
          academiaId: isAcademyAdmin ? profile?.academia_id : null,
          strictAcademiaScope: isAcademyAdmin,
          allowNameFallback: !exercicio?.id
        });
      } catch (checkErr) {
        const code = String(checkErr?.code || '').toLowerCase();
        const message = String(checkErr?.message || '').toLowerCase();
        const isPermissionError = code.includes('permission-denied') || message.includes('insufficient permissions');
        const podeIgnorarCheck = (isAcademyAdmin && isExercicioAcademia(exercicio)) || isSystemAdmin;

        if (!(isPermissionError && podeIgnorarCheck)) {
          throw checkErr;
        }
      }

      if (temAssociacao) {
        return Alert.alert('Ação bloqueada', 'Este exercício está associado a treino de aluno e não pode ser excluído.');
      }

      await deleteExercicio(exercicio.id);
      Alert.alert('Sucesso', 'Exercício excluído com sucesso.');
      loadExercicios();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o exercício.'));
    }
  }

  function iniciarEdicao(exercicio) {
    setEditandoId(exercicio.id);
    setNomeEditado(exercicio.nome || '');
    setCategoriaEditada(exercicio.categoria || '');
    setSeriesEditadas(exercicio.series_padrao ? String(exercicio.series_padrao) : '');
    setRepsEditadas(exercicio.repeticoes_padrao ? String(exercicio.repeticoes_padrao) : '');
    setAcademiaEditadaSistema(String(exercicio?.academia_id || ''));
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEditado('');
    setCategoriaEditada('');
    setSeriesEditadas('');
    setRepsEditadas('');
    setAcademiaEditadaSistema('');
  }

  async function salvarEdicaoExercicio(exercicio) {
    const novoNome = String(nomeEditado || '').trim();
    const novaCategoria = String(categoriaEditada || '').trim();
    const novasSeries = String(seriesEditadas || '').trim();
    const novasReps = String(repsEditadas || '').trim();

    if (!novoNome) return Alert.alert('Erro', 'Nome do exercício é obrigatório');

    const payload = {
      nome: novoNome,
      categoria: novaCategoria || exercicio.categoria || '',
      series_padrao: novasSeries === '' ? null : novasSeries,
      repeticoes_padrao: novasReps === '' ? null : novasReps
    };

    const seriesAtual = String(exercicio?.series_padrao ?? '').trim() || null;
    const repsAtual = String(exercicio?.repeticoes_padrao ?? '').trim() || null;

    const unchanged =
      payload.nome === (exercicio.nome || '')
      && payload.categoria === (exercicio.categoria || '')
      && payload.series_padrao === seriesAtual
      && payload.repeticoes_padrao === repsAtual;

    if (unchanged) {
      cancelarEdicao();
      return;
    }

    try {
      const academiaIdAtual = String(profile?.academia_id || '').trim();
      const academiaIdSistema = String(academiaEditadaSistema || exercicio?.academia_id || '').trim();
      const academiaPayload = {
        ...payload,
        criado_por: auth.currentUser?.uid,
        academia_id: isSystemAdmin ? (academiaIdSistema || null) : (academiaIdAtual || null),
        is_padrao: false
      };

      const sistemaPayload = {
        ...payload,
        is_padrao: true
      };

      if (exercicio?.is_padrao === true && academiaIdAtual) {
        const { ocultacaoAplicada } = await personalizarExercicioPadraoParaAcademia({
          exercicioPadrao: exercicio,
          payload,
          academiaId: academiaIdAtual,
          criadoPor: auth.currentUser?.uid
        });
        Alert.alert(
          'Sucesso',
          ocultacaoAplicada
            ? 'Exercício removido do padrão e atualizado para esta academia.'
            : 'Exercício atualizado para esta academia.'
        );
        setFiltroAtivo('academia');
      } else if (exercicio?.is_padrao === true && isSystemAdmin) {
        await updateExercicio(exercicio.id, sistemaPayload);
        Alert.alert('Sucesso', 'Exercício padrão atualizado com sucesso.');
      } else {
        if (isSystemAdmin && !academiaPayload.academia_id) {
          return Alert.alert('Erro', 'Selecione a academia para atualizar o exercício.');
        }
        await updateExercicio(exercicio.id, academiaPayload);
        Alert.alert('Sucesso', 'Exercício atualizado com sucesso.');
      }

      await loadExercicios();
      cancelarEdicao();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível atualizar o exercício.'));
    }
  }

  async function confirmDelete(exercicio) {
    const isOcultacaoPadraoAcademia = isAcademyAdmin && exercicio?.is_padrao === true;
    const confirmado = await Alert.confirm(
      isOcultacaoPadraoAcademia ? 'Confirmar ocultação' : 'Confirmar exclusão',
      isOcultacaoPadraoAcademia
        ? `Deseja ocultar "${exercicio.nome}" somente para esta academia?`
        : `Deseja realmente excluir "${exercicio.nome}"?`,
      { confirmText: isOcultacaoPadraoAcademia ? 'Ocultar' : 'Excluir', destructive: true }
    );
    if (!confirmado) return;
    handleDeleteExercicio(exercicio);
  }

  async function handleInicializarBanco() {
    const mensagem = temExerciciosPadrao 
      ? 'Esta ação irá substituir os exercícios padrão do sistema para todas as academias.\n\nPersonalizações derivadas dos exercícios padrão serão reiniciadas.\n\nDeseja continuar?'
      : 'Esta ação irá adicionar 162 exercícios padrão ao banco.\n\nDeseja continuar?';
    
    const confirmado = await Alert.confirm('Confirmar ação', mensagem, { confirmText: 'Continuar' });
    if (!confirmado) return;
    try {
      setCarregando(true);
      setProgresso(0);
      setStatusMensagem('Preparando...');
      
      const results = await inicializarBancoExercicios((current, total, status) => {
        setProgresso(Math.round((current / total) * 100));
        setStatusMensagem(status);
      });

      setStatusMensagem('Carregando exercícios...');
      await loadExercicios();
      
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      Alert.alert('Sucesso', `Banco atualizado: ${results.length} exercícios padrão adicionados.`);
    } catch (err) {
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível inicializar o banco de exercícios.'));
    }
  }

  async function handleExcluirPadrao() {
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      'Deseja realmente excluir todos os exercícios padrão do sistema?\n\nSeus exercícios personalizados serão mantidos.\n\nEsta ação não pode ser desfeita.',
      { confirmText: 'Excluir', destructive: true }
    );
    if (!confirmado) return;
    try {
      setCarregando(true);
      setProgresso(0);
      setStatusMensagem('Preparando exclusão...');
      
      const deleted = await deleteExerciciosPadrao((current, total, status) => {
        setProgresso(Math.round((current / total) * 100));
        setStatusMensagem(status);
      });
      
      setStatusMensagem('Carregando exercícios...');
      await loadExercicios();
      
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      
      Alert.alert('Sucesso', `${deleted} exercícios padrão excluídos.`);
    } catch (err) {
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir os exercícios padrão.'));
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Falha ao sair.'));
    }
  }

  const myAcademiaId = String(profile?.academia_id || '').trim();
  const myUserId = String(auth.currentUser?.uid || '').trim();
  const professorIdsAcademia = new Set([
    myUserId,
    ...professoresAcademia.map((prof) => prof?.id)
  ].filter(Boolean));

  const isExercicioAcademia = (item) => {
    if (isSystemAdmin) return item?.is_padrao !== true;

    if (item?.is_padrao === true) return false;

    const itemAcademiaId = String(item?.academia_id || '').trim();
    if (myAcademiaId && itemAcademiaId && itemAcademiaId === myAcademiaId) return true;

    const criadoPor = String(item?.criado_por || '').trim();
    return !!criadoPor && professorIdsAcademia.has(criadoPor);
  };

  const exerciciosPadrao = exercicios.filter((item) => item?.is_padrao === true);
  const exerciciosAcademia = exercicios.filter(isExercicioAcademia);

  const exerciciosVisiveis = exercicios.filter((item) => {
    if (isSystemAdmin) return true;
    if (item?.is_padrao === true) return true;
    return isExercicioAcademia(item);
  });
  const totalPadrao = exerciciosPadrao.length;
  const totalAcademia = exerciciosAcademia.length;

  // Filtra exercícios pelo campo de busca
  const exerciciosFiltrados = (filtroAtivo === 'padrao'
    ? exerciciosPadrao
    : filtroAtivo === 'academia'
      ? exerciciosAcademia
      : exerciciosVisiveis
  ).filter((item) => {
    if (!buscaExercicio.trim()) return true;
    const nome = String(item?.nome || '').toLowerCase();
    const categoria = String(item?.categoria || '').toLowerCase();
    const busca = buscaExercicio.toLowerCase();
    return nome.includes(busca) || categoria.includes(busca);
  });

  const filtroDescricao = filtroAtivo === 'padrao'
    ? ' (somente padrão)'
    : filtroAtivo === 'academia'
      ? ' (somente da academia)'
      : '';

  function alternarFiltro(tipo) {
    setFiltroAtivo((atual) => (atual === tipo ? 'todos' : tipo));
  }

  function formatarDetalhesExercicio(item) {
    const categoria = String(item?.categoria || '').trim();
    const seriesPadrao = item?.series_padrao;
    const repeticoesPadrao = item?.repeticoes_padrao;

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
      <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
        <View style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar ao painel</Text>
        </View>
      </TouchableWithoutFeedback>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gerenciar Banco de Exercícios</Text>
          <Text style={styles.subtitle}>Organize os exercícios para montar fichas mais rápido</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.statCard, filtroAtivo === 'todos' && styles.statCardActive]}
          onPress={() => setFiltroAtivo('todos')}
        >
          <CardMedia variant="exercicio" label="EXERCÍCIOS" compact />
          <Text style={styles.statValue}>{exerciciosVisiveis.length}</Text>
          <Text style={styles.statLabel}>Exercícios</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filtroAtivo === 'academia' && styles.statCardActive]}
          onPress={() => alternarFiltro('academia')}
        >
          <CardMedia variant="academia" label="DA ACADEMIA" compact />
          <Text style={styles.statValue}>{totalAcademia}</Text>
          <Text style={styles.statLabel}>Da academia</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filtroAtivo === 'padrao' && styles.statCardActive]}
          onPress={() => alternarFiltro('padrao')}
        >
          <CardMedia variant="sistema" label="PADRÃO" compact />
          <Text style={styles.statValue}>{totalPadrao}</Text>
          <Text style={styles.statLabel}>Padrão</Text>
        </TouchableOpacity>
      </View>

      {exerciciosFiltrados.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={{ marginBottom: 12, textAlign: 'center', color: theme.colors.muted }}>Nenhum exercício cadastrado</Text>
        </View>
      )}

      {carregando && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{statusMensagem}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progresso}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{progresso}%</Text>
        </View>
      )}

      {isSystemAdmin && (
        <View style={styles.cardBlock}>
          <CardMedia variant="sistema" label="BANCO PADRÃO" />
          <Text style={styles.blockTitle}>Banco padrão do sistema</Text>
          <Text style={styles.blockHint}>Use para popular ou limpar exercícios padrões sem afetar os personalizados.</Text>
          <View style={styles.actionContainer}>
          <Button 
              title={carregando ? "Processando..." : (temExerciciosPadrao ? "Reinicializar exercícios padrão" : "Inicializar exercícios padrão")}
            onPress={handleInicializarBanco}
            color={theme.colors.primary}
            disabled={carregando}
          />
          {temExerciciosPadrao && (
            <View style={{ marginTop: 8 }}>
              <Button 
                title="Excluir exercícios padrão"
                onPress={handleExcluirPadrao}
                color={theme.colors.danger}
                disabled={carregando}
              />
            </View>
          )}
          </View>
        </View>
      )}

      <View style={styles.cardBlock}>
        <CardMedia variant="exercicio" label="NOVO EXERCÍCIO" />
        <Text style={styles.blockTitle}>Cadastrar novo exercício</Text>
        {isSystemAdmin && (
          <>
            <Text style={styles.blockHint}>Selecione a academia em que o exercício será criado.</Text>
            <TextInput
              placeholder="Digite o nome da academia"
              value={buscaAcademiaSistema}
              onChangeText={(value) => {
                setBuscaAcademiaSistema(value);
                setAcademiaSelecionadaSistema('');
                setAcademiaSelecionadaSistemaInfo(null);
              }}
              style={styles.input}
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>Digite pelo menos 2 letras para buscar.</Text>

            {academiasSistemaEncontradas.length > 0 && (
              <View style={styles.academiasSugestoesBox}>
                {academiasSistemaEncontradas.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.academiaSugestaoItem}
                    onPress={() => handleSelecionarAcademiaSistema(item)}
                  >
                    <Text style={styles.academiaSugestaoNome}>{item.nome}</Text>
                    <Text style={styles.academiaSugestaoMeta}>ID: {item.id}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {academiaSelecionadaSistemaInfo && (
              <View style={styles.academiaSelecionadaBox}>
                <Text style={styles.academiaSelecionadaText}>Selecionada: {academiaSelecionadaSistemaInfo.nome}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setBuscaAcademiaSistema('');
                    setAcademiaSelecionadaSistema('');
                    setAcademiaSelecionadaSistemaInfo(null);
                  }}
                >
                  <Text style={styles.academiaSelecionadaRemover}>Limpar</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <TextInput placeholder="Nome do exercício" style={styles.input} value={nome} onChangeText={setNome} />
        <TextInput placeholder="Categoria (Peito, Costas, Pernas...)" style={styles.input} value={categoria} onChangeText={setCategoria} />
        <TextInput placeholder="Séries padrão" style={styles.input} value={series} onChangeText={setSeries} />
        <TextInput placeholder="Repetições padrão" style={styles.input} value={reps} onChangeText={setReps} />
        <Button title="Adicionar Exercício" onPress={handleCreateExercicio} />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Exercícios Cadastrados ({exerciciosFiltrados.length}){filtroDescricao}</Text>
        {filtroAtivo !== 'todos' && (
          <TouchableOpacity onPress={() => setFiltroAtivo('todos')} style={styles.clearFilterBtn}>
            <Text style={styles.clearFilterText}>Mostrar todos</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Campo de busca de exercícios */}
      <TextInput
        placeholder="Buscar exercício por nome ou categoria"
        value={buscaExercicio}
        onChangeText={setBuscaExercicio}
        style={styles.input}
        autoCapitalize="none"
      />
      <FlatList
        data={exerciciosFiltrados}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          (() => {
            const showDualIconsPadraoAcademia = isAcademyAdmin && item?.is_padrao === true;
            const showEditAction = showDualIconsPadraoAcademia || (isAcademyAdmin && isExercicioAcademia(item)) || (isSystemAdmin && item?.is_padrao !== true);
            const detalhesExercicio = formatarDetalhesExercicio(item);
            return (
          <TouchableOpacity
            style={styles.exercicioRow}
            onPress={() => {
              if (editandoId !== item.id) iniciarEdicao(item);
            }}
          >
            <View style={{ flex: 1 }}>
              {editandoId === item.id ? (
                <>
                  <TextInput
                    value={nomeEditado}
                    onChangeText={setNomeEditado}
                    style={styles.editInput}
                    placeholder="Nome do exercício"
                  />
                  <TextInput
                    value={categoriaEditada}
                    onChangeText={setCategoriaEditada}
                    style={styles.editInput}
                    placeholder="Categoria"
                  />
                  <View style={styles.editTwoColumns}>
                    <TextInput
                      value={seriesEditadas}
                      onChangeText={setSeriesEditadas}
                      style={[styles.editInput, styles.editMiniInput]}
                      placeholder="Séries"
                    />
                    <TextInput
                      value={repsEditadas}
                      onChangeText={setRepsEditadas}
                      style={[styles.editInput, styles.editMiniInput]}
                      placeholder="Reps"
                    />
                  </View>
                  {isSystemAdmin && item?.is_padrao !== true && (
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={academiaEditadaSistema}
                        onValueChange={(value) => setAcademiaEditadaSistema(String(value || ''))}
                        style={styles.picker}
                      >
                        <Picker.Item label="Selecione a academia" value="" />
                        {academiasSistema.map((academia) => (
                          <Picker.Item
                            key={academia.id}
                            label={String(academia.nome || academia.id)}
                            value={academia.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  )}
                </>
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.nome}</Text>
              )}
              {!!detalhesExercicio && (
                <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                  {detalhesExercicio}
                </Text>
              )}
            </View>
            <View style={styles.rowActions}>
              {editandoId === item.id ? (
                <>
                  <TouchableOpacity onPress={() => salvarEdicaoExercicio(item)} style={styles.saveBtn}>
                    <Text style={styles.saveText}>Salvar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelarEdicao} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {showEditAction && (
                    <TouchableOpacity onPress={() => iniciarEdicao(item)} style={styles.editBtn}>
                      <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
            );
          })()
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing(2), backgroundColor: theme.colors.background },
  backBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10
  },
  backBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600'
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: theme.spacing(2) 
  },
  title: { fontSize: theme.fontSizes.xl, marginBottom: theme.spacing(0.5) },
  subtitle: { 
    fontSize: theme.fontSizes.sm, 
    color: theme.colors.muted 
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing(1.5)
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  statCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background
  },
  statValue: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.text
  },
  statLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    marginTop: 2
  },
  logoutBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    borderRadius: theme.radii.sm, 
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  logoutText: { 
    color: theme.colors.danger, 
    fontSize: 15, 
    fontWeight: '500' 
  },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(0.5)
  },
  clearFilterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.card
  },
  clearFilterText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  cardBlock: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5)
  },
  blockTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4
  },
  blockHint: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    marginBottom: 10
  },
  helperText: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.background
  },
  academiasSugestoesBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    marginBottom: 10,
    overflow: 'hidden'
  },
  academiaSugestaoItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  academiaSugestaoNome: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14
  },
  academiaSugestaoMeta: {
    color: theme.colors.muted,
    marginTop: 2,
    fontSize: 12
  },
  academiaSelecionadaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10
  },
  academiaSelecionadaText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600'
  },
  academiaSelecionadaRemover: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.background,
    overflow: 'hidden'
  },
  picker: {
    width: '100%'
  },
  exercicioRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.card,
    marginBottom: 4,
    borderRadius: theme.radii.sm
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    marginLeft: 8
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginLeft: 8
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginLeft: 8
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginLeft: 8
  },
  saveText: {
    color: theme.colors.primary,
    fontSize: 13
  },
  cancelText: {
    color: theme.colors.muted,
    fontSize: 13
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: '#fff'
  },
  editTwoColumns: {
    flexDirection: 'row',
    gap: 8
  },
  editMiniInput: {
    flex: 1
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  actionContainer: {
    marginTop: 4
  },
  progressContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  progressBarBackground: {
    height: 24,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 12
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center'
  },
  list: {
    minHeight: 220,
    marginTop: 6
  },
  listContent: {
    paddingBottom: 24
  }
});
