/* Correlação entre os dois tokens de um par — e a perda que ela implica.
 *
 * O método exige isto e não dá o número:
 *
 *   "Quando montar pool com dois ativos voláteis: verificar correlação no
 *    DeFiLlama. Os ativos precisam ter alta correlação positiva — se um sobe, o
 *    outro também sobe. Alta correlação = menos Impermanent Loss porque os
 *    preços se movem juntos."
 *                        — METODOLOGIA_GENESIS, seção 4
 *
 * A regra aparece em três fontes independentes do curso, sempre sem
 * coeficiente, sem janela e sem método. Os cortes abaixo são MEUS, escolhidos a
 * partir de pares reais medidos em 05/09/2026, e estão marcados como escolha —
 * não como regra do curso. Se a transcrição das aulas trouxer o número dele,
 * é aqui que se troca.
 *
 * Nada aqui fala com a rede nem com o banco: entra série de preço, sai medida.
 */

/* Os cortes, e de onde saíram.
 *
 * Medido com 60 dias de retorno diário:
 *   ETH x BTC      0,896   o par colado que o método descreve como ideal
 *   ETH x SOL      0,708   andam juntos, mas não sempre
 *   SOL x POPCAT   0,702   a memecoin segue a rede em que vive
 *   ETH x USDC     0,116   um se move, o outro não — é o caso de IL alto
 *
 * 0,8 separa "colado" de "só parecido"; 0,5 separa "parecido" de "cada um pro
 * seu lado". São escolhas com margem, não fronteiras finas. */
export const CORRELACAO = { alta: 0.8, media: 0.5, janelaDias: 60 };

/* Retorno diário. É sobre retorno que se mede correlação, não sobre preço:
 * duas séries que só sobem dão correlação alta mesmo andando muito diferente,
 * porque ambas têm tendência. O retorno tira a tendência e deixa o movimento. */
export function retornos(precos) {
  if (!Array.isArray(precos) || precos.length < 2) return [];
  const r = [];
  for (let i = 1; i < precos.length; i++) {
    const antes = precos[i - 1];
    if (!(antes > 0) || !Number.isFinite(precos[i])) continue;
    r.push(precos[i] / antes - 1);
  }
  return r;
}

/* Pearson entre duas séries de retorno. */
export function correlacao(a, b) {
  const n = Math.min(a?.length || 0, b?.length || 0);
  // Menos de 20 pontos não sustenta um coeficiente: com 5 dias qualquer par
  // parece colado ou oposto por acaso.
  if (n < 20) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const u = x[i] - mx, v = y[i] - my;
    num += u * v; dx += u * u; dy += v * v;
  }
  /* Variância praticamente nula: não há o que correlacionar.
   *
   * Comparar com zero exato não serve. Somar 0,01 trinta vezes e dividir por
   * trinta não devolve 0,01 em ponto flutuante, então a variância de uma série
   * constante sai como 1e-36 em vez de 0 — e a divisão seguinte devolve um
   * número qualquer entre -1 e 1, com cara de correlação medida.
   *
   * O limiar é relativo ao tamanho dos retornos: 1e-9 de desvio sobre retornos
   * diários é ruído de arredondamento, não movimento de preço. */
  const desprezivel = 1e-18 * n;
  if (dx <= desprezivel || dy <= desprezivel) return null;
  return num / Math.sqrt(dx * dy);
}

export function lerCorrelacao(c) {
  if (c == null) return { nivel: "sem-dado", texto: "sem histórico de preço suficiente pra medir" };
  if (c >= CORRELACAO.alta) {
    return { nivel: "alta", texto: `andam colados (${c.toFixed(2)}) — é o que o método pede num par volátil` };
  }
  if (c >= CORRELACAO.media) {
    return { nivel: "media", texto: `andam parecido (${c.toFixed(2)}), mas não colados` };
  }
  if (c >= 0) {
    return { nivel: "baixa", texto: `andam quase independentes (${c.toFixed(2)}) — o método evita par assim` };
  }
  return { nivel: "negativa", texto: `andam em sentidos opostos (${c.toFixed(2)}) — é o pior caso pra perda por descolamento` };
}

/* Quanto os dois já se descolaram na janela, e a perda que isso implica.
 *
 * Diferente da correlação, que mede o movimento diário, isto mede o resultado:
 * onde os dois estão hoje em relação a onde começaram. Um par pode ter
 * correlação alta e ainda assim ter descolado, se um subiu mais que o outro
 * todo dia. Por isso as duas medidas aparecem juntas. */
export function descolamento(precosA, precosB) {
  const n = Math.min(precosA?.length || 0, precosB?.length || 0);
  if (n < 2) return null;
  const a0 = precosA[precosA.length - n], a1 = precosA[precosA.length - 1];
  const b0 = precosB[precosB.length - n], b1 = precosB[precosB.length - 1];
  if (!(a0 > 0) || !(b0 > 0)) return null;
  const razao = (a1 / a0) / (b1 / b0);
  // Sempre >= 1: descolar 2x pra cima e 2x pra baixo dá a mesma perda.
  return razao >= 1 ? razao : 1 / razao;
}

/* O veredito do método sobre o par.
 *
 * Só se aplica a par de dois voláteis — que é exatamente onde o método manda
 * checar. Par com stablecoin tem outro risco e outra conta. */
export function vereditoDoPar({ correlacao: c, ehParVolatil, ilEsperado }) {
  if (!ehParVolatil) {
    return { aplica: false, motivo: "a regra de correlação é pra par de dois voláteis" };
  }
  const leitura = lerCorrelacao(c);
  return {
    aplica: true,
    correlacao: c,
    leitura,
    // "precisam ter alta correlação positiva" — o método não diz "de preferência".
    aprovado: leitura.nivel === "alta",
    ilEsperado,
    texto: leitura.nivel === "alta"
      ? `Par volátil aceito pelo método: ${leitura.texto}.`
      : leitura.nivel === "sem-dado"
        ? "Par volátil sem correlação medível — o método manda checar antes de entrar."
        : `Par volátil reprovado na regra de correlação: ${leitura.texto}.`,
  };
}
