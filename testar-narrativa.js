/* Prova a leitura de narrativa, de fluxo por rede, do par e do volume.
 *
 *   node testar-narrativa.js
 */

import {
  agruparPorNarrativa, dividirNarrativas, porqueDaNarrativa, fluxoDeRedes,
} from "./src/narrativa.js";
import { separarPar, riscoDoPar, tendenciaDeVolume, medirPool, porque } from "./src/rendimento.js";

let passou = 0, falhou = 0;
const M = 1e6, B = 1e9;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const proto = (nome, categoria, tvl, tvl7d, tvl30d = tvl7d) =>
  ({ nome, categoria, tvl, tvl7d, tvl30d, redes: ["Ethereum"] });

// ---------------------------------------------------------------------------
titulo("A narrativa é a categoria que recebeu dinheiro");

{
  const protos = [
    proto("A1", "Lending", 20 * B, 20.4 * B),
    proto("A2", "Lending", 5 * B, 5 * B),
    proto("B1", "Yield", 3 * B, 2.8 * B),
    proto("B2", "Yield", 1.8 * B, 1.77 * B),
    proto("C1", "Dexs", 12 * B, 11.8 * B),
    proto("D1", "Poeira", 10 * M, 5 * M),
  ];
  const linhas = agruparPorNarrativa(protos);
  const d = dividirNarrativas(linhas);

  conferir("categoria pequena demais não vira narrativa",
    !linhas.some((l) => l.narrativa === "Poeira"),
    "um protocolo de $10M não é um tema de mercado");
  conferir("Yield aparece puxando", d.puxando.some((l) => l.narrativa === "Yield"));
  conferir("Lending aparece perdendo", d.perdendo.some((l) => l.narrativa === "Lending"));
  conferir("ordenado por dólar, não por porcentagem",
    d.puxando[0].delta7d >= d.puxando[1].delta7d);

  const rend = linhas.find((l) => l.narrativa === "Yield");
  conferir("soma os protocolos da categoria", Math.round(rend.tamanho / 1e9) === 5);
  conferir("conta quantos protocolos são", rend.protocolos === 2);
  conferir("aponta quem puxou dentro da narrativa", rend.puxando[0].nome === "B1");
}

{
  // O caso que a ordenação por dólar esconde: pequena crescendo rápido.
  const protos = [
    proto("Gigante", "Lending", 40 * B, 39.5 * B),
    proto("Nova", "Leveraged Farming", 380 * M, 225 * M),
  ];
  const d = dividirNarrativas(agruparPorNarrativa(protos));
  conferir("a gigante lidera por dólar", d.puxando[0].narrativa === "Lending");
  conferir("mas a pequena explodindo aparece em 'emergindo'",
    d.emergindo.some((l) => l.narrativa === "Leveraged Farming"),
    "é onde a narrativa nova aparece antes de ser grande");
  conferir("e a gigante não é 'emergindo'",
    !d.emergindo.some((l) => l.narrativa === "Lending"),
    "+1,3% não é uma narrativa emergindo");
}

// ---------------------------------------------------------------------------
titulo("A frase da narrativa lê a virada");

{
  const virando = {
    narrativa: "X", tamanho: 3 * B, protocolos: 9,
    delta7d: 200 * M, pct7d: 7, delta30d: -100 * M, pct30d: -3,
    puxando: [{ nome: "Spark", delta: 150 * M }], largando: [],
  };
  conferir("diz quando a virada é desta semana",
    porqueDaNarrativa(virando).includes("virada é desta semana"));

  const realizando = {
    narrativa: "Y", tamanho: 3 * B, protocolos: 9,
    delta7d: -200 * M, pct7d: -6, delta30d: 400 * M, pct30d: 15,
    puxando: [], largando: [{ nome: "Algum", delta: -180 * M }],
  };
  conferir("distingue realização de abandono",
    porqueDaNarrativa(realizando).includes("realização, não abandono"),
    "sair depois de subir muito é diferente de fugir");
  conferir("e diz quem largou", porqueDaNarrativa(realizando).includes("Quem larga"));
}

// ---------------------------------------------------------------------------
titulo("Fluxo por rede, em dólares");

{
  const f = (rede, abs) => ({ rede, absTvl7d: abs, tvl: 100 * M });
  const fluxo = fluxoDeRedes([
    f("Ganha1", 200 * M), f("Ganha2", 50 * M),
    f("Perde1", -300 * M), f("Perde2", -10 * M),
    f("Parada", 1 * M),
    { rede: "SemDado", absTvl7d: null },
  ]);
  conferir("quem mais ganhou vem primeiro", fluxo.ganhando[0].rede === "Ganha1");
  conferir("quem mais perdeu vem primeiro", fluxo.perdendo[0].rede === "Perde1");
  conferir("rede parada não entra", !fluxo.ganhando.some((x) => x.rede === "Parada"));
  conferir("rede sem dado não entra",
    !fluxo.ganhando.concat(fluxo.perdendo).some((x) => x.rede === "SemDado"));
}

// ---------------------------------------------------------------------------
titulo("O par de tokens, separado");

{
  conferir("separa o par no hífen", separarPar("USDCAD-USDC").tokens.length === 2);
  conferir("escreve legível", separarPar("WSOL-USELESS").texto === "WSOL + USELESS");
  conferir("posição única é reconhecida", separarPar("STEAKUSDG").tipo === "único");
  conferir("símbolo vazio não quebra", separarPar("").tokens.length === 0);

  conferir("par de duas stablecoins é 'par estável'",
    riscoDoPar("USDC-USDT").rotulo === "par estável");
  conferir("stablecoin sozinha é 'stablecoin'",
    riscoDoPar("USDC").rotulo === "stablecoin");
  conferir("um lado estável e outro não é 'meio estável'",
    riscoDoPar("WETH-USDC").rotulo === "meio estável");
  conferir("e a explicação avisa da perda por descolamento",
    riscoDoPar("WETH-USDC").explica.includes("perde valor mesmo"));
  conferir("dois voláteis é 'par volátil'",
    riscoDoPar("WSOL-USELESS").rotulo === "par volátil");
  conferir("mas se a API diz que andam juntos, é 'par ligado'",
    riscoDoPar("WETH-STETH", "no").rotulo === "par ligado");
}

// ---------------------------------------------------------------------------
titulo("Volume: o aviso que chega antes");

{
  const caindo = tendenciaDeVolume(2 * M, 35 * M);
  conferir("volume abaixo da média é 'caindo'", caindo.direcao === "caindo");
  const subindo = tendenciaDeVolume(10 * M, 35 * M);
  conferir("volume acima da média é 'subindo'", subindo.direcao === "subindo");
  const parado = tendenciaDeVolume(5 * M, 35 * M);
  conferir("volume na média é 'parado'", parado.direcao === "parado",
    "sem folga, todo fim de semana viraria alarme");

  conferir("pool sem volume não é medida",
    tendenciaDeVolume(null, null).aplica === false,
    "empréstimo e staking não negociam; dizer 'volume caindo' seria besteira");
  conferir("e o motivo é dito", tendenciaDeVolume(null, null).motivo === "não negocia");
  conferir("volume minúsculo não vira tendência",
    tendenciaDeVolume(1000, 5000).aplica === false,
    "foi assim que pools de $0 apareceram liderando queda e alta ao mesmo tempo");
}

// ---------------------------------------------------------------------------
titulo("A trajetória do rendimento");

{
  const serie = (a) => a.map((apy, i) => ({ dia: String(i), apy, tvl: 10 * M }));
  const acelerando = medirPool(serie([...Array(23).fill(5), ...Array(6).fill(9), 14]),
    { cartaz: 14, emitidoPct: 0 });
  conferir("ontem > semana > mês é 'acelerando'", acelerando.trajetoria === "acelerando");

  const murchando = medirPool(serie([...Array(23).fill(20), ...Array(6).fill(10), 4]),
    { cartaz: 4, emitidoPct: 0 });
  conferir("a ordem inversa é 'murchando'", murchando.trajetoria === "murchando");

  const parada = medirPool(serie(Array(30).fill(8)), { cartaz: 8, emitidoPct: 0 });
  conferir("série constante é 'estável'", parada.trajetoria === "estável");

  conferir("a frase escreve 'murchando' com os três números",
    porque(murchando).includes("Vem murchando") &&
    porque(murchando).includes("no mês"));
  conferir("e 'acelerando' quando é o contrário",
    porque(acelerando).includes("Vem acelerando"));
}

// ---------------------------------------------------------------------------
titulo("O aviso de volume entra na frase da pool");

{
  const serie = (a) => a.map((apy, i) => ({ dia: String(i), apy, tvl: 10 * M }));
  const comVolumeCaindo = medirPool(serie(Array(30).fill(9)), {
    cartaz: 9, emitidoPct: 0, volume1d: 1 * M, volume7d: 35 * M,
  });
  conferir("a frase avisa que o volume caiu",
    porque(comVolumeCaindo).includes("volume de negociação caiu"));
  conferir("e diz que o rendimento costuma seguir",
    porque(comVolumeCaindo).includes("rendimento costuma seguir"),
    "é a única leitura do radar que olha pra frente");

  const semVolume = medirPool(serie(Array(30).fill(9)), { cartaz: 9, emitidoPct: 0 });
  conferir("pool que não negocia não ganha frase de volume",
    !porque(semVolume).includes("volume"));
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
