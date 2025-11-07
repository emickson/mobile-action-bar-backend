/**
 * Servidor Local Simples
 * Para testar a integração sem erro de CORS
 * 
 * Como usar:
 * 1. Instalar Node.js (se não tiver)
 * 2. Abrir terminal nesta pasta
 * 3. Executar: node server.js
 * 4. Abrir: http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuração de ambiente
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

// Configuração CORS
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['*'];

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown'
};

// Handler do servidor (usado tanto para HTTP quanto HTTPS)
const serverHandler = (req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);

  // Adicionar headers CORS
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, VIEW');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api-key, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle HEAD (usado para verificar se servidor está online)
  if (req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ========================================
  // ENDPOINT: /health (Health Check)
  // Verifica se o servidor está online
  // ========================================
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Servidor online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: NODE_ENV
    }));
    return;
  }

  // ========================================
  // ENDPOINT: /api/validate-ironpay (Documentação)
  // ========================================
  if (req.url === '/api/validate-ironpay' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      message: 'IronPay Validation Guide',
      documentation: {
        title: 'Como validar hashes do IronPay',
        important: [
          'O hash é único e deve ser usado como identificador',
          'O ID não será exibido na API pública em futuras alterações',
          'Token, offer_hash e product_hash DEVEM pertencer à mesma conta'
        ],
        validation_rules: [
          'Verificar se o product_hash existe',
          'Verificar se o offer_hash pertence ao mesmo seller',
          'Verificar se o token pertence ao mesmo seller'
        ],
        error_403: {
          cause: 'Hashes não pertencem à mesma conta que gerou o token',
          solution: [
            'Verifique se você copiou todos os valores da MESMA CONTA',
            'Painel IronPay → Ofertas e Links → Copie offer_hash e product_hash',
            'Painel IronPay → Integrações → API → Copie o token',
            'Certifique-se de estar logado na conta correta'
          ]
        },
        required_fields: {
          token: 'Token de autenticação da API IronPay',
          offer_hash: 'Hash da oferta (ex: 7becb)',
          product_hash: 'Hash do produto (ex: 7tjdfkshdv)'
        },
        where_to_find: {
          token: 'Painel IronPay → Integrações → API',
          offer_hash: 'Painel IronPay → Ofertas e Links → Selecione a oferta',
          product_hash: 'Painel IronPay → Ofertas e Links ou Produtos'
        }
      }
    }));
    return;
  }
  
  // ========================================
  // ENDPOINT: /api/produtos/:id (Buscar produto com preço seguro)
  // ========================================
  if (req.url.startsWith('/api/produtos/') && req.method === 'GET') {
    const productId = req.url.split('/api/produtos/')[1];
    
    try {
      // Ler products-db.json
      const productsData = fs.readFileSync(path.join(__dirname, 'products-db.json'), 'utf8');
      const db = JSON.parse(productsData);
      
      // Buscar produto por ID
      const product = db.products.find(p => p.id === productId);
      
      if (!product) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          success: false,
          error: 'Produto não encontrado'
        }));
        return;
      }
      
      // Verificar se produto está ativo
      if (!product.active) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          success: false,
          error: 'Produto indisponível'
        }));
        return;
      }
      
      // Retornar produto (sem expor hashes do IronPay)
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          stock: product.stock
          // ironpay hashes NÃO são expostos (segurança)
        }
      }));
    } catch (error) {
      console.error('❌ Erro ao ler products-db.json:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: false,
        error: 'Erro ao buscar produto',
        details: error.message
      }));
    }
    return;
  }

  // ========================================
  // ENDPOINT: /api/pagar (Gerar pagamento PIX)
  // IMPORTANTE: Validar valores no backend!
  // ========================================
  if (req.url === '/api/pagar' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { amount, description, customer, apiKey, offerHash, productHash, cart } = JSON.parse(body);
        
        console.log('\n💳 ==== NOVA REQUISIÇÃO DE PAGAMENTO ====');
        console.log('Valor recebido:', amount);
        console.log('Cliente:', customer.name);
        console.log('Descrição:', description);
        
        // 🔒 VALIDAÇÃO DE PREÇO (Segurança)
        // Verificar se o valor enviado corresponde ao preço real do produto
        if (cart && cart.length > 0) {
          try {
            const productsData = fs.readFileSync(path.join(__dirname, 'products-db.json'), 'utf8');
            const db = JSON.parse(productsData);
            
            let totalCalculado = 0;
            
            for (const item of cart) {
              // Buscar por ID do produto (não hash, pois hash é gerado pelo IronPay)
              const productId = item.product_id || item.id || '1'; // Fallback para produto 1
              const product = db.products.find(p => p.id === productId);
              
              if (!product) {
                console.error('❌ Produto não encontrado no banco:', productId);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: false, 
                  error: 'Produto inválido'
                }));
                return;
              }
              
              if (!product.active) {
                console.error('❌ Produto inativo:', product.name);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: false, 
                  error: 'Produto indisponível'
                }));
                return;
              }
              
              const quantity = item.quantity || 1;
              totalCalculado += product.price * quantity;
            }
            
            // Permitir diferença para frete e descontos
            // TODO: Enviar valor do frete separadamente do frontend
            const diferencaAceitavel = 2000; // R$ 20,00 (considera frete)
            const diferenca = Math.abs(amount - totalCalculado);
            
            if (diferenca > diferencaAceitavel) {
              console.error('❌ TENTATIVA DE FRAUDE DETECTADA!');
              console.error('Valor enviado:', amount, '(R$', (amount/100).toFixed(2), ')');
              console.error('Valor real:', totalCalculado, '(R$', (totalCalculado/100).toFixed(2), ')');
              console.error('Diferença:', diferenca, 'centavos');
              
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Valor inválido. Por favor, recarregue a página.'
              }));
              return;
            }
            
            console.log('✅ Validação de preço: OK');
            console.log('   Valor enviado:', amount, 'centavos');
            console.log('   Valor calculado:', totalCalculado, 'centavos');
            console.log('   Diferença:', diferenca, 'centavos (aceitável)');
            
          } catch (error) {
            console.error('❌ Erro ao validar preço:', error);
            // Continuar mesmo com erro de validação (modo degradação)
            console.warn('⚠️ Prosseguindo sem validação de preço (modo degradação)');
          }
        }
        
        console.log('Offer Hash:', offerHash || '⚠️ Não fornecido (usará padrão)');
        console.log('Product Hash:', productHash || '⚠️ Não fornecido (usará padrão)');
        
        const TOKEN = apiKey || process.env.GATEWAY_TOKEN;
        
        // 🔍 Debug: Verificar origem do token
        console.log('\n🔑 ==== TOKEN DE AUTENTICAÇÃO ====');
        console.log('Token vindo do frontend (apiKey)?', apiKey ? 'SIM' : 'NÃO (usando env)');
        console.log('Token length:', TOKEN ? TOKEN.length : 'NENHUM');
        console.log('Token (primeiros 15 chars):', TOKEN ? TOKEN.substring(0, 15) + '...' : 'AUSENTE');
        console.log('Token (últimos 8 chars):', TOKEN ? '...' + TOKEN.substring(TOKEN.length - 8) : 'AUSENTE');
        
        // Detectar gateway pelo formato do token
        const isMercadoPago = TOKEN.startsWith('APP_USR') || TOKEN.startsWith('TEST-');
        const isAsaas = TOKEN.startsWith('$aact') || TOKEN.includes('asaas');
        const isIronPay = TOKEN.length > 30 && !isMercadoPago && !isAsaas && !TOKEN.startsWith('test_'); // IronPay tokens são longos
        const isTriboPay = TOKEN.startsWith('tribo_') || TOKEN.includes('tribopay');
        const isTest = TOKEN.startsWith('test_');
        
        let GATEWAY_API;
        if (isMercadoPago) {
          GATEWAY_API = 'https://api.mercadopago.com/v1/payments';
        } else if (isAsaas) {
          GATEWAY_API = 'https://www.asaas.com/api/v3/payments';
        } else if (isIronPay) {
          GATEWAY_API = `https://api.ironpayapp.com.br/api/public/v1/transactions?api_token=${TOKEN}`;
        } else if (isTriboPay) {
          GATEWAY_API = 'http://api.tribopay.com.br/api/public/cash/deposits/pix';
        } else {
          console.error('❌ Gateway não reconhecido!');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Gateway não suportado' 
          }));
          return;
        }
        
        if (!TOKEN) {
          console.error('❌ Token IronPay não configurado!');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Token IronPay não configurado' 
          }));
          return;
        }
        
        // Preparar dados conforme o gateway
        let requestData;
        let gatewayName = 'Gateway';
        
        if (isMercadoPago) {
          gatewayName = 'Mercado Pago';
          requestData = {
            transaction_amount: amount / 100,
            description: description,
            payment_method_id: 'pix',
            payer: {
              email: customer.email,
              first_name: customer.name.split(' ')[0],
              last_name: customer.name.split(' ').slice(1).join(' ') || customer.name.split(' ')[0],
              identification: {
                type: 'CPF',
                number: customer.document
              }
            },
            notification_url: 'https://checkout.shoptiktok.shop/webhook/mercadopago'
          };
        } else if (isIronPay) {
          gatewayName = 'IronPay';
          // Formato IronPay conforme documentação oficial
          requestData = {
            amount: amount, // Valor em centavos
            payment_method: 'pix',
            installments: 1, // PIX é sempre à vista (1 parcela)
            customer: {
              name: customer.name,
              email: customer.email,
              phone_number: customer.phone?.replace(/\D/g, '') || '',
              document: customer.document?.replace(/\D/g, ''),
              street_name: customer.address?.street || 'Rua Exemplo',
              number: customer.address?.number || '123',
              complement: customer.address?.complement || '',
              neighborhood: customer.address?.neighborhood || 'Centro',
              city: customer.address?.city || 'São Paulo',
              state: customer.address?.state || 'SP',
              zip_code: customer.address?.zipCode?.replace(/\D/g, '') || '01310100'
            },
            cart: cart || [
              {
                title: description || 'Produto',
                cover: null,
                price: amount,
                quantity: 1,
                operation_type: 1,
                tangible: false
              }
            ],
            expire_in_days: 1,
            transaction_origin: 'api',
            tracking: {
              src: '',
              utm_source: 'checkout',
              utm_medium: 'web',
              utm_campaign: 'direct',
              utm_term: '',
              utm_content: ''
            },
            postback_url: 'https://checkout.shoptiktok.shop/webhook/ironpay'
          };
          
          // Adicionar hashes apenas se estiverem configurados (senão IronPay cria automaticamente)
          if (finalOfferHash) {
            requestData.offer_hash = finalOfferHash;
          }
          if (finalProductHash && requestData.cart.length > 0) {
            requestData.cart[0].product_hash = finalProductHash;
          }
          
          console.log('💳 IronPay - Request:');
          console.log('   Valor:', (amount/100).toFixed(2), 'R$');
          console.log('   Offer Hash:', requestData.offer_hash || 'NULL (auto)');
          console.log('   Product Hash:', requestData.cart[0].product_hash || 'NULL (auto)');
          console.log('   Cliente:', customer.name);
          console.log('   CPF:', customer.document?.replace(/\D/g, ''));
          console.log('   🔑 Token (primeiros 10 chars):', TOKEN.substring(0, 10) + '...');
          console.log('   🔑 Token (tamanho):', TOKEN.length, 'caracteres');
        } else if (isAsaas) {
          gatewayName = 'Asaas';
          requestData = {
            billingType: 'PIX',
            value: amount / 100, // Asaas usa valores decimais
            dueDate: new Date().toISOString().split('T')[0],
            description: description,
            externalReference: 'pedido_' + Date.now(),
            customer: {
              name: customer.name,
              email: customer.email,
              cpfCnpj: customer.document,
              mobilePhone: customer.phone
            },
            postalService: false
          };
        } else if (isTriboPay) {
          gatewayName = 'TriboPay';
          // Formato EXATO conforme OpenAPI (sem description!)
          requestData = {
            amount: amount, // Valor em centavos
            externalId: 'pedido_' + Date.now(),
            postbackUrl: 'https://checkout.shoptiktok.shop/webhook/tribopay',
            method: 'pix',
            transactionOrigin: 'cashin',
            payer: {
              name: customer.name,
              email: customer.email,
              document: customer.document.replace(/\D/g, '').substring(0, 11)
            }
          };
          
          console.log('💳 TriboPay - Request:');
          console.log('   Valor:', (amount/100).toFixed(2), 'R$');
          console.log('   ExternalId:', requestData.externalId);
          console.log('   Payer:', customer.name);
          console.log('   Document:', customer.document.replace(/\D/g, '').substring(0, 11));
        } else {
          requestData = {
            amount: amount,
            description: description,
            customer: customer,
            payment_method: 'pix',
            notification_url: 'https://checkout.shoptiktok.shop/webhook/ironpay'
          };
        }
        
        const requestBody = JSON.stringify(requestData);
        
        console.log('🔧 Gateway:', gatewayName);
        console.log('📤 Dados:', requestData);
        
        const url = new URL(GATEWAY_API);
        
        // Headers conforme gateway
        const headers = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'User-Agent': 'Checkout-Integration/1.0'
        };
        
        if (isAsaas) {
          headers['access_token'] = TOKEN;
        } else if (isIronPay) {
          // IronPay usa api_token como query parameter (já incluído na URL)
          headers['Accept'] = 'application/json';
        } else if (isTriboPay) {
          headers['Authorization'] = `Bearer ${TOKEN}`; // TriboPay usa Bearer
        } else {
          headers['Authorization'] = `Bearer ${TOKEN}`;
          headers['X-Idempotency-Key'] = `pix-${Date.now()}`;
        }
        
        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search, // Incluir query string (api_token para IronPay)
          method: 'POST',
          headers: headers
        };
        
        // MODO DE TESTE: Se token começar com 'test_', simula resposta
        if (isTest) {
          console.log('🧪 MODO DE TESTE ATIVADO - Simulando gateway...');
          
          // Simular resposta de sucesso do gateway
          const mockResponse = {
            success: true,
            transaction_id: 'test_' + Date.now(),
            qr_code: '00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 38) + '520400005303986540' + (amount/100).toFixed(2) + '5802BR5925LOJA TESTE PIX6009SAO PAULO62070503***63041D3D',
            pix_code: '00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 38),
            qr_code_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            amount: amount,
            status: 'pending',
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
          };
          
          console.log('✅ Gateway Simulado - Pagamento criado!');
          console.log('Transaction ID:', mockResponse.transaction_id);
          
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(mockResponse));
          return;
        }
        
        console.log('🔄 Enviando requisição para gateway real...');
        console.log('🌐 URL:', isIronPay ? GATEWAY_API.replace(/api_token=.+/, 'api_token=***') : GATEWAY_API);
        console.log('🔗 Path:', url.pathname + url.search);
        console.log('📝 Headers:', JSON.stringify(headers, null, 2));
        
        const proxyReq = https.request(options, (proxyRes) => {
          let responseData = '';
          
          proxyRes.on('data', (chunk) => {
            responseData += chunk;
          });
          
          proxyRes.on('end', () => {
            console.log('📥 Resposta bruta do gateway (status ' + proxyRes.statusCode + '):', responseData);
            
            try {
              const data = JSON.parse(responseData);
              
              if (proxyRes.statusCode === 200 || proxyRes.statusCode === 201) {
                console.log(' Pagamento criado com sucesso!');
                console.log('Transaction ID:', data.id || data.transaction_id);
                
                // Função auxiliar para enviar resposta normalizada
                const sendNormalizedResponse = (normalizedResponse) => {
                  res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  });
                  res.end(JSON.stringify(normalizedResponse));
                };
                
                // Normalizar resposta conforme gateway
                let normalizedResponse;
                
                if (isMercadoPago) {
                  normalizedResponse = {
                    success: true,
                    transaction_id: data.id,
                    qr_code: data.point_of_interaction?.transaction_data?.qr_code,
                    pix_code: data.point_of_interaction?.transaction_data?.qr_code,
                    qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
                    qr_code_url: data.point_of_interaction?.transaction_data?.qr_code_base64 
                      ? `data:image/png;base64,${data.point_of_interaction.transaction_data.qr_code_base64}` 
                      : null,
                    status: data.status,
                    amount: data.transaction_amount
                  };
                  sendNormalizedResponse(normalizedResponse);
                } else if (isAsaas) {
                  console.log('\ud83d\udd0d Asaas - Cobran\u00e7a criada, ID:', data.id);
                  
                  // Asaas: Buscar QR Code em segunda chamada (usando Promise)
                  if (data.id) {
                    console.log('\ud83d\udd0d Buscando QR Code PIX...');
                    
                    const qrOptions = {
                      hostname: 'www.asaas.com',
                      path: `/api/v3/payments/${data.id}/pixQrCode`,
                      method: 'GET',
                      headers: {
                        'access_token': TOKEN,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Checkout-Integration/1.0'
                      }
                    };
                    
                    const qrReq = https.request(qrOptions, (qrRes) => {
                      let qrBody = '';
                      qrRes.on('data', chunk => qrBody += chunk);
                      qrRes.on('end', () => {
                        console.log('\ud83d\udcdd Resposta QR Code (status', qrRes.statusCode + '):', qrBody.substring(0, 200));
                        let pixData = null;
                        try {
                          pixData = JSON.parse(qrBody);
                          console.log('\u2705 QR Code obtido: SIM');
                          if (pixData) {
                            console.log('\ud83d\udd0d encodedImage:', pixData.encodedImage ? 'PRESENTE' : 'AUSENTE');
                            console.log('\ud83d\udd0d payload:', pixData.payload ? pixData.payload.substring(0, 50) + '...' : 'AUSENTE');
                          }
                        } catch (e) {
                          console.error('\u274c Erro ao parsear QR Code:', e.message);
                        }
                        
                        normalizedResponse = {
                          success: true,
                          transaction_id: data.id,
                          qr_code: pixData?.payload || null,
                          pix_code: pixData?.payload || null,
                          qr_code_base64: pixData?.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null,
                          qr_code_url: pixData?.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null,
                          status: data.status,
                          amount: data.value,
                          invoice_url: data.invoiceUrl
                        };
                        
                        console.log('\u2705 QR Code final:', normalizedResponse.qr_code_base64 ? 'PRESENTE \u2705' : 'AUSENTE \u274c');
                        sendNormalizedResponse(normalizedResponse);
                      });
                    });
                    
                    qrReq.on('error', (err) => {
                      console.error('\u274c Erro na requisi\u00e7\u00e3o QR Code:', err.message);
                      // Enviar resposta mesmo com erro no QR Code
                      normalizedResponse = {
                        success: true,
                        transaction_id: data.id,
                        qr_code: null,
                        pix_code: null,
                        qr_code_base64: null,
                        qr_code_url: null,
                        status: data.status,
                        amount: data.value,
                        invoice_url: data.invoiceUrl
                      };
                      sendNormalizedResponse(normalizedResponse);
                    });
                    
                    qrReq.end();
                  } else {
                    // Sem ID, enviar resposta sem QR Code
                    normalizedResponse = {
                      success: true,
                      transaction_id: data.id,
                      qr_code: null,
                      pix_code: null,
                      qr_code_base64: null,
                      qr_code_url: null,
                      status: data.status,
                      amount: data.value,
                      invoice_url: data.invoiceUrl
                    };
                    sendNormalizedResponse(normalizedResponse);
                  }
                } else if (isIronPay) {
                  // Normalizar resposta IronPay
                  console.log('✅ IronPay - Resposta recebida (RAW):');
                  console.log('===== INÍCIO DA RESPOSTA =====');
                  console.log(JSON.stringify(data, null, 2));
                  console.log('===== FIM DA RESPOSTA =====');
                  console.log('');
                  console.log('🔍 Estrutura:');
                  console.log('   data.data:', data.data ? 'EXISTS' : 'MISSING');
                  console.log('   data.pix:', data.pix ? 'EXISTS' : 'MISSING');
                  console.log('   data.transaction:', data.transaction ? 'EXISTS' : 'MISSING');
                  console.log('   data.offer:', data.offer ? 'EXISTS' : 'MISSING');
                  console.log('   data.product:', data.product ? 'EXISTS' : 'MISSING');
                  if (data.data) {
                    console.log('   data.data.pix:', data.data.pix ? 'EXISTS' : 'MISSING');
                  }
                  if (data.pix) {
                    console.log('   Conteúdo de data.pix:', JSON.stringify(data.pix, null, 2));
                  }
                  // Estrutura correta da resposta IronPay:
                  // pix.pix_qr_code, transaction.hash, pix.pix_url, etc.
                  const pixCode = data.pix?.pix_qr_code || data.pix_qr_code || data.qr_code;
                  const pixImageUrl = data.pix?.pix_url || data.pix?.url || data.pix_url;
                  
                  // Se não houver imagem do QR Code, gerar URL via API externa
                  let qrCodeImage = pixImageUrl;
                  if (!qrCodeImage && pixCode) {
                    // Gerar QR Code usando API pública
                    qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pixCode)}`;
                    console.log('⚠️ IronPay não retornou imagem do QR Code, gerando via API externa');
                  }
                  
                  normalizedResponse = {
                    success: true,
                    transaction_id: data.transaction?.hash || data.hash || data.id,
                    hash: data.transaction?.hash || data.hash,
                    qr_code: pixCode,
                    pix_code: pixCode,
                    qr_code_base64: qrCodeImage,
                    qr_code_url: qrCodeImage,
                    payment_url: pixImageUrl,
                    status: data.transaction?.status || data.status,
                    amount: data.amount
                  };
                  
                  console.log('✅ IronPay - Transa\u00e7\u00e3o criada!');
                  console.log('   Hash:', normalizedResponse.hash);
                  console.log('   Status:', normalizedResponse.status);
                  console.log('   PIX Code (primeiros 50 chars):', pixCode ? pixCode.substring(0, 50) + '...' : 'AUSENTE ❌');
                  console.log('   QR Code Image:', qrCodeImage ? 'PRESENTE ✅' : 'AUSENTE ❌');
                  sendNormalizedResponse(normalizedResponse);
                } else if (isTriboPay) {
                  // Normalizar resposta TriboPay (OpenAPI spec)
                  normalizedResponse = {
                    success: true,
                    transaction_id: data.id,
                    qr_code: data.pix?.code, // Código PIX copia e cola
                    pix_code: data.pix?.code,
                    qr_code_base64: data.pix?.imageBase64 ? `data:image/png;base64,${data.pix.imageBase64}` : null,
                    qr_code_url: data.pix?.imageBase64 ? `data:image/png;base64,${data.pix.imageBase64}` : null,
                    status: data.status,
                    amount: data.amount,
                    net_amount: data.netAmount,
                    external_id: data.externalId,
                    created_at: data.createdAt,
                    updated_at: data.updatedAt
                  };
                  sendNormalizedResponse(normalizedResponse);
                } else {
                  normalizedResponse = {
                    success: true,
                    qr_code: data.qr_code || data.pix_qr_code,
                    pix_code: data.pix_code || data.pix_id,
                    transaction_id: data.transaction_id,
                    qr_code_url: data.qr_code_url || data.qr_code_base64,
                    status: data.status,
                    amount: amount
                  };
                  sendNormalizedResponse(normalizedResponse);
                }
              } else {
                console.error(`\n❌ ==== ERRO DO GATEWAY (Status ${proxyRes.statusCode}) ====`);
                console.error('Gateway:', gatewayName);
                console.error('Mensagem:', data.message || data.error);
                console.error('Detalhes completos:', JSON.stringify(data, null, 2));
                
                // 🔍 Ajuda específica para erro 403 do IronPay
                if (proxyRes.statusCode === 403 && isIronPay) {
                  console.error('\n🚨 ==== ERRO 403 - IRONPAY ====');
                  console.error('⚠️ Este erro geralmente significa:');
                  console.error('1. Token API não pertence à mesma conta dos hashes');
                  console.error('2. Offer Hash ou Product Hash inválidos');
                  console.error('3. Token API expirado ou inválido');
                  console.error('');
                  console.error('🔧 Como corrigir:');
                  console.error('- Verifique se o TOKEN, OFFER_HASH e PRODUCT_HASH');
                  console.error('  são TODOS da MESMA CONTA no painel IronPay');
                  console.error('- Gere um novo token API no painel IronPay');
                  console.error('- Verifique se os hashes estão corretos');
                  console.error('');
                  console.error('📝 Valores enviados:');
                  console.error('   Offer Hash:', offerHash || 'PADRÃO');
                  console.error('   Product Hash:', productHash || 'PADRÃO');
                  console.error('   Token (primeiros 15):', TOKEN ? TOKEN.substring(0, 15) + '...' : 'AUSENTE');
                }
                
                // Encaminhar detalhes do erro para o cliente para facilitar debug
                res.writeHead(proxyRes.statusCode, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                  success: false,
                  status: proxyRes.statusCode,
                  error: data.message || data.error || 'Erro ao processar pagamento',
                  cause: data.cause || data.error_description,
                  details: data
                }));
              }
            } catch (parseError) {
              console.error('❌ Erro ao parsear resposta JSON');
              console.error('📄 Resposta não é JSON válido:', responseData);
              console.error('🔍 Erro:', parseError.message);
              
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Gateway retornou resposta inválida',
                gateway_response: responseData.substring(0, 300)
              }));
            }
          });
        });
        
        proxyReq.on('error', (error) => {
          console.error(' Erro na requisição IronPay:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        });
        
        proxyReq.write(requestBody);
        proxyReq.end();
        
      } catch (error) {
        console.error('❌ Erro ao processar requisição:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Dados inválidos' }));
      }
    });
    
    return;
  }
  
  // ========================================
  // ENDPOINT: /webhook/tribopay
  // Recebe notificações de pagamento do TriboPay
  // ========================================
  if (req.url === '/webhook/tribopay' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const evento = JSON.parse(body);
        
        console.log('\n🔔 ==== WEBHOOK TRIBOPAY RECEBIDO ====');
        console.log('Status:', evento.status);
        console.log('Transaction ID:', evento.id);
        console.log('External ID:', evento.externalId);
        console.log('Valor:', evento.amount);
        
        if (evento.status === 'paid') {
          console.log('✅ PAGAMENTO CONFIRMADO!');
          console.log('Payer:', evento.payer?.name);
          
          // Processar pagamento:
          // - Atualizar status do pedido
          // - Enviar email de confirmação
          // - Liberar produto/acesso
        } else if (evento.status === 'cancelled' || evento.status === 'refused' || evento.status === 'failed') {
          console.log('❌ Pagamento cancelado/recusado');
        } else {
          console.log('ℹ️ Status:', evento.status);
        }
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        
      } catch (error) {
        console.error('❌ Erro ao processar webhook TriboPay:', error);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('ERRO');
      }
    });
    
    return;
  }
  
  // ========================================
  // ENDPOINT: /webhook/asaas
  // Recebe notificações de pagamento do Asaas
  // ========================================
  if (req.url === '/webhook/asaas' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const evento = JSON.parse(body);
        
        console.log('\n🔔 ==== WEBHOOK ASAAS RECEBIDO ====');
        console.log('Evento:', evento.event);
        console.log('Pagamento ID:', evento.payment?.id);
        console.log('Valor:', evento.payment?.value);
        
        if (evento.event === 'PAYMENT_RECEIVED' || evento.event === 'PAYMENT_CONFIRMED') {
          console.log('✅ PAGAMENTO CONFIRMADO!');
          console.log('Cliente:', evento.payment?.customer);
          
          // Aqui você pode:
          // - Atualizar status do pedido no banco de dados
          // - Enviar email de confirmação
          // - Liberar produto/acesso
          // - Etc.
        } else if (evento.event === 'PAYMENT_OVERDUE' || evento.event === 'PAYMENT_DELETED') {
          console.log('❌ Pagamento vencido/cancelado');
        } else {
          console.log('ℹ️ Evento:', evento.event);
        }
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        
      } catch (error) {
        console.error('❌ Erro ao processar webhook Asaas:', error);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('ERRO');
      }
    });
    
    return;
  }
  
  // ========================================
  // ENDPOINT: /webhook/tribopay
  // Recebe notificações de pagamento do TriboPay
  // ========================================
  if (req.url === '/webhook/tribopay' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const evento = JSON.parse(body);
        
        console.log('\n🔔 ==== WEBHOOK TRIBOPAY RECEBIDO ====');
        console.log('ID:', evento.id);
        console.log('External ID:', evento.externalId);
        console.log('Status:', evento.status);
        console.log('Método:', evento.method);
        console.log('Valor:', evento.amount);
        
        // Status possíveis: processing, paid, refunded, waiting_payment, refused, 
        // chargeback, cancelled, antifraud, pre_chargeback, failed, in_dispute
        
        if (evento.status === 'paid') {
          console.log('✅ PAGAMENTO CONFIRMADO!');
          console.log('PIX Code:', evento.pix?.code);
          
          // TODO: Processar pagamento
          // - Atualizar status do pedido no banco
          // - Enviar email de confirmação
          // - Liberar produto/acesso
          // - Gerar nota fiscal
        } else if (evento.status === 'refused' || evento.status === 'cancelled' || evento.status === 'failed') {
          console.log('❌ Pagamento recusado/cancelado/falhou');
        } else if (evento.status === 'processing' || evento.status === 'waiting_payment') {
          console.log('⏳ Aguardando pagamento...');
        } else {
          console.log('ℹ️ Status:', evento.status);
        }
        
        // Sempre retornar 200 OK para o gateway
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        
      } catch (error) {
        console.error('❌ Erro ao processar webhook TriboPay:', error);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('ERRO');
      }
    });
    
    return;
  }
  
  // ========================================
  // ENDPOINT: /webhook/ironpay
  // Recebe notificações de pagamento do IronPay
  // ========================================
  if (req.url === '/webhook/ironpay' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const evento = JSON.parse(body);
        
        console.log('\n🔔 ==== WEBHOOK IRONPAY RECEBIDO ====');
        console.log('===== INÍCIO DA RESPOSTA =====');
        console.log(JSON.stringify(evento, null, 2));
        console.log('===== FIM DA RESPOSTA =====');
        console.log('');
        console.log('Evento:', evento.event);
        console.log('ID:', evento.id);
        console.log('Hash:', evento.hash);
        console.log('Payment Status:', evento.payment_status);
        console.log('Transaction:', evento.transaction);
        console.log('Amount:', evento.amount);
        console.log('PIX URL:', evento.pix_url ? 'PRESENTE' : 'AUSENTE');
        console.log('Customer:', evento.customer?.name);
        
        // IronPay usa payment_status ao invés de status
        // Possíveis valores: waiting_payment, paid, refused, cancelled, refunded, etc.
        if (evento.payment_status === 'paid' || evento.payment_status === 'approved') {
          console.log('✅ PAGAMENTO CONFIRMADO!');
          console.log('Cliente:', evento.customer?.name);
          console.log('Email:', evento.customer?.email);
          console.log('Produto:', evento.product?.name);
          
          // Aqui você pode:
          // - Atualizar status do pedido no banco de dados usando evento.id ou evento.hash
          // - Enviar email de confirmação para evento.customer.email
          // - Liberar produto/acesso
          // - Gerar nota fiscal
        } else if (evento.payment_status === 'cancelled' || evento.payment_status === 'expired' || evento.payment_status === 'refused') {
          console.log('❌ Pagamento cancelado/expirado/recusado');
        } else if (evento.payment_status === 'waiting_payment' || evento.payment_status === 'processing') {
          console.log('⏳ Aguardando pagamento...');
        } else {
          console.log('ℹ️ Payment Status:', evento.payment_status);
        }
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        
      } catch (error) {
        console.error('❌ Erro ao processar webhook:', error);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('ERROR');
      }
    });
    
    return;
  }

  // ========================================
  // ENDPOINT: /api/pagamento/status/:id
  // Verifica status de pagamento no IronPay
  // ========================================
  if (req.url.startsWith('/api/pagamento/status/') && req.method === 'GET') {
    const transactionId = req.url.split('/api/pagamento/status/')[1];
    
    console.log('\n🔍 ==== VERIFICAÇÃO DE STATUS ====');
    console.log('Transaction ID:', transactionId);
    
    const TOKEN = process.env.GATEWAY_TOKEN;
    
    if (!TOKEN) {
      console.error('❌ Token IronPay não configurado!');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Token não configurado' 
      }));
      return;
    }
    
    // Endpoint IronPay para consultar status
    const IRONPAY_API = `https://api.ironpayapp.com.br/api/public/v1/transactions/${transactionId}?api_token=${TOKEN}`;
    
    console.log('🔄 Consultando IronPay...');
    
    const options = {
      hostname: 'api.ironpayapp.com.br',
      path: `/api/public/v1/transactions/${transactionId}?api_token=${TOKEN}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      let responseData = '';
      
      proxyRes.on('data', (chunk) => {
        responseData += chunk;
      });
      
      proxyRes.on('end', () => {
        console.log('📥 Resposta IronPay (status ' + proxyRes.statusCode + '):', responseData.substring(0, 200));
        
        try {
          const data = JSON.parse(responseData);
          
          if (proxyRes.statusCode === 200) {
            // Normalizar status IronPay para formato padrão
            const status = data.payment_status || data.status || 'pending';
            
            // Mapear status IronPay para status padrão
            const statusMap = {
              'paid': 'paid',
              'approved': 'paid',
              'waiting_payment': 'pending',
              'processing': 'pending',
              'cancelled': 'cancelled',
              'expired': 'expired',
              'refused': 'cancelled',
              'refunded': 'refunded'
            };
            
            const normalizedStatus = statusMap[status] || 'pending';
            
            console.log('✅ Status:', status, '→', normalizedStatus);
            
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
              success: true,
              status: normalizedStatus,
              transactionId: transactionId,
              originalStatus: status,
              paidAt: data.date_approved,
              amount: data.amount
            }));
          } else {
            console.error('❌ Erro ao consultar status:', data);
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
              success: false,
              error: data.message || 'Erro ao consultar status'
            }));
          }
        } catch (parseError) {
          console.error('❌ Erro ao parsear resposta:', parseError);
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Resposta inválida do gateway' 
          }));
        }
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('❌ Erro na requisição:', error);
      res.writeHead(500, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
    });
    
    proxyReq.end();
    return;
  }

  // ========================================
  // SERVIR ARQUIVOS ESTÁTICOS
  // (deve vir DEPOIS das rotas API)
  // ========================================
  
  // Remover query parameters da URL (ex: ?total=123 → fica só o caminho)
  const urlWithoutParams = req.url.split('?')[0];
  
  // Determinar arquivo usando __dirname para garantir path correto
  let filePath = path.join(__dirname, urlWithoutParams === '/' ? 'index.html' : urlWithoutParams);
  
  // Prevenir path traversal (segurança)
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 - Acesso negado</h1>', 'utf-8');
    return;
  }

  // Extensão do arquivo
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Ler arquivo
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Arquivo não encontrado</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Erro no servidor: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
};

// Criar servidor HTTP ou HTTPS
let server;
if (USE_HTTPS && SSL_KEY_PATH && SSL_CERT_PATH) {
  try {
    const options = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };
    server = https.createServer(options, serverHandler);
    console.log('🔒 Servidor HTTPS configurado');
  } catch (error) {
    console.error('❌ Erro ao carregar certificados SSL:', error.message);
    console.log('⚠️ Usando HTTP...');
    server = http.createServer(serverHandler);
  }
} else {
  server = http.createServer(serverHandler);
}

server.listen(PORT, HOST, () => {
  const protocol = USE_HTTPS ? 'https' : 'http';
  const isLocal = HOST === 'localhost' || HOST === '127.0.0.1';
  const displayHost = isLocal ? 'localhost' : HOST;
  
  console.log('');
  console.log('🚀 ========================================');
  console.log('🚀  Servidor rodando!');
  console.log('🚀 ========================================');
  console.log('');
  console.log(`📍 Ambiente: ${NODE_ENV.toUpperCase()}`);
  console.log(`📍 URL: ${protocol}://${displayHost}:${PORT}`);
  console.log(`📍 Host: ${HOST}`);
  console.log(`📍 Porta: ${PORT}`);
  console.log(`🔒 HTTPS: ${USE_HTTPS ? 'Ativado ✅' : 'Desativado ❌'}`);
  console.log('');
  console.log('📋 Páginas disponíveis:');
  console.log(`   • ${protocol}://${displayHost}:${PORT}/index.html`);
  console.log(`   • ${protocol}://${displayHost}:${PORT}/checkout-v2.html`);
  console.log(`   • ${protocol}://${displayHost}:${PORT}/pagamento.html`);
  console.log(`   • ${protocol}://${displayHost}:${PORT}/admin.html`);
  console.log(`   • ${protocol}://${displayHost}:${PORT}/confirmacao.html`);
  console.log('');
  console.log('🔧 API Endpoints:');
  console.log(`   • POST ${protocol}://${displayHost}:${PORT}/api/pagar`);
  console.log(`   • POST ${protocol}://${displayHost}:${PORT}/webhook/ironpay`);
  console.log(`   • POST ${protocol}://${displayHost}:${PORT}/webhook/asaas`);
  console.log(`   • POST ${protocol}://${displayHost}:${PORT}/webhook/tribopay`);
  console.log('');
  if (NODE_ENV === 'development') {
    console.log('💡 Para mudar a porta: PORT=3000 node server.js');
  } else {
    console.log('✅ Servidor pronto para produção!');
  }
  console.log('');
});

// Tratamento de erros do servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Erro: Porta ${PORT} já está em uso!`);
    console.error('💡 Tente outra porta: PORT=3000 node server.js\n');
  } else {
    console.error('\n❌ Erro ao iniciar servidor:', error.message, '\n');
  }
  process.exit(1);
});

// Tratamento graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  Recebido SIGTERM. Encerrando servidor gracefully...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso.\n');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n⚠️  Servidor interrompido pelo usuário (Ctrl+C)');
  console.log('👋 Encerrando...\n');
  server.close(() => {
    console.log('✅ Servidor encerrado.\n');
    process.exit(0);
  });
});
