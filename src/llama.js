/* O que o DefiLlama nos conta.
 *
 * A API é aberta e sem chave, mas nem todo endereço serve pra mesma coisa, e
 * escolher errado dá número errado com cara de certo. O que aprendemos testando:
 *
 *  - `/v2/chains` é o número OFICIAL de cada rede. É a única fonte que vale.
 *  - Somar o TVL dos protocolos por rede NÃO reproduz esse número: o DefiLlama
 *    tira da conta da rede categorias inteiras (ponte, corretora, a própria
 *    chain) e desconta staking líquido. Em 02/09/2026 tentamos refazer a soma e
 *    o Bitcoin deu 636% a mais que o oficial. Não refaça essa conta — leia o
 *    número pronto.
 *  - `/lite/protocols2` é a lista de protocolos com o valor de ontem, de 7 e de
 *    30 dias atrás já embutido. É 6,7 MB, mas evita ter que guardar histórico
 *    de protocolo. A lista cheia (`/protocols`) tem 8 MB e traz só a variação
 *    em porcentagem — pior, porque porcentagem sozinha esconde o tamanho.
 */

const CHAINS = "https://api.llama.fi/v2/chains";
const PROTOCOLOS = "https://api.llama.fi/lite/protocols2";
const STABLES = "https://stablecoins.llama.fi/stablecoinchains";
const PRECOS = "https://coins.llama.fi/chart";
const YIELDS = "https://yields.llama.fi/pools";
const TAXAS = "https://api.llama.fi/overview/fees";
const HISTORICO_REDE = "https://api.llama.fi/v2/historicalChainTvl";
/* A rede vai no CAMINHO, nunca em `?chain=`.
 *
 * `stablecoincharts/all?chain=Base` responde 200, devolve um JSON bonito e
 * ignora o parâmetro: vem o total do mundo inteiro ($310B) pra qualquer rede
 * que se peça. Em 02/09/2026 isso fez o primeiro ensaio dizer que TODA rede
 * havia perdido 95% das stablecoins na semana — o erro não parecia erro, parecia
 * um mercado em pânico. Só ficou óbvio porque estava errado igual em todas. */
const HISTORICO_STABLES = "https://stablecoins.llama.fi/stablecoincharts";

async function pegar(url, ondeDoi) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${ondeDoi} respondeu ${r.status}`);
  return r.json();
}

/* O TVL oficial de cada rede, agora. ~50 KB, uma chamada só. */
export async function redesAgora() {
  const bruto = await pegar(CHAINS, "a lista de redes");
  const redes = new Map();
  for (const c of bruto) {
    if (!c?.name) continue;
    redes.set(c.name, {
      rede: c.name,
      tvl: Number(c.tvl) || 0,
      moeda: c.tokenSymbol || null,
    });
  }
  return redes;
}

/* Quanto de stablecoin circula em cada rede, agora.
 *
 * Esta é a medida honesta de "entrou dinheiro". O TVL sobe sozinho quando o
 * token da rede valoriza, sem ninguém ter depositado nada — o mesmo ETH parado
 * vale mais em dólar e o gráfico sobe. Stablecoin não faz isso: se a quantidade
 * de USDC numa rede cresceu, alguém de fato mandou dinheiro pra lá. */
export async function stablesAgora() {
  const bruto = await pegar(STABLES, "as stablecoins por rede");
  const porRede = new Map();
  for (const c of bruto) {
    if (!c?.name) continue;
    // O campo é um objeto por tipo de lastro (peggedUSD, peggedEUR, ...);
    // somamos tudo, já convertido pra dólar pela própria API.
    const total = Object.values(c.totalCirculatingUSD || {})
      .reduce((s, v) => s + (Number(v) || 0), 0);
    porRede.set(c.name, total);
  }
  return porRede;
}

/* Os protocolos que importam, com o passado já embutido.
 *
 * `corte` existe porque a lista tem quase 8 mil protocolos e a esmagadora
 * maioria é poeira: 1300 têm mais de 1 milhão parado. Carregar todos custaria
 * memória e daria ruído sem informação. */
export async function protocolosAgora(corte = 5e6) {
  const bruto = await pegar(PROTOCOLOS, "a lista de protocolos");
  const lista = [];
  for (const p of bruto.protocols || []) {
    const tvl = Number(p.tvl) || 0;
    if (tvl < corte) continue;
    const redes = Array.isArray(p.chains) ? p.chains : [];
    lista.push({
      nome: p.name,
      categoria: p.category || null,
      redes,
      rede: redes.length === 1 ? redes[0] : "Multi-Chain",
      tvl,
      tvl1d: Number(p.tvlPrevDay) || 0,
      tvl7d: Number(p.tvlPrevWeek) || 0,
      tvl30d: Number(p.tvlPrevMonth) || 0,
      // por rede, pra saber quem puxou o crescimento de uma rede específica
      porRede: p.chainTvls || {},
    });
  }
  return lista;
}

/* As piscinas de rendimento e as taxas — as fontes das medidas de qualidade.
 *
 * São grandes: 11,7 MB e 4,2 MB. Por isso cada uma é buscada e REDUZIDA aqui
 * dentro, uma de cada vez, em vez de devolvidas cruas — o que a função entrega
 * é o resumo, e o pesado pode ser recolhido pela memória logo em seguida. Num
 * worker com 128 MB de teto isso é a diferença entre funcionar e morrer.
 *
 * Só a rodada diária chama isto. As medidas mudam devagar; buscá-las a cada
 * abertura do painel seria gastar por nada. */
export async function piscinasDeRendimento() {
  const bruto = await pegar(YIELDS, "as piscinas de rendimento");
  const lista = bruto?.data || bruto || [];
  return lista.map((p) => ({
    id: p.pool,
    chain: p.chain,
    projeto: p.project,
    simbolo: p.symbol,
    meta: p.poolMeta || null,
    tvlUsd: Number(p.tvlUsd) || 0,
    apy: Number(p.apy) || 0,
    apyBase: Number(p.apyBase) || 0,
    apyReward: Number(p.apyReward) || 0,
    /* `count` é quantos dias o DefiLlama acompanha esta piscina. Serve de idade,
     * e é o que responde "onde estão montando pool agora": piscina nova com
     * muito dinheiro dentro é obra recente, não coisa consolidada. */
    idade: Number(p.count) || null,
    estavel: !!p.stablecoin,
    riscoIl: p.ilRisk || null,
    exposicao: p.exposure || null,
    apyVar7d: p.apyPct7D == null ? null : Number(p.apyPct7D),
    apyMedio30d: p.apyMean30d == null ? null : Number(p.apyMean30d),
    // Quanto o rendimento balança. Alto = o número de hoje não se repete amanhã.
    balanco: p.sigma == null ? null : Number(p.sigma),
    /* Os DOIS volumes.
     *
     * O de 24h faltava, e a falta não dava erro: `volume1d` chegava `undefined`
     * em `tendenciaDeVolume`, que devolvia educadamente "não negocia" — então
     * TODA pool aparecia sem leitura de volume, e o único indicador do radar que
     * olha pra frente ficou morto desde o dia em que foi escrito.
     *
     * Os testes passavam porque testavam a função pura com valores na mão. Nunca
     * exercitaram o caminho do dado de verdade. É o buraco clássico: unidade
     * verde, fiação solta. */
    volume1d: p.volumeUsd1d == null ? null : Number(p.volumeUsd1d),
    volume7d: p.volumeUsd7d == null ? null : Number(p.volumeUsd7d),
    /* Os endereços dos tokens que compõem a pool.
     *
     * São eles que permitem pedir o preço de cada perna sem depender de mapear
     * símbolo na mão — "USDC" existe em vinte redes com vinte endereços, e o
     * símbolo sozinho não diz qual. Existem em 45% das pools; onde faltam, a
     * correlação fica sem medida, que é diferente de reprovada. */
    tokens: Array.isArray(p.underlyingTokens) ? p.underlyingTokens : [],
  })).filter((p) => p.chain && p.tvlUsd > 0);
}

export async function taxasDosProtocolos() {
  const bruto = await pegar(
    `${TAXAS}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
    "as taxas dos protocolos",
  );
  return (bruto?.protocols || []).map((p) => ({
    name: p.name,
    chains: p.chains || [],
    breakdown24h: p.breakdown24h || null,
    breakdown30d: p.breakdown30d || null,
  }));
}

/* Histórico de preço de vários tokens, em lote.
 *
 * O endereço aceita mais de um token por chamada, misturando `rede:endereço` e
 * `coingecko:id` — o que é o que torna a correlação viável dentro do orçamento
 * de 50 chamadas do plano grátis. Mas o lote tem teto: em 06/09/2026, 12 tokens
 * passaram e 15 devolveram 400. Uso 10, com folga, porque o limite não está
 * documentado e pode apertar sem aviso.
 *
 * `maximoDeLotes` existe pra proteger o orçamento: se um dia passarem 400 pools
 * nos portões, isto não pode virar 80 chamadas e derrubar a rodada inteira. O
 * que não couber fica sem correlação — e sem correlação é "não sei", que o
 * resto do código já sabe tratar. */
export async function historicoDePrecos(ids, { dias = 60, maximoDeLotes = 24 } = {}) {
  const unicos = [...new Set((ids || []).filter(Boolean))];
  const series = new Map();

  /* O teto é de PONTOS, não de tokens — e essa distinção custou uma tarde.
   *
   * Medido em 06/09/2026: 10 tokens × 50 dias (500 pontos) passa; 10 × 60 (600)
   * devolve 400; 6 × 60 (360) passa. O limite está entre 500 e 600 pontos por
   * chamada.
   *
   * Meu padrão era 10 tokens × 60 dias = 600 pontos, ou seja, TODA chamada
   * falhava — e falhava com 400, que o código engolia como "lote ruim" e seguia.
   * O sintoma foi correlação vazia em 101 pares, sem um único erro no log.
   *
   * Por isso o tamanho do lote agora se calcula a partir da janela pedida, em
   * vez de ser um número fixo que envelhece mal quando alguém muda `dias`. */
  const ORCAMENTO_DE_PONTOS = 450;
  const porLote = Math.max(1, Math.floor(ORCAMENTO_DE_PONTOS / Math.max(1, dias)));
  const lotes = Math.min(Math.ceil(unicos.length / porLote), maximoDeLotes);

  for (let i = 0; i < lotes; i++) {
    const fatia = unicos.slice(i * porLote, (i + 1) * porLote);
    if (!fatia.length) break;
    try {
      const r = await fetch(
        `${PRECOS}/${fatia.map(encodeURIComponent).join(",")}?period=1d&span=${dias}`,
        { headers: { accept: "application/json" } },
      );
      if (!r.ok) continue; // um lote ruim não pode derrubar os outros
      const dados = await r.json();
      for (const [id, moeda] of Object.entries(dados?.coins || {})) {
        const precos = (moeda?.prices || [])
          .map((p) => Number(p?.price))
          .filter((v) => Number.isFinite(v) && v > 0);
        if (precos.length >= 20) series.set(id, precos);
      }
    } catch {
      // idem: silêncio aqui vira "sem correlação", não vira erro na rodada
    }
  }
  return { series, lotesUsados: lotes, pedidos: unicos.length };
}

/* O histórico de uma rede, direto da fonte. Usado só pelo semeador — o radar
 * no ar não chama isto, porque seriam centenas de chamadas e o plano grátis da
 * Cloudflare corta em 50 por execução. */
export async function historicoDaRede(rede) {
  const bruto = await pegar(
    `${HISTORICO_REDE}/${encodeURIComponent(rede)}`,
    `o histórico de ${rede}`,
  );
  return bruto.map((p) => ({ dia: diaDoCarimbo(p.date), tvl: Number(p.tvl) || 0 }));
}

/* O mesmo, pras stablecoins de uma rede. */
export async function historicoStablesDaRede(rede) {
  const bruto = await pegar(
    `${HISTORICO_STABLES}/${encodeURIComponent(rede)}`,
    `o histórico de stablecoins de ${rede}`,
  );
  if (!Array.isArray(bruto)) return [];
  return bruto.map((p) => ({
    dia: diaDoCarimbo(p.date),
    stables: Object.values(p.totalCirculatingUSD || {})
      .reduce((s, v) => s + (Number(v) || 0), 0),
  }));
}

/* As duas séries que o ciclo precisa. Duas chamadas, uma vez por dia.
 *
 * Ficam com nome próprio de propósito. `historicoStablesDaRede("all")` devolve
 * o total do mundo e está certo — mas é a MESMA chamada que, com `?chain=`,
 * mente calada (veja o aviso em HISTORICO_STABLES lá em cima). Um nome que diz
 * "global" impede que alguém veja "all" ali e conclua que dá pra trocar por uma
 * rede qualquer. */
export async function estoqueGlobalDeStables() {
  const serie = await historicoStablesDaRede("all");
  return serie.map((p) => p.stables).filter((v) => Number.isFinite(v) && v > 0);
}

/* O preço do Bitcoin, longo o bastante pra tudo o que se mede sobre ele.
 *
 * ERA 260, VIROU 400, e cada número tem um dono:
 *
 *   200  a média de 200 dias precisa de 200 pontos
 *   260  + folga pra `idadeDoRegime` saber há quantos dias o preço virou
 *   400  + a FAIXA DE BULL MARKET, que é semanal: 21 semanas são 147 dias, e
 *        a EMA precisa de muito mais que isso pra a semente sumir. Com 400
 *        dias são 57 semanas, e o resto do histórico deixa de pesar (medido:
 *        cortar 5 semanas mexe 0,02% na EMA de hoje).
 *
 * E TAMBÉM: a cruz de ouro só é visível onde as DUAS médias existem. Com 400
 * dias dá pra enxergar 200 dias de cruzamento pra trás; com 260, só 60.
 *
 * CUSTO: zero chamadas novas. O teto de `historicoDePrecos` é ~450 pontos por
 * pedido, e um token só cabe inteiro nele. Continua sendo UM pedido — só que
 * agora ele volta cheio em vez de pela metade. */
export async function precoDoBitcoin(dias = 400) {
  const { series } = await historicoDePrecos(["coingecko:bitcoin"], { dias });
  return series.get("coingecko:bitcoin") || [];
}

/* OS INDICADORES DE CICLO DO CURSO — MVRV, Z-Score, Puell e VDD.
 *
 * Fonte: bitcoin-data.com. Aberta, sem chave, com histórico diário. É a única
 * que achei com estes quatro de graça — o curso ensina a olhá-los no Glassnode
 * e no CheckOnChain, que não abrem API sem assinatura.
 *
 * O LIMITE É DE 10 CHAMADAS POR HORA, POR IP, e ele governa este arquivo
 * inteiro. Descobri levando 429 quatro vezes seguidas, e a mensagem da fonte é
 * explícita: RATE_LIMIT_HOUR_EXCEEDED. Três consequências, todas no código:
 *
 * 1. UMA CHAMADA POR INDICADOR, UMA VEZ POR DIA. São 4 das 240 permitidas —
 *    folga grande, e só na rodada da manhã, que é onde o ciclo é medido.
 *
 * 2. SEQUENCIAL, COM PAUSA. Em paralelo, as quatro contam como um pico e a
 *    fonte recusa. Um segundo e meio entre elas é o preço de não ser um
 *    vizinho ruim numa API de graça.
 *
 * 3. E O MAIS IMPORTANTE: 429 NÃO APAGA NÚMERO BOM. O Worker sai por IPs
 *    compartilhados da Cloudflare, então o limite pode estourar por causa de
 *    outra pessoa, num dia em que a nossa leitura estava perfeitamente
 *    disponível. Quem chama guarda a leitura anterior e a reaproveita, com a
 *    DATA dela à mostra — é a mesma regra da "última leitura boa" das posições:
 *    número velho declarado velho é melhor que número ausente.
 *
 * Cada indicador falha sozinho. Se o Puell não responder, os outros três ainda
 * contam: o veredito é por maioria e sabe trabalhar com três. */
const CASA_DOS_INDICADORES = "https://bitcoin-data.com/v1";

const INDICADORES = [
  { chave: "mvrv", caminho: "/mvrv/last", campo: "mvrv" },
  { chave: "zscore", caminho: "/mvrv-zscore/last", campo: "mvrvZscore" },
  { chave: "puell", caminho: "/puell-multiple/last", campo: "puellMultiple" },
  { chave: "vdd", caminho: "/vdd-multiple/last", campo: "vddMultiple" },
];

export async function indicadoresDoCiclo() {
  const fora = { valores: {}, falhas: [] };
  const respirar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  for (let i = 0; i < INDICADORES.length; i++) {
    const ind = INDICADORES[i];
    if (i) await respirar(1500);
    try {
      const r = await fetch(CASA_DOS_INDICADORES + ind.caminho, {
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        /* O 429 vai nomeado, e não como "HTTP 429" cru: é a falha que mais vai
           acontecer, e quem ler o /saude precisa entender sem procurar. */
        fora.falhas.push(ind.chave + ": " +
          (r.status === 429 ? "limite de chamadas da fonte" : "HTTP " + r.status));
        continue;
      }
      const d = await r.json();
      const v = Number(d?.[ind.campo]);
      if (!Number.isFinite(v)) { fora.falhas.push(ind.chave + ": sem o campo " + ind.campo); continue; }
      fora.valores[ind.chave] = { valor: v, dia: d?.d || null };
    } catch (e) {
      fora.falhas.push(ind.chave + ": " + String(e?.message || e).slice(0, 60));
    }
  }

  return fora;
}

/* Junta o que chegou agora com o que já se sabia.
 *
 * O NOVO GANHA SEMPRE que existe; o velho fica quando o novo não veio, com a
 * data dele intacta. Nunca o contrário — e a regra é escrita aqui, num lugar
 * só, porque "qual dos dois vale" é exatamente o tipo de decisão que, espalhada,
 * acaba respondida de dois jeitos diferentes no mesmo programa. */
export function juntarIndicadores(novos, guardados) {
  const fora = {};
  const chaves = new Set([
    ...Object.keys(novos?.valores || {}),
    ...Object.keys(guardados || {}),
  ]);
  for (const k of chaves) {
    const n = novos?.valores?.[k];
    const g = guardados?.[k];
    if (n && Number.isFinite(n.valor)) fora[k] = { ...n, deAntes: false };
    else if (g && Number.isFinite(g.valor)) fora[k] = { ...g, deAntes: true };
  }
  return fora;
}

/* A razão ETH/BTC, que é o primeiro degrau da "fórmula mágica ALTS/BTC" do
 * Portal 2. Devolve a de hoje e a de 30 dias atrás, que é o par que a leitura
 * precisa — a razão de um dia só não diz nada sobre uma estação. */
export async function razaoEthBtc(dias = 35) {
  const { series } = await historicoDePrecos(
    ["coingecko:ethereum", "coingecko:bitcoin"], { dias },
  );
  const eth = series.get("coingecko:ethereum") || [];
  const btc = series.get("coingecko:bitcoin") || [];
  const n = Math.min(eth.length, btc.length);
  if (n < 31) return null;

  const razao = (i) => {
    const a = eth[eth.length - n + i], b = btc[btc.length - n + i];
    return (a > 0 && b > 0) ? a / b : null;
  };
  const hoje = razao(n - 1);
  const antes = razao(Math.max(0, n - 31));
  if (!(hoje > 0) || !(antes > 0)) return null;
  return { hoje, antes };
}

/* Os carimbos do DefiLlama vêm em segundos, às vezes como texto. O dia é o
 * dia UTC do carimbo: as fotos deles fecham à meia-noite UTC, então forçar
 * Brasília aqui só embaralharia a série. */
export function diaDoCarimbo(carimbo) {
  return new Date(Number(carimbo) * 1000).toISOString().slice(0, 10);
}
