/* Prova a medida de correlação com séries construídas.
 *
 *   node testar-correlacao.js
 *
 * Os valores de referência vêm de pares reais medidos em 05/09/2026 com 60 dias
 * de retorno diário: ETH×BTC 0,896 · ETH×SOL 0,708 · SOL×POPCAT 0,702 ·
 * ETH×USDC 0,116.
 */

import {
  CORRELACAO, retornos, correlacao, lerCorrelacao, descolamento, vereditoDoPar,
} from "./src/correlacao.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* Constrói uma série de 60 preços a partir de retornos diários. */
const serie = (rets, inicio = 100) => {
  const p = [inicio];
  for (const r of rets) p.push(p[p.length - 1] * (1 + r));
  return p;
};
const ondas = (n, amp, fase = 0) =>
  Array.from({ length: n }, (_, i) => amp * Math.sin(i / 3 + fase));

// ---------------------------------------------------------------------------
titulo("Correlação se mede sobre retorno, não sobre preço");

{
  /* Duas séries que só sobem, mas de jeitos diferentes. Sobre PREÇO a
   * correlação seria altíssima (ambas têm tendência de alta); sobre RETORNO,
   * que é o que interessa, elas não se parecem. */
  const a = serie(Array.from({ length: 60 }, (_, i) => (i % 2 ? 0.03 : -0.01)));
  const b = serie(Array.from({ length: 60 }, (_, i) => (i % 2 ? -0.01 : 0.03)));
  const c = correlacao(retornos(a), retornos(b));
  conferir("séries que sobem juntas mas se movem opostas dão correlação negativa",
    c < -0.5,
    `saiu ${c?.toFixed(3)} — se desse positivo, a conta estaria sobre preço, não retorno`);
}

{
  const r = retornos([100, 110, 99]);
  conferir("retorno é calculado sobre o dia anterior",
    Math.abs(r[0] - 0.1) < 1e-9 && Math.abs(r[1] + 0.1) < 1e-9);
  conferir("série de um ponto não tem retorno", retornos([100]).length === 0);
  conferir("preço zero não vira divisão por zero", retornos([0, 50]).length === 0);
}

// ---------------------------------------------------------------------------
titulo("Os casos que o método descreve");

{
  // Par colado: mesmo movimento, com um ruído pequeno.
  const base = ondas(60, 0.04);
  const a = serie(base);
  const b = serie(base.map((v, i) => v + (i % 5 === 0 ? 0.004 : 0)));
  const c = correlacao(retornos(a), retornos(b));
  conferir("par colado passa de 0,8", c >= CORRELACAO.alta, `saiu ${c?.toFixed(3)}`);
  conferir("e é lido como alta", lerCorrelacao(c).nivel === "alta");
  conferir("a leitura diz que é o que o método pede",
    lerCorrelacao(c).texto.includes("método pede"));

  // Par independente: um se move, o outro fica parado (o caso volátil×stable).
  const parado = serie(Array(60).fill(0.00001));
  const cBaixa = correlacao(retornos(a), retornos(parado));
  conferir("volátil contra quase-parado dá correlação baixa",
    cBaixa == null || cBaixa < CORRELACAO.media,
    `saiu ${cBaixa?.toFixed(3)}`);

  // Par oposto: o pior caso.
  const oposto = serie(base.map((v) => -v));
  conferir("par oposto é reconhecido como negativo",
    lerCorrelacao(correlacao(retornos(a), retornos(oposto))).nivel === "negativa");
  conferir("e a leitura diz que é o pior caso",
    lerCorrelacao(-0.9).texto.includes("pior caso"));
}

// ---------------------------------------------------------------------------
titulo("Sem amostra não se afirma correlação");

{
  conferir("menos de 20 pontos devolve null",
    correlacao([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]) === null,
    "com 3 dias qualquer par parece colado por acaso");
  conferir("série constante devolve null",
    correlacao(Array(30).fill(0.01), Array(30).fill(0.02)) === null,
    "não há movimento pra correlacionar");
  conferir("null é lido como sem-dado", lerCorrelacao(null).nivel === "sem-dado");
  conferir("e a leitura explica o motivo",
    lerCorrelacao(null).texto.includes("histórico"));
}

// ---------------------------------------------------------------------------
titulo("Descolamento: onde os dois foram parar");

{
  // A dobrou, B ficou igual: descolamento de 2x.
  conferir("descolamento de 2x é medido",
    Math.abs(descolamento([100, 200], [50, 50]) - 2) < 1e-9);
  conferir("descolar pra baixo dá o mesmo número",
    Math.abs(descolamento([100, 50], [50, 50]) - 2) < 1e-9,
    "2x pra cima e 2x pra baixo dão a mesma perda");
  conferir("sem movimento, descolamento é 1", Math.abs(descolamento([10, 10], [5, 5]) - 1) < 1e-9);
  conferir("série curta devolve null", descolamento([10], [5]) === null);
}

// ---------------------------------------------------------------------------
titulo("O veredito do método sobre o par");

{
  const volatilBom = vereditoDoPar({ correlacao: 0.9, ehParVolatil: true, ilEsperado: -0.2 });
  conferir("par volátil colado é aprovado", volatilBom.aprovado === true);
  conferir("e o texto diz que foi aceito", volatilBom.texto.includes("aceito"));

  const volatilRuim = vereditoDoPar({ correlacao: 0.2, ehParVolatil: true });
  conferir("par volátil descolado é reprovado", volatilRuim.aprovado === false);
  conferir("e o texto diz reprovado", volatilRuim.texto.includes("reprovado"));

  const medio = vereditoDoPar({ correlacao: 0.65, ehParVolatil: true });
  conferir("correlação média NÃO passa",
    medio.aprovado === false,
    "o método diz 'precisam ter alta correlação', não 'de preferência'");

  const comStable = vereditoDoPar({ correlacao: 0.1, ehParVolatil: false });
  conferir("par com stablecoin não é julgado por esta regra", comStable.aplica === false);
  conferir("e o motivo é dito", comStable.motivo.includes("dois voláteis"));

  const semDado = vereditoDoPar({ correlacao: null, ehParVolatil: true });
  conferir("sem correlação medível não se aprova", semDado.aprovado === false);
  conferir("mas o texto distingue 'não medi' de 'reprovou'",
    semDado.texto.includes("sem correlação medível"),
    "reprovar por falta de dado seria afirmar o que não se sabe");
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
