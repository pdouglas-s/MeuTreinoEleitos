import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, TextInput, Button, ImageBackground, InteractionManager } from 'react-native';
import theme from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../utils/alert';
import { getAuthErrorMessage } from '../utils/authErrors';
import { createAcademia, createAcademiaAdmin, getSystemDashboardStats } from '../services/userService';
import { listAllExercicios } from '../services/exerciciosService';
import { isValidEmail } from '../utils/validation';
import CardMedia from '../components/CardMedia';

const adminHeroImage = 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80';
const adminBackgroundImage = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80';

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
                        activeOpacity={0.85}
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

              <View style={styles.gridRow}>
                <InfoCard title="Academias" value={resumo.total_academias || 0} subtitle="Total cadastradas" />
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
  }
});
