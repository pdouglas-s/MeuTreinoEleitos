import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import TreinoCard from '../../components/TreinoCard';

const sampleTreinos = [
  {
    id: 't1',
    nome_treino: 'Treino A',
    itens: [
      { exercicio_nome: 'Supino', series: 3, repeticoes: 8, carga: 60 },
      { exercicio_nome: 'Agachamento', series: 4, repeticoes: 6, carga: 80 }
    ]
  },
  {
    id: 't2',
    nome_treino: 'Treino B',
    itens: [
      { exercicio_nome: 'Remada', series: 3, repeticoes: 10, carga: 50 },
      { exercicio_nome: 'Levantamento Terra', series: 3, repeticoes: 5, carga: 100 }
    ]
  }
];

export default function AlunoHome() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Seus Treinos</Text>
      {sampleTreinos.map((t) => (
        <TreinoCard key={t.id} treino={t} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, marginBottom: 12 }
});
