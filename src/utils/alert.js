import { Platform, Alert as RNAlert } from 'react-native';

// Alert compatível com web
export const Alert = {
  alert: (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message || ''}`);
    } else {
      RNAlert.alert(title, message);
    }
  }
};
