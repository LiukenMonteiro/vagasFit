# VagasFit — MVP de currículos ATS por vaga

Plataforma para gerar versões de currículo adaptadas a descrições de vagas de TI, mantendo o currículo mestre como fonte da verdade e evitando inventar experiências.

## O que já vem pronto

- Upload de currículo em PDF.
- Extração inicial de texto do PDF e criação de perfil editável.
- Perfil mestre salvo localmente.
- Campo para colar descrição da vaga.
- Análise da vaga com foco, senioridade, palavras-chave, compatibilidade e lacunas.
- Geração de currículo adaptado em PT-BR.
- Histórico de currículos gerados.
- Download em PDF com nome automático:

```txt
curriculo-nome-da-pessoa-nome-da-vaga-empresa.pdf
```

## Stack

- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Express + TypeScript.
- PDF parsing: `pdf-parse`.
- PDF generation: `puppeteer`.
- Storage MVP: arquivos JSON locais em `apps/api/data`.

## Como rodar

```bash
npm install
npm run dev
```

Frontend:

```txt
http://localhost:5173
```

Backend:

```txt
http://localhost:3333/api/health
```

## Variáveis de ambiente

Copie o arquivo `.env.example` para `.env` na raiz ou configure diretamente no ambiente:

```bash
API_PORT=3333
WEB_ORIGIN=http://localhost:5173
```


## Estrutura

```txt
vaga-fit/
  apps/
    api/
      src/
        routes/
        services/
        data/profileSeed.ts
        models.ts
        server.ts
      data/
        profile.json
        resumes/
        uploads/
    web/
      src/
        components/
        App.tsx
        api.ts
        types.ts
```

## Próximos passos recomendados

1. Melhorar o editor do perfil mestre com CRUD completo de experiências, projetos e skills.
2. Adicionar autenticação.
3. Trocar armazenamento local por PostgreSQL + Prisma.
4. Adicionar análise por link de vaga.
5. Adicionar versão DOCX.
6. Criar extensão Chrome para capturar vagas do LinkedIn, Gupy, Indeed e sites similares.

## Regra de ouro do projeto

A plataforma pode reorganizar, reescrever e destacar informações reais do perfil. Ela não deve afirmar experiência inexistente. Tecnologias que aparecem na vaga, mas não aparecem no currículo mestre, devem virar lacunas ou sugestões de estudo, não afirmações no currículo.
