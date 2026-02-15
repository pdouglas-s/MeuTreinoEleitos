export function getAuthErrorMessage(error, fallbackMessage = 'Não foi possível concluir a operação. Tente novamente.') {
  const code = error?.code || '';

  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
    return 'E-mail ou senha inválidos.';
  }
  if (code === 'auth/wrong-password') {
    return 'Senha inválida.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Tente novamente em alguns minutos.';
  }
  if (code === 'auth/invalid-email') {
    return 'E-mail inválido.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este e-mail já está em uso.';
  }
  if (code === 'auth/weak-password') {
    return 'Senha fraca. Use uma senha mais forte.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Sua sessão expirou para esta ação. Faça login novamente.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Operação não permitida na configuração atual.';
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
