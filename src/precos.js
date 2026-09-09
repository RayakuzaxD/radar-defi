/* O preço ao vivo dos tokens que ele tem na carteira.
 *
 * Pedido dele em 08/09/2026:
 *
 *   "se eu tiver com tokens eth, sol, zec etc... eu especifico, lá mostra o
 *    total, mas aí preciso de algum banco de dados que puxe o valor em tempo
 *    real desses tokens pra ele ir atualizando automaticamente"
 *
 * A fonte é a mesma que o radar já usa pro preço do Bitcoin: coins.llama.fi.
 * Sem chave, sem cadastro, e — o que mais importa — é a MESMA fonte que
 * alimenta o ciclo. Duas fontes de preço na mesma tela é como ter dois
 * relógios: nunca se sabe qual está certo.
 *
 * O caminho de um símbolo até um preço tem três degraus, do mais barato ao mais
 * caro, e só desce quando precisa:
 *
 *   1. A tabela curada aqui embaixo, conferida uma a uma contra a API.
 *   2. O que já foi descoberto antes, guardado no D1.
 *   3. A busca no CoinGecko — uma vez por símbolo novo, na vida.
 *
 * Nada aqui guarda quanto ele tem. Só QUAIS símbolos existem e quanto vale um
 * de cada. O D1 serve uma página pública; patrimônio não entra nele.
 */

const PRECO_AGORA = "https://coins.llama.fi/prices/current";
const VARIACAO = "https://coins.llama.fi/percentage";
const BUSCA = "https://api.coingecko.com/api/v3/search";

/* Os símbolos que ele tem chance real de digitar, com o id do CoinGecko.
 *
 * Cada linha desta tabela foi CONFERIDA contra a API (node conferir-tokens.js):
 * pedi o preço de cada id e confirmei que o símbolo que voltou é o mesmo da
 * chave. Um id errado aqui não daria erro — daria um preço plausível do token
 * errado, que é o pior jeito de errar dinheiro.
 *
 * A conferência de 08/09/2026 pegou três, e vale registrar porque explica por
 * que ela existe: MATIC (matic-network) não tem mais preço, virou POL; TON
 * (the-open-network) devolve GRAM; FXS (frax-share) devolve FRAX. Os três
 * saíram da tabela e caem na busca, que acha o token certo pelo ranking. */
export const IDS = {
  // Base
  BTC: "bitcoin", WBTC: "wrapped-bitcoin", CBBTC: "coinbase-wrapped-btc",
  // Grandes
  ETH: "ethereum", WETH: "weth", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", ADA: "cardano", AVAX: "avalanche-2", DOT: "polkadot",
  TRX: "tron", LTC: "litecoin", DOGE: "dogecoin",
  POL: "polygon-ecosystem-token", ATOM: "cosmos",
  NEAR: "near", ICP: "internet-computer", HBAR: "hedera-hashgraph",
  KAS: "kaspa", FIL: "filecoin", XLM: "stellar", BCH: "bitcoin-cash",
  // Privacidade
  ZEC: "zcash", XMR: "monero", DASH: "dash",
  // DeFi
  LINK: "chainlink", UNI: "uniswap", AAVE: "aave", CRV: "curve-dao-token",
  MKR: "maker", SNX: "havven", COMP: "compound-governance-token",
  PENDLE: "pendle", LDO: "lido-dao", RPL: "rocket-pool", GMX: "gmx",
  ENA: "ethena", ONDO: "ondo-finance", CAKE: "pancakeswap-token",
  SUSHI: "sushi", BAL: "balancer", YFI: "yearn-finance",
  // Camadas 2 e novas redes
  ARB: "arbitrum", OP: "optimism", STRK: "starknet", MNT: "mantle",
  SUI: "sui", APT: "aptos", SEI: "sei-network", TIA: "celestia",
  INJ: "injective-protocol", S: "sonic-3", FTM: "fantom",
  // Solana
  JUP: "jupiter-exchange-solana", RAY: "raydium", JTO: "jito-governance-token",
  PYTH: "pyth-network", JITOSOL: "jito-staked-sol",
  // Dados, IA, infra
  RENDER: "render-token", FET: "fetch-ai", TAO: "bittensor", GRT: "the-graph",
  W: "wormhole", ETHFI: "ether-fi", EIGEN: "eigenlayer",
  // Caixa
  USDT: "tether", USDC: "usd-coin", DAI: "dai", USDE: "ethena-usde",
  FDUSD: "first-digital-usd", BRZ: "brz", PYUSD: "paypal-usd",
  SUSDE: "ethena-staked-usde", USDS: "usds",
};

/* Limpa o que ele digitou. "eth", " Sol ", "$ZEC" viram ETH, SOL, ZEC. */
export function simboloLimpo(texto) {
  return String(texto || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/* Descobre o id de um símbolo que não está na tabela curada.
 *
 * Escolhe pelo RANKING DE MERCADO, não pelo primeiro da lista: buscar "ZEC"
 * devolve o Zcash e também um "ZecFi Capital" de rank 837. Pegar o primeiro
 * daria certo hoje e erraria no dia em que a ordem mudasse. */
export async function buscarId(simbolo, buscar = fetch) {
  const alvo = simboloLimpo(simbolo);
  if (!alvo) return null;
  try {
    const r = await buscar(`${BUSCA}?query=${encodeURIComponent(alvo)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const candidatos = (d?.coins || [])
      .filter((c) => simboloLimpo(c?.symbol) === alvo && c?.id)
      .sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9));
    const achado = candidatos[0];
    return achado ? { id: achado.id, nome: achado.name || alvo } : null;
  } catch {
    return null;
  }
}

/* Os três degraus, na ordem. Devolve um mapa símbolo -> id.
 *
 * `banco` é opcional: sem ele, funciona só com a tabela curada e a busca. Isso
 * mantém a função testável sem D1 — e testável é o que faz alguém conferir. */
export async function idsDosSimbolos(simbolos, banco, buscar = fetch) {
  const limpos = [...new Set((simbolos || []).map(simboloLimpo).filter(Boolean))];
  const mapa = new Map();
  const faltando = [];

  for (const s of limpos) {
    if (IDS[s]) mapa.set(s, IDS[s]);
    else faltando.push(s);
  }
  if (!faltando.length) return mapa;

  if (banco) {
    const marcas = faltando.map(() => "?").join(",");
    const { results } = await banco
      .prepare(`SELECT simbolo, id FROM token_id WHERE simbolo IN (${marcas})`)
      .bind(...faltando).all();
    for (const l of results || []) mapa.set(l.simbolo, l.id);
  }

  const aindaFalta = faltando.filter((s) => !mapa.has(s));
  /* Teto de 5 buscas por chamada. O Worker corta em 50 subrequisições, e uma
   * carteira com 30 símbolos desconhecidos é erro de digitação, não carteira. */
  for (const s of aindaFalta.slice(0, 5)) {
    const achado = await buscarId(s, buscar);
    if (!achado) continue;
    mapa.set(s, achado.id);
    if (banco) {
      try {
        await banco.prepare(
          "INSERT OR REPLACE INTO token_id (simbolo, id, nome, achado_em) VALUES (?, ?, ?, ?)",
        ).bind(s, achado.id, achado.nome, new Date().toISOString().slice(0, 10)).run();
      } catch { /* cache que não grava não pode derrubar o preço */ }
    }
  }
  return mapa;
}

/* Preço e variação de 24h, numa ida só para cada coisa.
 *
 * A variação vem separada porque o endpoint é outro. Se ela falhar, o preço
 * ainda vale: melhor mostrar quanto vale sem dizer quanto mexeu do que não
 * mostrar nada. */
export async function precosAgora(mapaDeIds, buscar = fetch) {
  const ids = [...new Set([...mapaDeIds.values()])];
  if (!ids.length) return { precos: new Map(), quando: null };

  const chaves = ids.map((i) => `coingecko:${i}`);
  const lista = chaves.map(encodeURIComponent).join(",");

  const precos = new Map();
  let quando = null;

  try {
    const r = await buscar(`${PRECO_AGORA}/${lista}`, { headers: { accept: "application/json" } });
    if (r.ok) {
      const d = await r.json();
      for (const [chave, v] of Object.entries(d?.coins || {})) {
        const id = chave.replace(/^coingecko:/, "");
        const preco = Number(v?.price);
        if (!Number.isFinite(preco) || preco <= 0) continue;
        precos.set(id, { preco, simbolo: v?.symbol || null, confianca: Number(v?.confidence) || null });
        if (v?.timestamp) quando = Math.max(quando || 0, Number(v.timestamp));
      }
    }
  } catch { /* sem preço é um estado previsto; a tela diz isso */ }

  try {
    const r = await buscar(`${VARIACAO}/${lista}?period=24h`, { headers: { accept: "application/json" } });
    if (r.ok) {
      const d = await r.json();
      for (const [chave, v] of Object.entries(d?.coins || {})) {
        const id = chave.replace(/^coingecko:/, "");
        const alvo = precos.get(id);
        if (alvo && Number.isFinite(Number(v))) alvo.variacao24h = Number(v);
      }
    }
  } catch { /* idem: preço sem variação continua sendo preço */ }

  return { precos, quando };
}

/* O que a tela recebe: um mapa por SÍMBOLO, que é como ele digitou.
 *
 * Símbolo que não virou preço volta com motivo. Sumir com a linha faria o total
 * mudar sem explicação — e um total que muda sozinho é um total em que não se
 * confia. */
export async function cotarSimbolos(simbolos, banco, buscar = fetch) {
  const mapa = await idsDosSimbolos(simbolos, banco, buscar);
  const { precos, quando } = await precosAgora(mapa, buscar);

  const saida = {};
  for (const s of [...new Set((simbolos || []).map(simboloLimpo).filter(Boolean))]) {
    const id = mapa.get(s);
    if (!id) { saida[s] = { erro: "não achei esse símbolo" }; continue; }
    const p = precos.get(id);
    if (!p) { saida[s] = { erro: "sem preço agora", id }; continue; }
    saida[s] = {
      id,
      preco: p.preco,
      variacao24h: p.variacao24h ?? null,
      confianca: p.confianca,
    };
  }
  return { tokens: saida, quando };
}

/* Nome e preço de tokens da Solana, pelo endereço do token.
 *
 * Existe porque a carteira dele devolve ENDEREÇOS, não símbolos: o USDC na
 * Solana é "EPjFWdd5..." e não "USDC". A mesma fonte que dá o preço dá o
 * símbolo junto, numa ida só — então não preciso de tabela de tradução, que
 * envelheceria a cada token novo que ele comprasse. */
export async function cotarMints(mints, buscar = fetch) {
  const limpos = [...new Set((mints || []).filter(Boolean))];
  if (!limpos.length) return {};
  const fora = {};
  // 60 por vez: a URL tem limite de tamanho, e endereço da Solana é comprido.
  for (let i = 0; i < limpos.length; i += 60) {
    const fatia = limpos.slice(i, i + 60);
    try {
      const r = await buscar(
        `${PRECO_AGORA}/${fatia.map((m) => "solana:" + m).join(",")}`,
        { headers: { accept: "application/json" } },
      );
      if (!r.ok) continue;
      const d = await r.json();
      for (const [chave, v] of Object.entries(d?.coins || {})) {
        const mint = chave.replace(/^solana:/, "");
        const preco = Number(v?.price);
        if (!Number.isFinite(preco)) continue;
        fora[mint] = { preco, simbolo: String(v?.symbol || "").toUpperCase() || null };
      }
    } catch { /* lote ruim não derruba os outros */ }
  }
  return fora;
}

/* O que conta como "mexeu muito" num dia.
 *
 * Não é opinião sobre o token: é o tamanho do movimento. 10% num dia é o que
 * separa oscilação de notícia — abaixo disso o cripto anda sozinho.
 *
 * O radar diz QUE mexeu e QUANTO. Não diz se é bom ou ruim, e não diz o que
 * fazer: quem lê a notícia é ele. */
export const MOVIMENTO = { grande: 10, enorme: 20 };

export function lerMovimento(variacao, lim = MOVIMENTO) {
  const v = Number(variacao);
  if (!Number.isFinite(v)) return null;
  const tamanho = Math.abs(v);
  if (tamanho < lim.grande) return null;
  return {
    variacao: v,
    forca: tamanho >= lim.enorme ? "enorme" : "grande",
    sentido: v > 0 ? "subiu" : "caiu",
  };
}
