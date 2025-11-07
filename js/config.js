 /**
 * Configurações Centralizadas do Sistema
 * Evita duplicação de código e facilita manutenção
 */

const AppConfig = {
  /**
   * Detecta e retorna a URL do backend baseado no ambiente
   */
  getBackendURL: () => {
    const hostname = window.location.hostname;
    
    // Produção - shoptlktok.shop
    if (hostname.includes('shoptlktok.shop')) {
      return 'https://mobile-action-bar-backend-production.up.railway.app';
    }
    
    // Railway (backend direto)
    if (hostname.includes('railway.app')) {
      return '';
    }
    
    // Localhost ou outros
    return '';
  },
  
  /**
   * Verifica se está em ambiente de desenvolvimento
   */
  isDevelopment: () => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' ||
           hostname.includes('192.168');
  },
  
  /**
   * Configurações de pagamento
   */
  payment: {
    // Número máximo de verificações de status (reduzido de 360 para 60)
    maxChecks: 60,  // 5 minutos no máximo
    
    // Intervalo base de verificação (ms)
    baseInterval: 5000,  // 5 segundos
    
    /**
     * Retorna intervalo adaptativo baseado no número de tentativas
     * - Primeiros 12 checks (1 min): 5s
     * - Próximos 18 checks (2 min): 10s  
     * - Restantes (2 min): 15s
     */
    getInterval: (checkCount) => {
      if (checkCount < 12) return 5000;   // 1 min: verificar a cada 5s
      if (checkCount < 30) return 10000;  // 2 min: verificar a cada 10s
      return 15000;                       // 2 min: verificar a cada 15s
    }
  },
  
  /**
   * URLs das páginas
   */
  pages: {
    home: 'index.html',
    checkout: 'checkout-v2.html',
    payment: 'pagamento.html',
    confirmation: 'confirmacao.html',
    admin: 'admin.html'
  },
  
  /**
   * Versão do sistema (para cache-busting)
   */
  version: '2024110701'
};

// Tornar disponível globalmente
if (typeof window !== 'undefined') {
  window.AppConfig = AppConfig;
}

// Export para uso em módulos (se necessário no futuro)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
}
