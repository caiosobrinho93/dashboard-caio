# Design Vault

Dashboard para salvar componentes de desenvolvimento (botoes, backgrounds animados, textos animados, fontes, paletas de cores, etc.) e gerar um `design.md` com as especificacoes escolhidas, para que uma IA crie um app seguindo esse design system.

## Como rodar

```bash
cd C:\Users\caiosobrinho\Documents\dashboard
npm install   # ja instalado
npm start
```

## Onde os arquivos sao salvos

- Codigos dos componentes: `C:\Users\caiosobrinho\Documents\components\<categoria>\<nome>-<id>.txt`
  - Exemplo: `../components/buttons/btn-ex.txt`
- design.md gerados: `C:\Users\caiosobrinho\Documents\designs\<projeto>-design.md`
- Indice de metadados: `components/index.json`

Os arquivos `.txt` ficam salvos no disco (nao apenas no navegador), entao persistem para sempre.

## Uso

1. Navegue pelas categorias na barra lateral.
2. Clique em **+ Novo componente** para adicionar (nome, categoria, linguagem, tags, codigo).
3. Marque (checkbox) os componentes desejados.
4. Clique em **Gerar design.md**, informe nome do projeto e descricao.
5. O arquivo e salvo em disco e pode ser baixado.

## Categorias

Botoes, Backgrounds animados, Textos animados, Fontes, Paletas de cores, Cards, Inputs/Forms, Loaders, Navbars, Modals, Outros.

## Deploy no Vercel (nuvem + senha)

O app roda igual no PC e na nuvem. A diferenca e onde os dados ficam:

| Modo | Quando | Onde salva | Login |
| --- | --- | --- | --- |
| Local | `npm start` | Disco (`../components`, `../data`, `../designs`, `../backups`) | Desativado |
| Nuvem | Na Vercel | Supabase (tabela `kv`) | Senha obrigatoria |

O explorador de arquivos (`files.html`) so funciona no modo local.

### 1. Criar a tabela no Supabase

No painel do Supabase: **SQL Editor** → cole e rode:

```sql
create table if not exists public.kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.kv enable row level security;

drop policy if exists "dashboard full access" on public.kv;
create policy "dashboard full access" on public.kv
  for all
  to anon, authenticated
  using (true)
  with check (true);
```

### 2. Enviar os dados do PC para o Supabase

```powershell
$env:STORAGE="supabase"
$env:NEXT_PUBLIC_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
node migrate.js
```

### 3. Importar o repo na Vercel

1. [vercel.com/new](https://vercel.com/new) → importe `caiosobrinho93/dashboard-caio`.
2. Framework preset: **Other** (deixe build e output vazios).
3. Em **Environment Variables**, adicione:

| Variavel | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fppnutdyvhbjnjowvkiq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sua chave `sb_publishable_...` |
| `DASHBOARD_PASSWORD` | a senha que voce vai digitar no site |
| `AUTH_SECRET` | qualquer texto longo e aleatorio |

4. **Deploy**. O site abre em `https://dashboard-caio.vercel.app` (ou similar) e pede a senha.

> Sem `DASHBOARD_PASSWORD` a versao na nuvem fica bloqueada de proposito (503) para nao expor finanças e notas.

### Variaveis de ambiente

Copie `.env.example` para `.env` se quiser testar o login localmente. Nenhuma variavel e obrigatoria no PC.

## Rede social (perfis, feed, comunidades, comentarios)

A partir de agora o projeto tambem tem uma rede social para trabalhadores da regiao,
inspirada em Facebook/Instagram, usando o mesmo Supabase (com Supabase Auth).

### Como ativar (uma vez)

1. No Supabase: **SQL Editor** → cole e rode o arquivo [`supabase/social.sql`](supabase/social.sql).
   Ele cria: `profiles`, `communities`, `community_members`, `posts`, `comments`, `likes`, `follows`,
   os indices, as policies (RLS) e os buckets de fotos (`posts`, `avatars`).
2. Ainda no Supabase: **Authentication → Providers → Email** habilitado.
   - Para entrar na hora (recomendado para testar): desligue **Confirm email** em Authentication → Sign In / Up.
   - Se manter ligado, o usuario recebe um e-mail de confirmacao. Configure tambem
     **Authentication → URL Configuration → Site URL** com a URL do site (Vercel).
3. Abra `https://SEU-SITE.vercel.app/social-login.html` (ou `http://localhost:3000/social-login.html`),
   crie sua conta e comece a usar.

### Paginas

| Arquivo | O que faz |
| --- | --- |
| `social-login.html` | Entrar / criar conta (Supabase Auth) |
| `feed.html` | Feed com filtros (Todos / Seguindo / Meus posts), publicar com foto |
| `communities.html` | Listar e criar comunidades, entrar/sair |
| `community.html?slug=...` | Pagina da comunidade com feed proprio |
| `people.html` | Diretorio de profissionais com busca e seguir/deixar de seguir |
| `profile.html` | Perfil (posts, seguidores, seguindo) e editar perfil com foto |

O painel antigo continua igual (senha do dashboard). A sidebar dele ganhou um atalho "Rede social".

### Configuracao do cliente

`public/social-config.js` guarda a URL e a chave PUBLISHABLE do Supabase (segura para o navegador,
a protecao real e via RLS) e a lista de profissoes. Troque ali o `appName` para mudar o nome da rede.

### Regras de privacidade (RLS)

- Leitura: publica (qualquer visitante ve perfis, posts, comunidades e comentarios).
- Escrita: so o dono — `auth.uid()` precisa bater com autor/dono da linha.
- Fotos: qualquer pessoa autenticada envia para os buckets `posts`/`avatars`; so o dono apaga.

```