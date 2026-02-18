import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Button, ImageBackground } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import theme from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../utils/alert';
import { getAuthErrorMessage } from '../utils/authErrors';
import { createAcademia, createAcademiaAdmin, getSystemDashboardStats } from '../services/userService';
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

  useEffect(() => {
    loadStats();
  }, []);

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
      await loadStats();
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
      await loadStats();
      Alert.alert('Sucesso', 'Administrador da academia criado com sucesso');
    } catch (error) {
      Alert.alert('Erro', getAuthErrorMessage(error, 'Não foi possível criar o administrador da academia.'));
    }
  }

  const resumo = stats?.resumo || {};
  const porAcademia = stats?.por_academia || [];

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
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={academiaSelecionada} onValueChange={setAcademiaSelecionada} style={styles.picker}>
                    <Picker.Item label="Selecione a academia" value="" />
                    {porAcademia.map((item) => (
                      <Picker.Item key={item.academia_id} label={item.academia_nome} value={item.academia_id} />
                    ))}
                  </Picker>
                </View>
                <Button
                  title="Criar Admin da Academia"
                  onPress={handleCreateAdminAcademia}
                  disabled={!nomeAdminAcademia.trim() || !emailAdminAcademia.trim() || !academiaSelecionada}
                />
              </View>

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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    marginBottom: 10,
    backgroundColor: theme.colors.background,
    overflow: 'hidden'
  },
  picker: {
    width: '100%'
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
