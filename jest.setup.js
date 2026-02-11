// Jest setup: mock expo modules that cause native/platform calls
jest.mock('expo-asset', () => ({
  Asset: { fromModule: () => ({ localUri: '' }) },
  default: { loadAsync: jest.fn() },
  PlatformUtils: { exists: () => false }
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Mock = (props) => React.createElement('Icon', props, props.children || null);
  return { Ionicons: Mock, MaterialIcons: Mock, default: Mock };
});
