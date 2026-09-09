/* Separa o mercado em caixas que se comparam entre si.
 *
 * Uma lista única de 120 redes não ajuda ninguém a decidir: Ethereum caindo 3%
 * e uma rede de $8M subindo 300% aparecem lado a lado como se fossem eventos do
 * mesmo tipo, e não são. Uma é notícia macro, a outra é uma pessoa movendo
 * dinheiro.
 *
 * Então o radar passa a ter quatro caixas, e cada uma só compara com ela mesma:
 *
 *   GRANDES subindo    — as 10 maiores. Aqui 5% é muito.
 *   GRANDES caindo     — idem, no outro sentido.
 *   PEQUENAS subindo   — fora do top 10. Aqui 5% é ruído; o corte é outro.
 *   PEQUENAS caindo    — idem.
 *
 * Cada caixa é curta de propósito. O valor está em ser um punhado que dá pra
 * ler, não um catálogo que dá pra consultar.
 */

export const DIVISOES = {
  // Quantas redes contam como "as grandes". Dez porque é o que cabe na cabeça,
  // e porque abaixo disso o tamanho já muda de ordem de grandeza.
  quantasGrandes: 10,

  // Em rede grande, mover 5% do TVL numa semana é evento. Em rede pequena, não.
  grande: { altaPct: 5, quedaPct: -5, minimoAbs: 20e6 },

  // Em rede pequena o corte é percentual alto E dinheiro de verdade, porque é
  // aqui que porcentagem engana: dobrar 300 mil dólares não é notícia.
  pequena: { altaPct: 25, quedaPct: -20, minimoAbs: 2e6, pisoTvl: 2e6 },

  // Quantas linhas por caixa. Curto é o ponto.
  porCaixa: 5,
};

/* Divide as fichas de rede nas quatro caixas.
 *
 * `fichas` vem de `montarFichas` (sinais.js) e já está ordenada por TVL, o que
 * torna as 10 primeiras "as grandes" sem precisar reordenar. */
export function dividirRedes(fichas, lim = DIVISOES) {
  const comHistorico = fichas.filter((f) => f.varTvl7d != null && f.absTvl7d != null);
  const grandes = new Set(fichas.slice(0, lim.quantasGrandes).map((f) => f.rede));

  const caixa = (eGrande, subindo) => {
    const regra = eGrande ? lim.grande : lim.pequena;
    return comHistorico
      .filter((f) => {
        if (grandes.has(f.rede) !== eGrande) return false;
        if (!eGrande && f.tvl < regra.pisoTvl) return false;
        return subindo
          ? f.varTvl7d >= regra.altaPct && f.absTvl7d >= regra.minimoAbs
          : f.varTvl7d <= regra.quedaPct && f.absTvl7d <= -regra.minimoAbs;
      })
      // Ordenado pelo TAMANHO DO MOVIMENTO EM DÓLARES, não pela porcentagem.
      // Numa caixa onde todos já passaram do corte percentual, o que separa é
      // quanto dinheiro de fato se moveu.
      .sort((a, b) => (subindo ? b.absTvl7d - a.absTvl7d : a.absTvl7d - b.absTvl7d))
      .slice(0, lim.porCaixa);
  };

  return {
    grandes: { subiram: caixa(true, true), cairam: caixa(true, false) },
    pequenas: { subiram: caixa(false, true), cairam: caixa(false, false) },
  };
}

/* A frase de uma rede, escrita com os números dela.
 *
 * `qualidade` e `stablesOk` são opcionais: quando faltam, a frase diz menos, mas
 * não diz nada errado. */
export function porqueDaRede(f, { qualidade = null, eGrande = false } = {}) {
  const p = (v, d = 1) => (v == null ? "?" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`);
  const d = (v) => {
    if (v == null) return "?";
    const s = v < 0 ? "-" : "", n = Math.abs(v);
    if (n >= 1e9) return `${s}$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${s}$${(n / 1e6).toFixed(0)}M`;
    return `${s}$${(n / 1e3).toFixed(0)}k`;
  };

  const partes = [`${p(f.varTvl7d)} na semana (${d(f.absTvl7d)}).`];

  // A distinção que o radar existe pra fazer: entrou dinheiro, ou o token subiu?
  if (f.varStables7d != null) {
    partes.push(f.varStables7d >= 10
      ? `Stablecoin ${p(f.varStables7d)} junto — é dinheiro de verdade chegando.`
      : f.varStables7d <= -10
        ? `Stablecoin ${p(f.varStables7d)} — está saindo dinheiro de verdade.`
        : `Stablecoin quase parada (${p(f.varStables7d)}) — o movimento é mais preço que depósito.`);
  }

  // O contexto que só os quatro períodos dão.
  if (f.varTvl1d != null && f.varTvl7d > 20 && f.varTvl1d >= f.varTvl7d * 0.9) {
    partes.push("Tudo isso aconteceu nas últimas 24h — é um evento, não tendência.");
  } else if (f.varTvl90d != null && f.varTvl7d > 15 && f.varTvl90d < 0) {
    partes.push("No trimestre ainda está negativa: parece recuperação, não crescimento novo.");
  }

  if (qualidade?.alugado != null && qualidade.alugado >= 60) {
    partes.push(`${qualidade.alugado.toFixed(0)}% do rendimento da rede é incentivo — parte desse dinheiro está sendo pago pra ficar.`);
  }

  if (!eGrande && f.tvl != null && f.tvl < 20e6) {
    partes.push("Rede pequena: um único depósito grande move esse número.");
  }

  return partes.join(" ");
}

/* Divide as pools medidas nas caixas que interessam a quem vive de renda.
 *
 * Não é por rede nem por tamanho: é por COMPORTAMENTO, que é o que muda a
 * decisão. Uma pool firme de 9% e uma loteria de 74% não competem entre si. */
export function dividirPools(medidas, porCaixa = 6) {
  const de = (classe, ordenar) =>
    medidas.filter((m) => m.classe === classe).sort(ordenar).slice(0, porCaixa);

  /* Ordena pelo MULTIPLICADOR do método (Taxas24h/TVL), com o chão desempatando.
   *
   * Era por chão — a minha métrica. O método do Rayakuza manda pelo multiplicador,
   * e ele decide. O chão continua na tela e continua desempatando, porque entre
   * duas pools de multiplicador parecido a que de fato pagou é a melhor escolha
   * — mas quem manda na ordem é a régua dele. */
  const porMultiplicador = (a, b) => {
    const ma = a.multiplicador ?? -1, mb = b.multiplicador ?? -1;
    if (mb !== ma) return mb - ma;
    return (b.chao ?? -1) - (a.chao ?? -1);
  };

  return {
    // As que pagam parecido todo dia, com rendimento vindo de taxas.
    firmes: de("firme", porMultiplicador),
    // Pagam bem e regular, mas com token emitido: tem prazo.
    alugadas: de("alugada", porMultiplicador),
    // Cartaz grande, chão baixo. Ordenadas pelo tamanho da promessa não cumprida.
    loterias: de("loteria", (a, b) => (b.abismo ?? 0) - (a.abismo ?? 0)),
    // Recém-montadas: sem histórico, mas é onde estão construindo agora.
    novas: de("nova", (a, b) => (b.tvl ?? 0) - (a.tvl ?? 0)),
  };
}

/* O que mudou desde a última leitura.
 *
 * Compara duas listas de identificadores e devolve quem entrou e quem saiu.
 * É o "o que mudou desde ontem" — a parte que evita reler o que já se leu. */
export function oQueMudou(hoje, ontem, chave = (x) => x.id) {
  const antes = new Set((ontem || []).map(chave));
  const agora = new Set((hoje || []).map(chave));
  return {
    entraram: (hoje || []).filter((x) => !antes.has(chave(x))),
    sairam: (ontem || []).filter((x) => !agora.has(chave(x))),
  };
}
