 /**
 * Sistema de Logging Condicional
 * Logs só aparecem em desenvolvimento, não em produção
 */

const Logger = {
  /**
   * Verifica se está em desenvolvimento
   */
  isDev: () => {
    // Verifica se AppConfig existe
    if (typeof AppConfig !== 'undefined') {
      return AppConfig.isDevelopment();
    }
    
    // Fallback: verificar hostname diretamente
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' ||
           hostname.includes('192.168');
  },
  
  /**
   * Log normal (apenas em desenvolvimento)
   */
  log: (...args) => {
    if (Logger.isDev()) {
      console.log(...args);
    }
  },
  
  /**
   * Warnings (apenas em desenvolvimento)
   */
  warn: (...args) => {
    if (Logger.isDev()) {
      console.warn(...args);
    }
  },
  
  /**
   * Erros (sempre mostrar, mas com mais detalhes em dev)
   */
  error: (...args) => {
    if (Logger.isDev()) {
      console.error('🔴 ERRO:', ...args);
    } else {
      // Em produção, log simplificado
      console.error('Erro:', args[0]);
    }
  },
  
  /**
   * Info importante (sempre mostrar)
   */
  info: (...args) => {
    console.info(...args);
  },
  
  /**
   * Debug detalhado (apenas em desenvolvimento)
   */
  debug: (...args) => {
    if (Logger.isDev()) {
      console.log('🔍 DEBUG:', ...args);
    }
  },
  
  /**
   * Grupo de logs (apenas em desenvolvimento)
   */
  group: (title, fn) => {
    if (Logger.isDev()) {
      console.group(title);
      fn();
      console.groupEnd();
    }
  },
  
  /**
   * Tabela (apenas em desenvolvimento)
   */
  table: (data) => {
    if (Logger.isDev()) {
      console.table(data);
    }
  }
};

// Tornar disponível globalmente
if (typeof window !== 'undefined') {
  window.Logger = Logger;
}

// Export para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}
