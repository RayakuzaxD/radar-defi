/* Prova o acompanhamento das pools em que o Rayakuza já está.
 *
 *   node testar-carteira.js
 *
 * A regra que estas conferências protegem, e que é a mais fácil de quebrar sem
 * perceber: NENHUMA frase daqui manda ele fazer alguma coisa. O radar diz o que
 * mudou desde o dia em que ele entrou; o que fazer é decisão dele, e "sai dessa
 * pool" saindo de mim seria palpite com cara de análise.
 *
 * A segunda regra: todo número aparece com o par dele. "Chão 12%" não diz nada
 * a quem entrou quando era 30%.
 */

import {
  CARTEIRA, oQueMudouNaMinha, situacaoDaMinha, fotoDaEntrada, diasEntre,
} from "./src/carteira.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const M = 1e6;
const entrada = {
  id: "abc", projeto: "raydium-amm", simbolo: "RAY-USDC", rede: "Solana",
  desde: "2026-08-01",
  chao_entrada: 30, cartaz_entrada: 45, apy_base_entrada: 30,
  incentivo_entrada: 10, tvl_entrada: 10 * M, correlacao_entrada: 0.88,
  classe_entrada: "firme", passava_entrada: 1,
};
const hoje = {
  id: "abc", dia: "2026-09-06", chao: 29, cartaz: 44, emitido: 12,
  tvl: 9.5 * M, correlacao: 0.86, classe: "firme", portao_passa: 1,
};
const tipos = (ms) => ms.map((m) => m.tipo);

// ---------------------------------------------------------------------------
titulo("Sem mudança é resposta, não silêncio");

{
  const ms = oQueMudouNaMinha(entrada, hoje);
  conferir("oscilação normal não vira aviso", ms.length === 0, tipos(ms).join(", "));

  const s = situacaoDaMinha(entrada, hoje);
  conferir("mas o /minhas ainda diz alguma coisa", s.resumo.length > 10);
  conferir("e diz há quantos dias ele está lá", s.dias === 36, `saiu ${s.dias}`);
  conferir("com os dois números lado a lado",
    s.chaoEntrada === 30 && s.chaoHoje === 29,
    "chão de hoje sozinho não diz nada a quem entrou com outro");
}

// ---------------------------------------------------------------------------
titulo("O chão caindo — a medida em que ele se baseou");

{
  const ms = oQueMudouNaMinha(entrada, { ...hoje, chao: 15 });
  conferir("queda pela metade avisa", tipos(ms).includes("chao-caiu"));
  conferir("e a frase traz os dois números",
    ms[0].texto.includes("30.0%") && ms[0].texto.includes("15.0%"), ms[0].texto);
  conferir("sem mandar fazer nada",
    !/saia|sai da|venda|vender|tire|retire|recomend/i.test(ms[0].texto), ms[0].texto);

  conferir("queda de 10% não interrompe",
    oQueMudouNaMinha(entrada, { ...hoje, chao: 27 }).length === 0,
    "aviso que toca por ruído ensina a ignorar aviso");
}

{
  const ms = oQueMudouNaMinha(entrada, { ...hoje, chao: 50 });
  conferir("subida também é avisada", tipos(ms).includes("chao-subiu"),
    "radar que só avisa de coisa ruim ensina a temer a notificação");
}

// ---------------------------------------------------------------------------
titulo("O incentivo acabando — o evento com prazo do método");

{
  const comIncentivo = { ...entrada, incentivo_entrada: 70 };
  const ms = oQueMudouNaMinha(comIncentivo, { ...hoje, emitido: 0 });
  conferir("incentivo que acabou avisa", tipos(ms).includes("incentivo-acabou"));
  conferir("dizendo quanto era e quanto é",
    ms[0].texto.includes("70%") && ms[0].texto.includes("0%"), ms[0].texto);
  conferir("e sem mandar sair",
    !/saia|venda|tire/i.test(ms[0].texto),
    "o Guia 3 diz 'saia antes que terminem'; quem decide isso é ele, não eu");

  /* Quem entrou numa pool que já não tinha incentivo não deve receber aviso de
   * incentivo que acabou — não acabou nada, nunca houve. */
  conferir("pool que nunca teve incentivo não gera esse aviso",
    !tipos(oQueMudouNaMinha({ ...entrada, incentivo_entrada: 2 }, { ...hoje, emitido: 0 }))
      .includes("incentivo-acabou"));
}

{
  const ms = oQueMudouNaMinha(entrada, { ...hoje, emitido: 80 });
  conferir("rendimento que virou incentivo avisa", tipos(ms).includes("incentivo-tomou-conta"));
  conferir("e explica que sobra menos de taxa do que parecia",
    ms[0].texto.includes("taxa"), ms[0].texto);
}

// ---------------------------------------------------------------------------
titulo("O dinheiro saindo da pool");

{
  const ms = oQueMudouNaMinha(entrada, { ...hoje, tvl: 3 * M });
  conferir("metade do TVL indo embora avisa", tipos(ms).includes("tvl-caiu"));
  conferir("e diz por que isso importa",
    /menos taxa|sem mexer no preço/.test(ms[0].texto), ms[0].texto);
  conferir("queda de 20% não interrompe",
    !tipos(oQueMudouNaMinha(entrada, { ...hoje, tvl: 8 * M })).includes("tvl-caiu"));
}

// ---------------------------------------------------------------------------
titulo("Os portões e o par");

{
  const ms = oQueMudouNaMinha(entrada, {
    ...hoje, portao_passa: 0,
    portao_motivos: JSON.stringify(["TVL abaixo do mínimo de $500k"]),
  });
  conferir("deixar de passar nos portões avisa", tipos(ms).includes("saiu-dos-portoes"));
  conferir("com o motivo junto", ms.find((m) => m.tipo === "saiu-dos-portoes").texto.includes("TVL abaixo"));

  conferir("motivo ilegível não vira aviso mudo",
    oQueMudouNaMinha(entrada, { ...hoje, portao_passa: 0, portao_motivos: "{quebrado" })
      .some((m) => m.tipo === "saiu-dos-portoes"));

  conferir("pool que já entrou barrada não gera esse aviso",
    !tipos(oQueMudouNaMinha({ ...entrada, passava_entrada: 0 }, { ...hoje, portao_passa: 0 }))
      .includes("saiu-dos-portoes"));
}

{
  const ms = oQueMudouNaMinha(entrada, { ...hoje, correlacao: 0.2 });
  conferir("par que se soltou avisa", tipos(ms).includes("correlacao-quebrou"));
  conferir("com os dois coeficientes",
    ms.find((m) => m.tipo === "correlacao-quebrou").texto.includes("0.88"));

  conferir("par que já entrou solto não gera aviso de quebra",
    !tipos(oQueMudouNaMinha({ ...entrada, correlacao_entrada: 0.3 }, { ...hoje, correlacao: 0.2 }))
      .includes("correlacao-quebrou"));
}

{
  const ms = oQueMudouNaMinha(entrada, { ...hoje, classe: "loteria" });
  conferir("mudar de caixa avisa", tipos(ms).includes("mudou-de-classe"));
  conferir("dizendo de qual pra qual",
    ms.find((m) => m.tipo === "mudou-de-classe").texto.includes("loteria"));
}

// ---------------------------------------------------------------------------
titulo("Quando a pool some da medição");

{
  const ms = oQueMudouNaMinha(entrada, null);
  conferir("some vira aviso", ms.length === 1 && ms[0].tipo === "sumiu");
  conferir("mas NÃO se afirma que a pool acabou",
    !/acabou|encerrad|fechou/i.test(ms[0].texto),
    "sumir da medição tem três causas possíveis e daqui não dá pra saber qual");
  conferir("e as três são ditas",
    /encolhido/.test(ms[0].texto) && /endereço/.test(ms[0].texto) && /falha/.test(ms[0].texto));

  const s = situacaoDaMinha(entrada, null);
  conferir("o /minhas marca como não achada", s.achada === false);
}

// ---------------------------------------------------------------------------
titulo("Ordem: o que mais mudou vem primeiro");

{
  const ms = oQueMudouNaMinha(entrada, {
    ...hoje, chao: 5, classe: "loteria",
  });
  conferir("mais de uma mudança sai junto", ms.length >= 2);
  conferir("ordenadas pela força", ms[0].forca >= ms[ms.length - 1].forca);
}

// ---------------------------------------------------------------------------
titulo("A foto da entrada guarda o que não dá pra remedir depois");

{
  const medida = {
    id: "xyz", rede: "Base", projeto: "aerodrome", simbolo: "WETH-USDC",
    chao: 22.5, cartaz: 65.8, apy_base: 22, emitido: 8, tvl: 4 * M,
    correlacao: 0.91, classe: "firme", portao_passa: 1,
  };
  const f = fotoDaEntrada(medida, "2026-09-07");
  conferir("guarda o chão daquele dia", f.chao_entrada === 22.5,
    "daqui a dois meses não existe como saber qual era");
  conferir("guarda se passava nos portões", f.passava_entrada === 1);
  conferir("guarda a correlação do par", f.correlacao_entrada === 0.91);
  conferir("e o dia", f.desde === "2026-09-07");
  conferir("medida ausente não vira foto vazia", fotoDaEntrada(null, "2026-09-07") === null,
    "foto com tudo nulo seria indistinguível de pool que mediu zero");

  conferir("portão nunca julgado fica null, não vira 'reprovou'",
    fotoDaEntrada({ ...medida, portao_passa: null }, "x").passava_entrada === null);
}

// ---------------------------------------------------------------------------
titulo("Contas de data");

conferir("36 dias entre 01/08 e 06/09", diasEntre("2026-08-01", "2026-09-06") === 36);
conferir("mesmo dia dá zero", diasEntre("2026-09-06", "2026-09-06") === 0);
conferir("data faltando devolve null", diasEntre(null, "2026-09-06") === null);
conferir("data inválida devolve null", diasEntre("ontem", "2026-09-06") === null);

// ---------------------------------------------------------------------------
titulo("Nenhuma frase manda fazer nada");

{
  /* A conferência que dá nome ao arquivo. Passa por todos os avisos possíveis e
   * confere que nenhum deles contém verbo de ordem. Não sou consultor de
   * investimento licenciado, e o Rayakuza pediu explicitamente que eu mostrasse
   * pra onde o dinheiro vai — não que eu dissesse onde ele deve pôr o dele. */
  const cenarios = [
    [entrada, { ...hoje, chao: 5 }],
    [{ ...entrada, incentivo_entrada: 70 }, { ...hoje, emitido: 0 }],
    [entrada, { ...hoje, tvl: 1 * M }],
    [entrada, { ...hoje, portao_passa: 0, portao_motivos: "[]" }],
    [entrada, { ...hoje, correlacao: 0.1 }],
    [entrada, { ...hoje, classe: "loteria" }],
    [entrada, null],
  ];
  const PROIBIDO = /\b(saia|saia|venda|vender|compre|comprar|tire|retire|aumente|invista|recomendo|sugiro|deve sair|melhor sair)\b/i;
  let limpo = true, culpada = "";
  for (const [e, h] of cenarios) {
    for (const m of oQueMudouNaMinha(e, h)) {
      if (PROIBIDO.test(m.texto)) { limpo = false; culpada = m.texto; }
    }
  }
  conferir("nenhum aviso usa verbo de ordem", limpo, culpada);
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
