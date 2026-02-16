import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import theme from '../../theme';
import { listAllProfessores } from '../../services/userService';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';

export default function ProfessoresListScreen() {
  const [professores, setProfessores] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarProfessores();
  }, []);

  async function carregarProfessores() {
    setLoading(true);
    try {
      const list = await listAllProfessores();
      const filtrados = list.filter((item) => item?.nome !== 'ADMIN');
      const sortedList = [...filtrados].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setProfessores(sortedList);
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar os professores.'));
    } finally {
      setLoading(false);
    }
  }

  const professoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return professores;
    return professores.filter((professor) => {
      const nome = String(professor?.nome || '').toLowerCase();
      const email = String(professor?.email || '').toLowerCase();
      return nome.includes(termo) || email.includes(termo);
    });
  }, [professores, busca]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando professores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Professores Cadastrados</Text>
      <TextInput
        placeholder="Buscar por nome ou e-mail"
        style={styles.input}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
      />

      <FlatList
        data={professoresFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemNome}>{item.nome}</Text>
            <Text style={styles.itemEmail}>{item.email}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyHint}>Nenhum professor encontrado.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(2)
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.muted,
    fontSize: 14
  },
  title: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    backgroundColor: theme.colors.card
  },
  itemRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 6
  },
  itemNome: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text
  },
  itemEmail: {
    marginTop: 3,
    fontSize: 12,
    color: theme.colors.muted
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.muted
  }
});
