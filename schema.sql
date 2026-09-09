-- O banco do radar. Roda uma vez, na criação:
--   npx wrangler d1 execute radar-defi --remote --file=schema.sql

-- Uma fotografia por dia, por rede. É daqui que sai todo crescimento de rede:
-- o DefiLlama entrega o número de hoje, o de ontem/semana passada é o que
-- guardamos aqui. Por isso `semear.js` existe — sem ele o radar levaria uma
-- semana pra ter o que dizer.
CREATE TABLE IF NOT EXISTS fotos (
  dia      TEXT NOT NULL,          -- 'AAAA-MM-DD', sempre em Brasília
  rede     TEXT NOT NULL,
  tvl      REAL,                   -- dinheiro parado na rede, em dólares
  stables  REAL,                   -- stablecoins circulando ali (capital de verdade)
  PRIMARY KEY (dia, rede)
);
CREATE INDEX IF NOT EXISTS fotos_por_rede ON fotos (rede, dia DESC);
CREATE INDEX IF NOT EXISTS fotos_por_dia  ON fotos (dia);

-- Protocolos não precisam de histórico nosso: a própria API entrega o valor de
-- ontem, de 7 e de 30 dias atrás junto com o de hoje. Guardamos mesmo assim,
-- porque é o que permite responder "o que mudou desde a semana passada" no
-- painel sem depender de a API estar no ar naquele segundo.
CREATE TABLE IF NOT EXISTS fotos_protocolo (
  dia        TEXT NOT NULL,
  protocolo  TEXT NOT NULL,
  rede       TEXT,                 -- 'Multi-Chain' quando vive em várias
  categoria  TEXT,
  tvl        REAL,
  tvl_1d     REAL,
  tvl_7d     REAL,
  tvl_30d    REAL,
  PRIMARY KEY (dia, protocolo)
);
CREATE INDEX IF NOT EXISTS protos_por_dia ON fotos_protocolo (dia, tvl DESC);

-- Avisos já enviados. Serve pra duas coisas, igual à tabela `avisos` do vigia:
-- o mesmo achado não toca o celular duas vezes, e dá pra reler depois o que o
-- radar viu, mesmo semanas atrás.
CREATE TABLE IF NOT EXISTS avisos (
  chave  TEXT PRIMARY KEY,         -- ex.: 'entrada:Base:2026-09-02'
  tipo   TEXT NOT NULL,
  alvo   TEXT NOT NULL,            -- a rede ou o protocolo
  forca  REAL,                     -- o tamanho do movimento, pra saber se piorou
  texto  TEXT,
  quando TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS avisos_por_alvo ON avisos (alvo, tipo, quando DESC);

-- Redes que o Rayakuza mandou seguir de perto (/seguir Base). Essas furam os
-- limiares: qualquer mexida nelas ele quer saber, mesmo pequena.
CREATE TABLE IF NOT EXISTS seguidas (
  rede  TEXT PRIMARY KEY,
  desde TEXT NOT NULL
);

-- Coisas que o bot precisa lembrar entre uma rodada e outra — hoje só o chat do
-- Telegram, descoberto na primeira mensagem que ele recebe.
CREATE TABLE IF NOT EXISTS ajustes (
  nome  TEXT PRIMARY KEY,
  valor TEXT
);

-- As três medidas de qualidade, uma linha por rede por dia.
--
-- Guardadas e não calculadas na hora porque as fontes são pesadas: a lista de
-- piscinas de rendimento tem 11,7 MB e a de taxas 4,2 MB. Buscar isso a cada
-- abertura do painel gastaria memória e tempo à toa — as medidas mudam devagar,
-- uma vez por dia basta.
CREATE TABLE IF NOT EXISTS qualidade (
  dia            TEXT NOT NULL,
  rede           TEXT NOT NULL,
  alugado        REAL,      -- % do rendimento pago em token emitido; NULL = não sei
  piscinas       INTEGER,
  taxas_24h      REAL,      -- quanto a rede arrecadou no dia, em dólares
  taxa_por_milhao REAL,     -- o mesmo, por milhão parado: compara redes de tamanhos diferentes
  concentracao   REAL,      -- % do dinheiro no maior protocolo
  maior_protocolo TEXT,
  PRIMARY KEY (dia, rede)
);
CREATE INDEX IF NOT EXISTS qualidade_por_dia ON qualidade (dia);

-- As piscinas de rendimento: onde o dinheiro está sendo posto pra render, e
-- quem está pagando por isso.
--
-- Guardamos só as acima de $1M — abaixo disso são milhares, e piscina pequena
-- mexe muito por natureza. Só o dia mais recente importa pro que o Rayakuza
-- pergunta ("quais estão pagando agora", "onde estão montando"), então dias
-- velhos são apagados: a idade vem do próprio DefiLlama, não da nossa série.
CREATE TABLE IF NOT EXISTS piscinas (
  dia        TEXT NOT NULL,
  id         TEXT NOT NULL,
  rede       TEXT,
  projeto    TEXT,
  simbolo    TEXT,
  meta       TEXT,
  tvl        REAL,
  apy        REAL,
  apy_base   REAL,     -- rendimento que vem de uso real
  apy_reward REAL,     -- rendimento pago em token emitido
  idade_dias INTEGER,  -- há quantos dias a piscina existe
  estavel    INTEGER,  -- 1 = par de stablecoins
  risco_il   TEXT,
  exposicao  TEXT,
  apy_var7d  REAL,
  balanco    REAL,     -- o quanto o rendimento oscila
  volume7d   REAL,
  PRIMARY KEY (dia, id)
);
CREATE INDEX IF NOT EXISTS piscinas_por_rede ON piscinas (dia, rede, tvl DESC);
CREATE INDEX IF NOT EXISTS piscinas_novas ON piscinas (dia, idade_dias);

-- A série diária de cada pool: o que ela REALMENTE pagou, dia a dia.
--
-- É a tabela que sustenta a medida central do radar (o "chão" — o rendimento
-- superado em 9 de cada 10 dias). Sem ela só existe o APY anunciado, que em
-- 05/09/2026 mediu 74% numa pool cujo chão era 7,9%.
--
-- Semeada uma vez por `semear-pools.js` (60 dias de uma vez, buscando o gráfico
-- de cada pool). Depois disso ela se mantém sozinha: cada rodada diária já traz
-- o APY de hoje de todas as pools, e basta acrescentar esse ponto. Rebuscar os
-- 60 dias todo dia levaria 429 da API e estouraria o limite de chamadas do
-- worker — e não traria nada que a série já não tenha.
CREATE TABLE IF NOT EXISTS historico_piscina (
  id         TEXT NOT NULL,
  dia        TEXT NOT NULL,
  apy        REAL,
  apy_base   REAL,
  apy_reward REAL,
  tvl        REAL,
  PRIMARY KEY (id, dia)
);
CREATE INDEX IF NOT EXISTS hist_piscina_por_dia ON historico_piscina (dia);

-- O resumo calculado de cada pool: chão, oscilação, abismo, classe.
--
-- Guardado em vez de recalculado a cada abertura porque a conta é sobre 60
-- pontos × centenas de pools, e o resultado só muda uma vez por dia.
CREATE TABLE IF NOT EXISTS medida_piscina (
  dia        TEXT NOT NULL,
  id         TEXT NOT NULL,
  rede       TEXT,
  projeto    TEXT,
  simbolo    TEXT,
  meta       TEXT,      -- a faixa de taxa da pool ('0.05%'), como o DefiLlama entrega
  tvl        REAL,
  cartaz     REAL,      -- o APY que ela anuncia hoje
  chao       REAL,      -- o que superou em 9 de cada 10 dias
  realizado  REAL,      -- a média dos últimos 30
  pior       REAL,
  oscilacao  REAL,
  abismo     REAL,      -- cartaz - chão: quanto do anunciado não dá pra contar
  tendencia  REAL,      -- última semana contra as anteriores
  emitido    REAL,      -- % do rendimento pago em token emitido
  idade_dias INTEGER,
  dias_serie INTEGER,
  estavel    INTEGER,
  risco_il   TEXT,
  classe     TEXT,      -- firme | alugada | loteria | nova | sem-dado
  porque     TEXT,      -- a frase pronta, escrita com os números dessa pool

  -- A trajetória: o mesmo rendimento visto em quatro distâncias, que é o que
  -- diz se a pool está começando a subir ou já murchando.
  apy_base   REAL,      -- o rendimento que vem de USO; é dele que sai o multiplicador
  apy_ontem  REAL,
  apy_semana REAL,
  apy_mes    REAL,
  trajetoria TEXT,      -- acelerando | murchando | estável | null

  volume_1d      REAL,
  volume_7d      REAL,
  volume_razao   REAL,  -- o dia contra a média da semana, em %
  volume_direcao TEXT,  -- subindo | caindo | estável

  -- O par, separado: quais tokens, que risco, e por quê.
  par_texto   TEXT,
  par_risco   TEXT,
  par_explica TEXT,

  -- O método do Defiverso, medido e guardado.
  giro       REAL,      -- volume7d / TVL: a REGRA DO 3 do Módulo 8
  giro_nivel TEXT,
  ficha      TEXT,      -- JSON: as perguntas do estudo de caso do Módulo 4
  zera_em    REAL,      -- o descolamento em que a perda impermanente come o APY

  -- Os portões binários, com o MOTIVO. Guardar só o veredito faria a pool
  -- sumir da tela sem explicação, e lista curta sem explicação tem a mesma cara
  -- de mercado parado.
  portao_passa   INTEGER,   -- 1 passa, 0 barrada, NULL = medida antes dos portões existirem
  portao_motivos TEXT,      -- JSON
  portao_avisos  TEXT,      -- JSON
  nota_nivel     TEXT,
  nota_selo      TEXT,

  -- Só o COEFICIENTE de correlação do par volátil. Nível, veredito e leitura
  -- saem dele por função pura na hora de ler: guardar os quatro faria toda
  -- mudança de limiar exigir remedir tudo em vez de só publicar.
  correlacao REAL,

  PRIMARY KEY (dia, id)
);
CREATE INDEX IF NOT EXISTS medida_por_classe ON medida_piscina (dia, classe, chao DESC);
CREATE INDEX IF NOT EXISTS medida_por_rede ON medida_piscina (dia, rede, chao DESC);

-- As pools em que o Rayakuza JÁ ESTÁ.
--
-- O resto do banco guarda o mercado; esta tabela guarda a POSIÇÃO dele. A
-- diferença que justifica a tabela é a foto da entrada: daqui a dois meses não
-- existe como saber qual era o chão no dia em que ele entrou se ninguém anotou
-- naquele dia. Mercado se remede; passado não.
--
-- Uma linha por pool. Sem quantidade e sem valor investido de propósito: o
-- radar não precisa saber quanto ele pôs pra dizer o que mudou, e guardar
-- patrimônio num banco que serve uma página pública seria criar um risco que
-- não paga nada em troca.
CREATE TABLE IF NOT EXISTS minhas_pools (
  id     TEXT PRIMARY KEY,     -- o id da pool no DefiLlama
  rede   TEXT,
  projeto TEXT,
  simbolo TEXT,
  desde  TEXT NOT NULL,        -- 'AAAA-MM-DD', o dia em que ele marcou

  -- A foto do dia da entrada. É contra ela que tudo se compara depois.
  chao_entrada       REAL,
  cartaz_entrada     REAL,
  apy_base_entrada   REAL,
  incentivo_entrada  REAL,     -- % do rendimento vindo de token impresso
  tvl_entrada        REAL,
  correlacao_entrada REAL,
  classe_entrada     TEXT,
  passava_entrada    INTEGER   -- passava nos portões do método naquele dia?
);

-- ---------------------------------------------------------------------------
-- O símbolo de um token e o id dele na fonte de preço.
--
-- Só um cache do que a busca já descobriu: qual "ZEC" é o Zcash. A maioria dos
-- símbolos nem chega aqui — está na tabela curada em src/precos.js, conferida
-- uma a uma contra a API. Esta tabela guarda o resto.
--
-- Repare no que NÃO tem: quantidade, valor, dono. Quanto ele tem de cada token
-- mora no Supabase, atrás de login. Este banco serve uma página pública.
CREATE TABLE IF NOT EXISTS token_id (
  simbolo   TEXT PRIMARY KEY,   -- 'ZEC', em maiúscula
  id        TEXT NOT NULL,      -- 'zcash', o id do CoinGecko
  nome      TEXT,
  achado_em TEXT
);
