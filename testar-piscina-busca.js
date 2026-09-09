/* Prova a busca de pool: o que ele cola, e o que sai disso.
 *
 *   node testar-piscina-busca.js
 *
 * A conferência que dá nome ao arquivo é a primeira: o endereço da pool na
 * blockchain NÃO acha nada, porque o DefiLlama não guarda esse endereço. Se um
 * dia essa conferência ficar verde por acaso, é porque alguém mudou a fonte —
 * e aí o campo pode passar a aceitar o que ele naturalmente tentaria colar.
 */

import {
  entenderTermo, procurarPiscinas, deOndeVemORendimento,
} from "./src/piscina-busca.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const POOLS = [
  { id: "d32f9c01-47d1-4077-8c73-8b91b08d1e91", rede: "Base", projeto: "aerodrome-v1",
    simbolo: "USDC-AERO", tvl: 33456145, apyBase: 0, apyReward: 22.85,
    tokens: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0x940181a94A35A4569E4529A3CDfB74e38FD98631"] },
  { id: "aaaaaaaa-1111-2222-3333-444444444444", rede: "Base", projeto: "aerodrome-v1",
    simbolo: "ETH-USDC", tvl: 12000000, apyBase: 18.4, apyReward: 1.2,
    tokens: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"] },
  { id: "bbbbbbbb-1111-2222-3333-444444444444", rede: "Arbitrum", projeto: "uniswap-v3",
    simbolo: "ETH-USDC", tvl: 45000000, apyBase: 9.1, apyReward: 0, tokens: [] },
  { id: "cccccccc-1111-2222-3333-444444444444", rede: "Ethereum", projeto: "curve-dex",
    simbolo: "USDC-USDT", tvl: 800000, apyBase: 3.2, apyReward: 0.4, tokens: [] },
];

// ---------------------------------------------------------------------------
titulo("O endereço da POOL não acha nada — e tem que continuar assim");

{
  /* Conferido no dado cru do DefiLlama em 08/09/2026: os campos são `pool` (id
     próprio), `underlyingTokens` e `rewardTokens`. Endereço do contrato da pool
     não existe. Colar o endereço da pool era o palpite natural dele, e é
     justamente o que não funciona. */
  const enderecoDeUmaPool = "0x1111111111111111111111111111111111111111";
  const r = procurarPiscinas(POOLS, enderecoDeUmaPool);
  conferir("é lido como endereço", r.pedido.tipo === "endereco");
  conferir("e não devolve nada", r.achados.length === 0,
    "se isto ficar verde por acaso, a fonte mudou e o campo pode aceitar mais");
}

// ---------------------------------------------------------------------------
titulo("O que ele PODE ter na mão");

{
  const r = procurarPiscinas(POOLS, "https://defillama.com/yields/pool/d32f9c01-47d1-4077-8c73-8b91b08d1e91");
  conferir("o link do DefiLlama acha a pool exata",
    r.achados.length === 1 && r.achados[0].simbolo === "USDC-AERO");
  conferir("e é lido como id, não como texto", r.pedido.tipo === "id");
}

conferir("o id sozinho também serve",
  procurarPiscinas(POOLS, "D32F9C01-47D1-4077-8C73-8B91B08D1E91").achados.length === 1,
  "maiúscula não pode atrapalhar: ele vai colar como veio");

{
  const r = procurarPiscinas(POOLS, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  conferir("o endereço de um TOKEN do par acha as pools dele",
    r.achados.length === 2, `achou ${r.achados.length}`);
  conferir("e vêm da maior para a menor", r.achados[0].tvl > r.achados[1].tvl);
}

{
  const sujo = "Contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | BaseScan";
  conferir("endereço colado com sujeira em volta ainda funciona",
    procurarPiscinas(POOLS, sujo).achados.length === 2,
    "quem copia de um explorador leva o texto junto");
}

// ---------------------------------------------------------------------------
titulo("O jeito humano: escrever o par");

{
  /* "eth" está dentro de "ethereum", então a pool USDC-USDT da Ethereum casa
     também. Ela não é escondida — some sem explicação seria pior — mas fica
     por último: o que casa no SÍMBOLO sobe. */
  const r = procurarPiscinas(POOLS, "eth usdc");
  conferir("as duas ETH-USDC vêm primeiro",
    r.achados[0].simbolo === "ETH-USDC" && r.achados[1].simbolo === "ETH-USDC",
    r.achados.map((p) => p.simbolo + "/" + p.rede).join(", "));
  conferir("e a que casou só pelo nome da rede fica por último",
    r.achados[r.achados.length - 1].simbolo === "USDC-USDT",
    "'eth' está dentro de 'ethereum' — esconder seria pior que ordenar");
  conferir("entre as de mesma nota, a maior primeiro", r.achados[0].rede === "Arbitrum");
}

conferir("o hífen do símbolo não atrapalha",
  procurarPiscinas(POOLS, "ETH-USDC").achados.length === 2,
  "o dado diz ETH-USDC e ele pode escrever dos dois jeitos");

{
  /* Cada palavra é um filtro a mais, não uma alternativa. É a diferença entre
     a busca ajudar e a busca despejar tudo que tem ETH no nome. */
  const r = procurarPiscinas(POOLS, "eth usdc base");
  conferir("juntar a rede afunila para uma só", r.achados.length === 1);
  conferir("e é a certa", r.achados[0].rede === "Base" && r.achados[0].projeto === "aerodrome-v1");
}

conferir("o nome do projeto também procura",
  procurarPiscinas(POOLS, "uniswap").achados.length === 1);
conferir("projeto com hífen aceita espaço",
  procurarPiscinas(POOLS, "curve dex").achados.length === 1,
  "o dado diz curve-dex e ninguém escreve o hífen");
conferir("maiúscula e minúscula dão no mesmo",
  procurarPiscinas(POOLS, "AeRoDrOmE").achados.length === 2);
conferir("o que não existe devolve lista vazia",
  procurarPiscinas(POOLS, "banana frita").achados.length === 0);
conferir("termo vazio não devolve a lista inteira",
  procurarPiscinas(POOLS, "").achados.length === 0,
  "campo em branco não é pedido de tudo");
conferir("nulo não quebra", procurarPiscinas(POOLS, null).achados.length === 0);
conferir("lista ausente não quebra", procurarPiscinas(null, "eth").achados.length === 0);

{
  const r = procurarPiscinas(POOLS, "usdc", { limite: 2 });
  conferir("o limite é respeitado", r.achados.length === 2);
}

// ---------------------------------------------------------------------------
titulo("De onde vem o rendimento — a REGRA DO 3 na hora de lançar");

{
  const taxas = deOndeVemORendimento({ apyBase: 18.4, apyReward: 1.2 });
  conferir("rendimento de taxa é reconhecido", taxas.texto.includes("taxas"));
  conferir("e a conta bate", Math.round(taxas.pctDeTaxa) === 94, `saiu ${taxas.pctDeTaxa}`);

  const incentivo = deOndeVemORendimento({ apyBase: 0, apyReward: 22.85 });
  conferir("rendimento de incentivo é reconhecido", incentivo.texto.includes("incentivo"));
  conferir("com 0% de taxa", incentivo.pctDeTaxa === 0);

  const meio = deOndeVemORendimento({ apyBase: 5, apyReward: 5 });
  conferir("meio a meio é dito como meio a meio", meio.texto.includes("metade"));

  conferir("sem rendimento não inventa divisão",
    deOndeVemORendimento({ apyBase: 0, apyReward: 0 }).pctDeTaxa === null);
  conferir("aceita o formato do banco também",
    deOndeVemORendimento({ apy_base: 10, apy_reward: 0 }).pctDeTaxa === 100,
    "o D1 guarda apy_base, a API devolve apyBase");
}

{
  /* Mesma regra do resto do radar: mostra a divisão, não manda entrar. */
  const PROIBIDO = /\b(compre|comprar|entre|entrar|invista|evite|fuja|recomendo|melhor|pior|boa|ruim)\b/i;
  const textos = [
    deOndeVemORendimento({ apyBase: 18, apyReward: 1 }).texto,
    deOndeVemORendimento({ apyBase: 0, apyReward: 30 }).texto,
    deOndeVemORendimento({ apyBase: 5, apyReward: 5 }).texto,
  ];
  conferir("nenhuma frase manda fazer nada", textos.every((t) => !PROIBIDO.test(t)),
    textos.find((t) => PROIBIDO.test(t)) || "");
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
