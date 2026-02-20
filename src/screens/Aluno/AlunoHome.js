import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable as TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TreinoCard from '../../components/TreinoCard';
import { auth } from '../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { listItensByTreino } from '../../services/treinoItensService';
import { notificarResumoSemanalAluno } from '../../services/notificacoesService';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';
import theme from '../../theme';
import CardMedia from '../../components/CardMedia';

const alunoHeroImage = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80';
const alunoBackgroundImage = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80';

export default function AlunoHome({ navigation }) {
  const { logout, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [treinos, setTreinos] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [treinosAbertos, setTreinosAbertos] = useState(false);

  useEffect(() => {
    let unsubscribeTreinos = null;
    let unsubscribeNotificacoes = null;
    let unsubscribeItens = [];
    let resumoSemanalChecked = false;

    function clearItensListeners() {
      unsubscribeItens.forEach((unsubItem) => {
        try {
          unsubItem();
        } catch (_) {
          // noop
        }
      });
      unsubscribeItens = [];
    }

    function sortItensByOrdem(list = []) {
      return [...list].sort((a, b) => {
        const ordemA = Number.isFinite(a?.ordem) ? a.ordem : null;
        const ordemB = Number.isFinite(b?.ordem) ? b.ordem : null;

        if (ordemA !== null && ordemB !== null) return ordemA - ordemB;
        if (ordemA !== null) return -1;
        if (ordemB !== null) return 1;
        return 0;
      });
    }

    function sortTreinosByNome(list = []) {
      return [...list].sort((a, b) => {
        const nomeA = String(a?.nome_treino || '').trim();
        const nomeB = String(b?.nome_treino || '').trim();
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
      });
    }

    function watchItensPorTreino(treinosBase) {
      clearItensListeners();
      unsubscribeItens = treinosBase.map((treinoBase) => {
        const itensQuery = query(collection(db, 'treino_itens'), where('treino_id', '==', treinoBase.id));
        return onSnapshot(itensQuery, (itensSnapshot) => {
          const itens = sortItensByOrdem(
            itensSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          );
          setTreinos((prev) => prev.map((treinoAtual) => (
            treinoAtual.id === treinoBase.id ? { ...treinoAtual, itens } : treinoAtual
          )));
        }, () => {});
      });
    }

    async function hydrateTreinos(treinosBase) {
      const tWithItems = await Promise.all(
        treinosBase.map(async (tr) => {
          const itens = await listItensByTreino(tr.id);
          return { ...tr, itens };
        })
      );

      const ordenados = sortTreinosByNome(tWithItems);
      setTreinos(ordenados);
      return ordenados;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTreinos([]);
        setNotifCount(0);
        setLoading(false);
        if (unsubscribeTreinos) {
          unsubscribeTreinos();
          unsubscribeTreinos = null;
        }
        if (unsubscribeNotificacoes) {
          unsubscribeNotificacoes();
          unsubscribeNotificacoes = null;
        }
        clearItensListeners();
        return;
      }

      try {
        if (unsubscribeTreinos) {
          unsubscribeTreinos();
          unsubscribeTreinos = null;
        }

        const treinosQuery = query(collection(db, 'treinos'), where('aluno_id', '==', user.uid));
        unsubscribeTreinos = onSnapshot(treinosQuery, async (snapshot) => {
          try {
            const treinosBase = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            const tWithItems = await hydrateTreinos(treinosBase);
            watchItensPorTreino(treinosBase);

            if (!resumoSemanalChecked) {
              resumoSemanalChecked = true;
              try {
                const professorIdResponsavel = tWithItems[0]?.professor_id || null;
                await notificarResumoSemanalAluno(user.uid, professorIdResponsavel, profile?.nome || 'Atleta');
              } catch (resumoErr) {}
            }
          } catch (snapshotErr) {
          } finally {
            setLoading(false);
          }
        }, () => {
          setLoading(false);
        });

        if (unsubscribeNotificacoes) {
          unsubscribeNotificacoes();
          unsubscribeNotificacoes = null;
        }

        const notificacoesNaoLidasQuery = query(
          collection(db, 'notificacoes'),
          where('aluno_id', '==', user.uid),
          where('lida', '==', false)
        );
        unsubscribeNotificacoes = onSnapshot(notificacoesNaoLidasQuery, (snapshot) => {
          setNotifCount(snapshot.size);
        }, () => {});
      } catch (err) {
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeTreinos) unsubscribeTreinos();
      if (unsubscribeNotificacoes) unsubscribeNotificacoes();
      clearItensListeners();
      unsub();
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Falha ao sair.'));
    }
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" />
    </View>
  );

  const totalTreinos = treinos.length;
  const totalExercicios = treinos.reduce((acc, treino) => acc + (Array.isArray(treino?.itens) ? treino.itens.length : 0), 0);
  const motivacaoMensagem = totalTreinos > 0
    ? 'Consistência gera resultado. Vamos para mais um treino!'
    : 'Seu próximo treino começa aqui. Mantenha o foco!';

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: alunoBackgroundImage }}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View style={styles.screenBackgroundTint} />
      </ImageBackground>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
      <ImageBackground
        source={{ uri: alunoHeroImage }}
        style={styles.heroCard}
        imageStyle={styles.heroCardImage}
      >
        <View style={styles.heroCardTint} />
        <View style={styles.heroCardContent}>
          <Text style={styles.heroTag}>MODO TREINO</Text>
          <Text style={styles.heroTitle}>Evolução começa com constância</Text>
          <Text style={styles.heroHint}>{totalTreinos} treino(s) • {totalExercicios} exercício(s)</Text>
          <Text style={styles.heroMotivation}>{motivacaoMensagem}</Text>
        </View>
      </ImageBackground>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Seus Treinos</Text>
          <Text style={styles.subtitle}>Bem-vindo, {profile?.nome}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => {
              navigation.navigate('Notificacoes');
            }}
          >
            <Ionicons name="notifications" size={22} color={theme.colors.primary} />
            {notifCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsCard}>
        <CardMedia variant="treino" label="RESUMO DO DIA" compact />
        <Text style={styles.statsValue}>{totalTreinos}</Text>
        <Text style={styles.statsLabel}>treino(s) disponível(is)</Text>
      </View>

      {treinos.length === 0 && (
        <View style={styles.emptyCard}>
          <CardMedia variant="aluno" label="SEM TREINOS NO MOMENTO" compact />
          <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
          <Text style={styles.emptyHint}>Fale com seu professor para liberar seu próximo treino.</Text>
        </View>
      )}
      {treinos.length > 0 && (
        <View style={styles.groupCard}>
          <TouchableOpacity
            style={styles.groupHeader}
            onPress={() => setTreinosAbertos((prev) => !prev)}
          >
            <View>
              <Text style={styles.groupTitle}>Treinos disponíveis</Text>
              <Text style={styles.groupSubtitle}>{totalTreinos} treino(s)</Text>
            </View>
            <Text style={styles.groupChevron}>{treinosAbertos ? '▾' : '▸'}</Text>
          </TouchableOpacity>

          {treinosAbertos && treinos.map((t) => (
            <TreinoCard 
              key={t.id} 
              treino={t} 
              onOpen={(treino) => navigation.navigate('TreinoDetail', { treino })}
              alunoId={auth.currentUser?.uid}
              professorId={t.professor_id}
              alunoNome={profile?.nome || 'Aluno'}
              collapsedByDefault
            />
          ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
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
    minHeight: 168,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: 12,
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
    padding: 14,
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
    marginTop: 6,
    fontSize: theme.fontSizes.xl,
    fontWeight: '800'
  },
  heroHint: {
    color: theme.colors.card,
    marginTop: 6,
    fontSize: theme.fontSizes.sm,
    fontWeight: '600'
  },
  heroMotivation: {
    color: theme.colors.card,
    marginTop: 4,
    fontSize: theme.fontSizes.sm
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  notifBtn: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: '700'
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  statsCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statsValue: {
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
    fontWeight: '700'
  },
  statsLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: 12
  },
  emptyText: {
    color: theme.colors.muted,
    textAlign: 'center',
    fontWeight: '600'
  },
  emptyHint: {
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12
  },
  groupCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8
  },
  groupTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  groupSubtitle: {
    color: theme.colors.muted,
    marginTop: 2,
    fontSize: 12
  },
  groupChevron: {
    color: theme.colors.muted,
    fontSize: 18,
    fontWeight: '700'
  },
  logoutBtn: {
    backgroundColor: '#fee',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca'
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14
  }
});
