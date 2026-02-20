import React, { useContext } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ThemeContext } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ title }) {
  const { theme, toggle } = useContext(ThemeContext);
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <Text style={[styles.title, { color: theme.colors.card }]}>{title}</Text>
      <Pressable onPress={toggle} style={styles.toggle} accessibilityLabel="toggle-theme">
        <Ionicons name="moon" size={18} color={theme.colors.card} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  toggle: { position: 'absolute', right: 12 }
});
