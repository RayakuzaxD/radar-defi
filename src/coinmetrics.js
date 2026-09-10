/* A FONTE RESERVA DOS INDICADORES DO CURSO.
 *
 * ------------------------------------------------------------------------
 * POR QUE ELA EXISTE
 *
 * A fonte principal (bitcoin-data.com) dá os quatro indicadores prontos e é a
 * referência. Ela também limita a 10 chamadas por hora POR IP — e o IP não é
 * nosso: é o de saída compartilhado da Cloudflare, dividido com todo mundo que
 * roda Worker no mesmo lugar. Em 10/09/2026 a régua do curso passou o dia
 * inteiro vazia, com 429 nos quatro, e o Rayakuza viu a tela e disse "vc tem
 * tantos dados mas ali aparece praticamente nada".
 *
 * MEDIDO NO MESMO DIA: do computador dele os quatro respondiam 200. Não era a
 * fonte fora do ar — era o nosso endereço no balde errado. Não há como um
 * Worker escolher outro IP de saída, então o caminho é outra fonte.
 *
 * ------------------------------------------------------------------------
 * O QUE DÁ E O QUE NÃO DÁ
 *
 * A API comunitária da CoinMetrics é aberta, sem chave, e do que ela serve de
 * graça três coisas interessam:
 *
 *   CapMVRVCur      o MVRV pronto
 *   CapMrktCurUSD   o valor de mercado
 *   IssTotUSD       quanto foi emitido em dólar, por dia
 *
 * Com isso dá pra ter TRÊS dos quatro:
 *
 *   MVRV      direto
 *   Puell     emissão de hoje ÷ média de 365 dias de emissão. É a definição,
 *             não uma aproximação.
 *   Z-Score   (valor de mercado − valor realizado) ÷ desvio do valor de
 *             mercado. O realizado sai do próprio MVRV: realizado = mercado
 *             ÷ MVRV. O desvio é da história inteira, e vem das somas
 *             correntes abaixo.
 *
 * O VDD NÃO TEM SUBSTITUTO. Ele precisa de dias-moeda-destruídos, que é dado
 * on-chain que nenhuma fonte aberta serve. Quando a principal falha, o VDD
 * fica faltando — e a tela DIZ que falta, em vez de fingir três de quatro.
 *
 * ------------------------------------------------------------------------
 * O QUANTO ELAS BATEM, MEDIDO EM 09/09/2026
 *
 *                aqui        bitcoin-data.com   diferença
 *   MVRV         1,4703      1,4808             -0,7%
 *   Z-Score      0,8207      0,8495             -3,4%
 *   Puell        1,0727      1,0825             -0,9%
 *
 * As diferenças vêm de o valor realizado ser apurado de jeitos ligeiramente
 * diferentes, e de o preço de referência não ser o mesmo. NENHUMA delas mudou
 * a leitura: os três caíram na mesma faixa do curso nos dois cálculos.
 *
 * MAS PERTO DE UM CORTE, TRÊS POR CENTO DECIDEM. Um MVRV de 1,395 aqui e
 * 1,405 lá é "meio" num e "acumulação" no outro. Por isso todo valor daqui sai
 * marcado com `fonte`, e a tela mostra a marca — quem lê tem que poder saber
 * que aquele número veio pelo caminho de trás.
 */

const CM = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics";

/* A SEMENTE DAS SOMAS CORRENTES DO Z-SCORE.
 *
 * O desvio-padrão do valor de mercado é sobre a HISTÓRIA INTEIRA: 5.898 dias
 * em 09/09/2026. Buscar isso a cada rodada seriam ~600 KB e várias páginas —
 * caro na nuvem, impossível nos 10 milissegundos do plano gratuito.
 *
 * Só que desvio não precisa da lista: precisa de três números.
 *
 * A PRIMEIRA VERSÃO USAVA soma e somaQuad, com desvio = raiz(somaQuad/n −
 * média²). Bate exato nos dados reais — e o teste que eu escrevi em seguida
 * derrubou ela num caso que eu não tinha pensado: valores ENORMES e quase
 * IGUAIS. Com [1e12, 1e12+1, 1e12−1, 1e12+2] os dois termos são ~1e24 e a
 * diferença verdadeira é ~1,25; o ponto flutuante não resolve isso e a
 * variância sai NEGATIVA (−134 milhões, medido).
 *
 * Nos dados reais o cancelamento não acontece, porque o valor de mercado do
 * Bitcoin varia de 1e8 a 2e12 e a dispersão é enorme. Ou seja: a fórmula
 * frágil funcionava aqui por sorte da distribuição, não por estar certa. Isso
 * é pior que um erro visível — é um erro esperando outro conjunto de dados.
 *
 * WELFORD faz a mesma coisa sem subtrair números grandes quase iguais:
 *
 *     n += 1
 *     d = x − média
 *     média += d/n
 *     M2 += d · (x − média)
 *     desvio = raiz(M2/n)
 *
 * Conferido contra o cálculo direto sobre os 5.898 dias: 0,000000000000%. E no
 * caso frio devolve 1,118, que é a resposta certa.
 *
 * A LIÇÃO: "bate com o valor de referência" não é o mesmo que "está correto".
 * Bater prova que funciona NESSES dados; um caso construído prova onde ela
 * quebra. Vale escrever o segundo mesmo quando o primeiro já passou.
 *
 * Estes números foram apurados uma vez e o Worker só acrescenta os dias que
 * passaram desde `ate`. */
export const SEMENTE_DO_MERCADO = {
  n: 5898,
  media: 425076496195.0006,
  m2: 2.209743358951e27,
  ate: "2026-09-09",
};

/* Uma consulta à CoinMetrics. Sem paginação de propósito: tudo o que se pede
   aqui cabe numa página, e uma função que pagina calada é uma função que um
   dia baixa 600 KB sem ninguém pedir. */
async function pedir(metricas, desde, quantos = 500) {
  const u = CM + "?assets=btc&metrics=" + encodeURIComponent(metricas) +
    "&frequency=1d&page_size=" + quantos +
    (desde ? "&start_time=" + encodeURIComponent(desde) : "");
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("CoinMetrics respondeu " + r.status);
  const d = await r.json();
  if (d?.error) throw new Error(String(d.error.message || d.error.type).slice(0, 80));
  return d?.data || [];
}

const dia = (r) => String(r?.time || "").slice(0, 10);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/* Quantos dias atrás, em texto ISO — pra pedir só a janela que interessa. */
function diasAtras(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

/* O MVRV e o valor de mercado do último dia fechado. */
export async function mvrvEMercado() {
  const linhas = await pedir("CapMVRVCur,CapMrktCurUSD", diasAtras(5), 10);
  for (let i = linhas.length - 1; i >= 0; i--) {
    const mvrv = num(linhas[i].CapMVRVCur);
    const mercado = num(linhas[i].CapMrktCurUSD);
    if (mvrv > 0 && mercado > 0) return { mvrv, mercado, dia: dia(linhas[i]) };
  }
  return null;
}

/* O PUELL MULTIPLE, pela definição: o que foi emitido hoje dividido pela média
 * do que foi emitido nos 365 dias anteriores.
 *
 * O dia de hoje NÃO entra na média — a média é do que veio antes, senão o
 * próprio dia puxaria o divisor e achataria o resultado. */
export async function puellMultiple() {
  const linhas = await pedir("IssTotUSD", diasAtras(380), 400);
  const serie = linhas
    .map((r) => ({ dia: dia(r), v: num(r.IssTotUSD) }))
    .filter((x) => x.v > 0);
  if (serie.length < 300) return null;

  const ultimo = serie[serie.length - 1];
  const antes = serie.slice(-366, -1);
  if (antes.length < 300) return null;
  const media = antes.reduce((a, b) => a + b.v, 0) / antes.length;
  if (!(media > 0)) return null;
  return { valor: ultimo.v / media, dia: ultimo.dia, sobreQuantosDias: antes.length };
}

/* Acrescenta às somas correntes os dias que passaram desde a última vez.
 *
 * Devolve as somas novas, e elas voltam pra ser guardadas. Se a busca falhar,
 * as antigas continuam valendo: um desvio de ontem sobre 5.898 dias é
 * praticamente o mesmo de hoje, e recusar o Z-Score inteiro por causa disso
 * seria trocar uma imprecisão invisível por um buraco visível. */
export async function somasDoMercado(guardadas) {
  const base = (guardadas && guardadas.n > 0) ? guardadas : SEMENTE_DO_MERCADO;
  let linhas;
  try {
    linhas = await pedir("CapMrktCurUSD", base.ate, 400);
  } catch {
    return { ...base, novos: 0 };
  }
  let n = base.n, media = base.media, m2 = base.m2, ate = base.ate, novos = 0;
  for (const r of linhas) {
    const d = dia(r), v = num(r.CapMrktCurUSD);
    /* Estritamente MAIOR que `ate`: a consulta devolve o dia de corte junto, e
       somá-lo de novo contaria o mesmo dia duas vezes. Uma contagem dupla por
       rodada, três rodadas por dia, e em um mês o desvio estaria errado sem
       nada na tela indicando isso. */
    if (!(v > 0) || d <= ate) continue;
    n++;
    const delta = v - media;
    media += delta / n;
    m2 += delta * (v - media);
    ate = d; novos++;
  }
  return { n, media, m2, ate, novos };
}

/* O desvio-padrão populacional a partir das somas. */
export function desvioDoMercado(somas) {
  if (!somas || !(somas.n > 1) || !Number.isFinite(somas.m2)) return null;
  const variancia = somas.m2 / somas.n;
  return variancia > 0 ? Math.sqrt(variancia) : null;
}

/* Welford a partir de uma lista, pra quem tiver a lista na mão (os testes, e
   quem um dia quiser refazer a semente). */
export function somasDeUmaLista(lista) {
  let n = 0, media = 0, m2 = 0;
  for (const v of lista || []) {
    if (!Number.isFinite(v)) continue;
    n++;
    const delta = v - media;
    media += delta / n;
    m2 += delta * (v - media);
  }
  return { n, media, m2, ate: null };
}

/* O Z-SCORE: quantos desvios o valor de mercado está acima do realizado. */
export function zscoreDe(mercado, mvrv, somas) {
  const desvio = desvioDoMercado(somas);
  if (!(desvio > 0) || !(mercado > 0) || !(mvrv > 0)) return null;
  const realizado = mercado / mvrv;
  return (mercado - realizado) / desvio;
}

/* O QUE FALTOU, BUSCADO AQUI — e só o que faltou.
 *
 * Recebe a lista de chaves que a fonte principal não entregou e devolve o que
 * esta fonte consegue. Pedir o que já chegou seria gastar rede pra sobrescrever
 * a referência por um substituto, que é exatamente o contrário do que se quer.
 *
 * Cada valor sai com `fonte: "coinmetrics"` pra a tela poder dizer. */
export async function completarIndicadores(faltando, somasGuardadas) {
  const querem = new Set(faltando || []);
  const fora = { valores: {}, falhas: [], somas: null };
  if (!querem.size) return fora;

  const precisaDoMvrv = querem.has("mvrv") || querem.has("zscore");
  let base = null;
  if (precisaDoMvrv) {
    try {
      base = await mvrvEMercado();
      if (!base) fora.falhas.push("mvrv: a fonte reserva não trouxe valor");
    } catch (e) {
      fora.falhas.push("mvrv: " + String(e?.message || e).slice(0, 60));
    }
  }

  if (querem.has("mvrv") && base) {
    fora.valores.mvrv = { valor: base.mvrv, dia: base.dia, fonte: "coinmetrics" };
  }

  if (querem.has("zscore") && base) {
    const somas = await somasDoMercado(somasGuardadas);
    fora.somas = somas;
    const z = zscoreDe(base.mercado, base.mvrv, somas);
    if (z != null) fora.valores.zscore = { valor: z, dia: base.dia, fonte: "coinmetrics" };
    else fora.falhas.push("zscore: não consegui o desvio do valor de mercado");
  }

  if (querem.has("puell")) {
    try {
      const p = await puellMultiple();
      if (p) fora.valores.puell = { valor: p.valor, dia: p.dia, fonte: "coinmetrics" };
      else fora.falhas.push("puell: a fonte reserva não trouxe dias suficientes");
    } catch (e) {
      fora.falhas.push("puell: " + String(e?.message || e).slice(0, 60));
    }
  }

  /* O VDD não tem substituto, e isto é dito e não escondido. */
  if (querem.has("vdd")) {
    fora.falhas.push("vdd: sem fonte reserva — ele precisa de dado on-chain que nenhuma API aberta serve");
  }

  return fora;
}
