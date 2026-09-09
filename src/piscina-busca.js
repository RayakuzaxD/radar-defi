/* Achar a pool que ele quer lançar, do jeito que ele a conhece.
 *
 * Pergunta dele em 08/09/2026:
 *
 *   "eu posso copiar a pool na blockchain certo? e colar aí já mostra todas
 *    informações dela ou não?"
 *
 * A resposta é não, e o motivo é da fonte, não dele: o DefiLlama NÃO guarda o
 * endereço da pool. Conferido no dado cru — cada pool tem `pool` (um id
 * próprio, tipo d32f9c01-47d1-...), `underlyingTokens` (os endereços dos tokens
 * do par) e `rewardTokens`. O endereço do contrato da pool não existe ali.
 *
 * Então colar o endereço da pool na tela nunca ia casar com nada, e o campo que
 * eu tinha feito ("cole o id da pool") pedia um número que ele não tem como
 * saber de cor. Era um campo que só funcionava pra quem já conhecia o
 * DefiLlama por dentro.
 *
 * Este arquivo aceita as quatro formas que ele PODE ter na mão:
 *
 *   1. o link do DefiLlama, copiado da barra do navegador;
 *   2. o id sozinho, se ele já tiver;
 *   3. o endereço de um TOKEN do par (esse o DefiLlama tem) — devolve todas as
 *      pools que usam aquele token;
 *   4. o texto: "usdc aero base", "eth usdc aerodrome". O jeito humano.
 *
 * Nada aqui fala com a rede. Recebe a lista de pools e procura dentro dela.
 */

/* Um id do DefiLlama é um UUID. Reconhecer o formato evita tratar "aerodrome"
 * como id e sair procurando igualdade exata onde deveria haver busca. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENDERECO = /^0x[0-9a-f]{40}$/i;

export function entenderTermo(bruto) {
  const termo = String(bruto || "").trim();
  if (!termo) return { tipo: "vazio", valor: "" };

  /* O link vem antes do resto: quem cola uma URL do DefiLlama já escolheu a
     pool, e procurar por texto dentro de uma URL acharia qualquer coisa. */
  const doLink = termo.match(/defillama\.com\/yields\/pool\/([0-9a-f-]{36})/i);
  if (doLink) return { tipo: "id", valor: doLink[1].toLowerCase() };

  if (UUID.test(termo)) return { tipo: "id", valor: termo.toLowerCase() };
  if (ENDERECO.test(termo)) return { tipo: "endereco", valor: termo.toLowerCase() };

  /* Um endereço colado de um explorador às vezes vem com sujeira em volta
     ("Contract 0xabc... | BaseScan"). Se houver um endereço no meio do texto,
     ele manda — é mais específico que qualquer palavra. */
  const solto = termo.match(/0x[0-9a-f]{40}/i);
  if (solto) return { tipo: "endereco", valor: solto[0].toLowerCase() };

  return { tipo: "texto", valor: termo.toLowerCase() };
}

/* Os três campos em que uma palavra pode cair, separados de propósito.
 *
 * O símbolo vem também sem os hífens, porque ele vai escrever "eth usdc" e o
 * dado diz "ETH-USDC". Sem isso a busca mais natural do mundo não acha nada. */
function camposDaPool(p) {
  return {
    simbolo: [p.simbolo, String(p.simbolo || "").replace(/[-/]/g, " ")].filter(Boolean).join(" ").toLowerCase(),
    projeto: [p.projeto, String(p.projeto || "").replace(/-/g, " "), p.meta].filter(Boolean).join(" ").toLowerCase(),
    rede: String(p.rede || p.chain || "").toLowerCase(),
  };
}

/* Toda palavra precisa aparecer em algum campo. "eth usdc base" não pode
 * devolver pool de ETH em qualquer rede: cada palavra que ele digita é um
 * filtro a mais, não uma alternativa. É a diferença entre a busca ajudar e a
 * busca despejar. */
function casaTexto(p, palavras) {
  const c = camposDaPool(p);
  const tudo = c.simbolo + " " + c.projeto + " " + c.rede;
  return palavras.every((w) => tudo.includes(w));
}

/* A nota de relevância, e por que ela existe.
 *
 * Procurar "eth usdc" trazia junto uma pool de USDC-USDT na ETHEREUM — porque
 * "eth" está dentro de "ethereum". Esconder o resultado seria pior: um dia ele
 * procura "ethereum" de verdade e a busca fica muda sem explicar por quê.
 *
 * Então nada é escondido; o que casa no SÍMBOLO sobe. Ele vê a lista e escolhe,
 * que é o único jeito honesto quando o computador não sabe o que ele quis
 * dizer. */
function nota(p, palavras) {
  const c = camposDaPool(p);
  let n = 0;
  for (const w of palavras) {
    if (c.simbolo.includes(w)) n += 3;
    else if (c.projeto.includes(w)) n += 2;
    else if (c.rede.includes(w)) n += 1;
  }
  return n;
}

export function procurarPiscinas(lista, bruto, { limite = 12 } = {}) {
  const pedido = entenderTermo(bruto);
  const todas = lista || [];
  if (pedido.tipo === "vazio") return { pedido, achados: [] };

  if (pedido.tipo === "id") {
    return { pedido, achados: todas.filter((p) => String(p.id).toLowerCase() === pedido.valor) };
  }

  if (pedido.tipo === "endereco") {
    const achados = todas.filter((p) =>
      (p.tokens || []).some((t) => String(t).toLowerCase() === pedido.valor));
    return { pedido, achados: ordenar(achados).slice(0, limite) };
  }

  const palavras = pedido.valor.split(/\s+/).filter(Boolean);
  const achados = todas
    .filter((p) => casaTexto(p, palavras))
    .map((p) => ({ p, n: nota(p, palavras) }))
    .sort((a, b) => (b.n - a.n) || ((Number(b.p.tvl ?? b.p.tvlUsd) || 0) - (Number(a.p.tvl ?? a.p.tvlUsd) || 0)))
    .map((x) => x.p);
  return { pedido, achados: achados.slice(0, limite) };
}

/* Maior primeiro.
 *
 * Não é opinião sobre qualidade — o método até prefere TVL baixo. É só que numa
 * lista de "USDC-ETH" a pool de 30 milhões é quase sempre a que ele está
 * pensando, e as de mil dólares são ruído com o mesmo nome. Ele escolhe. */
function ordenar(lista) {
  return [...lista].sort((a, b) => (Number(b.tvl ?? b.tvlUsd) || 0) - (Number(a.tvl ?? a.tvlUsd) || 0));
}

/* De onde vem o rendimento, em uma frase.
 *
 * É a REGRA DO 3 aplicada ao que ele está prestes a lançar: taxa é uso real,
 * incentivo é token impresso. O radar mostra a divisão e cala — a decisão de
 * entrar é dele. */
export function deOndeVemORendimento(p) {
  const base = Number(p.apyBase ?? p.apy_base) || 0;
  const premio = Number(p.apyReward ?? p.apy_reward) || 0;
  const total = base + premio;
  if (!(total > 0)) return { total: 0, pctDeTaxa: null, texto: "sem rendimento medido" };
  const pct = (base / total) * 100;
  return {
    total,
    pctDeTaxa: pct,
    texto: pct >= 70 ? "quase tudo de taxas"
      : pct >= 30 ? "metade taxas, metade incentivo"
      : "quase tudo de incentivo",
  };
}
