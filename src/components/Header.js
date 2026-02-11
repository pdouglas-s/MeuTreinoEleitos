import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeContext } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ title }) {
  const { theme, toggle } = useContext(ThemeContext);
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity onPress={toggle} style={styles.toggle} accessibilityLabel="toggle-theme">
        <Ionicons name="moon" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  toggle: { position: 'absolute', right: 12 }
});
