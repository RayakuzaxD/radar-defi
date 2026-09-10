/* A fonte reserva dos indicadores do curso.
 *
 *   node testar-reserva.js
 *
 * Nada aqui fala com a rede: entram números, saem números. O que este arquivo
 * guarda é a ARITMÉTICA — e ela é do tipo que erra calada. Um desvio-padrão
 * por somas correntes que conte um dia duas vezes continua devolvendo um
 * número plausível, e o Z-Score sai errado por meses sem nada na tela mudar de
 * cor.
 */

import {
  SEMENTE_DO_MERCADO, desvioDoMercado, zscoreDe, somasDoMercado, somasDeUmaLista,
} from "./src/coinmetrics.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);

/* Somas correntes a partir de uma lista, pra poder comparar com a conta
   direta sobre a mesma lista. */
const somasDe = (lista) => somasDeUmaLista(lista);
function desvioDireto(lista) {
  const m = lista.reduce((a, b) => a + b, 0) / lista.length;
  return Math.sqrt(lista.reduce((a, b) => a + (b - m) * (b - m), 0) / lista.length);
}

/* ------------------------------------------------------------------------ */
titulo("O desvio por somas correntes é o desvio de verdade");
{
  const casos = [
    ["números pequenos", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    ["mesma escala do valor de mercado", [1e11, 3e11, 8e11, 2e12, 1.5e12, 6e11]],
    ["quase constante", [1e12, 1e12 + 1, 1e12 - 1, 1e12 + 2]],
  ];
  for (const [nome, lista] of casos) {
    const a = desvioDoMercado(somasDe(lista));
    const b = desvioDireto(lista);
    const erro = Math.abs(a / b - 1);
    conferir(nome + ": bate com a conta direta", erro < 1e-6,
      a.toExponential(4) + " contra " + b.toExponential(4));
  }

  conferir("uma amostra só não tem desvio", desvioDoMercado(somasDeUmaLista([5])) === null);
  conferir("sem somas, sem desvio", desvioDoMercado(null) === null);
}

/* ------------------------------------------------------------------------ */
titulo("A semente é a de 5.898 dias, medida e não chutada");
{
  conferir("tem os 5.898 dias", SEMENTE_DO_MERCADO.n === 5898);
  conferir("vai até 09/09/2026", SEMENTE_DO_MERCADO.ate === "2026-09-09");
  const desvio = desvioDoMercado(SEMENTE_DO_MERCADO);
  /* Apurado sobre a série inteira em 10/09/2026: 6,120946e+11. Se este número
     mudar, alguém mexeu na semente — e mexer nela muda todo Z-Score que o
     radar já produziu. */
  conferir("o desvio da semente é o que foi medido",
    Math.abs(desvio / 6.120946e11 - 1) < 1e-5, desvio.toExponential(6));
}

/* ------------------------------------------------------------------------ */
titulo("O Z-Score, pela definição");
{
  /* Com MVRV = 2, o realizado é metade do mercado, então (mercado - realizado)
     é metade do mercado. Divide pelo desvio e pronto. */
  const somas = somasDeUmaLista(Array.from({ length: 100 }, (_, i) => 1e12 + (i % 2 ? 2e11 : -2e11)));
  const desvio = desvioDoMercado(somas);
  const z = zscoreDe(2e12, 2, somas);
  conferir("é (mercado − realizado) ÷ desvio",
    Math.abs(z - (2e12 - 1e12) / desvio) < 1e-9, String(z));

  conferir("MVRV = 1 dá zero: mercado igual ao realizado",
    Math.abs(zscoreDe(1e12, 1, somas)) < 1e-9);
  conferir("MVRV abaixo de 1 dá negativo", zscoreDe(1e12, 0.8, somas) < 0);

  conferir("sem mercado, sem Z", zscoreDe(0, 2, somas) === null);
  conferir("sem MVRV, sem Z", zscoreDe(1e12, 0, somas) === null);
  conferir("sem somas, sem Z", zscoreDe(1e12, 2, null) === null);
}

/* ------------------------------------------------------------------------ */
titulo("Contar o mesmo dia duas vezes seria o erro invisível");
{
  /* Este é O teste deste arquivo. A consulta à fonte devolve o dia de corte
     JUNTO com os novos — então somar tudo o que volta contaria o último dia de
     novo, uma vez por rodada, três vezes por dia. Em um mês o desvio estaria
     errado e nada na tela indicaria isso.
     A defesa é a comparação estrita (d <= ate é ignorado), e o que este teste
     prova é que ela existe e funciona. */
  const antes = { ...somasDeUmaLista([2,4,6,8,10,12,14,16,18,20]), ate: "2026-09-09" };

  /* Um "pedir" de mentira: devolve o dia de corte junto com dois dias novos,
     que é exatamente o formato que a API de verdade devolve. */
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        { time: "2026-09-09T00:00:00.000000000Z", CapMrktCurUSD: "10" },  // o de corte
        { time: "2026-09-10T00:00:00.000000000Z", CapMrktCurUSD: "20" },
        { time: "2026-09-11T00:00:00.000000000Z", CapMrktCurUSD: "30" },
      ],
    }),
  });

  const depois = await somasDoMercado(antes);
  globalThis.fetch = original;

  conferir("o dia de corte NÃO é somado de novo", depois.n === 12,
    "n virou " + depois.n + " (devia ser 12: 10 + os dois novos)");
  conferir("só os dias novos entraram", Math.abs(depois.media * depois.n - (110 + 20 + 30)) < 1e-6,
    "a soma implícita virou " + (depois.media * depois.n).toFixed(2) + " (devia ser 160)");
  conferir("a data de corte avança", depois.ate === "2026-09-11", depois.ate);
  conferir("e ela diz quantos entraram", depois.novos === 2, String(depois.novos));
}

/* ------------------------------------------------------------------------ */
titulo("Falhar na rede não apaga o que já se sabia");
{
  const antes = { ...SEMENTE_DO_MERCADO };
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("rede fora"); };
  const depois = await somasDoMercado(antes);
  globalThis.fetch = original;

  conferir("as somas antigas sobrevivem", depois.n === antes.n && depois.media === antes.media);
  conferir("e ela avisa que nada entrou", depois.novos === 0);
  /* Um desvio de ontem sobre 5.898 dias é praticamente o de hoje. Recusar o
     Z-Score inteiro por causa disso trocaria uma imprecisão invisível por um
     buraco visível — e o buraco é pior. */
  conferir("o Z-Score continua saindo", zscoreDe(2e12, 1.5, depois) != null);
}

/* ------------------------------------------------------------------------ */
titulo("Sem somas guardadas, a semente entra no lugar");
{
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("rede fora"); };
  const doNada = await somasDoMercado(null);
  globalThis.fetch = original;
  conferir("cai na semente", doNada.n === SEMENTE_DO_MERCADO.n);
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
