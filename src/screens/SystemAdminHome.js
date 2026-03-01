import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Pressable as TouchableOpacity, ActivityIndicator, TextInput, Button, ImageBackground, InteractionManager } from 'react-native';
import theme from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../utils/alert';
import { getAuthErrorMessage } from '../utils/authErrors';
import { createAcademia, createAcademiaAdmin, getSystemDashboardStats, updateAcademiaAdminBySystem, updateAcademiaBySystem } from '../services/userService';
import { listAllExercicios } from '../services/exerciciosService';
import { adminDeleteFirestore, adminInsertFirestore, adminSelectFirestore, adminUpdateFirestore } from '../services/firestoreAdminService';
import { isValidEmail } from '../utils/validation';
import CardMedia from '../components/CardMedia';

const adminHeroImage = 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80';
const adminBackgroundImage = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80';
const FIRESTORE_FILTER_OPERATORS = ['==', '!=', '<', '<=', '>', '>='];
const FIRESTORE_SORT_DIRECTIONS = ['asc', 'desc'];
const FIRESTORE_SELECT_PRESETS = [
  {
    key: 'users-admin-sistema',
    label: 'Usuários admin_sistema',
    collection: 'users',
    mode: 'list',
    limit: '25',
    filterField: 'role',
    filterOp: '==',
    filterValue: '"admin_sistema"',
    sortField: 'nome',
    sortDirection: 'asc'
  },
  {
    key: 'users-admin-academia',
    label: 'Usuários admin_academia',
    collection: 'users',
    mode: 'list',
    limit: '25',
    filterField: 'role',
    filterOp: '==',
    filterValue: '"admin_academia"',
    sortField: 'nome',
    sortDirection: 'asc'
  },
  {
    key: 'users-professores',
    label: 'Usuários professores',
    collection: 'users',
    mode: 'list',
    limit: '25',
    filterField: 'role',
    filterOp: '==',
    filterValue: '"professor"',
    sortField: 'nome',
    sortDirection: 'asc'
  },
  {
    key: 'users-alunos',
    label: 'Usuários alunos',
    collection: 'users',
    mode: 'list',
    limit: '50',
    filterField: 'role',
    filterOp: '==',
    filterValue: '"aluno"',
    sortField: 'nome',
    sortDirection: 'asc'
  },
  {
    key: 'academias',
    label: 'Academias',
    collection: 'academias',
    mode: 'list',
    limit: '25',
    filterField: '',
    filterOp: '==',
    filterValue: '',
    sortField: 'nome',
    sortDirection: 'asc'
  },
  {
    key: 'treinos',
    label: 'Treinos (últimos)',
    collection: 'treinos',
    mode: 'list',
    limit: '25',
    filterField: '',
    filterOp: '==',
    filterValue: '',
    sortField: '',
    sortDirection: 'desc'
  },
  {
    key: 'users-por-academia',
    label: 'Usuários por academia_id',
    collection: 'users',
    mode: 'list',
    limit: '50',
    filterField: 'academia_id',
    filterOp: '==',
    filterValue: '"__ACADEMIA_ID__"',
    sortField: 'nome',
    sortDirection: 'asc',
    requiresAcademiaId: true
  },
  {
    key: 'treinos-por-academia',
    label: 'Treinos por academia_id',
    collection: 'treinos',
    mode: 'list',
    limit: '50',
    filterField: 'academia_id',
    filterOp: '==',
    filterValue: '"__ACADEMIA_ID__"',
    sortField: '',
    sortDirection: 'desc',
    requiresAcademiaId: true
  },
  {
    key: 'notificacoes-por-academia',
    label: 'Notificações por academia_id',
    collection: 'notificacoes',
    mode: 'list',
    limit: '50',
    filterField: 'academia_id',
    filterOp: '==',
    filterValue: '"__ACADEMIA_ID__"',
    sortField: '',
    sortDirection: 'desc',
    requiresAcademiaId: true
  }
];

export function resolveFirestoreSelectPreset(preset, firestorePresetAcademiaId) {
  const academiaId = String(firestorePresetAcademiaId || '').trim();
  const templateValue = String(preset?.filterValue || '');
  const resolvedFilterValue = templateValue.includes('__ACADEMIA_ID__')
    ? templateValue.replace('__ACADEMIA_ID__', academiaId)
    : templateValue;

  if (preset?.requiresAcademiaId && !academiaId) {
    return { requiresAcademiaId: true, state: null };
  }

  return {
    requiresAcademiaId: false,
    state: {
      collectionPath: String(preset?.collection || 'users'),
      selectMode: String(preset?.mode || 'list'),
      documentId: String(preset?.documentId || ''),
      selectLimit: String(preset?.limit || '25'),
      filterField: String(preset?.filterField || ''),
      filterOp: String(preset?.filterOp || '=='),
      filterValue: resolvedFilterValue,
      sortField: String(preset?.sortField || ''),
      sortDirection: String(preset?.sortDirection || 'asc')
    }
  };
}

function InfoCard({ title, value, subtitle, extraLines = [] }) {
  const mediaByTitle = {
    Academias: 'academia',
    Alunos: 'aluno',
    Professores: 'professor',
    Gestores: 'sistema',
    Treinos: 'treino',
    Notificações: 'notificacao'
  };
  const mediaVariant = mediaByTitle[title] || 'sistema';

  return (
    <View style={styles.card}>
      <CardMedia variant={mediaVariant} label={title} compact />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {!!subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
      {extraLines.map((line) => (
        <Text key={line} style={styles.cardMeta}>{line}</Text>
      ))}
    </View>
  );
}

export default function SystemAdminHome({ navigation }) {
  const { logout, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [nomeAcademia, setNomeAcademia] = useState('');
  const [nomeAdminAcademia, setNomeAdminAcademia] = useState('');
  const [emailAdminAcademia, setEmailAdminAcademia] = useState('');
  const [academiaSelecionada, setAcademiaSelecionada] = useState('');
  const [buscaAcademiaAdmin, setBuscaAcademiaAdmin] = useState('');
  const [academiaSelecionadaInfo, setAcademiaSelecionadaInfo] = useState(null);
  const [showAcademiasCards, setShowAcademiasCards] = useState(false);
  const [editAcademiaId, setEditAcademiaId] = useState('');
  const [editAcademiaNome, setEditAcademiaNome] = useState('');
  const [editAdminId, setEditAdminId] = useState('');
  const [editAdminNome, setEditAdminNome] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [firestoreCollectionPath, setFirestoreCollectionPath] = useState('users');
  const [firestoreSelectMode, setFirestoreSelectMode] = useState('doc');
  const [firestoreDocumentId, setFirestoreDocumentId] = useState('');
  const [firestoreSelectLimit, setFirestoreSelectLimit] = useState('25');
  const [firestoreFilterField, setFirestoreFilterField] = useState('');
  const [firestoreFilterOp, setFirestoreFilterOp] = useState('==');
  const [firestoreFilterValue, setFirestoreFilterValue] = useState('');
  const [firestoreSortField, setFirestoreSortField] = useState('');
  const [firestoreSortDirection, setFirestoreSortDirection] = useState('asc');
  const [firestorePresetAcademiaId, setFirestorePresetAcademiaId] = useState('');
  const [firestorePayloadText, setFirestorePayloadText] = useState('{\n  \n}');
  const [firestoreResultText, setFirestoreResultText] = useState('Nenhuma operação executada ainda.');
  const [firestoreBusy, setFirestoreBusy] = useState(false);
  const [showFirestoreConsole, setShowFirestoreConsole] = useState(false);
  const navigateGuardRef = useRef(false);
  const [exerciciosPadraoCount, setExerciciosPadraoCount] = useState(0);
  const [exerciciosAcademiaCount, setExerciciosAcademiaCount] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadExerciciosResumoSistema();
    });

    return unsubscribe;
  }, [navigation]);

  async function loadDashboard() {
    await Promise.all([loadStats(), loadExerciciosResumoSistema()]);
  }

  async function loadStats() {
    try {
      const data = await getSystemDashboardStats();
      setStats(data);
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível carregar os indicadores do sistema.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadExerciciosResumoSistema() {
    try {
      const list = await listAllExercicios();
      const padrao = list.filter((item) => item?.is_padrao === true).length;
      const academia = list.filter((item) => item?.is_padrao !== true).length;
      setExerciciosPadraoCount(padrao);
      setExerciciosAcademiaCount(academia);
    } catch (error) {
      setExerciciosPadraoCount(0);
      setExerciciosAcademiaCount(0);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Falha ao sair.'));
    }
  }

  async function handleCreateAcademia() {
    if (!nomeAcademia.trim()) return Alert.alert('Erro', 'Nome da academia é obrigatório');
    try {
      await createAcademia({ nome: nomeAcademia });
      setNomeAcademia('');
      await loadDashboard();
      Alert.alert('Sucesso', 'Academia cadastrada com sucesso');
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível cadastrar a academia.'));
    }
  }

  async function handleCreateAdminAcademia() {
    if (!nomeAdminAcademia.trim() || !emailAdminAcademia.trim() || !academiaSelecionada) {
      return Alert.alert('Erro', 'Preencha nome, e-mail e academia');
    }
    if (!isValidEmail(emailAdminAcademia)) {
      return Alert.alert('Erro', 'Digite um e-mail válido');
    }
    try {
      await createAcademiaAdmin({
        nome: nomeAdminAcademia,
        email: emailAdminAcademia,
        academia_id: academiaSelecionada
      });
      setNomeAdminAcademia('');
      setEmailAdminAcademia('');
      setAcademiaSelecionada('');
      setBuscaAcademiaAdmin('');
      setAcademiaSelecionadaInfo(null);
      await loadDashboard();
      Alert.alert('Sucesso', 'Administrador da academia criado com sucesso');
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível criar o administrador da academia.'));
    }
  }

  const resumo = stats?.resumo || {};
  const porAcademia = stats?.por_academia || [];
  const academiaEmEdicao = useMemo(
    () => porAcademia.find((item) => item.academia_id === editAcademiaId) || null,
    [porAcademia, editAcademiaId]
  );
  const academiasEncontradas = useMemo(() => {
    const termo = String(buscaAcademiaAdmin || '').trim().toLowerCase();
    if (termo.length < 2) return [];

    return porAcademia
      .filter((item) => String(item?.academia_nome || '').toLowerCase().includes(termo))
      .slice(0, 8);
  }, [porAcademia, buscaAcademiaAdmin]);

  function handleSelecionarAcademia(item) {
    setAcademiaSelecionada(item.academia_id);
    setAcademiaSelecionadaInfo(item);
    setBuscaAcademiaAdmin('');
  }

  function handleSelecionarAcademiaParaAtualizacao(item) {
    const academiaId = String(item?.academia_id || '').trim();
    const academiaNome = String(item?.academia_nome || '').trim();
    const admins = Array.isArray(item?.admins) ? item.admins : [];
    const primeiroAdmin = admins[0] || null;

    setEditAcademiaId(academiaId);
    setEditAcademiaNome(academiaNome);
    setEditAdminId(primeiroAdmin?.id || '');
    setEditAdminNome(primeiroAdmin?.nome || '');
    setEditAdminEmail(primeiroAdmin?.email || '');
  }

  function handleSelecionarAdminParaAtualizacao(admin) {
    setEditAdminId(admin?.id || '');
    setEditAdminNome(admin?.nome || '');
    setEditAdminEmail(admin?.email || '');
  }

  async function handleAtualizarAcademiaSelecionada() {
    if (!editAcademiaId || !editAcademiaNome.trim()) {
      return Alert.alert('Erro', 'Selecione uma academia e informe o nome para atualizar.');
    }

    try {
      await updateAcademiaBySystem({ academiaId: editAcademiaId, nome: editAcademiaNome });
      await loadDashboard();
      Alert.alert('Sucesso', 'Academia atualizada com sucesso.');
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível atualizar a academia.'));
    }
  }

  async function handleAtualizarAdminSelecionado() {
    if (!editAdminId || !editAdminNome.trim() || !editAdminEmail.trim()) {
      return Alert.alert('Erro', 'Selecione um administrador e preencha nome e e-mail.');
    }
    if (!isValidEmail(editAdminEmail)) {
      return Alert.alert('Erro', 'Digite um e-mail válido');
    }

    try {
      await updateAcademiaAdminBySystem({
        adminId: editAdminId,
        nome: editAdminNome,
        email: editAdminEmail
      });
      await loadDashboard();
      Alert.alert('Sucesso', 'Administrador atualizado com sucesso.');
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível atualizar o administrador.'));
    }
  }

  function parseFirestorePayload() {
    const raw = String(firestorePayloadText || '').trim();
    if (!raw) throw new Error('Informe um JSON no payload.');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error('JSON inválido no payload.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload deve ser um objeto JSON.');
    }

    return parsed;
  }

  function setFirestoreResult(data) {
    setFirestoreResultText(JSON.stringify(data, null, 2));
  }

  function parseFirestoreFilterValue(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    try {
      return JSON.parse(raw);
    } catch (_) {
      return raw;
    }
  }

  async function handleFirestoreSelect() {
    setFirestoreBusy(true);
    try {
      const isDocMode = firestoreSelectMode === 'doc';
      const data = await adminSelectFirestore({
        collectionPath: firestoreCollectionPath,
        documentId: isDocMode ? firestoreDocumentId : '',
        limitCount: firestoreSelectLimit,
        filters: !isDocMode && firestoreFilterField.trim()
          ? [{
              field: firestoreFilterField,
              op: firestoreFilterOp,
              value: parseFirestoreFilterValue(firestoreFilterValue)
            }]
          : [],
        sort: !isDocMode && firestoreSortField.trim()
          ? {
              field: firestoreSortField,
              direction: firestoreSortDirection
            }
          : null
      });
      setFirestoreResult({ total: data.length, docs: data });
      Alert.alert('Sucesso', `${data.length} documento(s) retornado(s).`);
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível executar o SELECT.'));
    } finally {
      setFirestoreBusy(false);
    }
  }

  async function handleFirestoreInsert() {
    setFirestoreBusy(true);
    try {
      const payload = parseFirestorePayload();
      const result = await adminInsertFirestore({
        collectionPath: firestoreCollectionPath,
        documentId: firestoreDocumentId,
        payload
      });
      setFirestoreResult({ action: 'insert', ...result, payload });
      Alert.alert('Sucesso', `Documento inserido com id ${result.id}.`);
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível executar o INSERT.'));
    } finally {
      setFirestoreBusy(false);
    }
  }

  async function handleFirestoreUpdate() {
    setFirestoreBusy(true);
    try {
      const payload = parseFirestorePayload();
      const result = await adminUpdateFirestore({
        collectionPath: firestoreCollectionPath,
        documentId: firestoreDocumentId,
        payload
      });
      setFirestoreResult({ action: 'update', ...result, payload });
      Alert.alert('Sucesso', `Documento ${result.id} atualizado.`);
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível executar o UPDATE.'));
    } finally {
      setFirestoreBusy(false);
    }
  }

  async function handleFirestoreDelete() {
    const canDelete = await Alert.confirm(
      'Excluir documento',
      'Essa ação remove o documento informado permanentemente. Deseja continuar?',
      { confirmText: 'Excluir', cancelText: 'Cancelar', destructive: true }
    );
    if (!canDelete) return;

    setFirestoreBusy(true);
    try {
      const result = await adminDeleteFirestore({
        collectionPath: firestoreCollectionPath,
        documentId: firestoreDocumentId
      });
      setFirestoreResult({ action: 'delete', ...result });
      Alert.alert('Sucesso', `Documento ${result.id} removido.`);
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível executar o DELETE.'));
    } finally {
      setFirestoreBusy(false);
    }
  }

  function handleApplySelectPreset(preset) {
    const resolved = resolveFirestoreSelectPreset(preset, firestorePresetAcademiaId);
    if (resolved.requiresAcademiaId) {
      Alert.alert('Atenção', 'Preencha o ID da academia para usar este modelo.');
      return;
    }

    setFirestoreCollectionPath(resolved.state.collectionPath);
    setFirestoreSelectMode(resolved.state.selectMode);
    setFirestoreDocumentId(resolved.state.documentId);
    setFirestoreSelectLimit(resolved.state.selectLimit);
    setFirestoreFilterField(resolved.state.filterField);
    setFirestoreFilterOp(resolved.state.filterOp);
    setFirestoreFilterValue(resolved.state.filterValue);
    setFirestoreSortField(resolved.state.sortField);
    setFirestoreSortDirection(resolved.state.sortDirection);
  }

  function handleOpenGerenciarExercicios() {
    if (navigateGuardRef.current) return;
    navigateGuardRef.current = true;

    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('GerenciarExercicios');
      setTimeout(() => {
        navigateGuardRef.current = false;
      }, 250);
    });
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: adminBackgroundImage }}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View style={styles.screenBackgroundTint} />
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.contentContainer}>
          <ImageBackground source={{ uri: adminHeroImage }} style={styles.heroCard} imageStyle={styles.heroCardImage}>
            <View style={styles.heroCardTint} />
            <View style={styles.heroCardContent}>
              <Text style={styles.heroTag}>VISÃO GERAL</Text>
              <Text style={styles.heroTitle}>Controle da Plataforma</Text>
              <Text style={styles.heroHint}>Olá, {profile?.nome || 'Admin'}</Text>
            </View>
          </ImageBackground>

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Painel do Sistema</Text>
              <Text style={styles.subtitle}>Gestão global de academias, usuários e indicadores</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>🚪 Sair</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Carregando indicadores...</Text>
            </View>
          ) : (
            <>
              <View style={styles.cardBlock}>
                <CardMedia variant="academia" label="GESTÃO DE ACADEMIAS" />
                <Text style={styles.blockTitle}>Gestão de Academias</Text>
                <TextInput
                  placeholder="Nome da academia"
                  value={nomeAcademia}
                  onChangeText={setNomeAcademia}
                  style={styles.input}
                />
                <Button title="Cadastrar Academia" onPress={handleCreateAcademia} disabled={!nomeAcademia.trim()} />
              </View>

              <View style={styles.cardBlock}>
                <CardMedia variant="sistema" label="GESTORES DA ACADEMIA" />
                <Text style={styles.blockTitle}>Criar Gestor da Academia</Text>
                <TextInput
                  placeholder="Nome do administrador"
                  value={nomeAdminAcademia}
                  onChangeText={setNomeAdminAcademia}
                  style={styles.input}
                />
                <TextInput
                  placeholder="E-mail do administrador"
                  value={emailAdminAcademia}
                  onChangeText={setEmailAdminAcademia}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  placeholder="Digite o nome da academia"
                  value={buscaAcademiaAdmin}
                  onChangeText={(value) => {
                    setBuscaAcademiaAdmin(value);
                    setAcademiaSelecionada('');
                    setAcademiaSelecionadaInfo(null);
                  }}
                  style={styles.input}
                  autoCapitalize="words"
                />
                <Text style={styles.helperText}>Digite pelo menos 2 letras para buscar.</Text>

                {academiasEncontradas.length > 0 && (
                  <View style={styles.academiasSugestoesBox}>
                    {academiasEncontradas.map((item) => (
                      <TouchableOpacity
                        key={item.academia_id}
                        style={styles.academiaSugestaoItem}
                        onPress={() => handleSelecionarAcademia(item)}
                      >
                        <Text style={styles.academiaSugestaoNome}>{item.academia_nome}</Text>
                        <Text style={styles.academiaSugestaoMeta}>Alunos: {item.alunos} • Professores: {item.professores}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {academiaSelecionadaInfo && (
                  <View style={styles.academiaSelecionadaBox}>
                    <Text style={styles.academiaSelecionadaText}>Selecionada: {academiaSelecionadaInfo.academia_nome}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setBuscaAcademiaAdmin('');
                        setAcademiaSelecionada('');
                        setAcademiaSelecionadaInfo(null);
                      }}
                    >
                      <Text style={styles.academiaSelecionadaRemover}>Limpar</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Button
                  title="Criar Admin da Academia"
                  onPress={handleCreateAdminAcademia}
                  disabled={!nomeAdminAcademia.trim() || !emailAdminAcademia.trim() || !academiaSelecionada}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.exerciseCard, pressed && styles.exerciseCardPressed]}
                onPress={handleOpenGerenciarExercicios}
              >
                <CardMedia variant="exercicio" label="BANCO DE EXERCÍCIOS" compact />
                <View style={styles.exerciseCardHeader}>
                  <Text style={styles.exerciseCardTitle}>Gerenciar Banco de Exercícios</Text>
                  <Text style={styles.exerciseCardArrow}>›</Text>
                </View>
                <View style={styles.exerciseMetricsRow}>
                  <View style={styles.exerciseMetricBox}>
                    <Text style={styles.exerciseMetricValue}>{exerciciosPadraoCount}</Text>
                    <Text style={styles.exerciseMetricLabel}>Padrão</Text>
                  </View>
                  <View style={styles.exerciseMetricBox}>
                    <Text style={styles.exerciseMetricValue}>{exerciciosAcademiaCount}</Text>
                    <Text style={styles.exerciseMetricLabel}>Das academias</Text>
                  </View>
                </View>
              </Pressable>

              <View style={styles.cardBlock}>
                <Pressable
                  style={({ pressed }) => [styles.consoleAccessCard, pressed && styles.consoleAccessCardPressed]}
                  onPress={() => setShowFirestoreConsole((prev) => !prev)}
                >
                  <CardMedia variant="sistema" label="CONSOLE FIRESTORE" compact />
                  <View style={styles.consoleAccessHeader}>
                    <Text style={styles.consoleAccessTitle}>Acesso direto ao Firestore (Admin do Sistema)</Text>
                    <Text style={styles.consoleAccessArrow}>{showFirestoreConsole ? '▾' : '▸'}</Text>
                  </View>
                  <Text style={styles.helperText}>
                    {showFirestoreConsole
                      ? 'Console aberto. Use coleção + modo de consulta para SELECT, e payload JSON para INSERT/UPDATE.'
                      : 'Toque para abrir o console e executar SELECT, INSERT, UPDATE e DELETE.'}
                  </Text>
                </Pressable>

                {showFirestoreConsole && (
                  <>

                  <Text style={styles.sectionLabel}>Modelos rápidos de SELECT</Text>
                  <TextInput
                    placeholder="ID da academia para presets por academia_id"
                    value={firestorePresetAcademiaId}
                    onChangeText={setFirestorePresetAcademiaId}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <View style={styles.optionRow}>
                    {FIRESTORE_SELECT_PRESETS.map((preset) => (
                      <Pressable
                        key={preset.key}
                        style={({ pressed }) => [styles.optionChip, pressed && styles.modeBtnPressed]}
                        onPress={() => handleApplySelectPreset(preset)}
                      >
                        <Text style={styles.optionChipText}>{preset.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    placeholder="Coleção (ex: users, treinos, academias)"
                    value={firestoreCollectionPath}
                    onChangeText={setFirestoreCollectionPath}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <Text style={styles.sectionLabel}>Modo do SELECT</Text>
                  <View style={styles.modeRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modeBtn,
                        firestoreSelectMode === 'doc' && styles.modeBtnActive,
                        pressed && styles.modeBtnPressed
                      ]}
                      onPress={() => setFirestoreSelectMode('doc')}
                    >
                      <Text style={[styles.modeBtnText, firestoreSelectMode === 'doc' && styles.modeBtnTextActive]}>Por ID</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modeBtn,
                        firestoreSelectMode === 'list' && styles.modeBtnActive,
                        pressed && styles.modeBtnPressed
                      ]}
                      onPress={() => setFirestoreSelectMode('list')}
                    >
                      <Text style={[styles.modeBtnText, firestoreSelectMode === 'list' && styles.modeBtnTextActive]}>Lista</Text>
                    </Pressable>
                  </View>

                {firestoreSelectMode === 'doc' ? (
                  <TextInput
                    placeholder="ID do documento (obrigatório para SELECT por ID)"
                    value={firestoreDocumentId}
                    onChangeText={setFirestoreDocumentId}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                ) : (
                  <>
                    <Text style={styles.sectionLabel}>Limite da lista</Text>
                    <TextInput
                      placeholder="25"
                      value={firestoreSelectLimit}
                      onChangeText={setFirestoreSelectLimit}
                      style={styles.input}
                      keyboardType="numeric"
                    />

                    <Text style={styles.sectionLabel}>Filtro opcional</Text>
                    <TextInput
                      placeholder="Campo do filtro (ex: role, academia_id)"
                      value={firestoreFilterField}
                      onChangeText={setFirestoreFilterField}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                    <Text style={styles.sectionLabel}>Operador</Text>
                    <View style={styles.optionRow}>
                      {FIRESTORE_FILTER_OPERATORS.map((op) => (
                        <Pressable
                          key={op}
                          style={({ pressed }) => [
                            styles.optionChip,
                            firestoreFilterOp === op && styles.optionChipActive,
                            pressed && styles.modeBtnPressed
                          ]}
                          onPress={() => setFirestoreFilterOp(op)}
                        >
                          <Text style={[styles.optionChipText, firestoreFilterOp === op && styles.optionChipTextActive]}>{op}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      placeholder={'Valor do filtro (ex: "admin_sistema", true, 10)'}
                      value={firestoreFilterValue}
                      onChangeText={setFirestoreFilterValue}
                      style={styles.input}
                      autoCapitalize="none"
                    />

                    <Text style={styles.sectionLabel}>Ordenação opcional</Text>
                    <TextInput
                      placeholder="Campo de ordenação (ex: created_at, nome)"
                      value={firestoreSortField}
                      onChangeText={setFirestoreSortField}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                    <View style={styles.optionRow}>
                      {FIRESTORE_SORT_DIRECTIONS.map((direction) => (
                        <Pressable
                          key={direction}
                          style={({ pressed }) => [
                            styles.optionChip,
                            firestoreSortDirection === direction && styles.optionChipActive,
                            pressed && styles.modeBtnPressed
                          ]}
                          onPress={() => setFirestoreSortDirection(direction)}
                        >
                          <Text style={[styles.optionChipText, firestoreSortDirection === direction && styles.optionChipTextActive]}>{direction.toUpperCase()}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {firestoreSelectMode !== 'doc' && (
                  <TextInput
                    placeholder="ID do documento (INSERT com ID, UPDATE e DELETE)"
                    value={firestoreDocumentId}
                    onChangeText={setFirestoreDocumentId}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                )}

                <Text style={styles.sectionLabel}>Payload JSON (INSERT/UPDATE)</Text>
                <TextInput
                  placeholder={'{\n  "campo": "valor"\n}'}
                  value={firestorePayloadText}
                  onChangeText={setFirestorePayloadText}
                  style={[styles.input, styles.payloadInput]}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                />

                <View style={styles.firestoreActionsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.firestoreActionBtn, pressed && styles.firestoreActionBtnPressed, firestoreBusy && styles.firestoreActionBtnDisabled]}
                    onPress={handleFirestoreSelect}
                    disabled={firestoreBusy || !firestoreCollectionPath.trim() || (firestoreSelectMode === 'doc' && !firestoreDocumentId.trim())}
                  >
                    <Text style={styles.firestoreActionText}>SELECT</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.firestoreActionBtn, pressed && styles.firestoreActionBtnPressed, firestoreBusy && styles.firestoreActionBtnDisabled]}
                    onPress={handleFirestoreInsert}
                    disabled={firestoreBusy || !firestoreCollectionPath.trim()}
                  >
                    <Text style={styles.firestoreActionText}>INSERT</Text>
                  </Pressable>
                </View>

                <View style={styles.firestoreActionsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.firestoreActionBtn, pressed && styles.firestoreActionBtnPressed, firestoreBusy && styles.firestoreActionBtnDisabled]}
                    onPress={handleFirestoreUpdate}
                    disabled={firestoreBusy || !firestoreCollectionPath.trim() || !firestoreDocumentId.trim()}
                  >
                    <Text style={styles.firestoreActionText}>UPDATE</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.firestoreDeleteBtn, pressed && styles.firestoreActionBtnPressed, firestoreBusy && styles.firestoreActionBtnDisabled]}
                    onPress={handleFirestoreDelete}
                    disabled={firestoreBusy || !firestoreCollectionPath.trim() || !firestoreDocumentId.trim()}
                  >
                    <Text style={styles.firestoreDeleteText}>DELETE</Text>
                  </Pressable>
                </View>

                {firestoreBusy ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Executando operação no Firestore...</Text>
                  </View>
                ) : null}

                  <Text style={styles.sectionLabel}>Resultado</Text>
                  <View style={styles.firestoreResultBox}>
                    <Text style={styles.firestoreResultText} selectable>{firestoreResultText}</Text>
                  </View>
                  </>
                )}
              </View>

              <View style={styles.gridRow}>
                <Pressable style={styles.cardPressable} onPress={() => setShowAcademiasCards((prev) => !prev)}>
                  <InfoCard
                    title="Academias"
                    value={resumo.total_academias || 0}
                    subtitle={showAcademiasCards ? 'Toque para ocultar lista' : 'Toque para ver lista e atualização'}
                  />
                </Pressable>
                <InfoCard title="Alunos" value={resumo.total_alunos || 0} subtitle="Total no sistema" />
              </View>
              <View style={styles.gridRow}>
                <InfoCard title="Professores" value={resumo.total_professores || 0} subtitle="Total no sistema" />
                <InfoCard title="Gestores" value={resumo.total_admins_academia || 0} subtitle="Responsáveis por academia" />
              </View>
              <View style={styles.gridRow}>
                <InfoCard
                  title="Treinos"
                  value={resumo.total_treinos || 0}
                  subtitle="Treinos cadastrados"
                  extraLines={[
                    `📋 Modelos: ${resumo.total_treinos_modelo || 0}`,
                    `👤 Associados: ${resumo.total_treinos_vinculados || 0}`
                  ]}
                />
                <InfoCard title="Notificações" value={resumo.total_notificacoes || 0} subtitle="Eventos registrados" />
              </View>

              <View style={styles.cardBlock}>
                <CardMedia variant="progresso" label="INSIGHTS GERENCIAIS" />
                <Text style={styles.blockTitle}>Insights de uso</Text>
                <Text style={styles.blockItem}>• Média de alunos por academia: {resumo.media_alunos_por_academia || 0}</Text>
                <Text style={styles.blockItem}>
                  • Academia com mais alunos: {resumo.academia_com_mais_alunos?.nome || 'N/D'}
                  {resumo.academia_com_mais_alunos ? ` (${resumo.academia_com_mais_alunos.alunos})` : ''}
                </Text>
                <Text style={styles.blockItem}>• Use os dados por academia para identificar concentração de uso e necessidade de suporte.</Text>
              </View>

              <View style={styles.cardBlock}>
                <CardMedia variant="relatorio" label="DESEMPENHO POR ACADEMIA" />
                <Text style={styles.blockTitle}>Desempenho por academia</Text>
                {porAcademia.length === 0 && <Text style={styles.emptyText}>Nenhuma academia cadastrada.</Text>}
                {porAcademia.map((item) => (
                  <View key={item.academia_id} style={styles.academiaRow}>
                    <Text style={styles.academiaNome}>{item.academia_nome}</Text>
                    <Text style={styles.academiaInfo}>Alunos: {item.alunos} • Professores: {item.professores} • Admins: {item.admins_academia}</Text>
                    <Text style={styles.academiaInfo}>Treinos: {item.treinos} • Notificações: {item.notificacoes}</Text>
                  </View>
                ))}
              </View>

              {showAcademiasCards && (
                <View style={styles.cardBlock}>
                  <CardMedia variant="academia" label="ACADEMIAS E GESTORES" />
                  <Text style={styles.blockTitle}>Academias cadastradas e administradores</Text>
                  {porAcademia.length === 0 && <Text style={styles.emptyText}>Nenhuma academia cadastrada.</Text>}

                  {porAcademia.map((item) => (
                    <View key={item.academia_id} style={styles.academiaAdminCard}>
                      <View style={styles.academiaAdminHeader}>
                        <View style={styles.academiaAdminContent}>
                          <Text style={styles.academiaNome}>{item.academia_nome}</Text>
                          <Text style={styles.academiaInfo}>ID: {item.academia_id}</Text>
                          <Text style={styles.academiaInfo}>Alunos: {item.alunos} • Professores: {item.professores} • Admins: {item.admins_academia}</Text>
                        </View>
                        <Pressable style={styles.selectUpdateBtn} onPress={() => handleSelecionarAcademiaParaAtualizacao(item)}>
                          <Text style={styles.selectUpdateText}>Selecionar para atualização</Text>
                        </Pressable>
                      </View>

                      {Array.isArray(item.admins) && item.admins.length > 0 ? (
                        <View style={styles.adminListWrap}>
                          {item.admins.map((admin) => (
                            <Text key={admin.id} style={styles.adminListItem}>• {admin.nome} ({admin.email})</Text>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.emptyText}>Sem administradores cadastrados nesta academia.</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {showAcademiasCards && editAcademiaId && (
                <View style={styles.cardBlock}>
                  <CardMedia variant="sistema" label="ATUALIZAÇÃO" />
                  <Text style={styles.blockTitle}>Atualizar academia e gestores</Text>

                  <Text style={styles.sectionLabel}>Academia selecionada</Text>
                  <TextInput
                    placeholder="Nome da academia"
                    value={editAcademiaNome}
                    onChangeText={setEditAcademiaNome}
                    style={styles.input}
                  />
                  <Button title="Atualizar Academia" onPress={handleAtualizarAcademiaSelecionada} disabled={!editAcademiaNome.trim()} />

                  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Administrador da academia</Text>
                  {academiaEmEdicao?.admins?.length ? (
                    <View style={styles.adminChipsWrap}>
                      {academiaEmEdicao.admins.map((admin) => (
                        <Pressable
                          key={admin.id}
                          style={[styles.adminChip, editAdminId === admin.id && styles.adminChipActive]}
                          onPress={() => handleSelecionarAdminParaAtualizacao(admin)}
                        >
                          <Text style={[styles.adminChipText, editAdminId === admin.id && styles.adminChipTextActive]}>{admin.nome}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>Esta academia não possui administradores para atualizar.</Text>
                  )}

                  <TextInput
                    placeholder="Nome do administrador"
                    value={editAdminNome}
                    onChangeText={setEditAdminNome}
                    style={styles.input}
                    editable={!!editAdminId}
                  />
                  <TextInput
                    placeholder="E-mail do administrador"
                    value={editAdminEmail}
                    onChangeText={setEditAdminEmail}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!!editAdminId}
                  />
                  <Button
                    title="Atualizar Administrador"
                    onPress={handleAtualizarAdminSelecionado}
                    disabled={!editAdminId || !editAdminNome.trim() || !editAdminEmail.trim()}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 22
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
    minHeight: 150,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: 14
  },
  heroCardImage: {
    borderRadius: theme.radii.lg
  },
  heroCardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.56)'
  },
  heroCardContent: {
    padding: 16,
    gap: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.32)'
  },
  heroTag: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800'
  },
  heroHint: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  title: {
    fontSize: 20,
    color: theme.colors.text,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 4
  },
  logoutBtn: {
    backgroundColor: theme.colors.background,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.danger
  },
  logoutText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '600'
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.muted
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  cardPressable: {
    flex: 1
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  cardTitle: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 4
  },
  cardValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700'
  },
  cardSubtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  cardMeta: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600'
  },
  cardBlock: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 14,
    marginTop: 10
  },
  exerciseCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 14,
    marginTop: 10
  },
  exerciseCardPressed: {
    opacity: 0.9
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  exerciseCardTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  exerciseCardArrow: {
    color: theme.colors.muted,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2
  },
  exerciseMetricsRow: {
    flexDirection: 'row',
    gap: 10
  },
  exerciseMetricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background
  },
  exerciseMetricValue: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: theme.fontSizes.lg
  },
  exerciseMetricLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  blockTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8
  },
  blockItem: {
    color: theme.colors.muted,
    fontSize: 13,
    marginBottom: 6
  },
  sectionLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: 10,
    marginBottom: 10,
    backgroundColor: theme.colors.background
  },
  helperText: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10
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
  emptyText: {
    color: theme.colors.muted,
    fontSize: 13
  },
  academiaRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.background
  },
  academiaNome: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2
  },
  academiaInfo: {
    color: theme.colors.muted,
    fontSize: 12
  },
  academiaAdminCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.background
  },
  academiaAdminHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8
  },
  academiaAdminContent: {
    flex: 1
  },
  selectUpdateBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  selectUpdateText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  adminListWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  adminListItem: {
    color: theme.colors.text,
    fontSize: 12,
    marginBottom: 4
  },
  adminChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  adminChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  adminChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#dbeafe'
  },
  adminChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  adminChipTextActive: {
    color: theme.colors.primary
  },
  payloadInput: {
    minHeight: 140,
    fontFamily: 'monospace'
  },
  consoleAccessCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10
  },
  consoleAccessCardPressed: {
    opacity: 0.9
  },
  consoleAccessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  consoleAccessTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8
  },
  consoleAccessArrow: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: '700'
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    paddingVertical: 8,
    alignItems: 'center'
  },
  modeBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#dbeafe'
  },
  modeBtnPressed: {
    opacity: 0.88
  },
  modeBtnText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  modeBtnTextActive: {
    color: theme.colors.primary
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  optionChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#dbeafe'
  },
  optionChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  optionChipTextActive: {
    color: theme.colors.primary
  },
  firestoreActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  firestoreActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    backgroundColor: '#dbeafe',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  firestoreDeleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radii.sm,
    backgroundColor: '#fee2e2',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  firestoreActionBtnPressed: {
    opacity: 0.85
  },
  firestoreActionBtnDisabled: {
    opacity: 0.5
  },
  firestoreActionText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  firestoreDeleteText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '700'
  },
  firestoreResultBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    padding: 10,
    minHeight: 120
  },
  firestoreResultText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: 'monospace'
  }
});
