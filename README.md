# Didi Gás - Finanças

App leve de controle financeiro que se conecta ao Firestore do **Didi Gás** para
puxar o lucro do dia automaticamente, e permite lançar despesas (mercado, energia,
água, gasolina...) pelo app ou por WhatsApp.

## Stack (a mesma linha do Didi Gás, sem exageros)
- React + Vite + TypeScript
- Firebase Firestore (lê as vendas do Didi Gás, grava despesas numa coleção nova `despesas`)
- PWA (instalável no celular, funciona rápido)
- 1 função serverless na Vercel para o webhook do WhatsApp (sem servidor rodando o tempo todo)

## Instalação

```bash
npm install
npm install @vercel/node firebase-admin   # só necessário para o /api/whatsapp.ts
cp .env.example .env
# preencha o .env com as credenciais do Firebase (mesmas do Didi Gás ou um projeto novo)
npm run dev
```

## Como funciona

- **Lucro do dia**: lê direto a coleção de vendas do Didi Gás (`VITE_SALES_COLLECTION`,
  padrão `"vendas"` — troque se o nome real for diferente) e soma o campo `lucro`
  das vendas do dia, ignorando `CANCELADO`. Não depende de nenhum resumo pré-calculado.
- **Despesas**: ficam numa coleção nova `despesas`, separada da coleção de vendas —
  não mexe em nada do Didi Gás.
- **WhatsApp**: configure um número no Twilio (ou na API oficial da Meta) apontando
  o webhook para `https://seu-app.vercel.app/api/whatsapp`. Mensagens no formato
  `categoria valor descrição` (ex: `gasolina 150 posto shell`) são interpretadas e
  gravadas automaticamente.

## Deploy na Vercel

```bash
git init
git add .
git commit -m "primeiro commit"
# crie um repositório no GitHub e depois:
git remote add origin <url-do-seu-repo>
git push -u origin main
```

Depois é só importar o repositório em vercel.com → "Add New Project" → selecione o
repo → adicione as variáveis de ambiente do `.env` no painel da Vercel → Deploy.

## Ajustar o nome da coleção de vendas

Se ao abrir o app o "Faturamento hoje" aparecer zerado mesmo tendo vendas, o nome
da coleção provavelmente não é `vendas`. Troque em `.env`:

```
VITE_SALES_COLLECTION=nome-real-da-colecao
```
