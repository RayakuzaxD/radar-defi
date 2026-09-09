/* Prova as contas de câmbio e de proporção da carteira.
 *
 *   node testar-cambio.js
 *
 * Esta é a conta que o Rayakuza pediu pra não ter que fazer: ele lança quanto tem
 * em cada fatia, em real ou em dólar, e a porcentagem sai daqui. Se estas
 * conferências ficarem vermelhas, o painel passa a mostrar a proporção errada
 * do patrimônio dele — que é pior que não mostrar nenhuma.
 */

import {
  CAMBIO, cotacaoPlausivel, converter, somarCarteira, fatiasEmPorcento,
} from "./src/cambio.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const perto = (a, b, tol = 1e-9) => a != null && Math.abs(a - b) < tol;
const DOLAR = 5.1259;   // a cotação real de 07/09/2026

// ---------------------------------------------------------------------------
titulo("A faixa de sanidade da cotação");

conferir("5,13 é plausível", cotacaoPlausivel(5.1259));
conferir("zero não é", !cotacaoPlausivel(0));
conferir("negativo não é", !cotacaoPlausivel(-5));
conferir("1000 não é", !cotacaoPlausivel(1000),
  "cotação fora da faixa é erro de leitura, não notícia");
conferir("texto não é", !cotacaoPlausivel("5.12"));
conferir("os limites estão declarados", CAMBIO.minimo === 1 && CAMBIO.maximo === 30);

// ---------------------------------------------------------------------------
titulo("Converter");

conferir("dólar para real multiplica", perto(converter(100, "USD", "BRL", DOLAR), 512.59, 1e-6));
conferir("real para dólar divide", perto(converter(512.59, "BRL", "USD", DOLAR), 100, 1e-6));
conferir("mesma moeda não mexe no número", converter(100, "BRL", "BRL", DOLAR) === 100);
conferir("mesma moeda funciona sem cotação", converter(100, "USD", "USD", null) === 100,
  "não precisa de câmbio pra somar dólar com dólar");
conferir("sem cotação, converter devolve null", converter(100, "USD", "BRL", null) === null,
  "converter no chute é pior que não converter");
conferir("cotação absurda também devolve null", converter(100, "USD", "BRL", 999) === null);
conferir("valor ausente devolve null", converter(null, "USD", "BRL", DOLAR) === null);
conferir("valor não numérico devolve null", converter("abc", "USD", "BRL", DOLAR) === null);

// ---------------------------------------------------------------------------
titulo("O total de uma carteira misturada");

{
  /* O caso real dele: reserva em real, cripto em dólar. */
  const carteira = [
    { fatia: "reserva de emergência", valor: 20000, moeda: "BRL" },
    { fatia: "BTC", valor: 3000, moeda: "USD" },
    { fatia: "altcoins", valor: 1000, moeda: "USD" },
  ];

  const emReal = somarCarteira(carteira, "BRL", DOLAR);
  conferir("soma em real converte só o que é dólar",
    perto(emReal.total, 20000 + 4000 * DOLAR, 1e-6), `saiu ${emReal.total}`);

  const emDolar = somarCarteira(carteira, "USD", DOLAR);
  conferir("soma em dólar converte só o que é real",
    perto(emDolar.total, 4000 + 20000 / DOLAR, 1e-6), `saiu ${emDolar.total}`);

  conferir("as duas somas são a mesma coisa em moedas diferentes",
    perto(emReal.total / DOLAR, emDolar.total, 1e-6));
  conferir("nada ficou de fora", emReal.incompleto === 0 && emDolar.incompleto === 0);
}

{
  /* Sem cotação, as linhas em outra moeda não entram — e o total AVISA. */
  const carteira = [
    { fatia: "reserva", valor: 20000, moeda: "BRL" },
    { fatia: "BTC", valor: 3000, moeda: "USD" },
  ];
  const r = somarCarteira(carteira, "BRL", null);
  conferir("sem cotação, soma só o que já está na moeda", r.total === 20000);
  conferir("e conta quantas linhas ficaram de fora", r.incompleto === 1,
    "total que esconde o que não coube é total mentiroso");
}

conferir("carteira vazia soma zero", somarCarteira([], "BRL", DOLAR).total === 0);
conferir("lista ausente não quebra", somarCarteira(null, "BRL", DOLAR).total === 0);

// ---------------------------------------------------------------------------
titulo("A porcentagem — a conta que ele não quer fazer");

{
  const carteira = [
    { fatia: "reserva", valor: 25000, moeda: "BRL" },
    { fatia: "BTC", valor: 25000, moeda: "BRL" },
  ];
  const f = fatiasEmPorcento(carteira, "BRL", DOLAR);
  conferir("metade e metade dá 50% e 50%", perto(f[0].pct, 50) && perto(f[1].pct, 50));
  conferir("as porcentagens somam 100",
    perto(f.reduce((s, x) => s + x.pct, 0), 100, 1e-9));
}

{
  const carteira = [
    { fatia: "reserva", valor: 20000, moeda: "BRL" },
    { fatia: "BTC", valor: 3000, moeda: "USD" },
    { fatia: "altcoins", valor: 1000, moeda: "USD" },
  ];
  const emReal = fatiasEmPorcento(carteira, "BRL", DOLAR);
  const emDolar = fatiasEmPorcento(carteira, "USD", DOLAR);
  conferir("a proporção NÃO muda com a moeda escolhida",
    perto(emReal[0].pct, emDolar[0].pct, 1e-9) && perto(emReal[1].pct, emDolar[1].pct, 1e-9),
    "trocar a moeda de exibição muda os números, não a carteira");
  conferir("e continua somando 100",
    perto(emReal.reduce((s, x) => s + x.pct, 0), 100, 1e-9));
}

{
  conferir("carteira zerada não vira NaN%",
    fatiasEmPorcento([{ fatia: "x", valor: 0, moeda: "BRL" }], "BRL", DOLAR)[0].pct === null,
    "dividir por zero devolveria NaN, e NaN vira 'NaN%' na tela");
  conferir("linha sem valor fica sem porcentagem",
    fatiasEmPorcento([{ fatia: "x", moeda: "BRL" }], "BRL", DOLAR)[0].pct === null);
  conferir("o valor convertido vem junto",
    perto(fatiasEmPorcento([{ fatia: "x", valor: 100, moeda: "USD" }], "BRL", DOLAR)[0].convertido,
          100 * DOLAR, 1e-6));
}

{
  /* Sem cotação, a linha em outra moeda não some da lista — ela fica sem
     porcentagem, que é diferente de valer zero. */
  const f = fatiasEmPorcento([
    { fatia: "reserva", valor: 20000, moeda: "BRL" },
    { fatia: "BTC", valor: 3000, moeda: "USD" },
  ], "BRL", null);
  conferir("sem cotação a linha em outra moeda fica sem %", f[1].pct === null);
  conferir("mas continua na lista", f.length === 2,
    "sumir com a linha faria a pessoa achar que perdeu o lançamento");
  conferir("e a que dá pra medir fica com 100%", perto(f[0].pct, 100));
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
