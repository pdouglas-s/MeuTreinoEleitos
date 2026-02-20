import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../theme';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { listarNotificacoesProfessor, listarNotificacoesAluno, listarNotificacoesAcademia, marcarComoLida, marcarTodasComoLidas, marcarTodasComoLidasAluno, marcarTodasComoLidasAcademia } from '../../services/notificacoesService';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';
import { auth, db } from '../../firebase/config';
import CardMedia from '../../components/CardMedia';

const alunoNotifsHeroImage = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=80';
const alunoNotifsBackgroundImage = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80';
const professorNotifsHeroImage = 'https://images.unsplash.com/photo-1571019613914-85f342c55f1c?auto=format&fit=crop&w=1400&q=80';
const professorNotifsBackgroundImage = 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80';
const academiaNotifsHeroImage = 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=1400&q=80';
const academiaNotifsBackgroundImage = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80';

export default function NotificacoesScreen({ navigation }) {
  const { profile } = useAuth();
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [academiaNomePainel, setAcademiaNomePainel] = useState('');
  const userId = auth.currentUser?.uid || profile?.id || profile?.uid || null;
  const isAcademyAdmin = profile?.role === 'admin_academia';
  const isProfessor = ['professor', 'admin_sistema'].includes(profile?.role);
  const isAluno = !isAcademyAdmin && !isProfessor;
  const academiaNomeExibicao = String(academiaNomePainel || profile?.academia_nome || '').trim();
  const roleHeroImage = isAluno
    ? alunoNotifsHeroImage
    : (isAcademyAdmin ? academiaNotifsHeroImage : professorNotifsHeroImage);
  const roleBackgroundImage = isAluno
    ? alunoNotifsBackgroundImage
    : (isAcademyAdmin ? academiaNotifsBackgroundImage : professorNotifsBackgroundImage);
  const roleHeroTag = isAluno
    ? 'SEU FEED'
    : (isAcademyAdmin ? 'VISÃO DA ACADEMIA' : 'PAINEL DO PROFESSOR');
  const roleHeroTitle = isAluno
    ? 'Notificações de treino'
    : (isAcademyAdmin ? 'Atividades da academia' : 'Atividades dos alunos');
  const roleHeroHint = isAluno
    ? 'Acompanhe atualizações e progresso em tempo real'
    : (isAcademyAdmin
      ? 'Acompanhe o que está acontecendo com treinos e equipe'
      : 'Acompanhe início, progresso e finalização dos treinos');
  const roleHeaderTitle = isAluno
    ? 'Seu Feed de Treino'
    : (isAcademyAdmin
      ? (academiaNomeExibicao ? `Feed da Academia • ${academiaNomeExibicao}` : 'Feed da Academia')
      : 'Feed do Professor');

  useEffect(() => {
    const academiaId = String(profile?.academia_id || '').trim();
    if (!isAcademyAdmin || !academiaId) {
      setAcademiaNomePainel('');
      return undefined;
    }

    let active = true;
    getDoc(doc(db, 'academias', academiaId))
      .then((snapshot) => {
        if (!active) return;
        const nome = String(snapshot.data()?.nome || '').trim();
        setAcademiaNomePainel(nome);
      })
      .catch(() => {
        if (active) setAcademiaNomePainel('');
      });

    return () => {
      active = false;
    };
  }, [isAcademyAdmin, profile?.academia_id]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const academiaId = String(profile?.academia_id || '').trim();
    const filtro = isAcademyAdmin && academiaId
      ? query(collection(db, 'notificacoes'), where('academia_id', '==', academiaId))
      : (isProfessor
        ? query(collection(db, 'notificacoes'), where('professor_id', '==', userId))
        : query(collection(db, 'notificacoes'), where('aluno_id', '==', userId)));

    const unsubscribe = onSnapshot(filtro, (snapshot) => {
      const notifs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      notifs.sort((a, b) => {
        const dateA = a?.created_at?.toDate ? a.created_at.toDate() : new Date(a?.created_at || 0);
        const dateB = b?.created_at?.toDate ? b.created_at.toDate() : new Date(b?.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setNotificacoes(notifs);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [userId, isProfessor, isAcademyAdmin, profile?.academia_id]);

  async function carregarNotificacoes() {
    if (!userId) return;
    try {
      const notifs = isAcademyAdmin
        ? await listarNotificacoesAcademia(profile?.academia_id)
        : (isProfessor
          ? await listarNotificacoesProfessor(userId)
          : await listarNotificacoesAluno(userId));
      setNotificacoes(notifs);
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar as notificações.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleMarcarLida(notifId, jaLida) {
    if (jaLida) return;
    
    try {
      await marcarComoLida(notifId);
      setNotificacoes(prev => 
        prev.map(n => n.id === notifId ? { ...n, lida: true } : n)
      );
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível marcar a notificação como lida.'));
    }
  }

  async function handleMarcarTodasLidas() {
    if (!userId) return;
    try {
      if (isAcademyAdmin) await marcarTodasComoLidasAcademia(profile?.academia_id);
      else if (isProfessor) await marcarTodasComoLidas(userId);
      else await marcarTodasComoLidasAluno(userId);
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      Alert.alert('Sucesso', 'Todas as notificações foram marcadas como lidas.');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível marcar todas as notificações como lidas.'));
    }
  }

  function onRefresh() {
    setRefreshing(true);
    carregarNotificacoes();
  }

  function formatarData(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    const agora = new Date();
    const diff = Math.floor((agora - d) / 1000); // segundos

    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function getIcone(tipo) {
    switch (tipo) {
      case 'treino_iniciado':
        return { name: 'play-circle', color: '#3b82f6' };
      case 'exercicio_concluido':
        return { name: 'checkmark-circle', color: '#10b981' };
      case 'treino_finalizado':
        return { name: 'trophy', color: '#f59e0b' };
      case 'treino_associado':
        return { name: 'clipboard', color: '#0ea5a4' };
      case 'treino_criado':
        return { name: 'add-circle', color: '#14b8a6' };
      case 'treino_atualizado':
        return { name: 'create', color: '#2563eb' };
      case 'treino_excluido':
        return { name: 'trash', color: '#ef4444' };
      case 'treino_excluido_academia':
        return { name: 'trash-bin', color: '#dc2626' };
      case 'resumo_semanal':
        return { name: 'calendar', color: '#8b5cf6' };
      default:
        return { name: 'notifications', color: '#6b7280' };
    }
  }

  function getMensagemExibicao(item) {
    if (isAluno) {
      const treinoNome = String(item?.dados?.treino_nome || 'Treino').trim();
      const professorNome = String(item?.dados?.professor_nome || 'Professor').trim();

      switch (item?.tipo) {
        case 'treino_associado':
          return `${professorNome} liberou o treino "${treinoNome}" para você`;
        case 'treino_atualizado':
          return `Seu treino "${treinoNome}" foi atualizado`;
        case 'treino_excluido':
          return `O treino "${treinoNome}" foi removido da sua lista`;
        case 'resumo_semanal':
          return 'Seu resumo semanal está disponível';
        default:
          return item?.mensagem || '';
      }
    }

    if (!isAcademyAdmin) return item?.mensagem || '';

    if (item?.tipo === 'treino_associado') {
      const professorNome = String(item?.dados?.professor_nome || 'Professor').trim();
      const treinoNome = String(item?.dados?.treino_nome || 'Treino').trim();
      const alunoNome = String(item?.dados?.aluno_nome || item?.aluno_id || '').trim();

      if (alunoNome) {
        return `${professorNome} associou o treino "${treinoNome}" para ${alunoNome}`;
      }
    }

    return item?.mensagem || '';
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: roleBackgroundImage }}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View style={styles.screenBackgroundTint} />
      </ImageBackground>

      <ImageBackground source={{ uri: roleHeroImage }} style={styles.heroCard} imageStyle={styles.heroCardImage}>
        <View style={styles.heroCardTint} />
        <View style={styles.heroCardContent}>
          <Text style={styles.heroTag}>{roleHeroTag}</Text>
          <Text style={styles.heroTitle}>{roleHeroTitle}</Text>
          <Text style={styles.heroHint}>{roleHeroHint}</Text>
        </View>
      </ImageBackground>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{roleHeaderTitle}</Text>
          {naoLidas > 0 && (
            <Text style={styles.subtitle}>{naoLidas} não lida{naoLidas > 1 ? 's' : ''}</Text>
          )}
        </View>
        {naoLidas > 0 && (
          <Pressable style={styles.markAllBtn} onPress={handleMarcarTodasLidas}>
            <Text style={styles.markAllText}>Marcar todas</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <CardMedia variant="notificacao" label="TOTAL" compact />
          <Text style={styles.statValue}>{notificacoes.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <CardMedia variant="progresso" label="NÃO LIDAS" compact />
          <Text style={styles.statValue}>{naoLidas}</Text>
          <Text style={styles.statLabel}>Não lidas</Text>
        </View>
      </View>

      {notificacoes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={48} color={theme.colors.muted} />
          <Text style={styles.emptyText}>Nenhuma notificação ainda</Text>
        </View>
      ) : (
        <FlatList
          data={notificacoes}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const icone = getIcone(item.tipo);
            return (
              <Pressable
                style={[styles.notifCard, !item.lida && styles.notifCardUnread]}
                onPress={() => handleMarcarLida(item.id, item.lida)}
              >
                <View style={styles.notifMediaWrap}>
                  <CardMedia variant="notificacao" label={String(item?.tipo || 'atividade').replace(/_/g, ' ').toUpperCase()} compact />
                </View>
                <View style={[styles.iconContainer, { backgroundColor: icone.color + '20' }]}>
                  <Ionicons name={icone.name} size={24} color={icone.color} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifMessage, !item.lida && styles.notifMessageUnread]}>
                    {getMensagemExibicao(item)}
                  </Text>
                  <Text style={styles.notifTime}>{formatarData(item.created_at)}</Text>
                </View>
                {!item.lida && <View style={styles.unreadDot} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 12 },
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
    minHeight: 128,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'flex-end'
  },
  heroCardImage: {
    borderRadius: theme.radii.lg
  },
  heroCardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text,
    opacity: 0.54
  },
  heroCardContent: {
    padding: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.3)'
  },
  heroTag: {
    color: theme.colors.card,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700'
  },
  heroTitle: {
    color: theme.colors.card,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4
  },
  heroHint: {
    color: theme.colors.card,
    fontSize: 12,
    marginTop: 4
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 10
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 12
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
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  markAllText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyText: { fontSize: 16, color: theme.colors.muted, marginTop: 12 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: 14,
    marginHorizontal: 0,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: theme.colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  notifMediaWrap: {
    width: 84,
    marginRight: 8
  },
  notifCardUnread: {
    backgroundColor: theme.colors.background,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  notifContent: { flex: 1 },
  notifMessage: { fontSize: 15, color: theme.colors.text, marginBottom: 4 },
  notifMessageUnread: { fontWeight: '600', color: theme.colors.text },
  notifTime: { fontSize: 13, color: theme.colors.muted },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 8
  }
});
