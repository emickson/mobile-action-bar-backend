/**
 * Payment Gateway Integration Module
 * Suporta múltiplos gateways de pagamento PIX
 * 
 * Gateways suportados:
 * - Gerencianet (Efí)
 * - Pagar.me
 * - Asaas
 * - Mercado Pago
 * - TriboPay
 * - Personalizado
 */

class PaymentGateway {
  constructor() {
    console.log('🔧 PaymentGateway: Inicializando...');
    this.config = this.loadConfig();
    this.baseURL = this.getBaseURL();
    console.log('🔧 PaymentGateway: Config carregada:', this.config?.provider || 'Nenhuma');
    console.log('🔧 PaymentGateway: Base URL:', this.baseURL);
  }

  /**
   * Carrega configuração do gateway do localStorage
   */
  loadConfig() {
    const config = localStorage.getItem('gateway_config');
    if (!config) {
      console.warn('Gateway de pagamento não configurado');
      return null;
    }
    return JSON.parse(config);
  }

  /**
   * Retorna a URL base da API do gateway selecionado
   */
  getBaseURL() {
    if (!this.config) return null;

    // Se URL personalizada foi configurada
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }

    // URLs padrão dos gateways
    const urls = {
      gerencianet: this.config.environment === 'production' 
        ? 'https://api.gerencianet.com.br/v1'
        : 'https://sandbox.gerencianet.com.br/v1',
      
      pagarme: this.config.environment === 'production'
        ? 'https://api.pagar.me/core/v5'
        : 'https://api.pagar.me/core/v5', // Pagar.me usa mesma URL
      
      asaas: this.config.environment === 'production'
        ? 'https://www.asaas.com/api/v3'
        : 'https://sandbox.asaas.com/api/v3',
      
      mercadopago: this.config.environment === 'production'
        ? 'https://api.mercadopago.com/v1'
        : 'https://api.mercadopago.com/v1', // MP usa mesma URL
      
      tribopay: this.config.environment === 'production'
        ? 'https://api.tribopay.com.br/v1'
        : 'https://sandbox.tribopay.com.br/v1',
      
      vegas: this.config.baseUrl || 'https://checkout.shoptlktok.shop/api', // Vegas endpoint real (configurável via admin)
      
      custom: this.config.customUrl || null
    };

    return urls[this.config.provider] || null;
  }

  /**
   * Obtém token de autenticação OAuth2
   */
  async getAuthToken() {
    if (!this.config || !this.baseURL) {
      throw new Error('Gateway não configurado');
    }

    try {
      const response = await fetch(`${this.baseURL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`
        },
        body: JSON.stringify({
          grant_type: 'client_credentials'
        })
      });

      if (!response.ok) {
        throw new Error('Falha na autenticação');
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Erro ao obter token:', error);
      throw error;
    }
  }

  /**
   * Gera cobrança PIX
   * @param {Object} paymentData - Dados do pagamento
   * @returns {Promise<Object>} - Dados do PIX gerado
   */
  async generatePIX(paymentData) {
    console.log('💳 generatePIX: Iniciando...', paymentData);
    
    // Validar configuração (custom não precisa de baseURL)
    if (!this.config) {
      throw new Error('Gateway não configurado. Configure no painel admin.');
    }
    
    if (!this.baseURL && this.config.provider !== 'custom') {
      throw new Error('Gateway não configurado. Configure no painel admin.');
    }

    try {
      // Preparar dados conforme o gateway
      console.log('📝 generatePIX: Formatando dados...');
      const requestData = this.formatPaymentData(paymentData);
      console.log('📝 generatePIX: Dados formatados:', requestData);

      // Preparar headers
      const headers = {
        'Content-Type': 'application/json'
      };

      // Vegas usa API Key, Custom usa Bearer direto, outros usam OAuth2
      if (this.config.provider === 'vegas') {
        console.log('🔑 generatePIX: Usando API Key do Vegas');
        headers['api-key'] = this.config.apiKey || this.config.clientSecret;
      } else if (this.config.provider === 'custom') {
        console.log('🔑 generatePIX: Custom - Authorization será definida na chamada');
        // Custom (IronPay) define Authorization direto no fetch
      } else {
        console.log('🔑 generatePIX: Obtendo token OAuth2...');
        // Obter token de autenticação para outros gateways
        const token = await this.getAuthToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Endpoint específico por gateway (custom não usa)
      const endpoint = this.config.provider === 'custom' 
        ? null
        : this.config.provider === 'vegas' 
          ? `${this.baseURL}/checkout`
          : `${this.baseURL}/pix/charges`;
      
      if (endpoint) {
        console.log('🌐 generatePIX: Endpoint:', endpoint);
      }
      console.log('📤 generatePIX: Enviando requisição...');

      // Detectar se está rodando localmente
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      let response;

      // Gateway Personalizado (IronPay via BACKEND)
      if (this.config.provider === 'custom' && this.config.apiKey) {
        console.log('🔧 IronPay: Via Backend (evita CORS)');
        
        // Permitir configurar URL do backend via localStorage ou variável global
        const customBackendURL = localStorage.getItem('backend_api_url') || window.BACKEND_API_URL;
        
        // Usar backend local, customizado ou produção
        const backendURL = customBackendURL 
          ? customBackendURL 
          : (isLocal 
              ? 'http://localhost:8080/api/pagar'
              : window.location.origin + '/api/pagar'); // Usa o mesmo domínio
        
        console.log('🌐 Backend URL:', backendURL);
        
        // Obter offer_hash e product_hash do localStorage (admin deve configurar)
        const gatewayConfig = localStorage.getItem('gateway_config');
        const config = gatewayConfig ? JSON.parse(gatewayConfig) : {};
        
        const offerHash = config.offerHash || paymentData.offerHash || '7becb';
        const productHash = config.productHash || paymentData.productHash || '7tjdfkshdv';
        
        console.log('📝 IronPay - Hashes:');
        console.log('   Offer Hash:', offerHash);
        console.log('   Product Hash:', productHash);
        
        response = await fetch(backendURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: Math.round(parseFloat(paymentData.amount) * 100), // Centavos
            description: paymentData.description || 'Pagamento PIX',
            customer: {
              name: paymentData.customer.name,
              email: paymentData.customer.email,
              document: paymentData.customer.document?.replace(/\D/g, ''),
              phone: paymentData.customer.phone?.replace(/\D/g, ''),
              address: paymentData.customer.address || {
                street: paymentData.customer.street || 'Rua Exemplo',
                number: paymentData.customer.number || '123',
                complement: paymentData.customer.complement || '',
                neighborhood: paymentData.customer.neighborhood || 'Centro',
                city: paymentData.customer.city || 'São Paulo',
                state: paymentData.customer.state || 'SP',
                zipCode: paymentData.customer.zipCode || '01310100'
              }
            },
            offerHash: offerHash,
            productHash: productHash,
            cart: paymentData.cart || [
              {
                product_hash: productHash,
                title: paymentData.description || 'Produto',
                cover: null,
                price: Math.round(parseFloat(paymentData.amount) * 100),
                quantity: 1,
                operation_type: 1,
                tangible: false
              }
            ],
            apiKey: this.config.apiKey
          })
        });
      } else if (isLocal && this.config.provider !== 'vegas') {
        // Usar proxy local para outros gateways (evitar CORS)
        console.log('🔄 Usando proxy local para evitar CORS');
        response = await fetch('http://localhost:8080/api/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: this.config.apiKey || this.config.clientSecret,
            endpoint: endpoint,
            data: requestData
          })
        });
      } else {
        // Chamada direta (Vegas ou produção)
        response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestData)
        });
      }
      
      console.log('📥 generatePIX: Resposta recebida, status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao gerar PIX');
      }

      const data = await response.json();
      
      // Vegas: Fazer segunda chamada VIEW para pegar QR Code completo
      if (this.config.provider === 'vegas' && data.transaction_id_token) {
        try {
          const viewResponse = await fetch(`${this.baseURL}/checkout`, {
            method: 'VIEW',
            headers: headers,
            body: JSON.stringify({
              transaction_token: data.transaction_id_token,
              external_code: data.external_code
            })
          });
          
          if (viewResponse.ok) {
            const viewData = await viewResponse.json();
            // Mesclar dados do POST com dados do VIEW
            Object.assign(data, viewData);
          }
        } catch (viewError) {
          console.warn('Erro ao buscar detalhes do checkout:', viewError);
          // Continuar com dados do POST mesmo se VIEW falhar
        }
      }
      
      // Normalizar resposta
      return this.normalizeResponse(data);
    } catch (error) {
      console.error('Erro ao gerar PIX:', error);
      throw error;
    }
  }

  /**
   * Formata dados do pagamento conforme o gateway
   */
  formatPaymentData(paymentData) {
    const provider = this.config.provider;

    // Formato base
    const baseData = {
      amount: parseFloat(paymentData.amount),
      description: paymentData.description || 'Pagamento',
      customer: paymentData.customer
    };

    // Formatos específicos por gateway
    const formats = {
      gerencianet: {
        calendario: { expiracao: 3600 }, // 1 hora
        valor: { original: baseData.amount.toFixed(2) },
        chave: this.config.pixKey,
        solicitacaoPagador: baseData.description,
        infoAdicionais: [
          { nome: 'Cliente', valor: baseData.customer.name }
        ]
      },

      pagarme: {
        amount: Math.round(baseData.amount * 100), // Centavos
        payment_method: 'pix',
        customer: {
          name: baseData.customer.name,
          email: baseData.customer.email,
          document: baseData.customer.document,
          type: 'individual',
          phones: {
            mobile_phone: {
              country_code: '55',
              number: baseData.customer.phone.replace(/\D/g, '')
            }
          }
        },
        pix: {
          expires_in: 3600
        }
      },

      asaas: {
        customer: baseData.customer.document,
        billingType: 'PIX',
        value: baseData.amount,
        dueDate: new Date(Date.now() + 3600000).toISOString().split('T')[0], // +1 hora
        description: baseData.description
      },

      mercadopago: {
        transaction_amount: baseData.amount,
        description: baseData.description,
        payment_method_id: 'pix',
        payer: {
          email: baseData.customer.email,
          first_name: baseData.customer.name.split(' ')[0],
          last_name: baseData.customer.name.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: baseData.customer.document
          }
        }
      },

      tribopay: {
        amount: baseData.amount,
        description: baseData.description,
        payer: baseData.customer,
        pixKey: this.config.pixKey
      },

      vegas: {
        customer: {
          name: baseData.customer.name,
          email: baseData.customer.email,
          document: baseData.customer.document?.replace(/\D/g, ''),
          phone: baseData.customer.phone,
          address: {
            street: baseData.customer.address?.street || '',
            number: baseData.customer.address?.number || '',
            complement: baseData.customer.address?.complement || '',
            district: baseData.customer.address?.district || '',
            city: baseData.customer.address?.city || '',
            state: baseData.customer.address?.state || '',
            zipcode: baseData.customer.address?.zipcode?.replace(/\D/g, '') || ''
          }
        },
        payment: {
          method: 'pix',
          payment_value: Math.round(baseData.amount * 100), // Centavos
          freight_value: Math.round((paymentData.freight || 0) * 100),
          discount_value: Math.round((paymentData.discount || 0) * 100),
          external_code: paymentData.orderId || 'ORD' + Date.now(),
          currency: 'BRL'
        },
        products: paymentData.products || [{
          name: baseData.description,
          price: Math.round(baseData.amount * 100),
          quantity: 1,
          code: 'PROD001',
          is_digital: false,
          description: baseData.description,
          image_url: ''
        }],
        notification_url: this.config.webhookUrl || '',
        src: paymentData.src || 'checkout_web',
        utm_source: paymentData.utm_source || 'direct',
        utm_medium: paymentData.utm_medium || 'none',
        utm_campaign: paymentData.utm_campaign || 'default',
        utm_content: paymentData.utm_content || '',
        utm_term: paymentData.utm_term || ''
      }
    };

    return formats[provider] || baseData;
  }

  /**
   * Normaliza resposta do gateway para formato padrão
   */
  normalizeResponse(data) {
    try {
      const provider = this.config.provider;
      console.log('🔄 normalizeResponse: provider =', provider);
      console.log('🔄 normalizeResponse: data =', data);

      const normalizers = {
        gerencianet: {
          transactionId: data.txid,
          pixCode: data.pixCopiaECola,
          qrcodeUrl: data.imagemQrcode,
          status: 'pending',
          expiresAt: data.calendario?.criacao
        },

        pagarme: {
          transactionId: data.id,
          pixCode: data.charges?.[0]?.last_transaction?.qr_code,
          qrcodeUrl: data.charges?.[0]?.last_transaction?.qr_code_url,
          status: data.status,
          expiresAt: data.charges?.[0]?.last_transaction?.expires_at
        },

        asaas: {
          transactionId: data.id,
          pixCode: data.pixTransaction?.payload,
          qrcodeUrl: data.pixTransaction?.qrCode?.encodedImage,
          status: data.status,
          expiresAt: data.dueDate
        },

        mercadopago: {
          transactionId: data.id,
          pixCode: data.point_of_interaction?.transaction_data?.qr_code,
          qrcodeUrl: data.point_of_interaction?.transaction_data?.qr_code_base64,
          status: data.status,
          expiresAt: data.date_of_expiration
        },

        tribopay: {
          transactionId: data.transaction_id || data.id,
          pixCode: data.pix_code || data.pixCode,
          qrcodeUrl: data.qrcode_url || data.qrcodeUrl,
          status: data.status,
          expiresAt: data.expires_at
        },

        vegas: {
          transactionId: data.transaction_id_token || data.transaction_token || data.tansaction_token,
          pixCode: data.pix_id || data.pix_qr_code || data.qr_code_text,
          qrcodeUrl: data.pix_qr_code_base64 ? `data:image/png;base64,${data.pix_qr_code_base64}` : (data.qr_code_url || data.order_url),
          checkoutUrl: data.checkout_url,
          orderUrl: data.order_url,
          status: this.normalizeVegasStatus(data.status || data.payment_status),
          expiresAt: data.expiration_date,
          externalCode: data.external_code,
          amount: data.transaction_amount ? data.transaction_amount / 100 : data.total_price,
          dateCreated: data.date_created,
          dateApproved: data.date_approved
        },

        custom: {
          // IronPay e outros gateways personalizados
          transactionId: data.transaction_id || data.hash || data.id || data.txid,
          pixCode: data.pix_code || data.qr_code || data.qrcode || data.emv,
          // Priorizar qr_code_base64, depois qr_code_url, depois gerar do base64
          qrcodeUrl: data.qr_code_base64 || data.qr_code_url || data.qrcode_url || data.qrcode_image || (data.qrcode_base64 ? `data:image/png;base64,${data.qrcode_base64}` : null),
          status: data.status || 'pending',
          expiresAt: data.expires_at || data.expiration_date || data.expiresAt,
          amount: data.amount || data.value,
          hash: data.hash // IronPay hash específico
        }
      };

      // Retornar normalizer do provider, ou custom se não encontrar, ou dados originais
      const result = normalizers[provider] || normalizers['custom'] || data;
      console.log('✅ normalizeResponse: resultado =', result);
      return result;
    } catch (error) {
      console.error('❌ Erro em normalizeResponse:', error);
      console.log('📝 Retornando dados originais...');
      return data;
    }
  }

  /**
   * Normaliza status do Vegas
   */
  normalizeVegasStatus(vegasStatus) {
    const statusMap = {
      'pending': 'pending',
      'approved': 'paid',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'expired': 'expired',
      'rejected': 'expired'
    };
    return statusMap[vegasStatus] || vegasStatus;
  }

  /**
   * Verifica status do pagamento
   * @param {string} transactionId - ID da transação
   * @returns {Promise<Object>} - Status do pagamento
   */
  async checkPaymentStatus(transactionId, externalCode = null) {
    try {
      // Para IronPay, Asaas e outros gateways customizados,
      // usar backend para verificar status (evita problemas de CORS)
      // NÃO precisa de config local porque o backend tem o token
      if (!this.config || this.config.provider === 'custom' || !this.baseURL) {
        console.log('🔍 Verificando status via backend:', transactionId);
        
        // Detectar URL do backend (mesmo esquema do checkout-v2.html)
        const hostname = window.location.hostname;
        const BACKEND_URL = hostname.includes('shoptlktok.shop')
          ? 'https://mobile-action-bar-backend-production.up.railway.app'
          : '';
        
        const response = await fetch(`${BACKEND_URL}/api/pagamento/status/${transactionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          // Se backend não tem endpoint, retornar status pendente
          console.warn('⚠️ Endpoint de status não disponível, assumindo pendente');
          return { status: 'pending', transactionId };
        }
        
        const data = await response.json();
        return data;
      }
      
      // Para outros gateways (Vegas, Mercado Pago, etc), config é obrigatória
      if (!this.config) {
        throw new Error('Gateway não configurado');
      }
      
      // Preparar headers
      const headers = {};

      // Vegas usa API Key e método VIEW
      if (this.config.provider === 'vegas') {
        headers['api-key'] = this.config.apiKey || this.config.clientSecret;
        headers['Content-Type'] = 'application/json';
        
        const response = await fetch(`${this.baseURL}/checkout`, {
          method: 'VIEW',
          headers: headers,
          body: JSON.stringify({
            transaction_token: transactionId,
            external_code: externalCode
          })
        });

        if (!response.ok) {
          throw new Error('Erro ao verificar status');
        }

        const data = await response.json();
        return this.normalizeStatusResponse(data);
      } else {
        // Outros gateways usam OAuth2
        const token = await this.getAuthToken();
        headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${this.baseURL}/pix/charges/${transactionId}`, {
          method: 'GET',
          headers: headers
        });

        if (!response.ok) {
          throw new Error('Erro ao verificar status');
        }

        const data = await response.json();
        return this.normalizeStatusResponse(data);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      throw error;
    }
  }

  /**
   * Normaliza resposta de status
   */
  normalizeStatusResponse(data) {
    const provider = this.config.provider;

    // Vegas tem normalização própria
    if (provider === 'vegas') {
      return {
        transactionId: data.transaction_token || data.tansaction_token,
        externalCode: data.external_code,
        status: this.normalizeVegasStatus(data.payment_status),
        paidAt: data.date_approved,
        amount: data.transaction_amount / 100,
        paymentType: data.payment_type,
        dateCreated: data.date_created,
        dateRefunded: data.date_refunded
      };
    }

    // Status padrão: pending, paid, expired, cancelled
    const statusMap = {
      gerencianet: {
        'ATIVA': 'pending',
        'CONCLUIDA': 'paid',
        'REMOVIDA_PELO_USUARIO_RECEBEDOR': 'cancelled',
        'REMOVIDA_PELO_PSP': 'expired'
      },
      pagarme: {
        'pending': 'pending',
        'paid': 'paid',
        'canceled': 'cancelled',
        'failed': 'expired'
      },
      asaas: {
        'PENDING': 'pending',
        'RECEIVED': 'paid',
        'CONFIRMED': 'paid',
        'OVERDUE': 'expired'
      },
      mercadopago: {
        'pending': 'pending',
        'approved': 'paid',
        'cancelled': 'cancelled',
        'rejected': 'expired'
      }
    };

    const providerMap = statusMap[provider] || {};
    const normalizedStatus = providerMap[data.status] || data.status;

    return {
      transactionId: data.txid || data.id,
      status: normalizedStatus,
      paidAt: data.horario || data.paid_at || data.paymentDate,
      amount: data.valor?.original || data.amount || data.value
    };
  }

  /**
   * Inicia verificação periódica de status
   * @param {string} transactionId - ID da transação
   * @param {Function} callback - Função chamada quando status mudar
   * @param {number} interval - Intervalo em ms (padrão: 5000)
   */
  startStatusPolling(transactionId, callback, interval = 5000) {
    const checkStatus = async () => {
      try {
        const status = await this.checkPaymentStatus(transactionId);
        callback(status);

        // Parar polling se pagamento foi concluído ou expirou
        if (['paid', 'expired', 'cancelled'].includes(status.status)) {
          clearInterval(pollingInterval);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    };

    // Verificar imediatamente
    checkStatus();

    // Continuar verificando periodicamente
    const pollingInterval = setInterval(checkStatus, interval);

    // Parar após 30 minutos
    setTimeout(() => {
      clearInterval(pollingInterval);
    }, 1800000);

    return pollingInterval;
  }
}

// Exportar para uso global
window.PaymentGateway = PaymentGateway;
