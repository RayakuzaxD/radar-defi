/* QUANTO BITCOIN AS EMPRESAS ABERTAS ESTÃO GUARDANDO — e desde ontem, quanto.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO EXISTE, E POR QUE NÃO É O FLUXO DOS ETFs
 *
 * ATENÇÃO, ESTE PARÁGRAFO JÁ ESTEVE ERRADO. Ele dizia que o fluxo diário dos
 * ETFs não tinha fonte livre, com esta lista de porta fechada como prova:
 *
 *   Farside          desafio de JavaScript da Cloudflare, 403 pra robô
 *   SoSoValue        exige chave
 *   CoinGlass        exige chave
 *   DefiLlama        não tem o dado
 *   iShares (IBIT)   devolve a página HTML de 1,3 MB, sem endereço de dados
 *   Grayscale        429 em tudo
 *   Yahoo / stooq    preço e volume do papel, que NÃO é fluxo
 *
 * A primeira linha dessa lista estava errada. O Farside responde 200 AO
 * WORKER — o que faltava era o radar DIZER QUEM ERA, porque a Cloudflare não
 * manda cabeçalho de identificação nenhum por padrão. O fluxo dos ETFs mora em
 * src/etf.js e funciona. (As outras seis continuam fechadas, e as duas que
 * pedem chave continuam pedindo chave.)
 *
 * A lição fica escrita porque ela é maior que este arquivo: as seis fontes
 * foram testadas do computador do Rayakuza, e de lá o cabeçalho vai sozinho.
 * FONTE SÓ ESTÁ MORTA DEPOIS DE MORRER NO LUGAR ONDE ELA VAI SER USADA.
 *
 * ---------------------------------------------------------------------------
 * E ENTÃO POR QUE ESTE ARQUIVO CONTINUA EXISTINDO
 *
 * Porque mede outra coisa, e é o Módulo 5: quanto bitcoin as empresas de
 * capital aberto têm em caixa.
 *
 * NÃO É UM SUBSTITUTO DO FLUXO DOS ETFs, e a tela tem que dizer o que é.
 * São compradores diferentes com prazos diferentes: o ETF recebe e devolve
 * dinheiro todo dia, a empresa que põe bitcoin no balanço quase nunca desfaz.
 * Um mede a maré, o outro mede o nível do mar. Chamar um de outro seria a
 * mesma mentira de trocar a régua de lugar e continuar lendo o número.
 *
 * ---------------------------------------------------------------------------
 * O FLUXO SAI DA DIFERENÇA, E POR ISSO O RADAR GUARDA A FOTO
 *
 * A fonte devolve o TOTAL de hoje, não a variação. Uma foto por dia no banco, e
 * a variação é a subtração — exatamente o que `fotos` já faz com o TVL das
 * redes, e pela mesma razão: mercado se remede, passado não. */

const FONTE = "https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin";

/* O 403 ERA FALTA DE NOME, NÃO FALTA DE CHAVE — e eu quase pedi a chave à toa.
 *
 * Do meu computador a fonte respondia 200; do Worker, 403. A conclusão fácil
 * era "CoinGecko bloqueia datacenter, precisa de chave paga", e eu já ia
 * escrever isso pro Rayakuza. Antes disso, o /saude/tesouraria perguntou as duas
 * hipóteses de uma vez, no ar, em 11/09/2026:
 *
 *   sem cabeçalho nenhum            403
 *   fingindo ser um navegador       passa
 *   dizendo o nome do radar         passa
 *
 * Era o cabeçalho de identificação. O Worker da Cloudflare não manda nenhum por
 * padrão, e a CoinGecko recusa quem não se apresenta.
 *
 * FICA O HONESTO. Os dois passam, e não há razão nenhuma pra fingir ser um
 * navegador quando dizer o que se é funciona igual — e ainda dá à fonte como
 * falar com a gente se este radar algum dia incomodar.
 *
 * A CHAVE CONTINUA ACEITA, e se um dia fizer falta ela entra pela Cloudflare,
 * das mãos dele, nunca pelas minhas. */
const QUEM_SOMOS = "radar-defi";

export async function tesourariasDeBitcoin(chave = null) {
  const cabecalhos = { accept: "application/json", "user-agent": QUEM_SOMOS };
  if (chave) cabecalhos["x-cg-demo-api-key"] = chave;
  const r = await fetch(FONTE, { headers: cabecalhos });
  if (!r.ok) return { erro: "a fonte respondeu " + r.status, comChave: !!chave };
  const j = await r.json();

  const total = Number(j?.total_holdings);
  if (!Number.isFinite(total) || total <= 0) return { erro: "veio sem total" };

  const empresas = Array.isArray(j?.companies) ? j.companies : [];
  return {
    totalBtc: total,
    totalUsd: Number(j?.total_value_usd) || null,
    dominancia: Number(j?.market_cap_dominance) || null,
    quantasEmpresas: empresas.length,
    /* As cinco maiores, e só o nome e a quantidade. Serve pra ele reconhecer o
       que está lendo — um total de 1,29 milhão de BTC não diz nada sozinho, e
       "a Strategy tem 845 mil deles" diz tudo sobre a concentração. */
    maiores: empresas.slice(0, 5).map((c) => ({
      nome: String(c?.name || "").slice(0, 40),
      btc: Number(c?.total_holdings) || null,
    })),
  };
}

/* A VARIAÇÃO, que é o que responde "está entrando ou saindo dinheiro".
 *
 * Devolve null em vez de zero quando não há com o que comparar. Zero aqui
 * significaria "ninguém comprou nem vendeu", que é uma afirmação sobre o
 * mercado — e o que houve foi falta de foto. */
export function fluxoDasTesourarias(hoje, ontem, semanaAtras) {
  if (!(hoje > 0)) return null;
  const variacao = (antes) => {
    if (!(antes > 0)) return null;
    return { btc: hoje - antes, pct: ((hoje - antes) / antes) * 100 };
  };
  const dia = variacao(ontem);
  const semana = variacao(semanaAtras);
  if (!dia && !semana) return null;

  /* A DIREÇÃO SAI DA SEMANA, e não do dia.
   *
   * Empresa não compra bitcoin todo dia: compra em blocos, e no meio disso há
   * dias parados que não significam nada. Um dia zerado lido como "parou de
   * entrar" seria ruído virando notícia — o mesmo erro que fez o eixo de
   * capital do ciclo oscilar antes de passar a olhar a semana. */
  const base = semana || dia;
  const direcao = base.btc > 0 ? "entrando" : base.btc < 0 ? "saindo" : "parado";
  return { totalBtc: hoje, dia, semana, direcao, olhando: semana ? "semana" : "dia" };
}
