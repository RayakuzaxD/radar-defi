/* Prova o caminho de um símbolo até um preço.
 *
 *   node testar-precos.js
 *
 * Sem rede: a busca e a API entram como função de mentira. O que se prova aqui
 * não é que o DefiLlama responde — isso conferir-tokens.js faz, contra a API de
 * verdade. O que se prova aqui é a LÓGICA, que é onde mora o erro caro:
 * escolher o token errado com um símbolo ambíguo, e sumir com uma linha da
 * carteira quando o preço não vem.
 */

import {
  IDS, simboloLimpo, buscarId, idsDosSimbolos, precosAgora, cotarSimbolos,
  lerMovimento, MOVIMENTO,
} from "./src/precos.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const resposta = (corpo, ok = true) => ({
  ok, json: async () => corpo,
});

// ---------------------------------------------------------------------------
titulo("O que ele digita vira um símbolo");

conferir("minúscula vira maiúscula", simboloLimpo("eth") === "ETH");
conferir("espaço em volta some", simboloLimpo("  sol ") === "SOL");
conferir("cifrão some", simboloLimpo("$ZEC") === "ZEC");
conferir("vazio continua vazio", simboloLimpo("") === "");
conferir("nulo não quebra", simboloLimpo(null) === "");

// ---------------------------------------------------------------------------
titulo("A tabela curada");

conferir("BTC é o bitcoin", IDS.BTC === "bitcoin");
conferir("ZEC é o zcash", IDS.ZEC === "zcash");
conferir("nenhum id repetido", new Set(Object.values(IDS)).size === Object.values(IDS).length,
  "dois símbolos com o mesmo id somariam o mesmo token duas vezes");
conferir("todo símbolo está limpo",
  Object.keys(IDS).every((s) => simboloLimpo(s) === s));
conferir("os três que a conferência reprovou não voltaram",
  !IDS.MATIC && !IDS.TON && !IDS.FXS,
  "MATIC virou POL, TON devolve GRAM, FXS devolve FRAX — 08/09/2026");

// ---------------------------------------------------------------------------
titulo("Símbolo ambíguo: escolhe pelo tamanho, não pela ordem");

{
  /* O caso real: buscar ZEC devolve o Zcash (rank 9) e o "ZecFi Capital"
     (rank 837). Pegar o primeiro da lista daria certo hoje e erraria no dia em
     que a ordem mudasse — e erraria mostrando um preço plausível. */
  const busca = async () => resposta({
    coins: [
      { id: "zecfi-capital", symbol: "ZEC", name: "ZecFi", market_cap_rank: 837 },
      { id: "zcash", symbol: "ZEC", name: "Zcash", market_cap_rank: 9 },
    ],
  });
  const r = await buscarId("zec", busca);
  conferir("pega o de maior mercado, não o primeiro", r.id === "zcash", `veio ${r?.id}`);
}

{
  const busca = async () => resposta({
    coins: [{ id: "outra-coisa", symbol: "XYZW", name: "Outra", market_cap_rank: 1 }],
  });
  conferir("símbolo que não bate exatamente é descartado",
    (await buscarId("XYZ", busca)) === null,
    "parecido não é igual quando o assunto é dinheiro");
}

conferir("busca que falha devolve null, não explode",
  (await buscarId("XYZ", async () => ({ ok: false }))) === null);

// ---------------------------------------------------------------------------
titulo("Os três degraus, na ordem");

{
  let buscou = 0;
  const busca = async () => { buscou++; return resposta({ coins: [] }); };
  const mapa = await idsDosSimbolos(["BTC", "eth", "ZEC"], null, busca);
  conferir("símbolo da tabela curada não custa busca", buscou === 0);
  conferir("e vem resolvido", mapa.get("ETH") === "ethereum" && mapa.get("BTC") === "bitcoin");
}

{
  /* O banco de mentira: já sabe quem é o FOO. Se a busca for chamada mesmo
     assim, o cache não está servindo pra nada. */
  let buscou = 0;
  const banco = {
    prepare: () => ({
      bind: () => ({ all: async () => ({ results: [{ simbolo: "FOO", id: "foo-coin" }] }) }),
    }),
  };
  const mapa = await idsDosSimbolos(["FOO"], banco, async () => { buscou++; return resposta({ coins: [] }); });
  conferir("o que já foi descoberto sai do banco", mapa.get("FOO") === "foo-coin");
  conferir("e não custa uma busca nova", buscou === 0);
}

// ---------------------------------------------------------------------------
titulo("Preço e variação");

{
  const busca = async (url) => {
    if (url.includes("/prices/current/")) {
      return resposta({ coins: {
        "coingecko:ethereum": { price: 2484.65, symbol: "ETH", timestamp: 1788840160, confidence: 0.99 },
        "coingecko:zcash": { price: 1133.16, symbol: "ZEC", timestamp: 1788840160, confidence: 0.99 },
      }});
    }
    return resposta({ coins: { "coingecko:ethereum": -0.5, "coingecko:zcash": -4.93 } });
  };
  const r = await cotarSimbolos(["ETH", "ZEC"], null, busca);
  conferir("o preço chega por símbolo, que é como ele digitou",
    r.tokens.ETH.preco === 2484.65 && r.tokens.ZEC.preco === 1133.16);
  conferir("a variação de 24h vem junto", r.tokens.ETH.variacao24h === -0.5);
  conferir("e o momento da cotação também", r.quando === 1788840160);
}

{
  /* Se a variação falhar, o preço ainda vale. Melhor mostrar quanto vale sem
     dizer quanto mexeu do que não mostrar nada. */
  const busca = async (url) => url.includes("/prices/current/")
    ? resposta({ coins: { "coingecko:ethereum": { price: 2484.65, symbol: "ETH" } } })
    : { ok: false };
  const r = await cotarSimbolos(["ETH"], null, busca);
  conferir("variação que falha não leva o preço junto", r.tokens.ETH.preco === 2484.65);
  conferir("e a variação fica nula, não zero", r.tokens.ETH.variacao24h === null,
    "zero diria 'não mexeu', que é uma afirmação que eu não tenho");
}

{
  const busca = async () => resposta({ coins: {} });
  const r = await cotarSimbolos(["ETH", "XYZQ"], null, busca);
  conferir("símbolo sem preço volta com motivo, não some",
    r.tokens.ETH && r.tokens.ETH.erro,
    "sumir com a linha faria o total mudar sem explicação");
  conferir("símbolo que nem existe também aparece",
    r.tokens.XYZQ && r.tokens.XYZQ.erro);
}

conferir("lista vazia não chama a rede",
  (await precosAgora(new Map(), async () => { throw new Error("não devia"); })).precos.size === 0);

// ---------------------------------------------------------------------------
titulo("O que conta como 'mexeu muito'");

conferir("2% num dia é o cripto andando", lerMovimento(2) === null);
conferir("9,9% ainda não é notícia", lerMovimento(-9.9) === null);
conferir("10% é o corte", lerMovimento(10).forca === "grande");
conferir("20% é enorme", lerMovimento(-22).forca === "enorme");
conferir("e diz pra que lado", lerMovimento(-22).sentido === "caiu" && lerMovimento(22).sentido === "subiu");
conferir("sem número não há movimento", lerMovimento(null) === null && lerMovimento("oi") === null);
conferir("o corte é 10 e 20", MOVIMENTO.grande === 10 && MOVIMENTO.enorme === 20);

{
  /* A regra que dá nome à parte: o radar diz QUE mexeu e QUANTO. Não diz se
     foi bom ou ruim — isso é notícia, e notícia quem lê é ele. */
  const m = lerMovimento(-30);
  conferir("o movimento não traz juízo de valor",
    !("bom" in m) && !("ruim" in m) && !/ruim|bom|péssim|ótim/i.test(JSON.stringify(m)));
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
