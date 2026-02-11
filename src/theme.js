import React from 'react';

const light = {
  colors: {
    primary: '#1e90ff',
    background: '#f7f8fb',
    card: '#ffffff',
    text: '#111827',
    muted: '#6b7280',
    danger: '#ef4444'
  },
  spacing: (n) => n * 8,
  radii: { sm: 6, md: 8, lg: 12 },
  fontSizes: { sm: 12, md: 16, lg: 18, xl: 22 }
};

const dark = {
  colors: {
    primary: '#0ea5a4',
    background: '#0f172a',
    card: '#0b1220',
    text: '#e6eef6',
    muted: '#94a3b8',
    danger: '#f87171'
  },
  spacing: (n) => n * 8,
  radii: { sm: 6, md: 8, lg: 12 },
  fontSizes: { sm: 12, md: 16, lg: 18, xl: 22 }
};

const ThemeContext = React.createContext({ theme: light, toggle: () => {} });

export { light, dark, ThemeContext };

// Default export for components still using `import theme from '../theme'`
export default light;
