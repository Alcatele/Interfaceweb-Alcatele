# MVP Mínimo Viável

## 1. Objetivo

Colocar em piloto uma versão funcional da plataforma para administrar empresas,
usuários e recursos básicos de FusionPBX, incluindo chamadas WebRTC de saída.

O MVP usa o frontend React/Vite já validado no protótipo. A migração para
Next.js fica depois do piloto para reduzir tempo de lançamento. A fronteira de
segurança e negócio já está no backend NestJS, permitindo trocar o frontend sem
reescrever o domínio.

## 2. Módulos

| Módulo | Entrega do MVP |
| --- | --- |
| Login | Sessão opaca em cookie HttpOnly |
| Multiempresa | Memberships, tenant ativo e troca de empresa |
| Usuários | Listagem, criação, remoção e redefinição de senha |
| Permissões | Perfis Super Admin, Admin e Usuário |
| Dashboard | Ramais, troncos, rotas, usuários e jobs pendentes |
| FusionPBX | Adapter mock/live, status, fila e sincronização |
| Ramais | CRUD e provisionamento assíncrono |
| Troncos | CRUD e provisionamento assíncrono |
| Rotas | Entrada e saída |
| WebPhone | SIP.js, registro WSS e chamada de saída |
| Auditoria | Alterações administrativas básicas |

Fora do recorte:

- WhatsApp;
- IA de voz;
- chat;
- filas e call center avançado;
- campanhas;
- CRM;
- billing automatizado;
- relatórios históricos avançados.

## 3. Cronograma

### Semana 1 - Fundação

- PostgreSQL MVP e RLS;
- NestJS;
- login e cookie;
- tenants e memberships;
- RBAC;
- Docker local;
- CI inicial.

Critério: três usuários seed conseguem entrar e só veem recursos autorizados.

### Semana 2 - FusionPBX e inventário

- adapter FusionPBX;
- jobs idempotentes;
- ramais;
- troncos;
- rotas de entrada;
- rotas de saída;
- sincronização manual;
- auditoria.

Critério: alteração na interface cria job e converge no adapter mock ou live.

### Semana 3 - Frontend e WebRTC

- frontend consumindo API;
- troca de empresa;
- dashboard;
- usuários e permissões;
- SIP.js;
- registro WSS;
- chamada de saída.

Critério: usuário com ramal registra e completa chamada em ambiente de teste.

### Semana 4 - Piloto

- testes de isolamento;
- testes de provisionamento;
- logs e alertas;
- TLS;
- bridge FusionPBX privado;
- backup e restore;
- documentação operacional;
- correções do piloto.

Critério: três a dez tenants piloto com operação assistida.

## 4. Ordem de desenvolvimento

1. Banco e contexto tenant.
2. Login e sessão.
3. RBAC no backend.
4. Multiempresa e tenant switch.
5. Usuários.
6. Adapter e fila FusionPBX.
7. Ramais.
8. Troncos.
9. Rotas.
10. Dashboard.
11. WebPhone.
12. Docker, CI e estabilização.

Essa ordem impede que CRUDs de telefonia sejam construídos antes das barreiras
de identidade e isolamento.

## 5. Backend

```text
backend/
|-- src/
|   |-- modules/
|   |   |-- auth/
|   |   |-- database/
|   |   |-- tenants/
|   |   |-- users/
|   |   |-- dashboard/
|   |   |-- fusionpbx/
|   |   |-- pbx/
|   |   |-- webphone/
|   |   `-- health/
|   |-- app.module.ts
|   `-- main.ts
|-- Dockerfile
|-- package.json
|-- tsconfig.json
`-- tsconfig.build.json
```

Decisões:

- NestJS modular;
- `pg` com SQL explícito;
- transação por request tenant-scoped;
- `set_config(..., true)` compatível com PgBouncer transaction pooling;
- cookie HttpOnly;
- guard global de sessão e permissões;
- bridge FusionPBX atrás de interface HTTP privada;
- credencial SIP emitida pelo bridge, não persistida no frontend.
- modo de credencial SIP simulada habilitado apenas por
  `WEBPHONE_ALLOW_MOCK=true`;
- sincronização com claim transacional para impedir processamento duplicado.

## 6. Frontend

```text
src/
|-- components/
|-- contexts/
|   `-- AuthContext.tsx
|-- layouts/
|-- pages/
|   |-- Login.tsx
|   |-- Tenants.tsx
|   |-- Dashboard.tsx
|   |-- Extensions.tsx
|   |-- SipTrunks.tsx
|   |-- InboundRoutes.tsx
|   |-- OutboundRoutes.tsx
|   |-- Webphone.tsx
|   `-- Settings.tsx
|-- routes/
`-- services/
    |-- api.ts
    `-- mvpApi.ts
```

Somente as rotas do MVP são liberadas pelo `AuthContext`. As páginas antigas
continuam no repositório como referência do protótipo, mas não aparecem no menu.

## 7. APIs necessárias

### Identidade

| Método | Rota | Uso |
| --- | --- | --- |
| POST | `/api/auth/login` | Criar sessão |
| GET | `/api/auth/me` | Sessão, tenant e permissões |
| POST | `/api/auth/switch-tenant` | Alterar tenant ativo |
| POST | `/api/auth/logout` | Revogar sessão |

### Empresas e usuários

| Método | Rota |
| --- | --- |
| GET/POST | `/api/tenants` |
| PATCH | `/api/tenants/:id/status` |
| DELETE | `/api/tenants/:id` |
| GET/POST | `/api/users` |
| POST | `/api/users/:id/reset-password` |
| DELETE | `/api/users/:id` |
| GET | `/api/permissions` |

### Operação

| Método | Rota |
| --- | --- |
| GET | `/api/dashboard/summary` |
| GET | `/api/fusionpbx/status` |
| POST | `/api/fusionpbx/sync` |
| GET/POST | `/api/pbx/extensions` |
| PATCH/DELETE | `/api/pbx/extensions/:id` |
| GET/POST | `/api/pbx/trunks` |
| PATCH/DELETE | `/api/pbx/trunks/:id` |
| GET/POST | `/api/pbx/routes/inbound` |
| PATCH/DELETE | `/api/pbx/routes/inbound/:id` |
| GET/POST | `/api/pbx/routes/outbound` |
| PATCH/DELETE | `/api/pbx/routes/outbound/:id` |
| GET | `/api/webphone/config` |
| GET | `/api/health` |

## 8. Banco necessário

O arquivo `database/postgresql/mvp_schema.sql` contém somente:

- `core.tenants`;
- `iam.users`;
- `iam.permissions`;
- `iam.roles`;
- `iam.role_permissions`;
- `iam.memberships`;
- `iam.sessions`;
- `telephony.extensions`;
- `telephony.sip_trunks`;
- `telephony.inbound_routes`;
- `telephony.outbound_routes`;
- `integration.fusionpbx_accounts`;
- `integration.provisioning_jobs`;
- `audit.events`.

O schema completo permanece como destino de evolução, não como dependência do
primeiro piloto.

## 9. Docker

Serviços:

- `postgres`: PostgreSQL 16;
- `api`: NestJS acessível somente pela rede interna;
- `web`: Nginx com frontend e proxy `/api`.

Execução:

```bash
docker compose up --build
```

Interface:

```text
http://localhost:8080
```

### Homologacao Debian 12

Para uma VPS pequena, utilize `docker-compose.prod.yml`. O ambiente inclui
Caddy com HTTPS automatico, PostgreSQL sem porta publica, API interna,
healthchecks e limites de memoria.

```bash
bash deploy/bootstrap-debian12.sh
cp .env.production.example .env.production
bash deploy/deploy.sh
```

No primeiro deploy, as senhas seed sao rotacionadas antes de o proxy HTTPS ser
iniciado.

Na VPS de homologacao, somente as portas `22`, `80` e `443` devem ficar
publicas. O arquivo `.env.production` nunca deve ser versionado.

Acessos locais:

| Login | Senha |
| --- | --- |
| `superadmin` | `Cloud@2026` |
| `admin` | `Admin@2026` |
| `usuario` | `Usuario@2026` |

O `docker-compose.yml` habilita `WEBPHONE_ALLOW_MOCK=true` somente para o
ambiente local. Em homologação e produção, mantenha `false`, configure
`FUSIONPBX_BRIDGE_URL` e injete `FUSIONPBX_BRIDGE_API_KEY` por secret.

O volume PostgreSQL preserva dados. Para recriar o banco de desenvolvimento,
remova o volume conscientemente antes de subir novamente.

## 10. GitHub Actions

`.github/workflows/ci.yml` executa:

1. instalação reproduzível;
2. lint e build do frontend;
3. typecheck e build do backend;
4. build das duas imagens Docker.

Próximas etapas do pipeline:

- testes de integração com PostgreSQL;
- scan de dependências;
- scan das imagens;
- SBOM;
- assinatura;
- deploy staging;
- smoke test;
- aprovação para produção.

## 11. FusionPBX

Modos:

- `mock`: marca jobs como sincronizados, usado em desenvolvimento;
- `live`: envia comandos ao bridge HTTP privado.

Variáveis:

```text
FUSIONPBX_BRIDGE_URL
FUSIONPBX_BRIDGE_API_KEY
WEBPHONE_SIP_DOMAIN
WEBPHONE_WSS_URL
```

O bridge deve:

1. autenticar a API;
2. validar tenant e idempotency key;
3. aplicar o recurso pela integração suportada;
4. confirmar o estado observado;
5. emitir credencial WebRTC curta;
6. nunca expor banco ou Event Socket à internet.

`WEBPHONE_MOCK_PASSWORD` existe apenas para desenvolvimento.

## 12. Critérios de lançamento

- isolamento entre dois tenants testado;
- sessão não armazenada em `localStorage`;
- autorização aplicada no backend;
- criação de recurso gera job idempotente;
- falha do FusionPBX não perde alteração;
- WebPhone registra com TLS/WSS;
- backup e restore executados;
- logs sem senha SIP ou token;
- Docker sobe em ambiente limpo;
- CI verde;
- bridge acessível somente por rede privada.
