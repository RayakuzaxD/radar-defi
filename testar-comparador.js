/* Prova o comparador do mesmo par entre redes.
 *
 *   node testar-comparador.js
 *
 * O caso que dá nome ao arquivo é o da aula "Pools na prática": ETH-USDC dando
 * 12,44 na Ethereum e 10,92 na Arbitrum, e o Lucas escolhendo a ARBITRUM por
 * causa do TVL menor. Se essa conferência ficar vermelha, o radar voltou a
 * responder "o maior número" onde o método responde outra coisa.
 */

import {
  COMPARACAO, chaveDoPar, agruparPorPar, compararPar,
  paresQueValemComparar, porqueDaComparacao,
} from "./src/comparador.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const M = 1e6;
const pool = (o) => ({ projeto: "x", rede: "y", simbolo: "A-B", tvl: 10 * M, multiplicador: 0.1, ...o });

// ---------------------------------------------------------------------------
titulo("A chave do par junta o que é a mesma coisa");

conferir("a ordem dos tokens não importa",
  chaveDoPar("ETH-USDC") === chaveDoPar("USDC-ETH"),
  "no banco havia 7 pools em 'ETH-USDC' e 4 em 'USDC-ETH', separadas só pela ordem");
conferir("token embalado é o mesmo token", chaveDoPar("WETH-USDC") === chaveDoPar("ETH-USDC"));
conferir("WSOL também", chaveDoPar("WSOL-USDC") === chaveDoPar("SOL-USDC"));
conferir("e as versões de Bitcoin", chaveDoPar("CBBTC-USDC") === chaveDoPar("WBTC-USDC"));
conferir("a barra serve de separador igual ao hífen", chaveDoPar("ETH/USDC") === chaveDoPar("ETH-USDC"));

/* O limite deliberado: stablecoins NÃO se fundem entre si. */
conferir("USDC e USDT continuam sendo pares diferentes",
  chaveDoPar("ETH-USDC") !== chaveDoPar("ETH-USDT"),
  "emissores diferentes são risco diferente; juntar esconderia uma escolha real");

conferir("par repetido colapsa", chaveDoPar("ETH-WETH") === "ETH");
conferir("símbolo vazio não vira chave", chaveDoPar("") === null && chaveDoPar(null) === null);

// ---------------------------------------------------------------------------
titulo("Agrupar só o que dá pra comparar");

{
  const g = agruparPorPar([
    pool({ simbolo: "ETH-USDC", rede: "Ethereum" }),
    pool({ simbolo: "USDC-WETH", rede: "Arbitrum" }),
    pool({ simbolo: "SOL-USDC", rede: "Solana" }),
  ]);
  conferir("pares equivalentes caem no mesmo grupo", g.get("ETH-USDC")?.length === 2);
  conferir("par que só existe num lugar é descartado", !g.has("SOL-USDC"),
    "comparar um com nenhum não é comparação");
}

{
  const g = agruparPorPar([
    pool({ simbolo: "ETH-USDC", multiplicador: null }),
    pool({ simbolo: "ETH-USDC", multiplicador: 0.2 }),
    pool({ simbolo: "ETH-USDC", multiplicador: 0 }),
  ]);
  conferir("pool sem multiplicador não entra no ranking", !g.has("ETH-USDC"),
    "sobrou uma só; linha 'sem dado' no meio de um ranking convida leitura errada");
}

// ---------------------------------------------------------------------------
titulo("O caso da aula: 12,44 na Ethereum contra 10,92 na Arbitrum");

{
  /* Os números são os da aula. TVL de 9,3M contra 1,9M. */
  const eth = pool({ projeto: "uniswap-v3", rede: "Ethereum", multiplicador: 12.44, tvl: 9.3 * M });
  const arb = pool({ projeto: "uniswap-v3", rede: "Arbitrum", multiplicador: 10.92, tvl: 1.9 * M });
  const c = compararPar("ETH-USDC", [arb, eth]);

  conferir("a ordem continua sendo pelo multiplicador", c.melhor === eth,
    "o método ordena por multiplicador; reordenar seria eu decidindo por ele");
  conferir("mas a nota do TVL menor aparece", c.notaDoTvl !== null,
    "é a regra da aula que eu jamais teria adivinhado");
  conferir("e aponta a Arbitrum", c.notaDoTvl.preferida === arb);
  conferir("dizendo quantas vezes menor", Math.abs(c.notaDoTvl.vezesMenor - 4.89) < 0.05,
    `saiu ${c.notaDoTvl.vezesMenor?.toFixed(2)}`);
  conferir("e explicando o motivo (fatia da pool)",
    /fatia/.test(c.notaDoTvl.texto));
  conferir("sem mandar ir pra lá",
    !/vá|entre na|escolha a|recomendo/i.test(c.notaDoTvl.texto), c.notaDoTvl.texto);
}

{
  // Multiplicador bem diferente: a nota tem que calar.
  const a = pool({ rede: "Ethereum", multiplicador: 12, tvl: 9 * M });
  const b = pool({ rede: "Arbitrum", multiplicador: 3, tvl: 1 * M });
  conferir("com multiplicador 4x maior, o TVL menor não vira nota",
    compararPar("ETH-USDC", [a, b]).notaDoTvl === null,
    "ele delimita: 'só quando é muito, muito, muito próximo'");
}

{
  // Empatados mas TVL parecido: também cala.
  const a = pool({ rede: "Ethereum", multiplicador: 12, tvl: 9 * M });
  const b = pool({ rede: "Arbitrum", multiplicador: 11, tvl: 8 * M });
  conferir("empate com TVL parecido não vira nota",
    compararPar("ETH-USDC", [a, b]).notaDoTvl === null,
    "'e quando o TVL é muito discrepante um do outro'");
}

// ---------------------------------------------------------------------------
titulo("O espalhamento — o número que justifica a tela");

{
  const c = compararPar("ETH-USDC", [
    pool({ rede: "Ethereum", multiplicador: 0.447 }),
    pool({ rede: "Base", multiplicador: 0.053 }),
  ]);
  conferir("mede quantas vezes o melhor paga mais que o pior",
    Math.abs(c.espalhamento - 8.43) < 0.05, `saiu ${c.espalhamento?.toFixed(2)}`);
  conferir("conta as redes", c.redes === 2);
  conferir("e os protocolos", c.dexes === 1);
}

{
  const pools = [
    pool({ simbolo: "ETH-USDC", rede: "Ethereum", multiplicador: 0.447 }),
    pool({ simbolo: "ETH-USDC", rede: "Base", multiplicador: 0.053 }),
    pool({ simbolo: "AAA-BBB", rede: "Ethereum", multiplicador: 0.10 }),
    pool({ simbolo: "AAA-BBB", rede: "Base", multiplicador: 0.098 }),
  ];
  const lista = paresQueValemComparar(pools);
  conferir("par que quase não varia entre redes fica de fora", lista.length === 1,
    "variar 2% entre redes não merece a atenção dele");
  conferir("e o que varia muito vem primeiro", lista[0].par === "ETH-USDC");
}

// ---------------------------------------------------------------------------
titulo("A frase");

{
  const c = compararPar("ETH-USDC", [
    pool({ projeto: "uniswap-v3", rede: "Ethereum", multiplicador: 0.447, tvl: 9 * M }),
    pool({ projeto: "aerodrome", rede: "Base", multiplicador: 0.053, tvl: 8 * M }),
  ]);
  const t = porqueDaComparacao(c);
  conferir("diz quantas vezes e onde", t.includes("8.4x") && t.includes("Ethereum"));
  conferir("diz em quantas redes está", /2 redes/.test(t));
  conferir("não manda fazer nada",
    !/\b(vá|entre|abra|escolha|invista|recomendo)\b/i.test(t), t);
}

conferir("comparação vazia não quebra a frase", porqueDaComparacao(null) === "");

// ---------------------------------------------------------------------------
titulo("Os cortes vieram da aula, não de mim");

conferir("proximidade de 20% cobre os 12% do exemplo dele",
  COMPARACAO.proximidade >= (12.44 - 10.92) / 12.44);
conferir("discrepância de 3x cabe nos 4,9x do exemplo",
  COMPARACAO.discrepanciaTvl <= 9.3 / 1.9);

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
