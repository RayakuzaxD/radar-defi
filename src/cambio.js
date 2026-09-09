/* O dólar em real.
 *
 * Existe por causa de uma frase do Rayakuza: "quero saber quanto tenho, e quanto
 * vale em dólar o que tenho". A reserva de emergência dele está em real e o
 * cripto em dólar — sem a cotação, somar as duas coisas seria somar laranja
 * com maçã, e o total sairia errado com cara de certo.
 *
 * Não fica em llama.js de propósito: aquele arquivo é "o que o DefiLlama nos
 * conta", e câmbio não vem de lá.
 */

/* A AwesomeAPI é brasileira, aberta, sem chave, e devolve USD-BRL direto com
 * carimbo de hora. A segunda é rede de segurança: se a primeira sair do ar, o
 * painel continua somando em vez de mostrar um traço.
 *
 * Ordem importa — a brasileira segue o mercado de câmbio daqui, que é o que ele
 * confere no banco dele. */
const FONTES = [
  {
    nome: "awesomeapi",
    url: "https://economia.awesomeapi.com.br/json/last/USD-BRL",
    ler: (d) => Number(d?.USDBRL?.bid),
  },
  {
    nome: "exchangerate-api",
    url: "https://open.er-api.com/v6/latest/USD",
    ler: (d) => Number(d?.rates?.BRL),
  },
];

/* Faixa de sanidade.
 *
 * Não é palpite sobre economia: é o filtro que impede um JSON estranho de virar
 * patrimônio errado na tela. Cotação fora daqui é erro de leitura, não notícia
 * — se o dólar de fato sair dessa faixa, quem conserta o número sou eu, e o
 * radar até lá prefere dizer "não sei" a dizer um número absurdo. */
export const CAMBIO = { minimo: 1, maximo: 30 };

export function cotacaoPlausivel(v) {
  return Number.isFinite(v) && v >= CAMBIO.minimo && v <= CAMBIO.maximo;
}

/* Quanto vale um dólar em real. Devolve null quando nenhuma fonte respondeu —
 * null é "não sei", e o painel sabe mostrar isso sem inventar. */
export async function cotacaoDoDolar() {
  for (const f of FONTES) {
    try {
      const r = await fetch(f.url, { headers: { accept: "application/json" } });
      if (!r.ok) continue;
      const v = f.ler(await r.json());
      if (cotacaoPlausivel(v)) return { valor: v, fonte: f.nome };
    } catch {
      // fonte fora do ar não derruba a próxima
    }
  }
  return null;
}

/* Converte um valor de uma moeda pra outra.
 *
 * `cotacao` é quantos reais valem um dólar. Sem cotação, só devolve o que já
 * está na moeda certa — converter no chute seria pior que não converter. */
export function converter(valor, de, para, cotacao) {
  if (valor == null || !Number.isFinite(valor)) return null;
  if (de === para) return valor;
  if (!cotacaoPlausivel(cotacao)) return null;
  if (de === "USD" && para === "BRL") return valor * cotacao;
  if (de === "BRL" && para === "USD") return valor / cotacao;
  return null;
}

/* O total de uma carteira numa moeda só.
 *
 * Devolve também `incompleto`: quantas linhas ficaram de fora por falta de
 * cotação. Um total que esconde o que não coube é um total mentiroso. */
export function somarCarteira(linhas, moeda, cotacao) {
  let total = 0, incompleto = 0;
  for (const l of linhas || []) {
    const v = converter(Number(l?.valor), l?.moeda || moeda, moeda, cotacao);
    if (v == null) { if (l?.valor != null) incompleto++; continue; }
    total += v;
  }
  return { total, incompleto };
}

/* A fatia de cada linha no total, em porcentagem.
 *
 * É a conta que o Rayakuza não quer fazer à mão — e é justamente por isso que ela
 * precisa estar certa quando o total é zero: dividir por zero devolveria NaN, e
 * NaN vira "NaN%" na tela. */
export function fatiasEmPorcento(linhas, moeda, cotacao) {
  const { total } = somarCarteira(linhas, moeda, cotacao);
  return (linhas || []).map((l) => {
    const v = converter(Number(l?.valor), l?.moeda || moeda, moeda, cotacao);
    return {
      ...l,
      convertido: v,
      pct: (v == null || !(total > 0)) ? null : (v / total) * 100,
    };
  });
}
