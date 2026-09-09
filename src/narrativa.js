/* Qual narrativa está puxando capital agora.
 *
 * "Narrativa", em cripto, é o assunto que está levando dinheiro: num mês é
 * empréstimo, no outro é RWA, no outro é restaking. Quem acompanha só rede e
 * pool vê o QUE cresceu, mas não vê o TEMA — e o tema é o que costuma explicar
 * por que várias coisas cresceram juntas.
 *
 * A conta é direta: o DefiLlama classifica cada protocolo por categoria, então
 * somar o dinheiro de cada categoria hoje e comparar com a semana passada dá a
 * rotação. Em 05/09/2026 essa conta mostrou dinheiro saindo de Lending (-$391M),
 * RWA (-$237M) e Restaking (-$117M) e entrando em Onchain Capital Allocation
 * (+$352M), Dexs (+$237M) e Yield (+$226M).
 *
 * Uma honestidade importante sobre o método: isto soma protocolos DENTRO de uma
 * categoria e compara com ela mesma no tempo. Não é comparável com o TVL oficial
 * de rede nenhuma (o DefiLlama exclui categorias inteiras daquela conta), e por
 * isso os números daqui só devem ser lidos contra outros números daqui.
 *
 * Nada aqui fala com a rede nem com o banco.
 */

export const LIMIARES_NARRATIVA = {
  // Categoria menor que isso não sustenta narrativa: é um protocolo ou dois.
  pisoTamanho: 50e6,
  // Movimento menor que isso é ruído de arredondamento em números de bilhões.
  pisoMovimento: 20e6,
  // Quantas mostrar de cada lado.
  quantas: 5,
};

/* Soma o dinheiro por categoria, hoje e no passado. */
export function agruparPorNarrativa(protocolos, lim = LIMIARES_NARRATIVA) {
  const caixas = new Map();

  for (const p of protocolos || []) {
    const cat = p.categoria;
    const hoje = Number(p.tvl) || 0;
    if (!cat || hoje <= 0) continue;

    const c = caixas.get(cat) || {
      narrativa: cat, hoje: 0, semana: 0, mes: 0, protocolos: 0, membros: [],
    };
    c.hoje += hoje;
    c.semana += Number(p.tvl7d) || 0;
    c.mes += Number(p.tvl30d) || 0;
    c.protocolos++;
    c.membros.push({
      nome: p.nome,
      redes: p.redes || [],
      tvl: hoje,
      delta: hoje - (Number(p.tvl7d) || 0),
    });
    caixas.set(cat, c);
  }

  const linhas = [];
  for (const c of caixas.values()) {
    if (c.hoje < lim.pisoTamanho || c.semana < lim.pisoTamanho) continue;
    // Ordena os membros pelo dinheiro movido: é assim que se responde "quem
    // dentro dessa narrativa está puxando".
    c.membros.sort((a, b) => b.delta - a.delta);
    linhas.push({
      narrativa: c.narrativa,
      tamanho: c.hoje,
      protocolos: c.protocolos,
      delta7d: c.hoje - c.semana,
      pct7d: c.semana > 0 ? (c.hoje / c.semana - 1) * 100 : null,
      delta30d: c.mes > 0 ? c.hoje - c.mes : null,
      pct30d: c.mes > 0 ? (c.hoje / c.mes - 1) * 100 : null,
      puxando: c.membros.slice(0, 3),
      largando: c.membros.slice(-2).reverse().filter((m) => m.delta < 0),
    });
  }
  return linhas;
}

/* Divide em quem está recebendo e quem está perdendo.
 *
 * Ordenado por DÓLAR e não por porcentagem: uma categoria de $270M subindo 21%
 * move menos dinheiro que uma de $9B subindo 4%, e o que define "a narrativa do
 * momento" é pra onde o dinheiro foi, não qual placar ficou mais bonito.
 *
 * `emergindo` é a exceção que a ordenação por dólar esconde: categorias
 * pequenas crescendo muito rápido. É onde uma narrativa nova aparece antes de
 * ser grande — e foi exatamente pra isso que o Rayakuza pediu "iniciando uma alta". */
export function dividirNarrativas(linhas, lim = LIMIARES_NARRATIVA) {
  const relevantes = linhas.filter((l) => Math.abs(l.delta7d) >= lim.pisoMovimento);

  return {
    puxando: relevantes.filter((l) => l.delta7d > 0)
      .sort((a, b) => b.delta7d - a.delta7d).slice(0, lim.quantas),
    perdendo: relevantes.filter((l) => l.delta7d < 0)
      .sort((a, b) => a.delta7d - b.delta7d).slice(0, lim.quantas),
    emergindo: linhas
      .filter((l) => l.pct7d != null && l.pct7d >= 15 && l.tamanho < 2e9 && l.delta7d >= lim.pisoMovimento)
      .sort((a, b) => b.pct7d - a.pct7d).slice(0, 3),
  };
}

/* A frase de uma narrativa, escrita com os números dela. */
export function porqueDaNarrativa(n) {
  const d = (v) => {
    if (v == null) return "?";
    const s = v < 0 ? "-" : "", x = Math.abs(v);
    if (x >= 1e9) return `${s}$${(x / 1e9).toFixed(2)}B`;
    return `${s}$${(x / 1e6).toFixed(0)}M`;
  };
  const p = (v) => (v == null ? "?" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

  const partes = [];
  const entrou = n.delta7d > 0;
  partes.push(
    `${entrou ? "Entraram" : "Saíram"} ${d(Math.abs(n.delta7d))} nesta semana (${p(n.pct7d)}), ` +
    `num total de ${d(n.tamanho)} em ${n.protocolos} protocolos.`,
  );

  // O mês contra a semana diz se a narrativa está começando ou virando.
  if (n.pct30d != null) {
    if (entrou && n.pct30d < 0) {
      partes.push(`No mês ainda está negativa (${p(n.pct30d)}): a virada é desta semana.`);
    } else if (!entrou && n.pct30d > 5) {
      partes.push(`No mês ainda está positiva (${p(n.pct30d)}): pode ser realização, não abandono.`);
    } else if (entrou && n.pct7d != null && n.pct30d > 0 && n.pct7d > n.pct30d) {
      partes.push(`E acelerando: a semana rendeu mais que o mês inteiro (${p(n.pct30d)}).`);
    }
  }

  if (n.puxando?.length && entrou) {
    partes.push(`Quem puxa: ${n.puxando.slice(0, 3).map((m) => `${m.nome} ${d(m.delta)}`).join(", ")}.`);
  } else if (n.largando?.length && !entrou) {
    partes.push(`Quem larga: ${n.largando.slice(0, 2).map((m) => `${m.nome} ${d(m.delta)}`).join(", ")}.`);
  }

  return partes.join(" ");
}

/* O fluxo líquido de cada rede: quanto entrou ou saiu, em dólares.
 *
 * Diferente das caixas de rede (que separam por porte e usam porcentagem), aqui
 * é uma lista só, ordenada por dinheiro. Responde direto a pergunta "qual rede
 * está ganhando e qual está perdendo capital" sem obrigar a somar duas telas de
 * cabeça. */
export function fluxoDeRedes(fichas, quantas = 6) {
  const comDado = (fichas || []).filter((f) => f.absTvl7d != null && Math.abs(f.absTvl7d) >= 5e6);
  return {
    ganhando: comDado.filter((f) => f.absTvl7d > 0)
      .sort((a, b) => b.absTvl7d - a.absTvl7d).slice(0, quantas),
    perdendo: comDado.filter((f) => f.absTvl7d < 0)
      .sort((a, b) => a.absTvl7d - b.absTvl7d).slice(0, quantas),
  };
}
