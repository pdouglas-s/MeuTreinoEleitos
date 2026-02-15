import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TreinoCard from '../../components/TreinoCard';
import { auth } from '../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { listTreinosByAluno } from '../../services/treinoService';
import { listItensByTreino } from '../../services/treinoItensService';
import { contarNaoLidasAluno, notificarResumoSemanalAluno } from '../../services/notificacoesService';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../../utils/alert';
import theme from '../../theme';

export default function AlunoHome({ navigation }) {
  const { logout, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [treinos, setTreinos] = useState([]);
  const [notifCount, setNotifCount] = useState(0);

  async function loadNotificacoes(alunoId) {
    try {
      const count = await contarNaoLidasAluno(alunoId);
      setNotifCount(count);
    } catch (err) {
      console.warn('Erro ao carregar notificações do aluno:', err?.message || err);
    }
  }

  useEffect(() => {
    let interval = null;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTreinos([]);
        setNotifCount(0);
        setLoading(false);
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
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
        try {
          const professorIdResponsavel = tWithItems[0]?.professor_id || null;
          await notificarResumoSemanalAluno(user.uid, professorIdResponsavel, profile?.nome || 'Atleta');
        } catch (resumoErr) {
          console.warn('Resumo semanal fallback não enviado:', resumoErr?.message || resumoErr);
        }
        await loadNotificacoes(user.uid);
        if (interval) clearInterval(interval);
        interval = setInterval(() => loadNotificacoes(user.uid), 30000);
      } catch (err) {
        console.warn('Erro ao listar treinos:', err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (interval) clearInterval(interval);
      unsub();
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (err) {
      Alert.alert('Erro', 'Falha ao sair: ' + err.message);
    }
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => {
              navigation.navigate('Notificacoes');
              loadNotificacoes(auth.currentUser?.uid);
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
        <Text style={styles.statsValue}>{treinos.length}</Text>
        <Text style={styles.statsLabel}>treino(s) disponível(is)</Text>
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
    textAlign: 'center'
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
