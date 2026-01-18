# Bella Pizza — Site e Área Administrativa

Design e identidade visual criados por Old Marechal.

## Visão Geral
- Site público para montagem e envio de pedidos de pizza com integração por WhatsApp.
- Área administrativa para controle de pedidos, preços, sabores, relatórios e backups.
- Persistência local com SQL.js (banco `bella2_db`) e opção de integração com backend para sincronizar pedidos entre dispositivos.

## Funcionalidades do Site (index.html)
- Menu dinâmico de sabores com preços P/G e descrição por categoria (salgada/doce).
- Montagem de pizzas:
  - Seleção de tamanho (P/G) e até 2 sabores por pizza.
  - Observações por pizza.
  - Cálculo automático de preço da pizza pelo maior preço entre os sabores escolhidos.
- Refrigerantes:
  - Seleção de tipo (Guaraná/Coca-Cola) e preço unitário configurável.
- Entrega ou retirada:
  - Endereço obrigatório para entregas.
  - Pagamentos: cartão, pix, dinheiro (com opção de troco).
  - Taxa de entrega aplicada quando modo = entrega.
- Resumo do pedido:
  - Total detalhado com taxa de entrega e bebidas.
  - Envio por WhatsApp para o número da pizzaria.
- Registro local em SQL:
  - Grava cada pedido em `orders` dentro do `bella2_db` (SQL.js).
  - Mantém funcionamento mesmo sem backend.

## Área Administrativa (admin.html)
- Login de administrador.
- Abas:
  - Pedidos: lista, filtros e ações.
  - Preços/Sabores: editor completo.
- Pedidos:
  - Filtros por mês, modo (entrega/retirada), status (pendente/concluído/cancelado/preparado), período e busca (telefone/observações).
  - Ações:
    - Marcar como concluído/cancelado/preparado.
    - Editar telefone.
    - Remover pedido.
    - Reenviar WhatsApp com base no payload do pedido.
  - Exportação CSV.
  - Gráfico de faturamento mensal (com base nos pedidos concluídos).
  - Painel com totais, ticket médio, pendentes e cancelados.
- Preços e sabores:
  - Edição de preço P/G por sabor.
  - Descrição e categoria (salgada/doce).
  - Ativar/desativar sabor.
  - Adicionar/remover sabores.
- Backup:
  - Baixar backup do banco `bella2_db` como arquivo base64 (`bella2_db_backup.txt`).
  - Restaurar backup para recuperar todos os dados, inclusive pedidos.

## Banco de Dados (SQL.js, no navegador)
- Banco: `bella2_db` salvo em `localStorage`.
- Tabelas:
  - `admin(username TEXT PRIMARY KEY, salt TEXT, hash TEXT)`
  - `orders(id TEXT PRIMARY KEY, created_at TEXT, phone TEXT, mode TEXT, total REAL, payload TEXT, status TEXT DEFAULT 'pending', settled_at TEXT, prepared_at TEXT)`
  - `pricing(flavor TEXT PRIMARY KEY, price_p REAL, price_g REAL)`
  - `flavors(flavor TEXT PRIMARY KEY, category TEXT, description TEXT, active INTEGER)`
- Migração automática:
  - A área admin garante que as colunas `status`, `settled_at` e `prepared_at` existam na `orders` (executa `ALTER TABLE` quando necessário).

## Integração Entre Dispositivos
- Sem backend: cada dispositivo mantém seu próprio `bella2_db`; os pedidos não são compartilhados entre aparelhos diferentes.
- Com backend: todos os dispositivos passam a ver a mesma lista de pedidos.
  - O frontend sincroniza do servidor para o banco local ao carregar a área admin.
  - O site público tenta registrar no backend e, independentemente do resultado, envia o WhatsApp.

## Backend Opcional (server.js)
- Endpoints:
  - `POST /api/order` – criar pedido (grava em `orders.json`).
  - `GET /api/orders` – listar pedidos (com ordenação e filtro por mês).
  - `POST /api/order/status` – atualizar status (`pending|completed|canceled|prepared`).
  - `POST /api/order/delete` – remover pedido.
  - `POST /api/order/phone` – atualizar telefone do pedido.
- Execução local:
  - `node server.js`
  - Acessar: `http://localhost:8000/`
- Deploy externo:
  - Hospedar `server.js` em um serviço de Node ou serverless e apontar o frontend para esse endereço.

## Configuração do Frontend (API_BASE)
- `index.html` e `admin.html` possuem `API_BASE`.
  - Se o backend estiver no mesmo host, deixe `API_BASE=''`.
  - Se estiver em outro domínio, defina `API_BASE='https://seu-backend.com'`.
- Com `API_BASE` corretamente configurado, desktop e celular verão os mesmos pedidos.

## Fluxo de Pedido
1. Cliente monta o pedido e confirma.
2. Registro local em SQL (`orders`) e tentativa de registro central (se `API_BASE` responder).
3. WhatsApp abre com o resumo pronto para envio.
4. Admin vê o pedido na lista, filtra, muda status, exporta, remove, etc.

## Responsividade
- CSS adaptado para dispositivos móveis e desktop.
- Elementos como tabelas na área admin possuem containers scrolláveis (`.table-wrap`) para manter legibilidade em telas pequenas.
- Página `teste-responsivo.html` auxilia na verificação visual de componentes e espaçamentos.

## Credenciais Padrão de Admin
- Usuário inicial: `mudinho`.
- Senha inicial: `mudinho`.
- Recomenda-se alterar via mecanismo próprio futuramente; hoje é gerado e salvo no banco local com hash baseado em `salt + senha`.

## Créditos
- Design e identidade por Old Marechal.
- © 2026 Bella Pizza.
