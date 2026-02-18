import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import theme from '../theme';

const MEDIA_BY_VARIANT = {
  auth: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1200&q=80',
  treino: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=1200&q=80',
  aluno: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
  professor: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80',
  academia: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=80',
  sistema: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  notificacao: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
  relatorio: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  exercicio: 'https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=1200&q=80',
  musica: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  progresso: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1200&q=80',
  warning: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80'
};

export default function CardMedia({ variant = 'default', label = '', compact = false }) {
  const imageUrl = MEDIA_BY_VARIANT[variant] || MEDIA_BY_VARIANT.default;

  return (
    <ImageBackground source={{ uri: imageUrl }} style={[styles.media, compact && styles.mediaCompact]} imageStyle={styles.mediaImage}>
      <View style={styles.tint} />
      {!!label && (
        <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  media: {
    height: 56,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'flex-end'
  },
  mediaCompact: {
    height: 44,
    marginBottom: 8
  },
  mediaImage: {
    borderRadius: theme.radii.sm
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    opacity: 0.52
  },
  label: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  labelCompact: {
    fontSize: 10,
    paddingVertical: 4
  }
});
