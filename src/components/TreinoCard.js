import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

export default function TreinoCard({ treino, onOpen }) {
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
    <TouchableOpacity activeOpacity={0.95} style={styles.card} onPress={() => onOpen && onOpen(treino)}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{treino.nome_treino}</Text>
        <Text style={styles.progress}>{`${doneCount}/${exercicios.length}`}</Text>
      </View>

      <FlatList
        data={exercicios}
        keyExtractor={(item, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity onPress={() => toggleDone(index)} style={styles.checkbox} testID={`checkbox-${index}`}>
              {item.done ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Ionicons name="ellipse-outline" size={18} color="#666" />}
            </TouchableOpacity>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.exercicio_nome || 'Exercício'}</Text>
              <Text style={styles.itemMeta}>{`${item.series || '-'} x ${item.repeticoes || '-'} • ${item.carga || '-'}kg`}</Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.finishBtn} onPress={() => alert('Sessão finalizada')}>
        <Ionicons name="checkmark-done" size={16} color="#fff" />
        <Text style={styles.finishText}>  Finalizar Sessão</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radii.md, padding: theme.spacing(1.5), marginBottom: theme.spacing(1.5), elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  title: { fontSize: theme.fontSizes.lg, fontWeight: '700', color: theme.colors.text },
  progress: { fontSize: theme.fontSizes.sm, color: theme.colors.muted },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 8 },
  checkbox: { width: 34, height: 34, borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#fbfbfd' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: theme.fontSizes.md, color: theme.colors.text },
  itemMeta: { fontSize: theme.fontSizes.sm, color: theme.colors.muted },
  finishBtn: { marginTop: 12, backgroundColor: theme.colors.primary, padding: 10, borderRadius: theme.radii.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  finishText: { color: '#fff', fontWeight: '600' }
});
