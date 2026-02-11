import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../theme';

export default function Header({ title }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: theme.spacing(1.5), backgroundColor: theme.colors.primary },
  title: { color: '#fff', fontSize: theme.fontSizes.lg, fontWeight: '700', textAlign: 'center' }
});
