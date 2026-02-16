import { Platform, Alert as RNAlert, ToastAndroid } from 'react-native';

const WEB_TOAST_CONTAINER_ID = 'meu-treino-toast-container';

function getWebToastContainer() {
  if (typeof document === 'undefined') return null;

  let container = document.getElementById(WEB_TOAST_CONTAINER_ID);
  if (container) return container;

  container = document.createElement('div');
  container.id = WEB_TOAST_CONTAINER_ID;
  container.style.position = 'fixed';
  container.style.top = '16px';
  container.style.right = '16px';
  container.style.zIndex = '9999';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '8px';
  document.body.appendChild(container);
  return container;
}

function getWebToastStyle(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('erro')) return { bg: '#b91c1c', border: '#7f1d1d' };
  if (t.includes('atenção') || t.includes('atencao')) return { bg: '#92400e', border: '#78350f' };
  if (t.includes('sucesso')) return { bg: '#166534', border: '#14532d' };
  return { bg: '#1f2937', border: '#111827' };
}

function showWebToast(title, message) {
  const container = getWebToastContainer();
  if (!container) return;

  const toast = document.createElement('div');
  const palette = getWebToastStyle(title);
  toast.style.background = palette.bg;
  toast.style.border = `1px solid ${palette.border}`;
  toast.style.color = '#fff';
  toast.style.padding = '10px 12px';
  toast.style.borderRadius = '10px';
  toast.style.maxWidth = '340px';
  toast.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  toast.style.fontSize = '13px';
  toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-6px)';
  toast.style.transition = 'opacity 120ms ease, transform 120ms ease';

  const strong = document.createElement('div');
  strong.style.fontWeight = '700';
  strong.style.marginBottom = message ? '4px' : '0';
  strong.textContent = title || 'Aviso';
  toast.appendChild(strong);

  if (message) {
    const content = document.createElement('div');
    content.style.lineHeight = '1.3';
    content.textContent = String(message);
    toast.appendChild(content);
  }

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 140);
  }, 2600);
}

// Alert compatível com web
export const Alert = {
  alert: (title, message) => {
    if (Platform.OS === 'web') {
      showWebToast(title, message);
    } else if (Platform.OS === 'android') {
      const text = [title, message].filter(Boolean).join(': ');
      ToastAndroid.show(text || 'Aviso', ToastAndroid.LONG);
    } else {
      RNAlert.alert(title, message);
    }
  }
};
