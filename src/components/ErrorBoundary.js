import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>❌ Erro no App</Text>
          <Text style={styles.error}>{String(this.state.error)}</Text>
          {this.state.errorInfo && (
            <Text style={styles.stack}>{this.state.errorInfo.componentStack}</Text>
          )}
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16
  },
  error: {
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
    fontFamily: 'monospace'
  },
  stack: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace'
  }
});
