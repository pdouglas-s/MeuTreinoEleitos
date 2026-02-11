import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ConfigErrorScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>⚠️ Configuração Incompleta</Text>
      <Text style={styles.subtitle}>Firebase não está configurado</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configure as variáveis de ambiente:</Text>
        <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_API_KEY</Text>
        <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_APP_ID</Text>
        <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_PROJECT_ID</Text>
        <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PowerShell (Windows):</Text>
        <Text style={styles.codeBlock}>
          $env:EXPO_PUBLIC_FIREBASE_API_KEY="sua_chave"
        </Text>
        <Text style={styles.codeBlock}>
          $env:EXPO_PUBLIC_FIREBASE_APP_ID="seu_app_id"
        </Text>
        <Text style={styles.codeBlock}>
          $env:EXPO_PUBLIC_FIREBASE_PROJECT_ID="meu-treino-eleitos"
        </Text>
      </View>

      <Text style={styles.instructions}>
        Depois de configurar, reinicie o servidor: npm run start
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 24,
    backgroundColor: '#fff'
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold',
    textAlign: 'center', 
    marginBottom: 8,
    color: '#d32f2f'
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666'
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333'
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    padding: 8,
    backgroundColor: '#fff',
    marginBottom: 6,
    borderRadius: 4,
    color: '#1976d2'
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 8,
    backgroundColor: '#fff',
    marginBottom: 4,
    borderRadius: 4,
    color: '#333'
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
    fontStyle: 'italic'
  }
});
