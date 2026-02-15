import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import TreinoCard from '../../components/TreinoCard';
import { auth } from '../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { listTreinosByAluno } from '../../services/treinoService';
import { listItensByTreino } from '../../services/treinoItensService';
import { listarNotificacoesAluno, contarNaoLidasAluno } from '../../services/notificacoesService';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../../utils/alert';
import theme from '../../theme';

export default function AlunoHome({ navigation }) {
  const { logout, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [treinos, setTreinos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTreinos([]);
        setNotificacoes([]);
        setNotifCount(0);
        setLoading(false);
        return;
      }

      try {
        const t = await listTreinosByAluno(user.uid);
        // Para cada treino, buscar os itens
        const tWithItems = await Promise.all(
          t.map(async (tr) => {
            const itens = await listItensByTreino(tr.id);
            return { ...tr, itens };
          })
        );
        setTreinos(tWithItems);

        const [notifs, count] = await Promise.all([
          listarNotificacoesAluno(user.uid),
          contarNaoLidasAluno(user.uid)
        ]);
        setNotificacoes(notifs.slice(0, 5));
        setNotifCount(count);
      } catch (err) {
        console.warn('Erro ao listar treinos:', err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (err) {
      Alert.alert('Erro', 'Falha ao sair: ' + err.message);
    }
  }

  function formatarData(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    const agora = new Date();
    const diff = Math.floor((agora - d) / 1000);

    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Seus Treinos</Text>
          <Text style={styles.subtitle}>Bem-vindo, {profile?.nome}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsValue}>{treinos.length}</Text>
        <Text style={styles.statsLabel}>treino(s) disponível(is)</Text>
      </View>

      <View style={styles.notifCard}>
        <Text style={styles.notifTitle}>Notificações</Text>
        <Text style={styles.notifSubtitle}>{notifCount} não lida(s)</Text>
        {notificacoes.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma notificação por enquanto.</Text>
        ) : (
          notificacoes.map((n) => (
            <View key={n.id} style={styles.notifItem}>
              <Text style={styles.notifMessage}>{n.mensagem}</Text>
              <Text style={styles.notifTime}>{formatarData(n.created_at)}</Text>
            </View>
          ))
        )}
      </View>

      {treinos.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
        </View>
      )}
      {treinos.map((t) => (
        <TreinoCard 
          key={t.id} 
          treino={t} 
          onOpen={(treino) => navigation.navigate('TreinoDetail', { treino })}
          alunoId={auth.currentUser?.uid}
          professorId={t.professor_id}
          alunoNome={profile?.nome || 'Aluno'}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
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
    textAlign: 'center'
  },
  notifCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 12,
    marginBottom: 12
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text
  },
  notifSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    marginBottom: 8
  },
  notifItem: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef0f3'
  },
  notifMessage: {
    fontSize: 14,
    color: theme.colors.text
  },
  notifTime: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2
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
