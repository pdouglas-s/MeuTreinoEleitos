import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import TreinoCard from '../../components/TreinoCard';
import { auth } from '../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { listTreinosByAluno } from '../../services/treinoService';
import { listItensByTreino } from '../../services/treinoItensService';

export default function AlunoHome() {
  const [loading, setLoading] = useState(true);
  const [treinos, setTreinos] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTreinos([]);
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
      } catch (err) {
        console.warn('Erro ao listar treinos:', err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Seus Treinos</Text>
      {treinos.length === 0 && <Text>Nenhum treino encontrado.</Text>}
      {treinos.map((t) => (
        <TreinoCard key={t.id} treino={t} onOpen={(treino) => navigation.navigate('TreinoDetail', { treino })} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, marginBottom: 12 }
});
