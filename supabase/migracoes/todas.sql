-- O BANCO DA CARTEIRA DELE, na Supabase.
--
-- Este arquivo existe porque o repositorio guardava o esquema do banco do
-- MERCADO (schema.sql, no Cloudflare D1) e nao guardava o da CARTEIRA — que e
-- justamente o que tem os lancamentos, os aportes, o preco medio e o historico
-- das posicoes. Vinte e seis migracoes moravam so dentro da Supabase.
--
-- Perder a conta da Supabase e uma coisa; perder a RECEITA de como o banco e
-- feito e outra, e essa nao precisava ser possivel.
--
-- Gerado de supabase_migrations.schema_migrations, na ordem em que foram
-- aplicadas. Rodar tudo em ordem, numa base vazia, reconstroi o esquema.
--
-- NAO CONTEM DADO NENHUM DELE — so a forma das tabelas, as regras de acesso
-- (RLS) e as funcoes.

-- ==========================================================================
-- 20260828015329  carteira_e_alertas
-- ==========================================================================
-- BTC Monitor — carteira e alertas.
-- Banco próprio, separado do caderno-entregas: chave nova, projeto novo.
-- Tudo travado em auth.uid(): sem login, nenhuma linha é visível.

create table public.aportes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  qtd         numeric(20, 8) not null check (qtd > 0),
  preco_unit  numeric(20, 2) not null check (preco_unit > 0),
  data        date not null,
  moeda       text not null check (moeda in ('BRL', 'USD')),
  criado_em   timestamptz not null default now()
);

create table public.alertas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direcao     text not null check (direcao in ('above', 'below')),
  alvo        numeric(20, 2) not null check (alvo > 0),
  moeda       text not null check (moeda in ('BRL', 'USD')),
  disparado_em timestamptz,
  criado_em   timestamptz not null default now()
);

create index aportes_user_idx on public.aportes (user_id, data desc);
create index alertas_user_idx on public.alertas (user_id);

alter table public.aportes enable row level security;
alter table public.alertas enable row level security;

-- Uma política por operação, todas com a mesma trava. O with check no insert
-- e no update impede alguém de gravar linha no nome de outro usuário — sem
-- ele, dava pra ler só as suas e escrever nas dos outros.
create policy "aportes: dono lê"      on public.aportes for select using (auth.uid() = user_id);
create policy "aportes: dono insere"  on public.aportes for insert with check (auth.uid() = user_id);
create policy "aportes: dono altera"  on public.aportes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "aportes: dono apaga"   on public.aportes for delete using (auth.uid() = user_id);

create policy "alertas: dono lê"      on public.alertas for select using (auth.uid() = user_id);
create policy "alertas: dono insere"  on public.alertas for insert with check (auth.uid() = user_id);
create policy "alertas: dono altera"  on public.alertas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alertas: dono apaga"   on public.alertas for delete using (auth.uid() = user_id);;


-- ==========================================================================
-- 20260907195705  alocacao_por_usuario
-- ==========================================================================
-- A alocação de carteira de cada pessoa, no formato do método B.A.R.C.A.
--
-- Guardada como FATIAS NOMEADAS e não como colunas fixas, de propósito: em
-- 07/09/2026 ainda não sabemos o que as cinco letras do B.A.R.C.A. significam
-- (a aula do Portal 7 não foi transcrita). Fixar colunas agora seria chutar as
-- categorias e depois precisar de migração pra corrigir o chute.
--
-- Só PORCENTAGEM, nunca valor. O método é sobre proporção, e a proporção basta
-- pra dizer "seu método pede 15% em LP e você está em 22%". Guardar patrimônio
-- criaria um risco que não paga nada em troca.
create table if not exists public.alocacao (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fatia         text not null,
  alvo          numeric check (alvo  >= 0 and alvo  <= 100),
  atual         numeric check (atual >= 0 and atual <= 100),
  ordem         int not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (user_id, fatia)
);

alter table public.alocacao enable row level security;

-- O escopo é do BANCO, não do app — mesmo desenho do Caderno. Se o app tiver um
-- bug, o banco continua não deixando ninguém ler a carteira de outra pessoa.
create policy alocacao_le    on public.alocacao for select using (auth.uid() = user_id);
create policy alocacao_cria  on public.alocacao for insert with check (auth.uid() = user_id);
create policy alocacao_muda  on public.alocacao for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy alocacao_apaga on public.alocacao for delete using (auth.uid() = user_id);

create index if not exists alocacao_por_pessoa on public.alocacao (user_id, ordem);;


-- ==========================================================================
-- 20260907204045  alocacao_por_valor
-- ==========================================================================
-- A carteira passa a ser lançada em VALOR, não em porcentagem.
--
-- Pedido do Rayakuza em 07/09/2026: "não vou saber a porcentagem do meu
-- portfólio". Ele tem razão — pedir que a pessoa calcule a própria proporção é
-- pedir que ela faça o trabalho que a ferramenta existe pra fazer. Ela lança
-- quanto tem em cada fatia; a porcentagem é CONTA, e conta é comigo.
--
-- A objeção que eu tinha levantado contra guardar valor ("patrimônio num banco
-- que serve página pública") valia pro D1 do radar, que é aberto. Aqui não
-- vale: isto é Supabase com RLS, e sem sessão a tabela devolve vazio — foi
-- conferido no navegador antes desta migração.
--
-- `moeda` é por LINHA e não por pessoa: a reserva de emergência costuma estar
-- em real e o BTC em dólar, e forçar uma moeda só obrigaria a converter na mão
-- justamente quem não quer fazer conta.
alter table public.alocacao
  add column if not exists valor numeric check (valor >= 0),
  add column if not exists moeda text check (moeda in ('BRL', 'USD'));

-- `atual` sai: virou coluna derivada. Coluna que ninguém escreve é armadilha —
-- daqui a um mês alguém a lê achando que vale alguma coisa.
alter table public.alocacao drop column if exists atual;;


-- ==========================================================================
-- 20260908040547  carteira_por_caixinha_do_barca
-- ==========================================================================
-- Cada lançamento passa a dizer a QUAL CAIXINHA do B.A.R.C.A. pertence, e pode
-- ser um token (quantidade x preco ao vivo) em vez de um valor fixo.
alter table public.alocacao
  add column if not exists caixa text
    check (caixa in ('base','volatil','renda','caixa','aprender')),
  add column if not exists token text,
  add column if not exists quantidade numeric check (quantidade >= 0);

comment on column public.alocacao.caixa is
  'B.A.R.C.A.: base=Bitcoin, volatil=altcoins, renda=pools/lending, caixa=stables, aprender=airdrops';
comment on column public.alocacao.token is
  'simbolo em maiuscula (ETH, SOL, ZEC). Quando presente, o valor vem de quantidade x preco ao vivo.';
comment on column public.alocacao.alvo is
  'SUPERADO por alvo_caixa: o alvo do B.A.R.C.A. e por caixinha, nao por linha. Mantido so para nao apagar o que ele ja tinha digitado.';

-- O alvo agora e por caixinha, que e como o metodo o define.
create table if not exists public.alvo_caixa (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  caixa text not null check (caixa in ('base','volatil','renda','caixa','aprender')),
  pct numeric not null check (pct >= 0 and pct <= 100),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, caixa)
);

alter table public.alvo_caixa enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'alvo_caixa' and policyname = 'alvo_caixa_ler') then
    create policy alvo_caixa_ler on public.alvo_caixa for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'alvo_caixa' and policyname = 'alvo_caixa_inserir') then
    create policy alvo_caixa_inserir on public.alvo_caixa for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'alvo_caixa' and policyname = 'alvo_caixa_atualizar') then
    create policy alvo_caixa_atualizar on public.alvo_caixa for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'alvo_caixa' and policyname = 'alvo_caixa_apagar') then
    create policy alvo_caixa_apagar on public.alvo_caixa for delete using (auth.uid() = user_id);
  end if;
end $$;;


-- ==========================================================================
-- 20260908040858  linha_de_pool_na_renda_passiva
-- ==========================================================================
-- Na renda passiva (o R do B.A.R.C.A.) a linha pode apontar para uma pool
-- concreta do DefiLlama. O radar ja sabe medir pool; faltava a carteira dizer
-- QUAL pool e dele, para o painel mostrar rendimento, chao e multiplicador ao
-- lado do valor.
alter table public.alocacao
  add column if not exists pool_id text,
  add column if not exists onde text;

comment on column public.alocacao.pool_id is
  'id da pool no DefiLlama. Liga a linha da carteira ao que o radar ja mede.';
comment on column public.alocacao.onde is
  'plataforma/corretora onde a posicao esta, escrito por ele. So para ele achar de novo.';;


-- ==========================================================================
-- 20260908050708  faixa_da_posicao_em_pool
-- ==========================================================================
-- A faixa de uma posicao concentrada.
--
-- Numa pool de liquidez concentrada (Orca, Uniswap v3, Aerodrome slipstream) a
-- posicao so rende enquanto o preco esta DENTRO da faixa. Fora dela o dinheiro
-- fica parado e virou tudo o ativo que caiu. E o numero que decide o dia a dia
-- da posicao, e nenhum outro campo da carteira falava disso.
--
-- faixa_token e o simbolo cujo preco se compara com a faixa: numa SOL/USDC a
-- faixa esta em USDC por SOL, entao o token e SOL. Guardado explicitamente
-- para nao ficar adivinhando pelo nome do par a cada leitura.
alter table public.alocacao
  add column if not exists faixa_min numeric check (faixa_min >= 0),
  add column if not exists faixa_max numeric check (faixa_max >= 0),
  add column if not exists faixa_token text;

comment on column public.alocacao.faixa_min is
  'limite de baixo da faixa da posicao concentrada, no preco do faixa_token';
comment on column public.alocacao.faixa_max is
  'limite de cima da faixa';
comment on column public.alocacao.faixa_token is
  'simbolo do token cujo preco se compara com a faixa (o lado que nao e stablecoin)';;


-- ==========================================================================
-- 20260908051446  posicao_em_pool_lida_da_blockchain
-- ==========================================================================
-- O endereco da posicao concentrada, e a foto da entrada.
--
-- Com o endereco o radar le a posicao de verdade na Solana: faixa, valor,
-- quanto de cada token, dentro ou fora. E publico e e so leitura -- o endereco
-- de uma posicao nao move fundo nenhum.
--
-- valor_entrada e data_entrada sao a foto do dia em que ele ligou a posicao.
-- Existe pelo mesmo motivo da tabela minhas_pools no D1: daqui a dois meses nao
-- ha como saber quanto valia no dia em que ele entrou se ninguem anotou naquele
-- dia. Mercado se remede; passado nao.
alter table public.alocacao
  add column if not exists posicao text,
  add column if not exists valor_entrada numeric check (valor_entrada >= 0),
  add column if not exists data_entrada date;

comment on column public.alocacao.posicao is
  'endereco publico da posicao concentrada (por ora, Orca Whirlpool na Solana)';
comment on column public.alocacao.valor_entrada is
  'valor em dolar no dia em que ele ligou a posicao ao radar; base do PnL';
comment on column public.alocacao.data_entrada is
  'o dia da foto acima';;


-- ==========================================================================
-- 20260908064137  carteira_solana_e_linhas_que_seguem
-- ==========================================================================
-- O endereco da carteira dele, guardado uma vez.
--
-- E publico e e so leitura: quem o tem enxerga o que ele tem, nunca move. Mesmo
-- assim mora AQUI, no Supabase atras do login, e nunca no D1 -- o D1 serve uma
-- pagina publica.
create table if not exists public.carteira_solana (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  endereco text not null,
  atualizado_em timestamptz not null default now()
);

alter table public.carteira_solana enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'carteira_solana' and policyname = 'carteira_ler') then
    create policy carteira_ler on public.carteira_solana for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'carteira_solana' and policyname = 'carteira_inserir') then
    create policy carteira_inserir on public.carteira_solana for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'carteira_solana' and policyname = 'carteira_atualizar') then
    create policy carteira_atualizar on public.carteira_solana for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'carteira_solana' and policyname = 'carteira_apagar') then
    create policy carteira_apagar on public.carteira_solana for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Qual token da Solana e a linha, e se ela SEGUE a carteira.
--
-- Seguir e o padrao porque numero velho na tela e pior que numero nenhum. Mas o
-- cadeado existe por um motivo real que ele levantou: se ele quiser contar uma
-- parte do BTC como base solida e outra parte como outra coisa, ou se tiver
-- token fora dessa carteira, seguir atropelaria a escolha dele.
alter table public.alocacao
  add column if not exists mint text,
  add column if not exists segue_carteira boolean not null default true;

comment on column public.alocacao.mint is
  'endereco do token na Solana, quando a linha veio da importacao da carteira';
comment on column public.alocacao.segue_carteira is
  'true = a quantidade se refaz pela carteira a cada abertura; false = congelada (o cadeado)';;


-- ==========================================================================
-- 20260908065926  salvar_carteira_sem_poder_perder
-- ==========================================================================
-- Salvar a carteira sem poder perder nada.
--
-- O QUE ACONTECEU EM 09/09/2026, e por que esta funcao existe:
--
-- O painel salvava em dois pedidos: DELETE de tudo, depois INSERT de tudo. O
-- INSERT falhou (o PostgREST recusa lote com chaves diferentes por linha) e o
-- DELETE ja tinha passado. Resultado: os lancamentos do Rayakuza sumiram e nada
-- entrou no lugar. Ele viu a carteira zerada e ia redigitar tudo.
--
-- Dois pedidos separados nunca podem virar uma coisa so: se o segundo falha, o
-- primeiro ja aconteceu. Dentro de uma funcao eles sao UMA transacao -- se o
-- insert quebrar por qualquer motivo, o delete volta atras junto e a carteira
-- fica exatamente como estava.
--
-- security invoker: as policies de RLS continuam valendo, entao esta funcao nao
-- alcanca a carteira de mais ninguem. E jsonb no lugar de lista de linhas mata
-- de vez o erro das chaves: o que falta vem nulo por construcao.
create or replace function public.salvar_alocacao(linhas jsonb)
returns integer
language plpgsql
security invoker
as $$
declare
  quantas integer;
begin
  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    l->>'fatia',
    nullif(l->>'caixa', ''),
    nullif(l->>'token', ''),
    (nullif(l->>'quantidade', ''))::numeric,
    (nullif(l->>'valor', ''))::numeric,
    nullif(l->>'moeda', ''),
    nullif(l->>'pool_id', ''),
    l->>'onde',
    nullif(l->>'posicao', ''),
    (nullif(l->>'valor_entrada', ''))::numeric,
    (nullif(l->>'data_entrada', ''))::date,
    nullif(l->>'mint', ''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem', ''))::integer, 0),
    (nullif(l->>'alvo', ''))::numeric
  from jsonb_array_elements(coalesce(linhas, '[]'::jsonb)) as l
  where coalesce(l->>'fatia', '') <> '';

  get diagnostics quantas = row_count;
  return quantas;
end;
$$;

-- O mesmo para os alvos das caixinhas, pelo mesmo motivo.
create or replace function public.salvar_alvos(alvos jsonb)
returns integer
language plpgsql
security invoker
as $$
declare
  quantas integer;
begin
  delete from public.alvo_caixa where user_id = auth.uid();

  insert into public.alvo_caixa (user_id, caixa, pct)
  select auth.uid(), a->>'caixa', (a->>'pct')::numeric
  from jsonb_array_elements(coalesce(alvos, '[]'::jsonb)) as a
  where coalesce(a->>'caixa', '') <> '' and coalesce(a->>'pct', '') <> '';

  get diagnostics quantas = row_count;
  return quantas;
end;
$$;

grant execute on function public.salvar_alocacao(jsonb) to authenticated;
grant execute on function public.salvar_alvos(jsonb) to authenticated;;


-- ==========================================================================
-- 20260908070606  backup_da_carteira_a_cada_salvamento
-- ==========================================================================
-- Uma copia da carteira a cada salvamento.
--
-- POR QUE ISTO EXISTE: em 09/09/2026 um erro meu apagou os lancamentos do
-- Rayakuza. A transacao em salvar_alocacao impede que aquilo se repita, mas
-- transacao so protege contra falha da MAQUINA. Nao protege contra ele apagar
-- uma linha sem querer, nem contra um erro meu numa versao futura.
--
-- Ele: "nao pode ser excluido mais, precisa de algum backup pra nao perdermos
-- dados. As versoes sempre vao atualizando e nao da pra perder as coisas que
-- estao dando certo."
--
-- Entao: antes de cada gravacao, o estado ANTERIOR inteiro vai pra ca. Se algo
-- der errado -- meu, dele, ou de uma versao nova -- da pra voltar a qualquer
-- ponto. Guarda as 30 ultimas por pessoa: o suficiente pra semanas de uso, e
-- pouco o bastante pra nao virar um deposito de lixo.
create table if not exists public.carteira_backup (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quando   timestamptz not null default now(),
  quantas  integer not null default 0,
  linhas   jsonb not null,
  alvos    jsonb
);

create index if not exists backup_por_pessoa on public.carteira_backup (user_id, quando desc);

alter table public.carteira_backup enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'carteira_backup' and policyname = 'backup_ler') then
    create policy backup_ler on public.carteira_backup for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'carteira_backup' and policyname = 'backup_inserir') then
    create policy backup_inserir on public.carteira_backup for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'carteira_backup' and policyname = 'backup_apagar') then
    create policy backup_apagar on public.carteira_backup for delete using (auth.uid() = user_id);
  end if;
end $$;

-- salvar_alocacao passa a tirar a foto do estado anterior ANTES de apagar.
-- Tudo na mesma transacao: se a gravacao quebrar, a foto some junto -- e nao
-- faz falta, porque nada foi perdido.
create or replace function public.salvar_alocacao(linhas jsonb)
returns integer
language plpgsql
security invoker
as $$
declare
  quantas integer;
  tinha   integer;
begin
  select count(*) into tinha from public.alocacao where user_id = auth.uid();

  -- So guarda se havia o que guardar: backup de carteira vazia e ruido.
  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos)
    select
      auth.uid(),
      tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid());

    -- Fica com as 30 mais novas.
    delete from public.carteira_backup
    where user_id = auth.uid()
      and id not in (
        select id from public.carteira_backup
        where user_id = auth.uid()
        order by quando desc
        limit 30
      );
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    l->>'fatia',
    nullif(l->>'caixa', ''),
    nullif(l->>'token', ''),
    (nullif(l->>'quantidade', ''))::numeric,
    (nullif(l->>'valor', ''))::numeric,
    nullif(l->>'moeda', ''),
    nullif(l->>'pool_id', ''),
    l->>'onde',
    nullif(l->>'posicao', ''),
    (nullif(l->>'valor_entrada', ''))::numeric,
    (nullif(l->>'data_entrada', ''))::date,
    nullif(l->>'mint', ''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem', ''))::integer, 0),
    (nullif(l->>'alvo', ''))::numeric
  from jsonb_array_elements(coalesce(linhas, '[]'::jsonb)) as l
  where coalesce(l->>'fatia', '') <> '';

  get diagnostics quantas = row_count;
  return quantas;
end;
$$;

grant execute on function public.salvar_alocacao(jsonb) to authenticated;;


-- ==========================================================================
-- 20260908070626  restaurar_backup_da_carteira
-- ==========================================================================
-- Voltar a carteira para uma copia guardada.
--
-- Repare que ela TAMBEM tira uma foto antes de restaurar: voltar atras e uma
-- operacao tao perigosa quanto salvar, e nao pode ser um caminho sem volta. Se
-- ele restaurar a copia errada, a copia certa continua la.
create or replace function public.restaurar_backup(qual uuid)
returns integer
language plpgsql
security invoker
as $$
declare
  copia   public.carteira_backup;
  quantas integer;
  tinha   integer;
begin
  select * into copia from public.carteira_backup
  where id = qual and user_id = auth.uid();

  if copia.id is null then
    raise exception 'não achei essa cópia';
  end if;

  select count(*) into tinha from public.alocacao where user_id = auth.uid();
  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos)
    select auth.uid(), tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid());
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(), l->>'fatia', nullif(l->>'caixa',''), nullif(l->>'token',''),
    (nullif(l->>'quantidade',''))::numeric, (nullif(l->>'valor',''))::numeric,
    nullif(l->>'moeda',''), nullif(l->>'pool_id',''), l->>'onde',
    nullif(l->>'posicao',''), (nullif(l->>'valor_entrada',''))::numeric,
    (nullif(l->>'data_entrada',''))::date, nullif(l->>'mint',''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem',''))::integer, 0),
    (nullif(l->>'alvo',''))::numeric
  from jsonb_array_elements(copia.linhas) as l
  where coalesce(l->>'fatia','') <> '';

  get diagnostics quantas = row_count;

  -- Os alvos voltam junto: carteira restaurada com alvo de outra epoca daria
  -- uma leitura de rebalanceamento que nunca existiu.
  if copia.alvos is not null and jsonb_array_length(copia.alvos) > 0 then
    delete from public.alvo_caixa where user_id = auth.uid();
    insert into public.alvo_caixa (user_id, caixa, pct)
    select auth.uid(), a->>'caixa', (a->>'pct')::numeric
    from jsonb_array_elements(copia.alvos) as a
    where coalesce(a->>'caixa','') <> '';
  end if;

  return quantas;
end;
$$;

grant execute on function public.restaurar_backup(uuid) to authenticated;;


-- ==========================================================================
-- 20260908072125  cambio_da_entrada_para_o_juro_da_kamino
-- ==========================================================================
-- O cambio do cToken no dia em que ele ligou o emprestimo.
--
-- Na Kamino o juro nao e pago em token novo: a quantidade de cTokens fica
-- parada e o CAMBIO sobe. Entao todo o rendimento e a diferenca entre o cambio
-- de hoje e o do dia da entrada -- uma conta exata, nao estimativa.
--
-- Sem esta coluna nao ha de que subtrair. Guardar so o valor em dolar nao
-- serve: se ele depositar mais, o valor sobe sem ter rendido nada.
alter table public.alocacao
  add column if not exists cambio_entrada numeric check (cambio_entrada > 0);

comment on column public.alocacao.cambio_entrada is
  'cambio do cToken quando a posicao foi ligada ao radar; base do juro acumulado';;


-- ==========================================================================
-- 20260908072355  salvar_guarda_o_cambio_da_entrada
-- ==========================================================================
-- Acrescenta cambio_entrada ao que salvar_alocacao grava. Sem isto a coluna
-- existiria e nunca receberia valor -- e o juro da Kamino nao teria base.
create or replace function public.salvar_alocacao(linhas jsonb)
returns integer
language plpgsql
security invoker
as $$
declare
  quantas integer;
  tinha   integer;
begin
  select count(*) into tinha from public.alocacao where user_id = auth.uid();

  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos)
    select
      auth.uid(),
      tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid());

    delete from public.carteira_backup
    where user_id = auth.uid()
      and id not in (
        select id from public.carteira_backup
        where user_id = auth.uid() order by quando desc limit 30
      );
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    l->>'fatia',
    nullif(l->>'caixa', ''),
    nullif(l->>'token', ''),
    (nullif(l->>'quantidade', ''))::numeric,
    (nullif(l->>'valor', ''))::numeric,
    nullif(l->>'moeda', ''),
    nullif(l->>'pool_id', ''),
    l->>'onde',
    nullif(l->>'posicao', ''),
    (nullif(l->>'valor_entrada', ''))::numeric,
    (nullif(l->>'data_entrada', ''))::date,
    (nullif(l->>'cambio_entrada', ''))::numeric,
    nullif(l->>'mint', ''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem', ''))::integer, 0),
    (nullif(l->>'alvo', ''))::numeric
  from jsonb_array_elements(coalesce(linhas, '[]'::jsonb)) as l
  where coalesce(l->>'fatia', '') <> '';

  get diagnostics quantas = row_count;
  return quantas;
end;
$$;

-- E restaurar_backup tambem, senao voltar atras perderia o cambio.
create or replace function public.restaurar_backup(qual uuid)
returns integer
language plpgsql
security invoker
as $$
declare
  copia   public.carteira_backup;
  quantas integer;
  tinha   integer;
begin
  select * into copia from public.carteira_backup where id = qual and user_id = auth.uid();
  if copia.id is null then raise exception 'não achei essa cópia'; end if;

  select count(*) into tinha from public.alocacao where user_id = auth.uid();
  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos)
    select auth.uid(), tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid());
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(), l->>'fatia', nullif(l->>'caixa',''), nullif(l->>'token',''),
    (nullif(l->>'quantidade',''))::numeric, (nullif(l->>'valor',''))::numeric,
    nullif(l->>'moeda',''), nullif(l->>'pool_id',''), l->>'onde',
    nullif(l->>'posicao',''), (nullif(l->>'valor_entrada',''))::numeric,
    (nullif(l->>'data_entrada',''))::date, (nullif(l->>'cambio_entrada',''))::numeric,
    nullif(l->>'mint',''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem',''))::integer, 0),
    (nullif(l->>'alvo',''))::numeric
  from jsonb_array_elements(copia.linhas) as l
  where coalesce(l->>'fatia','') <> '';

  get diagnostics quantas = row_count;

  if copia.alvos is not null and jsonb_array_length(copia.alvos) > 0 then
    delete from public.alvo_caixa where user_id = auth.uid();
    insert into public.alvo_caixa (user_id, caixa, pct)
    select auth.uid(), a->>'caixa', (a->>'pct')::numeric
    from jsonb_array_elements(copia.alvos) as a
    where coalesce(a->>'caixa','') <> '';
  end if;

  return quantas;
end;
$$;;


-- ==========================================================================
-- 20260908074301  historico_das_posicoes_para_o_vigia
-- ==========================================================================
-- O que o vigia viu, cada vez que olhou.
--
-- Serve pra duas coisas, e a segunda e a que o Rayakuza pediu:
--
-- 1. Saber se MUDOU. Sem o estado anterior, "saiu da faixa" viraria uma
--    mensagem por rodada enquanto ela estivesse fora -- e bot que repete e bot
--    que se aprende a ignorar.
--
-- 2. Contar as TRAVESSIAS. "Se esta oscilando entrando e saindo do range" so
--    da pra responder olhando o histórico. Cada travessia troca a composicao da
--    posicao: por cima ela vende, por baixo ela compra.
--
-- Fica no Supabase e nao no D1 porque endereco de posicao diz o que ele tem, e
-- o D1 serve uma pagina publica.
create table if not exists public.posicao_historico (
  id       bigserial primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  posicao  text not null,
  estado   text not null,
  preco    numeric,
  valor    numeric,
  quando   timestamptz not null default now()
);

create index if not exists historico_por_posicao
  on public.posicao_historico (user_id, posicao, quando desc);

alter table public.posicao_historico enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'posicao_historico' and policyname = 'historico_ler') then
    create policy historico_ler on public.posicao_historico for select using (auth.uid() = user_id);
  end if;
end $$;

-- Limpa o que passou de uma semana: o vigia so olha 24 horas pra tras, e
-- historico velho aqui e peso sem uso.
create or replace function public.limpar_historico_velho()
returns integer
language sql
security definer
as $$
  with fora as (
    delete from public.posicao_historico
    where quando < now() - interval '7 days'
    returning 1
  )
  select coalesce(count(*), 0)::integer from fora;
$$;;


-- ==========================================================================
-- 20260908080655  chave_estavel_da_linha
-- ==========================================================================
-- A CHAVE ESTÁVEL DE UMA LINHA.
--
-- `salvar_alocacao` apaga tudo e reinsere — é o que torna o salvamento uma
-- transação só, e foi assim que ele parou de perder lançamentos. O preço disso
-- é que o `id` de cada linha é NOVO a cada salvamento.
--
-- Então nada que precise durar pode se pendurar no `id`. O histórico de
-- aportes some no primeiro salvamento se eu fizer isso — e seria a mesma perda
-- de dados de novo, só que mais difícil de ver, porque some devagar.
--
-- A `chave` é gerada uma vez, viaja no jsonb do salvamento, e volta igual. Ela
-- sobrevive a renomear a linha, a reordenar, e ao delete+insert.

alter table public.alocacao add column if not exists chave text;

update public.alocacao set chave = gen_random_uuid()::text where chave is null;

alter table public.alocacao alter column chave set default gen_random_uuid()::text;
alter table public.alocacao alter column chave set not null;

create unique index if not exists alocacao_chave_por_dono
  on public.alocacao (user_id, chave);
;


-- ==========================================================================
-- 20260908080711  tabela_de_movimento
-- ==========================================================================
-- O QUE ENTROU, O QUE SAIU, E O QUE FOI COLHIDO.
--
-- Pedido dele: "vamos fazer, é importante isso também, tanto de pôr quando de
-- retirar né, ou coletar yield pendente".
--
-- Os três são movimentos, e os três mexem na conta de um jeito diferente:
--
--   aporte    → dinheiro ENTRANDO. Sobe o custo. Sem isso, pôr mais US$ 100
--               numa pool aparece como US$ 100 de lucro.
--
--   saque     → dinheiro SAINDO por decisão dele. Desce o custo. Sem isso,
--               tirar metade da posição aparece como prejuízo de metade.
--
--   colheita  → recolher a taxa que a pool já rendeu. NÃO mexe no custo: é
--               lucro que saiu do pendente e virou dinheiro na mão. Sem isso,
--               colher zera o "rendeu X em taxas" da tela e o ganho SOME —
--               o momento em que ele realiza o lucro é o momento em que a
--               ferramenta diz que ele não teve nenhum.
--
-- Amarrado na `chave` da linha, nunca no `id`: veja a migração anterior.

create table if not exists public.movimento (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave     text not null,
  tipo      text not null check (tipo in ('aporte', 'saque', 'colheita')),

  -- Sempre positivo. Quem diz a direção é o `tipo`, e não o sinal: número
  -- negativo guardado numa coluna que às vezes é positiva é a origem de
  -- metade dos erros de sinal que existem.
  valor     numeric not null check (valor > 0),
  moeda     text not null default 'USD' check (moeda in ('USD', 'BRL')),

  -- Convertido no dia em que foi lançado, e congelado aqui. O câmbio de hoje
  -- não pode reescrever quanto ele aportou em março.
  valor_usd numeric,

  quando    date not null default current_date,
  nota      text,
  criado_em timestamptz not null default now()
);

create index if not exists movimento_por_linha
  on public.movimento (user_id, chave, quando desc);

alter table public.movimento enable row level security;

drop policy if exists movimento_do_dono on public.movimento;
create policy movimento_do_dono on public.movimento
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
;


-- ==========================================================================
-- 20260908080746  salvar_e_restaurar_com_chave
-- ==========================================================================
alter table public.carteira_backup add column if not exists movimentos jsonb;

-- O SALVAMENTO PASSA A CARREGAR A CHAVE.
--
-- Se vier vazia (linha nova, ou versão velha do app aberta em outro aparelho),
-- o banco gera uma. Chave nula seria linha sem histórico, calada.
create or replace function public.salvar_alocacao(linhas jsonb)
returns integer language plpgsql as $function$
declare
  quantas integer;
  tinha   integer;
begin
  select count(*) into tinha from public.alocacao where user_id = auth.uid();

  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos, movimentos)
    select
      auth.uid(),
      tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid()),
      (select coalesce(jsonb_agg(to_jsonb(m) - 'user_id'), '[]'::jsonb)
         from public.movimento m where m.user_id = auth.uid());

    delete from public.carteira_backup
    where user_id = auth.uid()
      and id not in (
        select id from public.carteira_backup
        where user_id = auth.uid() order by quando desc limit 30
      );
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, chave, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    coalesce(nullif(l->>'chave', ''), gen_random_uuid()::text),
    l->>'fatia',
    nullif(l->>'caixa', ''),
    nullif(l->>'token', ''),
    (nullif(l->>'quantidade', ''))::numeric,
    (nullif(l->>'valor', ''))::numeric,
    nullif(l->>'moeda', ''),
    nullif(l->>'pool_id', ''),
    l->>'onde',
    nullif(l->>'posicao', ''),
    (nullif(l->>'valor_entrada', ''))::numeric,
    (nullif(l->>'data_entrada', ''))::date,
    (nullif(l->>'cambio_entrada', ''))::numeric,
    nullif(l->>'mint', ''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem', ''))::integer, 0),
    (nullif(l->>'alvo', ''))::numeric
  from jsonb_array_elements(coalesce(linhas, '[]'::jsonb)) as l
  where coalesce(l->>'fatia', '') <> '';

  get diagnostics quantas = row_count;
  return quantas;
end;
$function$;


-- RESTAURAR TRAZ A CHAVE DE VOLTA — e por isso os movimentos se reencontram
-- com as linhas sozinhos, sem eu precisar mexer neles.
--
-- E os movimentos do retrato voltam POR JUNÇÃO, nunca por substituição: só
-- entra o que não está mais lá. Restaurar uma cópia de ontem não pode apagar
-- um aporte que ele lançou hoje — "não pode ser excluído mais" foi o pedido,
-- e uma restauração que apaga é uma exclusão com outro nome.
create or replace function public.restaurar_backup(qual uuid)
returns integer language plpgsql as $function$
declare
  copia   public.carteira_backup;
  quantas integer;
  tinha   integer;
begin
  select * into copia from public.carteira_backup where id = qual and user_id = auth.uid();
  if copia.id is null then raise exception 'não achei essa cópia'; end if;

  select count(*) into tinha from public.alocacao where user_id = auth.uid();
  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos, movimentos)
    select auth.uid(), tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid()),
      (select coalesce(jsonb_agg(to_jsonb(m) - 'user_id'), '[]'::jsonb)
         from public.movimento m where m.user_id = auth.uid());
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, chave, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    coalesce(nullif(l->>'chave', ''), gen_random_uuid()::text),
    l->>'fatia', nullif(l->>'caixa',''), nullif(l->>'token',''),
    (nullif(l->>'quantidade',''))::numeric, (nullif(l->>'valor',''))::numeric,
    nullif(l->>'moeda',''), nullif(l->>'pool_id',''), l->>'onde',
    nullif(l->>'posicao',''), (nullif(l->>'valor_entrada',''))::numeric,
    (nullif(l->>'data_entrada',''))::date, (nullif(l->>'cambio_entrada',''))::numeric,
    nullif(l->>'mint',''),
    coalesce((l->>'segue_carteira')::boolean, true),
    coalesce((nullif(l->>'ordem',''))::integer, 0),
    (nullif(l->>'alvo',''))::numeric
  from jsonb_array_elements(copia.linhas) as l
  where coalesce(l->>'fatia','') <> '';

  get diagnostics quantas = row_count;

  if copia.alvos is not null and jsonb_array_length(copia.alvos) > 0 then
    delete from public.alvo_caixa where user_id = auth.uid();
    insert into public.alvo_caixa (user_id, caixa, pct)
    select auth.uid(), a->>'caixa', (a->>'pct')::numeric
    from jsonb_array_elements(copia.alvos) as a
    where coalesce(a->>'caixa','') <> '';
  end if;

  if copia.movimentos is not null then
    insert into public.movimento (id, user_id, chave, tipo, valor, moeda, valor_usd, quando, nota, criado_em)
    select (m->>'id')::uuid, auth.uid(), m->>'chave', m->>'tipo',
           (m->>'valor')::numeric, coalesce(nullif(m->>'moeda',''), 'USD'),
           (nullif(m->>'valor_usd',''))::numeric,
           (m->>'quando')::date, nullif(m->>'nota',''),
           coalesce((nullif(m->>'criado_em',''))::timestamptz, now())
    from jsonb_array_elements(copia.movimentos) as m
    where coalesce(m->>'id','') <> ''
    on conflict (id) do nothing;
  end if;

  return quantas;
end;
$function$;
;


-- ==========================================================================
-- 20260908080805  registrar_movimento_e_semear
-- ==========================================================================
-- Lançar um movimento. Uma linha por vez, de propósito: cada aporte é um ato
-- separado, e um erro num não pode derrubar os outros.
create or replace function public.registrar_movimento(dados jsonb)
returns uuid language plpgsql security invoker as $function$
declare
  novo uuid;
  dono uuid := auth.uid();
begin
  if dono is null then raise exception 'precisa estar logado'; end if;

  -- A linha tem que ser dele. Sem esta conferência, uma chave adivinhada
  -- penduraria movimento na carteira de outra pessoa.
  if not exists (select 1 from public.alocacao
                 where user_id = dono and chave = dados->>'chave') then
    raise exception 'não achei essa linha na sua carteira';
  end if;

  insert into public.movimento (user_id, chave, tipo, valor, moeda, valor_usd, quando, nota)
  values (
    dono,
    dados->>'chave',
    dados->>'tipo',
    (dados->>'valor')::numeric,
    coalesce(nullif(dados->>'moeda', ''), 'USD'),
    (nullif(dados->>'valor_usd', ''))::numeric,
    coalesce((nullif(dados->>'quando', ''))::date, current_date),
    nullif(dados->>'nota', '')
  )
  returning id into novo;

  return novo;
end;
$function$;


create or replace function public.apagar_movimento(qual uuid)
returns integer language plpgsql security invoker as $function$
declare apagou integer;
begin
  delete from public.movimento where id = qual and user_id = auth.uid();
  get diagnostics apagou = row_count;
  return apagou;
end;
$function$;


-- O QUE JÁ ESTAVA LANÇADO VIRA O PRIMEIRO APORTE.
--
-- `valor_entrada` era um número digitado uma vez, em dólar. Ele é exatamente
-- isso: o primeiro aporte. Trazê-lo pra cá faz o cálculo ter UM caminho só, em
-- vez de um caminho pra quem tem movimento e outro pra quem não tem — e dois
-- caminhos que deveriam concordar é o tipo de coisa que discorda no pior dia.
insert into public.movimento (user_id, chave, tipo, valor, moeda, valor_usd, quando, nota)
select a.user_id, a.chave, 'aporte', a.valor_entrada, 'USD', a.valor_entrada,
       coalesce(a.data_entrada, current_date), 'entrada original'
from public.alocacao a
where a.valor_entrada > 0
  and not exists (select 1 from public.movimento m
                  where m.user_id = a.user_id and m.chave = a.chave);
;


-- ==========================================================================
-- 20260908082050  chave_sobrevive_a_app_velho
-- ==========================================================================
-- O BURACO: um app numa versão anterior salva a carteira, não manda `chave`, e
-- a função gerava uma nova pra cada linha. Todas as linhas ficavam com
-- etiqueta nova e o histórico de aportes, pendurado na etiqueta velha, ficava
-- órfão. Sem erro, sem aviso — o número de "quanto você pôs" simplesmente
-- voltava a zero.
--
-- Aconteceu de verdade em 08/09/2026, minutos depois de eu criar a coluna.
-- O celular dele tem service worker guardando a casca: a versão velha continua
-- viva no aparelho até a barrinha de abertura trocar. Ou seja, isto ia
-- acontecer de novo toda vez que ele salvasse de um aparelho não atualizado.
--
-- O CONSERTO: quando a chave não vier, não inventar — PROCURAR. A linha é
-- reconhecida pelo nome dentro da caixinha, e recebe de volta a chave que já
-- era dela. O número na ponta (a posição entre linhas de mesmo nome e mesma
-- caixinha) existe pra o caso de haver duas "BTC" na mesma caixinha: a
-- primeira casa com a primeira, a segunda com a segunda.
--
-- Só se não achar nada é que nasce chave nova — que é o caso da linha nova
-- de verdade.

create or replace function public.salvar_alocacao(linhas jsonb)
returns integer language plpgsql as $function$
declare
  quantas integer;
  tinha   integer;
  antigas jsonb;
begin
  select count(*) into tinha from public.alocacao where user_id = auth.uid();

  -- O MAPA DAS CHAVES DE HOJE, tirado ANTES do delete. Depois dele não há mais
  -- de onde recuperar, e recuperar é justamente o ponto.
  select coalesce(jsonb_object_agg(k, ch), '{}'::jsonb) into antigas from (
    select lower(coalesce(fatia, '')) || '|' || lower(coalesce(caixa, '')) || '|' ||
           row_number() over (
             partition by lower(coalesce(fatia, '')), lower(coalesce(caixa, ''))
             order by ordem, chave
           )::text as k,
           chave as ch
    from public.alocacao where user_id = auth.uid()
  ) t;

  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos, movimentos)
    select
      auth.uid(), tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid()),
      (select coalesce(jsonb_agg(to_jsonb(m) - 'user_id'), '[]'::jsonb)
         from public.movimento m where m.user_id = auth.uid());

    delete from public.carteira_backup
    where user_id = auth.uid()
      and id not in (
        select id from public.carteira_backup
        where user_id = auth.uid() order by quando desc limit 30
      );
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, chave, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    coalesce(
      nullif(e.l->>'chave', ''),
      antigas ->> (lower(coalesce(e.l->>'fatia', '')) || '|' ||
                   lower(coalesce(nullif(e.l->>'caixa', ''), '')) || '|' || e.n::text),
      gen_random_uuid()::text
    ),
    e.l->>'fatia',
    nullif(e.l->>'caixa', ''),
    nullif(e.l->>'token', ''),
    (nullif(e.l->>'quantidade', ''))::numeric,
    (nullif(e.l->>'valor', ''))::numeric,
    nullif(e.l->>'moeda', ''),
    nullif(e.l->>'pool_id', ''),
    e.l->>'onde',
    nullif(e.l->>'posicao', ''),
    (nullif(e.l->>'valor_entrada', ''))::numeric,
    (nullif(e.l->>'data_entrada', ''))::date,
    (nullif(e.l->>'cambio_entrada', ''))::numeric,
    nullif(e.l->>'mint', ''),
    coalesce((e.l->>'segue_carteira')::boolean, true),
    coalesce((nullif(e.l->>'ordem', ''))::integer, 0),
    (nullif(e.l->>'alvo', ''))::numeric
  from (
    select l,
      row_number() over (
        partition by lower(coalesce(l->>'fatia', '')), lower(coalesce(nullif(l->>'caixa', ''), ''))
        order by coalesce((nullif(l->>'ordem', ''))::integer, 0), ord
      ) as n
    from jsonb_array_elements(coalesce(linhas, '[]'::jsonb)) with ordinality as t(l, ord)
    where coalesce(l->>'fatia', '') <> ''
  ) e;

  get diagnostics quantas = row_count;
  return quantas;
end;
$function$;
;


-- ==========================================================================
-- 20260908082148  restaurar_tambem_preserva_a_chave
-- ==========================================================================
-- As cópias feitas ANTES de a coluna `chave` existir não têm chave dentro.
-- Restaurar uma delas regeneraria todas as etiquetas e órfãos todos os
-- lançamentos — o mesmo buraco de salvar_alocacao, na outra porta.
create or replace function public.restaurar_backup(qual uuid)
returns integer language plpgsql as $function$
declare
  copia   public.carteira_backup;
  quantas integer;
  tinha   integer;
  antigas jsonb;
begin
  select * into copia from public.carteira_backup where id = qual and user_id = auth.uid();
  if copia.id is null then raise exception 'não achei essa cópia'; end if;

  select coalesce(jsonb_object_agg(k, ch), '{}'::jsonb) into antigas from (
    select lower(coalesce(fatia, '')) || '|' || lower(coalesce(caixa, '')) || '|' ||
           row_number() over (
             partition by lower(coalesce(fatia, '')), lower(coalesce(caixa, ''))
             order by ordem, chave
           )::text as k,
           chave as ch
    from public.alocacao where user_id = auth.uid()
  ) t;

  select count(*) into tinha from public.alocacao where user_id = auth.uid();
  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos, movimentos)
    select auth.uid(), tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid()),
      (select coalesce(jsonb_agg(to_jsonb(m) - 'user_id'), '[]'::jsonb)
         from public.movimento m where m.user_id = auth.uid());
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, chave, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    coalesce(
      nullif(e.l->>'chave', ''),
      antigas ->> (lower(coalesce(e.l->>'fatia', '')) || '|' ||
                   lower(coalesce(nullif(e.l->>'caixa', ''), '')) || '|' || e.n::text),
      gen_random_uuid()::text
    ),
    e.l->>'fatia', nullif(e.l->>'caixa',''), nullif(e.l->>'token',''),
    (nullif(e.l->>'quantidade',''))::numeric, (nullif(e.l->>'valor',''))::numeric,
    nullif(e.l->>'moeda',''), nullif(e.l->>'pool_id',''), e.l->>'onde',
    nullif(e.l->>'posicao',''), (nullif(e.l->>'valor_entrada',''))::numeric,
    (nullif(e.l->>'data_entrada',''))::date, (nullif(e.l->>'cambio_entrada',''))::numeric,
    nullif(e.l->>'mint',''),
    coalesce((e.l->>'segue_carteira')::boolean, true),
    coalesce((nullif(e.l->>'ordem',''))::integer, 0),
    (nullif(e.l->>'alvo',''))::numeric
  from (
    select l,
      row_number() over (
        partition by lower(coalesce(l->>'fatia', '')), lower(coalesce(nullif(l->>'caixa', ''), ''))
        order by coalesce((nullif(l->>'ordem', ''))::integer, 0), ord
      ) as n
    from jsonb_array_elements(copia.linhas) with ordinality as t(l, ord)
    where coalesce(l->>'fatia','') <> ''
  ) e;

  get diagnostics quantas = row_count;

  if copia.alvos is not null and jsonb_array_length(copia.alvos) > 0 then
    delete from public.alvo_caixa where user_id = auth.uid();
    insert into public.alvo_caixa (user_id, caixa, pct)
    select auth.uid(), a->>'caixa', (a->>'pct')::numeric
    from jsonb_array_elements(copia.alvos) as a
    where coalesce(a->>'caixa','') <> '';
  end if;

  if copia.movimentos is not null then
    insert into public.movimento (id, user_id, chave, tipo, valor, moeda, valor_usd, quando, nota, criado_em)
    select (m->>'id')::uuid, auth.uid(), m->>'chave', m->>'tipo',
           (m->>'valor')::numeric, coalesce(nullif(m->>'moeda',''), 'USD'),
           (nullif(m->>'valor_usd',''))::numeric,
           (m->>'quando')::date, nullif(m->>'nota',''),
           coalesce((nullif(m->>'criado_em',''))::timestamptz, now())
    from jsonb_array_elements(copia.movimentos) as m
    where coalesce(m->>'id','') <> ''
    on conflict (id) do nothing;
  end if;

  return quantas;
end;
$function$;
;


-- ==========================================================================
-- 20260908142311  travar_linha
-- ==========================================================================
-- O CADEADO DE UMA LINHA, gravado na hora.
--
-- Ele: "os que eu digito você não consegue ler, e os da carteira pode
-- atualizar automático os lançamentos ou retiradas".
--
-- O cadeado é o que separa os dois. Linha travada é linha que ele digita e eu
-- nunca encosto; linha solta é linha que eu releio da carteira dele.
--
-- POR QUE GRAVA SOZINHO, e não junto com o Salvar da carteira: é um controle
-- de segurança. Se ele trava o BTC e fecha o app sem salvar, o cadeado some e
-- a próxima leitura zera a linha — o cadeado teria falhado justamente no caso
-- em que existe. Controle que protege dado não pode depender de outro passo.
create or replace function public.travar_linha(qual text, segue boolean)
returns boolean language plpgsql security invoker as $function$
declare mexeu integer;
begin
  update public.alocacao
     set segue_carteira = coalesce(segue, false), atualizado_em = now()
   where user_id = auth.uid() and chave = qual;
  get diagnostics mexeu = row_count;
  if mexeu = 0 then raise exception 'não achei essa linha na sua carteira'; end if;
  return coalesce(segue, false);
end;
$function$;
;


-- ==========================================================================
-- 20260908154057  tamanho_visto_da_posicao
-- ==========================================================================
-- O ÚLTIMO TAMANHO QUE EU VI DE CADA POSIÇÃO.
--
-- Em 09/09/2026 ele depositou US$ 10 na Orca e US$ 10 na Kamino direto na
-- plataforma. O valor das linhas atualizou sozinho — mas o "quanto você pôs"
-- não, e descobrir quanto tinha entrado deu uma investigação de quatro
-- transações decodificadas à mão.
--
-- Não precisava. A liquidez de uma posição da Orca e a quantidade de cTokens
-- da Kamino SÓ mudam quando ele deposita ou saca: preço andando não mexe,
-- taxa acumulando não mexe, juro não mexe (na Kamino quem sobe é o câmbio).
--
-- Então guardar o tamanho da última olhada é o suficiente pra perceber que ele
-- mexeu, e pra calcular quanto — e aí a linha pergunta, em vez de ele precisar
-- lembrar.
--
-- Fica em tabela separada de propósito. `salvar_alocacao` apaga e reinsere as
-- linhas a cada salvamento; isto aqui não pode ir junto nessa dança.

create table if not exists public.posicao_tamanho (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave     text not null,
  tamanho   text not null,
  valor     numeric,
  visto_em  timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table public.posicao_tamanho enable row level security;

drop policy if exists tamanho_do_dono on public.posicao_tamanho;
create policy tamanho_do_dono on public.posicao_tamanho
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anota o tamanho de agora. Chamada quando ele confirma o aporte, quando manda
-- ignorar, e na primeira vez que vejo a posição — que é o caso em que não há
-- com o que comparar e portanto nada a perguntar.
create or replace function public.anotar_tamanho(qual text, novo text, quanto numeric default null)
returns boolean language plpgsql security invoker as $function$
begin
  if auth.uid() is null then raise exception 'precisa estar logado'; end if;
  insert into public.posicao_tamanho (user_id, chave, tamanho, valor, visto_em)
  values (auth.uid(), qual, novo, quanto, now())
  on conflict (user_id, chave)
  do update set tamanho = excluded.tamanho, valor = excluded.valor, visto_em = now();
  return true;
end;
$function$;
;


-- ==========================================================================
-- 20260908181121  composicao_do_movimento
-- ==========================================================================
-- A COMPOSIÇÃO EM TOKENS DE CADA MOVIMENTO — o que faltava pra medir IL.
--
-- Ele perguntou: "a carteira já salva quanto eu tinha quando entrei na pool?
-- aí sim quando fechar a posição faz sentido, porque vou saber quanto rendeu ou
-- se tive IL e perdi".
--
-- Salvava metade. Guardava quanto ele pôs EM DÓLAR, e com isso dá pra dizer
-- quanto rendeu. Mas impermanent loss não é "quanto entrou versus quanto saiu":
-- é quanto a posição vale hoje CONTRA quanto valeriam os mesmos tokens se ele
-- tivesse só segurado. Pra essa conta é preciso saber QUAIS tokens entraram e
-- QUANTOS — e o valor em dólar não diz isso.
--
-- Foi um buraco no meu desenho: eu pensei "quanto ele pôs" em dinheiro, e o
-- método do curso pensa em composição.
--
-- `preco` é o preço do par no momento (quantos B por A). Guardado junto porque
-- é o que permite conferir a conta depois, e porque preço de hoje não serve pra
-- reconstruir o de ontem.

alter table public.movimento add column if not exists qtd_a numeric;
alter table public.movimento add column if not exists qtd_b numeric;
alter table public.movimento add column if not exists simbolo_a text;
alter table public.movimento add column if not exists simbolo_b text;
alter table public.movimento add column if not exists preco numeric;

-- A função de registrar passa a aceitar a composição, sem deixar de aceitar
-- lançamento sem ela: dinheiro que ele digita à mão não tem composição, e
-- exigir uma inventaria número.
create or replace function public.registrar_movimento(dados jsonb)
returns uuid language plpgsql security invoker as $function$
declare
  novo uuid;
  dono uuid := auth.uid();
begin
  if dono is null then raise exception 'precisa estar logado'; end if;

  if not exists (select 1 from public.alocacao
                 where user_id = dono and chave = dados->>'chave') then
    raise exception 'não achei essa linha na sua carteira';
  end if;

  insert into public.movimento
    (user_id, chave, tipo, valor, moeda, valor_usd, quando, nota,
     qtd_a, qtd_b, simbolo_a, simbolo_b, preco)
  values (
    dono,
    dados->>'chave',
    dados->>'tipo',
    (dados->>'valor')::numeric,
    coalesce(nullif(dados->>'moeda', ''), 'USD'),
    (nullif(dados->>'valor_usd', ''))::numeric,
    coalesce((nullif(dados->>'quando', ''))::date, current_date),
    nullif(dados->>'nota', ''),
    (nullif(dados->>'qtd_a', ''))::numeric,
    (nullif(dados->>'qtd_b', ''))::numeric,
    nullif(dados->>'simbolo_a', ''),
    nullif(dados->>'simbolo_b', ''),
    (nullif(dados->>'preco', ''))::numeric
  )
  returning id into novo;

  return novo;
end;
$function$;
;


-- ==========================================================================
-- 20260908181846  linha_fechada
-- ==========================================================================
-- QUANDO A POSIÇÃO FOI FECHADA — e por que isso precisa ficar guardado.
--
-- Ao fechar uma posição da Orca, a conta da posição some da blockchain: o NFT
-- é queimado e o aluguel volta pra carteira. Se eu dependesse da cadeia pra
-- saber que ela existiu, a linha ficaria eternamente em "lendo a posição na
-- Solana…" e o resultado final — o "quanto fiquei quando saí" que ele pediu —
-- se perderia junto.
--
-- Então a data do fechamento fica AQUI, e a conta final se faz só com os
-- lançamentos: o que ele pôs, o que tirou, o que colheu, e a que preço. Depois
-- de fechada, a linha não pergunta mais nada à rede.

alter table public.alocacao add column if not exists fechada_em date;

create or replace function public.fechar_linha(qual text, quando date default null)
returns date language plpgsql security invoker as $function$
declare mexeu integer; dia date;
begin
  dia := coalesce(quando, current_date);
  update public.alocacao
     set fechada_em = dia, atualizado_em = now()
   where user_id = auth.uid() and chave = qual;
  get diagnostics mexeu = row_count;
  if mexeu = 0 then raise exception 'não achei essa linha na sua carteira'; end if;
  return dia;
end;
$function$;

-- Reabrir, porque fechar sem querer não pode ser sem volta.
create or replace function public.reabrir_linha(qual text)
returns boolean language plpgsql security invoker as $function$
declare mexeu integer;
begin
  update public.alocacao set fechada_em = null, atualizado_em = now()
   where user_id = auth.uid() and chave = qual;
  get diagnostics mexeu = row_count;
  if mexeu = 0 then raise exception 'não achei essa linha na sua carteira'; end if;
  return true;
end;
$function$;
;


-- ==========================================================================
-- 20260908185341  memoria_do_vigia_de_token
-- ==========================================================================
-- A MEMÓRIA DO VIGIA DOS TOKENS.
--
-- Ele pediu dois avisos: token novo na carteira, e o token cruzando o preço
-- médio de compra. Os dois precisam de memória, e pelo mesmo motivo: sem ela o
-- bot repetiria a mesma frase em toda rodada, três vezes por dia, e ele
-- pararia de ler — inclusive os avisos das pools, que são os urgentes.

-- O que o vigia já viu chegar. Na primeira olhada ele anota a carteira inteira
-- e cala: senão o primeiro dia seria uma mensagem por token que ele sempre teve.
create table if not exists public.token_visto (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mint     text not null,
  simbolo  text,
  visto_em timestamptz not null default now(),
  primary key (user_id, mint)
);

-- De que lado do preço médio cada linha estava na última olhada. É a
-- comparação com isto que diz se houve travessia.
create table if not exists public.token_lado (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave    text not null,
  lado     text not null check (lado in ('acima', 'abaixo')),
  medio    numeric,
  preco    numeric,
  visto_em timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table public.token_visto enable row level security;
alter table public.token_lado  enable row level security;

drop policy if exists visto_do_dono on public.token_visto;
create policy visto_do_dono on public.token_visto
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists lado_do_dono on public.token_lado;
create policy lado_do_dono on public.token_lado
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
;


-- ==========================================================================
-- 20260908192018  copias_guardam_uma_por_dia
-- ==========================================================================
-- AS CÓPIAS DE SEGURANÇA PASSAM A GUARDAR UMA POR DIA, além das recentes.
--
-- Ele perguntou "mas vão guardar apenas 30 transações?" e, separando as duas
-- coisas, o problema apareceu: os LANÇAMENTOS não têm limite nenhum e nunca
-- somem. As CÓPIAS eram 30, e ele já tinha gastado 24 — todas de hoje.
--
-- Mais seis salvamentos e a cópia da manhã sumiria: justamente a que tem o
-- estado antes de as chaves serem regeneradas e os aportes ficarem órfãos. A
-- rede que o protegeu do meu erro seria destruída pelo uso normal do app numa
-- tarde de trabalho.
--
-- Agora sobrevivem duas famílias:
--
--   as 30 MAIS RECENTES        pra desfazer o que ele acabou de fazer
--   a ÚLTIMA DE CADA DIA       dos últimos 180 dias, pra voltar a uma semana
--                              atrás mesmo depois de uma tarde de edição
--
-- São no máximo umas 200 linhas de alguns KB cada. Barato para o que evita.

create or replace function public.salvar_alocacao(linhas jsonb)
returns integer language plpgsql as $function$
declare
  quantas integer;
  tinha   integer;
  antigas jsonb;
begin
  select count(*) into tinha from public.alocacao where user_id = auth.uid();

  select coalesce(jsonb_object_agg(k, ch), '{}'::jsonb) into antigas from (
    select lower(coalesce(fatia, '')) || '|' || lower(coalesce(caixa, '')) || '|' ||
           row_number() over (
             partition by lower(coalesce(fatia, '')), lower(coalesce(caixa, ''))
             order by ordem, chave
           )::text as k,
           chave as ch
    from public.alocacao where user_id = auth.uid()
  ) t;

  if tinha > 0 then
    insert into public.carteira_backup (user_id, quantas, linhas, alvos, movimentos)
    select
      auth.uid(), tinha,
      (select coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'user_id' - 'atualizado_em'), '[]'::jsonb)
         from public.alocacao a where a.user_id = auth.uid()),
      (select coalesce(jsonb_agg(jsonb_build_object('caixa', c.caixa, 'pct', c.pct)), '[]'::jsonb)
         from public.alvo_caixa c where c.user_id = auth.uid()),
      (select coalesce(jsonb_agg(to_jsonb(m) - 'user_id'), '[]'::jsonb)
         from public.movimento m where m.user_id = auth.uid());

    -- A LIMPEZA, agora com as duas redes.
    delete from public.carteira_backup b
    where b.user_id = auth.uid()
      -- não é uma das 30 mais recentes
      and b.id not in (
        select id from public.carteira_backup
        where user_id = auth.uid() order by quando desc limit 30
      )
      -- nem é a última cópia do seu dia, nos últimos 180 dias
      and b.id not in (
        select distinct on (dia) id from (
          select id, quando, (quando at time zone 'UTC')::date as dia
          from public.carteira_backup
          where user_id = auth.uid()
            and quando > now() - interval '180 days'
        ) t order by dia, quando desc
      );
  end if;

  delete from public.alocacao where user_id = auth.uid();

  insert into public.alocacao
    (user_id, chave, fechada_em, fatia, caixa, token, quantidade, valor, moeda, pool_id, onde,
     posicao, valor_entrada, data_entrada, cambio_entrada, mint, segue_carteira, ordem, alvo)
  select
    auth.uid(),
    coalesce(
      nullif(e.l->>'chave', ''),
      antigas ->> (lower(coalesce(e.l->>'fatia', '')) || '|' ||
                   lower(coalesce(nullif(e.l->>'caixa', ''), '')) || '|' || e.n::text),
      gen_random_uuid()::text
    ),
    (nullif(e.l->>'fechada_em', ''))::date,
    e.l->>'fatia',
    nullif(e.l->>'caixa', ''),
    nullif(e.l->>'token', ''),
    (nullif(e.l->>'quantidade', ''))::numeric,
    (nullif(e.l->>'valor', ''))::numeric,
    nullif(e.l->>'moeda', ''),
    nullif(e.l->>'pool_id', ''),
    e.l->>'onde',
    nullif(e.l->>'posicao', ''),
    (nullif(e.l->>'valor_entrada', ''))::numeric,
    (nullif(e.l->>'data_entrada', ''))::date,
    (nullif(e.l->>'cambio_entrada', ''))::numeric,
    nullif(e.l->>'mint', ''),
    coalesce((e.l->>'segue_carteira')::boolean, true),
    coalesce((nullif(e.l->>'ordem', ''))::integer, 0),
    (nullif(e.l->>'alvo', ''))::numeric
  from (
    select l,
      row_number() over (
        partition by lower(coalesce(l->>'fatia', '')), lower(coalesce(nullif(l->>'caixa', ''), ''))
        order by coalesce((nullif(l->>'ordem', ''))::integer, 0), ord
      ) as n
    from jsonb_array_elements(coalesce(linhas, '[]'::jsonb)) with ordinality as t(l, ord)
    where coalesce(l->>'fatia', '') <> ''
  ) e;

  get diagnostics quantas = row_count;
  return quantas;
end;
$function$;
;


-- ==========================================================================
-- 20260908203917  retrato_com_ordem_estavel
-- ==========================================================================
-- Toda lista do retrato sai ORDENADA.
--
-- Sem "order by", o Postgres pode devolver as mesmas linhas em ordem diferente
-- entre duas chamadas. Isso muda o texto do JSON sem nada ter mudado de fato —
-- e as duas cópias (Drive e Telegram) decidem se gravam comparando a impressão
-- digital do texto. Resultado visto em 08/09/2026: o painel regravou no Drive
-- às 17:37 uma carteira idêntica à das 17:32.
--
-- Duas listas estavam sem ordem: ultimo_tamanho_das_posicoes e carteira_solana.

create or replace function public.retrato_da_carteira(dono uuid default null)
returns jsonb language plpgsql security invoker as $function$
declare
  quem uuid;
  fora jsonb;
begin
  quem := coalesce(auth.uid(), dono);
  if quem is null then raise exception 'preciso saber de quem é a carteira'; end if;
  if auth.uid() is not null and dono is not null and dono <> auth.uid() then
    raise exception 'essa carteira não é sua';
  end if;

  select jsonb_build_object(
    'radar_defi_backup', jsonb_build_object(
      'gerado_em', now(),
      'o_que_e', 'Cópia da carteira do Radar DeFi. Com ela dá pra reconstruir tudo, mesmo que a conta na Supabase suma. NÃO contém senha, chave privada nem frase-semente.',
      'como_ler', 'linhas = as caixinhas do B.A.R.C.A.; lancamentos = aportes, saques e colheitas (é daqui que saem o preço médio e o IL); alvos = as porcentagens que você definiu.'
    ),
    'conferencia', jsonb_build_object(
      'linhas', (select count(*) from public.alocacao where user_id = quem),
      'lancamentos', (select count(*) from public.movimento where user_id = quem),
      'aportado_usd', (select coalesce(sum(valor_usd), 0) from public.movimento
                        where user_id = quem and tipo = 'aporte'),
      'sacado_usd', (select coalesce(sum(valor_usd), 0) from public.movimento
                      where user_id = quem and tipo = 'saque'),
      'colhido_usd', (select coalesce(sum(valor_usd), 0) from public.movimento
                       where user_id = quem and tipo = 'colheita')
    ),
    'alvos', (select coalesce(jsonb_agg(jsonb_build_object('caixa', caixa, 'pct', pct) order by caixa), '[]'::jsonb)
                from public.alvo_caixa where user_id = quem),
    'carteira_solana', (select coalesce(jsonb_agg(endereco order by endereco), '[]'::jsonb)
                          from public.carteira_solana where user_id = quem),
    'linhas', (select coalesce(jsonb_agg(to_jsonb(a) - 'user_id' - 'id' order by a.caixa, a.ordem), '[]'::jsonb)
                 from public.alocacao a where a.user_id = quem),
    'lancamentos', (select coalesce(jsonb_agg(to_jsonb(m) - 'user_id' order by m.quando, m.criado_em), '[]'::jsonb)
                      from public.movimento m where m.user_id = quem),
    'ultimo_tamanho_das_posicoes', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.chave), '[]'::jsonb)
                                      from public.posicao_tamanho t where t.user_id = quem),
    'historico_do_vigia', (select coalesce(jsonb_agg(to_jsonb(h) - 'user_id' - 'id' order by h.quando), '[]'::jsonb)
                             from public.posicao_historico h where h.user_id = quem)
  ) into fora;

  return fora;
end;
$function$;
;
