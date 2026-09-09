/* Prova a leitura de uma posição de pool concentrada, contra a posição REAL.
 *
 *   node testar-orca.js
 *
 * O que torna este teste diferente dos outros: ele não usa dado inventado. Os
 * bytes em provas/orca-posicao.txt são uma posição real de US$ 10 aberta na
 * Orca em 08/09/2026, lida da Solana no mesmo minuto em que ele mandou o print
 * da tela. Então dá pra conferir número contra número:
 *
 *     a Orca dizia          faixa 120.481500 – 124.762300
 *     a Orca dizia          Balance $9.94
 *     a Orca dizia          -1.88% e +2.13%
 *
 * Decodificar conta de blockchain é ler bytes por deslocamento. Um campo lido
 * dois bytes adiante não dá erro: dá um número plausível e errado. Por isso a
 * conferência é contra uma tela que ele viu com os próprios olhos.
 *
 * Sem rede: os bytes estão no arquivo.
 */

import { existsSync } from "node:fs";

/* AS PROVAS NÃO VÊM NO REPOSITÓRIO, e o motivo importa: são os bytes de uma
 * posição REAL, lidos da blockchain — e dentro deles vai o endereço da carteira
 * de quem gravou. Endereço público não move dinheiro, mas expõe o patrimônio
 * inteiro de uma pessoa pra sempre. Então cada instalação grava as SUAS provas
 * (uma posição sua, os bytes dela, a tela que você viu) e este teste confere
 * contra elas. Sem provas, ele se declara pulado — alto, pra ninguém achar que
 * a decodificação foi conferida quando não foi. */
if (!existsSync("provas/orca-posicao.txt")) {
  console.log("\nPULADO — provas/ não existe neste repositório.");
  console.log("Este teste confere a decodificação contra bytes de uma posição REAL.");
  console.log("Grave a sua (veja o cabeçalho deste arquivo) e rode de novo.");
  process.exit(0);
}

import { readFileSync } from "node:fs";
import {
  lerPosicao, lerPool, precoDoTick, quantidadesDaPosicao, lerFaixa,
  paraBase58, pareceEnderecoSolana, TAMANHO_POSICAO, TAMANHO_POOL, BORDA,
  inicioDoTickArray, lerTickDoArray, taxasNaoColhidas, TAMANHO_TICK_ARRAY,
} from "./src/orca.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const perto = (a, b, folga) => Math.abs(a - b) <= folga;

const bruto = readFileSync("provas/orca-posicao.txt", "utf8");
const pegar = (nome) => {
  const linha = bruto.split("\n").find((l) => l.startsWith(nome + "="));
  return Uint8Array.from(Buffer.from(linha.split("=")[1].trim(), "base64"));
};
const BYTES_POSICAO = pegar("POSICAO");
const BYTES_POOL = pegar("POOL");

const CASAS_SOL = 9, CASAS_USDC = 6;

// ---------------------------------------------------------------------------
titulo("Os tamanhos conferem a leitura inteira");

conferir("a posição tem 216 bytes", BYTES_POSICAO.length === TAMANHO_POSICAO,
  `veio ${BYTES_POSICAO.length}`);
conferir("a pool tem 653 bytes", BYTES_POOL.length === TAMANHO_POOL,
  "se a soma dos campos não desse 653, algum estaria no lugar errado");

// ---------------------------------------------------------------------------
titulo("A posição, decodificada");

const p = lerPosicao(BYTES_POSICAO);
const w = lerPool(BYTES_POOL);

conferir("não deu erro", !p.erro && !w.erro, p.erro || w.erro || "");
conferir("a posição aponta para a pool certa",
  p.pool === "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
  `veio ${p.pool}`);
conferir("é o Position NFT que ele mandou",
  p.mint === "BuGcyAHRMydJdWsLRT4SeZEbmc7DJutW4B4tWRDyrRoM", `veio ${p.mint}`);
conferir("os ticks da faixa vieram", p.tickBaixo === -22908 && p.tickAlto === -22508,
  `${p.tickBaixo} a ${p.tickAlto}`);
conferir("a liquidez é um número de verdade", p.liquidez > 0n);
conferir("nada de taxa devida ainda", p.taxaDevidaA === 0n && p.taxaDevidaB === 0n,
  "a Orca mostrava Pending Yield < $0.01");

conferir("a pool é SOL de um lado",
  w.mintA === "So11111111111111111111111111111111111111112", `veio ${w.mintA}`);
conferir("e USDC do outro",
  w.mintB === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", `veio ${w.mintB}`);
conferir("a taxa da pool é 0,04%", perto(w.taxaPct, 0.04, 1e-9),
  `veio ${w.taxaPct} — a Orca mostrava 0.04% ao lado do par`);

// ---------------------------------------------------------------------------
titulo("A FAIXA — contra o que a tela dele mostrava");

{
  const fundo = precoDoTick(p.tickBaixo, CASAS_SOL, CASAS_USDC);
  const topo = precoDoTick(p.tickAlto, CASAS_SOL, CASAS_USDC);
  conferir("o fundo bate com 120.481500", perto(fundo, 120.481500, 0.000001),
    `saiu ${fundo.toFixed(6)}`);
  conferir("o topo bate com 124.762300", perto(topo, 124.762300, 0.000001),
    `saiu ${topo.toFixed(6)}`);
}

// ---------------------------------------------------------------------------
titulo("O VALOR — contra os US$ 9,94 da tela dele");

{
  const q = quantidadesDaPosicao(p, w, CASAS_SOL, CASAS_USDC);
  const valor = q.qtdA * q.preco + q.qtdB;
  conferir("o valor da posição dá perto de US$ 9,94", perto(valor, 9.94, 0.05),
    `saiu US$ ${valor.toFixed(2)}`);
  conferir("tem SOL e tem USDC dentro, como uma posição dentro da faixa",
    q.qtdA > 0 && q.qtdB > 0, `${q.qtdA} SOL e ${q.qtdB} USDC`);
  conferir("o preço lido fica perto de 103,1", perto(q.preco, 103.1, 0.6),
    `saiu ${q.preco.toFixed(5)} — a Orca mostrava 103.13`);
}

// ---------------------------------------------------------------------------
titulo("A leitura da faixa: dentro, perto da borda, fora");

{
  const fundo = 120.481500, topo = 124.762300;
  const r = lerFaixa(103.13, fundo, topo);
  conferir("103,13 está dentro", r.dentro && r.estado === "dentro");
  conferir("e as distâncias batem com -1,88% e +2,13%",
    perto(r.ateFundo, -1.88, 0.05) && perto(r.ateTopo, 2.13, 0.05),
    `saiu ${r.ateFundo.toFixed(2)}% e ${r.ateTopo.toFixed(2)}%`);
  conferir("o texto traz os dois números", r.texto.includes("fundo") && r.texto.includes("topo"));

  conferir("colado no fundo já é perto da borda",
    lerFaixa(101.4, fundo, topo).estado === "perto-da-borda");
  conferir("colado no topo também",
    lerFaixa(105.1, fundo, topo).estado === "perto-da-borda");
  conferir("e o texto diz de que lado",
    lerFaixa(101.4, fundo, topo).texto.includes("baixo") &&
    lerFaixa(105.1, fundo, topo).texto.includes("cima"));

  const caiu = lerFaixa(95, fundo, topo);
  conferir("abaixo da faixa é FORA", caiu.estado === "fora-baixo" && !caiu.dentro);
  conferir("e o texto explica o que isso significa",
    caiu.texto.includes("parou de render"),
    "fora da faixa a posição para de render — é o que decide o dia dele");
  conferir("acima da faixa também é fora",
    lerFaixa(120, fundo, topo).estado === "fora-cima");

  conferir("o meio da faixa dá posição 0,5",
    perto(lerFaixa((fundo + topo) / 2, fundo, topo).posicao, 0.5, 0.001));
  conferir("a borda é 15% da largura", BORDA.pertoEm === 0.15);
}

conferir("faixa invertida não é lida", lerFaixa(100, 105, 101) === null);
conferir("preço zero não é lido", lerFaixa(0, 101, 105) === null);
conferir("texto no lugar de número não quebra", lerFaixa("oi", 101, 105) === null);

// ---------------------------------------------------------------------------
titulo("O RENDIMENTO — o Pending Yield, contra a tela dele");

{
  /* A conta que o protocolo faz por dentro, refeita aqui. Os bytes em
   * provas/orca-taxas.txt são as duas contas de tick da faixa dele, lidas no
   * mesmo minuto em que a Orca mostrava "Pending Yield < $0.01". */
  const taxas = readFileSync("provas/orca-taxas.txt", "utf8");
  const dela = (nome) => {
    const linha = taxas.split(String.fromCharCode(10)).find((l) => l.startsWith(nome + "="));
    return Uint8Array.from(Buffer.from(linha.split("=")[1].trim(), "base64"));
  };
  const pos = lerPosicao(dela("POSICAO"), paraBase58);
  const poo = lerPool(dela("POOL"), paraBase58);
  const arrBaixo = dela("ARRAY_BAIXO");
  const arrAlto = dela("ARRAY_ALTO");

  conferir("as contas de tick têm 9988 bytes",
    arrBaixo.length === TAMANHO_TICK_ARRAY && arrAlto.length === TAMANHO_TICK_ARRAY);

  const espacamento = poo.tickSpacing;
  conferir("o espaçamento de tick da pool é 4", espacamento === 4, `veio ${espacamento}`);

  {
    const iB = inicioDoTickArray(pos.tickBaixo, espacamento);
    const iA = inicioDoTickArray(pos.tickAlto, espacamento);
    conferir("acha a conta de baixo em -23232", iB === -23232, `saiu ${iB}`);
    conferir("e a de cima em -22528", iA === -22528, `saiu ${iA}`);
    /* Arredondar pra baixo no lado negativo é o detalhe que quebra fácil:
       Math.floor(-1.2) tem que dar -2, não -1. */
    conferir("arredonda pra baixo mesmo no negativo",
      inicioDoTickArray(-1, 4) === -352 && inicioDoTickArray(-353, 4) === -704);
  }

  const tb = lerTickDoArray(arrBaixo, -23232, espacamento, pos.tickBaixo);
  const ta = lerTickDoArray(arrAlto, -22528, espacamento, pos.tickAlto);
  conferir("os dois ticks da faixa estão iniciados", tb.iniciado && ta.iniciado,
    "tick não iniciado quer dizer que ninguém tem posição naquele limite");

  {
    const r = taxasNaoColhidas(pos, poo, tb, ta, 9, 6);
    /* Os valores gravados no arquivo, e não os da primeira medição ao vivo: os
     * bytes foram salvos alguns minutos depois, e nesse intervalo a taxa
     * continuou correndo (0,000058200 virou 0,000058310 em SOL). A diferença é
     * a prova de que a coisa anda — e é por isso que o teste confere contra o
     * arquivo, que não muda, e não contra a leitura, que muda toda hora. */
    conferir("a taxa em SOL bate com o que está no arquivo",
      perto(r.qtdA, 0.000058310, 1e-8), `saiu ${r.qtdA}`);
    conferir("e a em USDC também",
      perto(r.qtdB, 0.004810, 1e-5), `saiu ${r.qtdB}`);

    const emDolar = r.qtdA * 102.8 + r.qtdB;
    conferir("o total fica abaixo de um centavo, como a Orca dizia",
      emDolar > 0 && emDolar < 0.01, `saiu US$ ${emDolar.toFixed(6)}`);
  }

  conferir("sem as contas de tick não inventa rendimento",
    taxasNaoColhidas(pos, poo, null, ta, 9, 6) === null,
    "melhor não mostrar do que mostrar um número que eu não sei");

  {
    /* A subtração dá a volta de propósito: os contadores são de 128 bits e
     * transbordam. Sem máscara, uma subtração normal daria um número negativo
     * gigante — e número gigante no rendimento é o erro que a pessoa acredita. */
    const falso = { ...poo, taxaGlobalA: 5n, taxaGlobalB: 5n };
    const r = taxasNaoColhidas(pos, falso, tb, ta, 9, 6);
    conferir("contador que deu a volta não vira rendimento negativo",
      r.qtdA >= 0 && r.qtdB >= 0, `saiu ${r.qtdA} e ${r.qtdB}`);
  }
}

// ---------------------------------------------------------------------------
titulo("Nenhuma frase manda fazer nada");

{
  /* Mesma regra do resto do radar. Aqui a tentação é grande: "saia da posição"
   * seria a frase natural. Mas quando sair é decisão dele, e o radar não sabe
   * nem o imposto nem o plano dele. Avisa que parou de render, e cala. */
  const PROIBIDO = /\b(saia|sair|retire|feche|fechar|desfaça|venda|compre|recomendo|deveria|melhor)\b/i;
  const textos = [
    lerFaixa(103.13, 101.19, 105.32).texto,
    lerFaixa(101.4, 101.19, 105.32).texto,
    lerFaixa(95, 101.19, 105.32).texto,
    lerFaixa(120, 101.19, 105.32).texto,
  ];
  conferir("nenhum aviso usa verbo de ordem", textos.every((t) => !PROIBIDO.test(t)),
    textos.find((t) => PROIBIDO.test(t)) || "");
}

// ---------------------------------------------------------------------------
titulo("Endereço: o que aceitar antes de ir à rede");

/* Um endereço público que não é de ninguém: o próprio programa Whirlpool da
   Orca. Endereço de POSIÇÃO nunca entra aqui — quem tiver um descobre em um
   clique de quem é a carteira dona, e com ela o patrimônio inteiro. */
conferir("um endereço de 43 caracteres passa",
  pareceEnderecoSolana("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"));
conferir("espaço em volta não atrapalha",
  pareceEnderecoSolana("  Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE  "));
conferir("endereço de Ethereum não passa",
  !pareceEnderecoSolana("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  "0x é outra rede: ir à Solana com ele seria pedido perdido");
conferir("texto solto não passa", !pareceEnderecoSolana("sol usdc orca"));
conferir("vazio não passa", !pareceEnderecoSolana(""));
conferir("as letras que a base58 não usa reprovam",
  !pareceEnderecoSolana("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyC0"),
  "zero, O, I e l ficam de fora do alfabeto de propósito");

conferir("base58 devolve o endereço original",
  paraBase58(BYTES_POSICAO.subarray(8, 40)) === "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE");

conferir("conta de tamanho errado é recusada com nome",
  (lerPosicao(new Uint8Array(100)).erro || "").includes("Orca"),
  "decodificar lixo daria número plausível e errado");

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
