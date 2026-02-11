import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';

export default function TreinoCard({ treino }) {
  const [exercicios, setExercicios] = useState(
    (treino.itens || []).map((e) => ({ ...e, done: false }))
  );

  function toggleDone(index) {
    const copy = [...exercicios];
    copy[index].done = !copy[index].done;
    setExercicios(copy);
  }

  const doneCount = exercicios.filter((e) => e.done).length;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{treino.nome_treino}</Text>
      <Text style={styles.progress}>{`${doneCount}/${exercicios.length} exercícios feitos`}</Text>

      <FlatList
        data={exercicios}
        keyExtractor={(item, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity onPress={() => toggleDone(index)} style={styles.checkbox}>
              <Text>{item.done ? '✓' : ''}</Text>
            </TouchableOpacity>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.exercicio_nome || 'Exercício'}</Text>
              <Text style={styles.itemMeta}>{`${item.series || '-'} x ${item.repeticoes || '-'} • ${item.carga || '-'}kg`}</Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.finishBtn} onPress={() => alert('Sessão finalizada')}>
        <Text style={styles.finishText}>Finalizar Sessão</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  progress: { fontSize: 12, color: '#666', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemInfo: {},
  itemTitle: { fontSize: 16 },
  itemMeta: { fontSize: 12, color: '#666' },
  finishBtn: { marginTop: 12, backgroundColor: '#1e90ff', padding: 10, borderRadius: 6, alignItems: 'center' },
  finishText: { color: '#fff', fontWeight: '600' }
});
