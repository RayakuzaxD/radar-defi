/* O FLUXO DIÁRIO DOS ETFs DE BITCOIN À VISTA.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO IMPORTA PRO MÉTODO
 *
 * O radar já tem dois eixos pro ciclo: o preço (a faixa de bull, os
 * cruzamentos) e o capital (o estoque de stablecoins). O fluxo dos ETFs é
 * capital também, mas de OUTRA gente: enquanto a stablecoin mede dinheiro que
 * já está dentro do mundo cripto se mexendo de lugar, o ETF mede dinheiro
 * ENTRANDO ou SAINDO pela porta da frente, de quem compra bitcoin numa
 * corretora de ações e nem sabe o que é uma carteira.
 *
 * ---------------------------------------------------------------------------
 * COMO EU QUASE DESISTI DESTA FONTE, E O QUE ME FEZ VOLTAR
 *
 * Testei seis fontes do computador do Rayakuza. Todas recusaram: Farside 403,
 * SoSoValue pede chave, CoinGlass pede chave, DefiLlama não tem, iShares
 * devolve HTML, Grayscale 429. Eu já tinha escrito o parágrafo dizendo que
 * fluxo de ETF não tem fonte livre.
 *
 * Aí a CoinGecko, que também "não funcionava", passou a funcionar só porque eu
 * comecei a dizer quem estava chamando — o Worker da Cloudflare não manda
 * cabeçalho de identificação nenhum por padrão. Perguntei de novo, DO WORKER e
 * com nome: o Farside responde 200.
 *
 * A LIÇÃO, que é maior que este arquivo: testar do computador dele não prova
 * nada sobre o que o Worker consegue. São endereços diferentes, cabeçalhos
 * diferentes, e reputações diferentes. Fonte só está morta depois de morrer no
 * lugar onde ela vai ser usada.
 *
 * ---------------------------------------------------------------------------
 * A TABELA, E O QUE NELA PODE ME ENGANAR
 *
 * Uma linha por dia, uma coluna por fundo, valores em MILHÕES DE DÓLARES. As
 * formas que o leitor tem de aguentar, todas guardadas em provas/:
 *
 *   negativo      <span class="redFont">(65.5)</span>   parênteses, não sinal
 *   sem dado      -                                     não é zero
 *   milhar        64,023                                vírgula, não ponto
 *   rodapé        uma linha "Total" no fim              NÃO é um dia
 *
 * A do rodapé é a perigosa: ela tem o mesmo formato de uma linha de dados e
 * somaria 55 bilhões ao fluxo de um dia se entrasse. Por isso a regra do
 * leitor não é "pule a última linha" — é "só é dia o que tem cara de data". */

const FONTE = "https://farside.co.uk/bitcoin-etf-flow-all-data/";
const QUEM_SOMOS = "radar-defi";

const MESES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/* "11 Jan 2024" -> "2024-01-11". Devolve null pra qualquer outra coisa, e é
   esse null que mantém a linha "Total" fora da série. */
export function diaDoFarside(texto) {
  const m = String(texto || "").trim()
    .match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) return null;
  const d = Number(m[1]);
  if (!(d >= 1 && d <= 31)) return null;
  return m[3] + "-" + String(mes).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

/* "(65.5)" -> -65.5 · "64,023" -> 64023 · "-" -> null · "0.0" -> 0 */
export function numeroDoFarside(texto) {
  const t = String(texto || "").trim();
  if (!t || t === "-" || t === "–") return null;
  const negativo = /^\(.*\)$/.test(t);
  const limpo = t.replace(/[(),]/g, "");
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const semTags = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

/* O leitor da tabela. Puro, pra poder ser conferido contra provas/. */
export function lerTabelaDoFarside(html) {
  const texto = String(html || "");
  const inicio = texto.indexOf("<table");
  if (inicio < 0) return { erro: "não achei a tabela" };
  const tabela = texto.slice(inicio, texto.indexOf("</table>", inicio) + 8);

  /* As colunas saem do cabeçalho, e não de uma lista minha. Fundo novo entra
     sozinho, fundo que fecha sai sozinho — e no dia em que a ordem mudar, ela
     muda aqui junto. Uma lista fixa daria o número do fundo errado com toda a
     cara de estar certo. */
  const cabecalho = (tabela.match(/<th[\s\S]*?<\/th>/g) || []).map(semTags);
  if (cabecalho.length < 3) return { erro: "cabeçalho curto demais" };
  const fundos = cabecalho.slice(1); // a primeira é "Date"

  const dias = [];
  for (const linha of tabela.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const celulas = (linha.match(/<td[\s\S]*?<\/td>/g) || []).map(semTags);
    if (celulas.length < 2) continue;
    const dia = diaDoFarside(celulas[0]);
    if (!dia) continue; // é assim que a linha "Total" fica de fora

    const valores = celulas.slice(1).map(numeroDoFarside);
    /* O "Total" da própria página é a última coluna. Uso o dela e não a minha
       soma: se algum dia as duas discordarem, quero ver a discordância, não
       escondê-la atrás de uma conta minha que sempre fecha. */
    const total = valores[valores.length - 1];
    const porFundo = {};
    for (let i = 0; i < fundos.length - 1 && i < valores.length; i++) {
      if (valores[i] != null) porFundo[fundos[i]] = valores[i];
    }
    dias.push({ dia, total, porFundo });
  }

  if (!dias.length) return { erro: "a tabela veio sem nenhum dia" };
  /* Do mais novo pro mais velho, que é a ordem em que a tela pergunta. */
  dias.sort((a, b) => (a.dia < b.dia ? 1 : -1));
  return { fundos: fundos.slice(0, -1), dias };
}

export async function fluxoDosEtfs() {
  const r = await fetch(FONTE, {
    headers: { "user-agent": QUEM_SOMOS, accept: "text/html" },
  });
  if (!r.ok) return { erro: "a fonte respondeu " + r.status };
  return lerTabelaDoFarside(await r.text());
}

/* A LEITURA: o dia, a semana, e há quantos dias a direção não muda.
 *
 * ---------------------------------------------------------------------------
 * A SEMANA MANDA, E O DIA É SÓ CONTEXTO
 *
 * Um dia de saída não é notícia: os ETFs alternam entrada e saída o tempo todo,
 * e fim de semana nem existe na série. Ler um dia como direção seria o mesmo
 * erro que fez o eixo de capital do ciclo balançar até passar a olhar a semana.
 *
 * A SEQUÊNCIA É O QUE VALE MAIS. Cinco dias seguidos de saída dizem algo que a
 * soma da semana esconde, porque a soma pode ser um número pequeno feito de
 * cinco saídas seguidas ou de um dia ruim no meio de quatro bons.
 *
 * ---------------------------------------------------------------------------
 * ISTO NÃO DECIDE NADA
 *
 * Devolve a medida. Não diz o que fazer, não diz que é bom nem ruim, e não
 * mexe no ciclo por conta própria — o ciclo quem decide é ele. */
export function lerFluxoDosEtfs(dias, quantos = 7) {
  if (!Array.isArray(dias) || !dias.length) return null;
  const comTotal = dias.filter((d) => d && Number.isFinite(d.total));
  if (!comTotal.length) return null;

  const janela = comTotal.slice(0, quantos);
  const somaDaJanela = janela.reduce((s, d) => s + d.total, 0);
  const ultimo = comTotal[0];

  /* Há quantos dias seguidos a direção é a mesma. Dia zerado não quebra a
     sequência nem conta pra ela: zero é feriado de fluxo, não virada. */
  const sinal = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const doUltimo = sinal(ultimo.total);
  let seguidos = 0;
  if (doUltimo !== 0) {
    for (const d of comTotal) {
      const s = sinal(d.total);
      if (s === 0) continue;
      if (s !== doUltimo) break;
      seguidos++;
    }
  }

  return {
    ultimoDia: ultimo.dia,
    ultimo: ultimo.total,
    janela: janela.length,
    semana: somaDaJanela,
    direcao: somaDaJanela > 0 ? "entrando" : somaDaJanela < 0 ? "saindo" : "parado",
    seguidos,
    direcaoDoUltimo: doUltimo > 0 ? "entrando" : doUltimo < 0 ? "saindo" : "parado",
  };
}
