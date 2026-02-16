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

function showWebConfirm(title, message, options = {}) {
  if (typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  const {
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    destructive = false
  } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.zIndex = '10000';

    const card = document.createElement('div');
    card.style.width = '100%';
    card.style.maxWidth = '420px';
    card.style.background = '#111827';
    card.style.border = '1px solid #374151';
    card.style.borderRadius = '12px';
    card.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)';
    card.style.color = '#f9fafb';
    card.style.padding = '16px';
    card.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    const titleEl = document.createElement('div');
    titleEl.textContent = title || 'Confirmação';
    titleEl.style.fontSize = '16px';
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '8px';

    const messageEl = document.createElement('div');
    messageEl.textContent = String(message || 'Deseja continuar?');
    messageEl.style.fontSize = '14px';
    messageEl.style.lineHeight = '1.4';
    messageEl.style.color = '#d1d5db';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';
    actions.style.marginTop = '16px';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = cancelText;
    cancelBtn.style.padding = '8px 12px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.border = '1px solid #4b5563';
    cancelBtn.style.background = '#1f2937';
    cancelBtn.style.color = '#f9fafb';
    cancelBtn.style.cursor = 'pointer';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmText;
    confirmBtn.style.padding = '8px 12px';
    confirmBtn.style.borderRadius = '8px';
    confirmBtn.style.border = destructive ? '1px solid #7f1d1d' : '1px solid #1e3a8a';
    confirmBtn.style.background = destructive ? '#b91c1c' : '#2563eb';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.cursor = 'pointer';

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        handleCancel();
      }
    });
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
    document.addEventListener('keydown', onKeyDown);

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(titleEl);
    card.appendChild(messageEl);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
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
  },
  confirm: (title, message, options = {}) => {
    const {
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      destructive = false
    } = options;

    if (Platform.OS === 'web') {
      return showWebConfirm(title, message, { confirmText, cancelText, destructive });
    }

    return new Promise((resolve) => {
      RNAlert.alert(
        title || 'Confirmação',
        message,
        [
          { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
          { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) }
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  }
};
