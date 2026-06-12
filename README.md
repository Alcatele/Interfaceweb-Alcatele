# Alcatele Cloud PBX

MVP SaaS Multi-Tenant para administracao de FusionPBX, telefonia SIP e
WebPhone WebRTC.

## Escopo do MVP

- login com sessao HttpOnly;
- empresas e troca de tenant;
- usuarios e RBAC;
- dashboard operacional;
- ramais, troncos e rotas;
- fila de provisionamento FusionPBX;
- WebPhone com SIP.js;
- PostgreSQL com Row-Level Security e auditoria.

WhatsApp, chat, IA de voz e call center avancado permanecem fora desta fase.

## Tecnologias

- React, TypeScript, Vite e Ant Design;
- NestJS;
- PostgreSQL 16;
- SIP.js;
- Docker Compose e Nginx;
- GitHub Actions.

## Execucao com Docker

```bash
docker compose up --build
```

A aplicacao fica disponivel em:

```text
http://localhost:8080
```

Contas locais:

| Perfil | Usuario | Senha |
| --- | --- | --- |
| Super Admin | `superadmin` | `Cloud@2026` |
| Admin | `admin` | `Admin@2026` |
| Usuario | `usuario` | `Usuario@2026` |

As credenciais acima sao exclusivas do ambiente local e devem ser removidas
antes de homologacao.

## Demonstracao sem PostgreSQL

O modo demonstrativo usa dados locais e nao deve ser ativado em producao:

```powershell
$env:VITE_DEMO_MODE='true'
npm run dev
```

## Desenvolvimento

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

Variaveis de ambiente estao documentadas em `.env.example`.

## Validacao

```bash
npm run lint
npm run build
npm --prefix backend run typecheck
npm --prefix backend run build
```

O workflow em `.github/workflows/ci.yml` executa essas verificacoes e tambem
constroi as imagens Docker.

## Documentacao

- [Arquitetura mestra](docs/ARQUITETURA_MESTRA.md)
- [Modelagem do banco](docs/MODELAGEM_BANCO_DADOS.md)
- [Plano do MVP](docs/MVP_PLANO_EXECUCAO.md)
- [Schema PostgreSQL do MVP](database/postgresql/mvp_schema.sql)

## Producao

Antes de publicar:

- configurar HTTPS, WSS e dominio SIP;
- manter `VITE_DEMO_MODE=false`;
- manter `WEBPHONE_ALLOW_MOCK=false`;
- armazenar chaves em secrets;
- configurar o bridge privado do FusionPBX;
- trocar usuarios e senhas seed;
- validar backup, restore, logs e isolamento RLS.

Para Debian 12, a configuracao de homologacao utiliza:

```bash
sudo bash deploy/bootstrap-debian12.sh
cp .env.production.example .env.production
bash deploy/deploy.sh
```

No primeiro deploy, o script inicia os servicos internos, troca as senhas seed e
somente depois publica o HTTPS.

O arquivo `docker-compose.prod.yml` mantem PostgreSQL e API em rede privada e
publica somente Caddy nas portas `80` e `443`.
