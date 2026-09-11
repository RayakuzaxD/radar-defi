/* O radar do DeFi — roda na nuvem, não no PC de ninguém.
 *
 * Faz três coisas:
 *   1. acorda pelo relógio da Cloudflare, tira a foto do dia e avisa no Telegram
 *      o que mudou;
 *   2. responde a perguntas no Telegram (/radar, /rede Base, /seguir ...);
 *   3. serve o painel e a API que ele consome.
 *
 * A restrição que moldou o desenho: o plano grátis corta em 50 chamadas de rede
 * por execução. Por isso uma rodada faz exatamente TRÊS chamadas ao DefiLlama
 * (redes, stablecoins, protocolos) e tira todo o resto do banco. O histórico não
 * é buscado aqui — ele é guardado, uma foto por dia, e semeado uma vez por
 * `semear.js` no computador do Rayakuza.
 */

import {
  redesAgora, stablesAgora, protocolosAgora,
  piscinasDeRendimento, taxasDosProtocolos, historicoDePrecos,
  precoDoBitcoin, estoqueGlobalDeStables, indicadoresDoCiclo,
  precoPorHora,
  juntarIndicadores, razaoEthBtc,
  precosDaSemana,
} from "./llama.js";
import {
  regimeDePreco, fluxoDeCapital, idadeDoRegime, lerCiclo, cicloEfetivo,
  cicloParaMeta, posicaoNoCiclo, lerPosicao, reduzirSerie, mediaMovel, CICLO,
} from "./ciclo.js";
import {
  aprenderApelidos, taxasPorRede, dependenciaDeIncentivo,
  concentracao, fichaDeQualidade, observacoes,
} from "./qualidade.js";
import {
  montarFichas, sinaisDeRede, sinaisDeProtocolo, quemPuxou,
  possivelDestino, jaAvisou, stablesConfiaveis, separarParaAvisar,
} from "./sinais.js";
import {
  falar, mandarArquivo, textoDoResumo, textoDoRadar, textoDaRede, textoDeAchado, textoDasPiscinas,
  textoDoCiclo, textoDaQuebra, textoDaCarteira, textoDeCandidatas,
  textoDaEntradaGuardada, textoDeAvisoDaCarteira, textoDaComparacao, AJUDA, escapar,
} from "./telegram.js";
import { medirPool, porque, ordenarPorConfianca } from "./rendimento.js";
import { dividirRedes, dividirPools, porqueDaRede, oQueMudou } from "./divisoes.js";
import { separarPar, riscoDoPar } from "./rendimento.js";
import {
  giro, lerGiro, faixaDeTaxa, lerFaixa, fichaDefiverso, porqueDefiverso,
  multiplicador, cartazContraChao, remontagem,
  volatilidadeDoPar, faixaContraVolatilidade,
  recolherVale,
  passaNosPortoes, PORTOES, classificarToken,
} from "./metodo.js";
import {
  retornos, correlacao, lerCorrelacao, descolamento, vereditoDoPar,
} from "./correlacao.js";
import {
  agruparPorNarrativa, dividirNarrativas, porqueDaNarrativa, fluxoDeRedes,
} from "./narrativa.js";
import {
  oQueMudouNaMinha, situacaoDaMinha, fotoDaEntrada,
} from "./carteira.js";
import {
  chaveDoPar, agruparPorPar, compararPar, paresQueValemComparar,
  porqueDaComparacao,
} from "./comparador.js";
import { cotacaoDoDolar } from "./cambio.js";
import { referenciaDoCiclo, quantosAtivos } from "./barca.js";
import { cotarSimbolos, cotarMints, lerMovimento } from "./precos.js";
import { completarIndicadores } from "./coinmetrics.js";
import { olharMacro } from "./macro.js";
import {
  entenderTermo, procurarPiscinas, deOndeVemORendimento,
} from "./piscina-busca.js";
/* Apelidados na entrada: `lerPosicao` já é a posição no CICLO (ciclo.js) e
   `lerFaixa` já é a faixa de TAXA do método (metodo.js). Três coisas
   diferentes com nome parecido é como se erra de andar. */
import {
  lerPosicao as lerPosicaoDaPool,
  lerPool as lerPoolDaOrca,
  precoDoTick,
  quantidadesDaPosicao,
  lerFaixa as lerFaixaDaPosicao,
  inicioDoTickArray, sementesDoTickArray, lerTickDoArray, taxasNaoColhidas,
  pareceEnderecoSolana, PROGRAMA_ORCA,
} from "./orca.js";
import { olharPosicao, avisoDeCegueira } from "./vigia-posicao.js";
import {
  lerMvrv, lerZscore, lerPuell, lerVdd, lerMedia50, lerAltseason,
  lerFaixaDeBull, lerCruzamento, seriesDoGrafico,
  vereditoDoCurso, juntarLeituras,
} from "./indicadores.js";
import {
  precoMedio, ladoDoPreco, tokensNovos, avisoDeTokenNovo, avisoDeCruzamento,
} from "./vigia-token.js";
import {
  temChaveDeServico, posicoesLigadas, historicoDasPosicoes,
  anotarEstado, limparHistoricoVelho,
  tokensLancados, movimentosDeToken, carteirasSolana,
  tokensVistos, anotarTokensVistos, ladosDeToken, anotarLadosDeToken,
  retratoDaCarteira, donosComCarteira, copiasEnviadas, anotarCopiaEnviada,
  alertasPendentes, anotarAlertaDisparado,
} from "./supabase.js";
import {
  contasEmLote, casasDosTokens, simboloDoMint,
  deBase58, enderecoDerivado, tokensDaCarteira, NOS,
  custoDeUmaColeta, prioridadeAgora, MINT_DO_SOL,
} from "./solana.js";
import {
  lerObrigacao, lerReserva, valorDoDeposito, cambioDaReserva,
  MERCADOS, PROGRAMA_KAMINO, TAMANHO_OBRIGACAO, TAMANHO_RESERVA,
} from "./kamino.js";
import { paraBase58 } from "./orca.js";
import { VERSAO, NUMERO_DA_VERSAO, COFRE_DA_CASCA } from "./versao.js";
import { paginaDoPainel } from "./painel.js";
import {
  ICONE_32, ICONE_64, ICONE_128, ICONE_192, ICONE_512, ICONE_RECORTAVEL,
} from "./icones.js";

/* O service worker, como texto — ele roda no navegador, não aqui.
 *
 * Estratégia: rede primeiro, cofre só como rede de segurança. O contrário
 * (cofre primeiro) faria o app abrir instantâneo mostrando o mercado de ontem,
 * e num app cuja única função é dizer o que mudou hoje isso não é otimização,
 * é mentira rápida.
 *
 * A versão no nome do cofre é o que faz uma publicação nova valer: sem ela, o
 * navegador serviria a casca velha pra sempre. O número vem de src/versao.js,
 * que é o único lugar onde ele se muda — dois números escritos à mão em
 * arquivos diferentes acabam discordando, normalmente no pior dia. */
const SERVICE_WORKER = `
const COFRE = "${COFRE_DA_CASCA}";
const CASCA = ["/painel", "/manifest.json"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(COFRE).then((c) => c.addAll(CASCA)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== COFRE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Os dados nunca entram no cofre: quem guarda a última leitura é a própria
  // página, que sabe carimbar a hora ao mostrar.
  if (url.pathname.startsWith("/api/")) return;
  /* Nem /versao. É o endereço que existe justamente pra dizer se o que está
     guardado aqui ficou velho — servi-lo do cofre seria ele responder com a
     versão velha que ele deveria denunciar. */
  if (url.pathname === "/versao") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(COFRE).then((c) => c.put(e.request, copia)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || Response.error())),
  );
});
`;

/* Os períodos que o radar compara: 24 horas, 7 dias, 1 mês e 3 meses.
 *
 * Cada um custa uma consulta ao banco por rodada, e nada mais — a foto do dia é
 * a mesma. Mas 90 dias só respondem se o banco tiver 90 dias: sem isso a coluna
 * de 3 meses vem vazia, e vazio aqui quer dizer "não sei", nunca zero. O
 * `semear.js` é quem enche esse passado; `/saude` diz até onde ele alcança.
 *
 * Os sinais continuam olhando só 7 dias. Os outros períodos servem pra você
 * conferir se o que subiu na semana vinha subindo ou acabou de virar — é
 * contexto pra leitura, não gatilho de aviso. */
export const PERIODOS = [1, 7, 30, 90];

/* Brasília é UTC-3 o ano todo — não temos mais horário de verão desde 2019. */
const emBrasilia = (quando = Date.now()) => new Date(quando - 3 * 3600 * 1000);
const hojeEmBrasilia = () => emBrasilia().toISOString().slice(0, 10);
const diaMenos = (dia, n) =>
  new Date(Date.parse(dia) - n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// O banco

async function guardarAjuste(env, nome, valor) {
  await env.BANCO.prepare("INSERT OR REPLACE INTO ajustes (nome, valor) VALUES (?, ?)")
    .bind(nome, String(valor)).run();
}

async function lerAjuste(env, nome) {
  const r = await env.BANCO.prepare("SELECT valor FROM ajustes WHERE nome = ?").bind(nome).first();
  return r?.valor ?? null;
}

/* ---------------------------------------------------------------------------
 * O CICLO — bull ou bear, que muda a divisão da carteira no B.A.R.C.A.
 *
 * Duas peças separadas de propósito:
 *
 *   `medirOCiclo`  busca as séries e guarda a LEITURA. Custa 2 chamadas e roda
 *                  uma vez por dia, junto com a medida de qualidade.
 *   `cicloDoBanco` lê o que ficou guardado, junta com a ESCOLHA do Rayakuza e diz
 *                  qual ciclo vale agora. Custa zero chamadas.
 *
 * Separadas porque o painel e o Telegram perguntam o ciclo o tempo todo, e a
 * leitura muda uma vez por dia. Juntas, cada F5 no painel pagaria duas chamadas
 * ao DefiLlama pra receber o mesmo número.
 * ------------------------------------------------------------------------- */

async function medirOCiclo(env, dia) {
  /* Falhar aqui não pode derrubar a rodada. Sem leitura nova, `cicloDoBanco`
   * devolve a última guardada com a data dela — que é honesto e visível — em
   * vez de o radar inteiro morrer por causa de um gráfico de preço. */
  try {
    const [precos, estoques] = await Promise.all([
      precoDoBitcoin(), estoqueGlobalDeStables(),
    ]);
    const preco = regimeDePreco(precos);
    const capital = fluxoDeCapital(estoques);
    const leitura = lerCiclo(preco, capital);

    /* A RÉGUA DO CURSO, ao lado da minha.
     *
     * Os quatro indicadores do Portal 2 (MVRV, Z-Score, Puell, VDD), a média de
     * 50 dias que o curso usa, e a razão ETH/BTC da "fórmula mágica ALTS/BTC".
     *
     * Dentro de try porque nada disto pode derrubar a medida do ciclo: se a
     * fonte dos indicadores estiver fora, o radar continua com os dois eixos
     * que sempre teve, e a tela diz que a régua do curso não foi lida. */
    let doCurso = null, confronto = null, indicadores = null, altseason = null;
    try {
      /* A MEMÓRIA DOS INDICADORES MORA SOZINHA, e isto conserta uma espiral.
       *
       * Antes, o "valor de antes" era lido de `ciclo_leitura` — que é
       * SOBRESCRITO A CADA RODADA, inclusive nas que falharam inteiras. Então:
       * uma rodada leva 429 nos quatro, grava `indicadores: { falhas: [...] }`
       * sem valor nenhum, e a rodada seguinte não tem mais o que herdar. Uma
       * falha apagava a memória da próxima, e a régua do curso sumia da tela
       * pra sempre — até uma rodada conseguir os quatro de uma vez.
       *
       * Foi o que o Rayakuza viu: "as informações sobre o ciclo são insuficientes,
       * vc tem tantos dados mas ali aparece praticamente nada". Não era a tela
       * mostrando pouco: era o dado tendo sido apagado por uma falha antiga.
       *
       * `indicadores_bons` só recebe valor que EXISTE. Falha não escreve nada
       * ali, então não há como uma falha piorar a memória. A LIÇÃO: cache que a
       * falha sobrescreve não é cache, é uma bomba-relógio — ele funciona em
       * todos os testes e some no primeiro dia ruim, que é justamente o dia em
       * que ele fazia falta. */
      const bonsAntes = JSON.parse((await lerAjuste(env, "indicadores_bons")) || "null");
      const chegaram = await indicadoresDoCiclo(bonsAntes);

      /* A FONTE RESERVA, só pro que a principal não trouxe.
       *
       * A principal (bitcoin-data.com) dá os quatro e é a referência. Ela
       * limita por IP, e o IP é o compartilhado da Cloudflare — em 10/09/2026
       * a régua passou o dia inteiro vazia com 429 nos quatro, e do computador
       * dele os mesmos endereços respondiam 200. Não é a fonte fora do ar: é o
       * nosso endereço no balde errado, e um Worker não escolhe IP de saída.
       *
       * A reserva cobre TRÊS dos quatro (MVRV, Z-Score e Puell) e diz que não
       * cobre o VDD. Três de quatro com o quarto declarado ausente é honesto;
       * três de quatro em silêncio seria a tela mentindo por omissão.
       *
       * A REFERÊNCIA GANHA SEMPRE que existe — por isso ela entra por cima no
       * espalhamento abaixo. Medido no mesmo dia, os dois cálculos ficam a
       * menos de 3,5% um do outro e caem na mesma faixa do curso; mas perto de
       * um corte 3% decidem, então cada valor viaja com a marca da fonte. */
      const faltando = ["mvrv", "zscore", "puell", "vdd"]
        .filter((k) => !chegaram.valores[k]);
      let reserva = { valores: {}, falhas: [], somas: null };
      if (faltando.length) {
        try {
          const somasAntes = JSON.parse((await lerAjuste(env, "mercado_somas")) || "null");
          reserva = await completarIndicadores(faltando, somasAntes);
          if (reserva.somas && reserva.somas.n > 0) {
            await guardarAjuste(env, "mercado_somas", JSON.stringify({
              n: reserva.somas.n, media: reserva.somas.media,
              m2: reserva.somas.m2, ate: reserva.somas.ate,
            }));
          }
        } catch (e) {
          reserva.falhas.push("fonte reserva: " + String(e?.message || e).slice(0, 60));
        }
      }

      indicadores = juntarIndicadores(
        { valores: { ...reserva.valores, ...chegaram.valores } },
        bonsAntes || null,
      );
      indicadores.falhas = [...chegaram.falhas, ...reserva.falhas];
      indicadores.pulados = chegaram.pulados;

      /* Guarda de volta SÓ o que tem valor. Sem `deAntes`: quem lê depois é que
         decide se aquilo é velho, comparando a data. */
      const bons = {};
      for (const [k, v] of Object.entries(indicadores)) {
        /* A FONTE VAI JUNTO. Sem ela, a rodada seguinte não sabe se aquele
           valor de hoje veio da referência ou do substituto — e trataria os
           dois igual, congelando o radar no substituto pra sempre. */
        if (v && Number.isFinite(v.valor)) {
          bons[k] = { valor: v.valor, dia: v.dia || null, fonte: v.fonte || null };
        }
      }
      if (Object.keys(bons).length) {
        await guardarAjuste(env, "indicadores_bons", JSON.stringify(bons));
      }

      const lidos = [
        lerMvrv(indicadores.mvrv?.valor),
        lerZscore(indicadores.zscore?.valor),
        lerPuell(indicadores.puell?.valor),
        lerVdd(indicadores.vdd?.valor),
      ];
      doCurso = vereditoDoCurso(lidos);

      const razao = await razaoEthBtc().catch(() => null);
      altseason = razao ? lerAltseason(razao.hoje, razao.antes) : null;

      confronto = juntarLeituras(doCurso, leitura, lerMedia50(precos), {
        faixaDeBull: lerFaixaDeBull(precos),
        cruzamento: lerCruzamento(precos),
      });
    } catch (e) {
      indicadores = { falhas: ["a régua do curso não foi lida: " + String(e?.message || e).slice(0, 80)] };
    }
    /* A série vai guardada junto, reduzida a 90 pontos.
     *
     * Assim o painel desenha o gráfico do Bitcoin sem buscar preço nenhum — o
     * mesmo motivo de a leitura ficar guardada: cada F5 pagaria uma chamada
     * pra receber o número de sempre. 90 pontos dão ~2 KB de JSON. */
    await guardarAjuste(env, "ciclo_leitura", JSON.stringify({
      ...leitura, dia,
      preco: { estado: preco.estado, dist: preco.dist ?? null, texto: preco.texto,
               media: preco.media ?? null, hoje: preco.hoje ?? null },
      capital: { estado: capital.estado, variacao: capital.variacao ?? null, texto: capital.texto },
      diasNoRegime: idadeDoRegime(precos),
      /* QUANTOS DIAS A JANELA ALCANÇA.
       *
       * `idadeDoRegime` devolve null quando o preço está do mesmo lado desde o
       * começo do que dá pra ver — e isso é honestidade, não falha: eu não sei
       * se são 61 dias ou 400. Mas a tela mostrava um travessão, e travessão
       * lê como defeito. Com este número ela pode dizer "60+ dias", que é a
       * verdade inteira: pelo menos isso, e eu não enxergo mais longe. */
      diasQueEnxergo: Math.max(0, precos.length - CICLO.janelaMedia),
      posicao: lerPosicao(posicaoNoCiclo(precos)),
      serie: reduzirSerie(precos, 90).map((v) => Math.round(v)),
      // A média de 200 dias em cada ponto da série reduzida seria cara de
      // recalcular; o painel desenha a linha reta do valor de hoje, que é o
      // que a leitura compara. Uma linha só, e ela diz o que diz.
      mediaHoje: preco.media == null ? null : Math.round(preco.media),
      /* A régua do curso viaja junto da minha, e o painel desenha as duas. */
      indicadores,
      curso: doCurso,
      confronto,
      altseason,
      media50: lerMedia50(precos),
      /* A FAIXA DE BULL MARKET e a CRUZ, guardadas fora do confronto também.
       *
       * Fora porque o confronto pode não existir: ele mora dentro do try da
       * régua do curso, e se a fonte dos indicadores estiver fora, ele vem
       * null e levaria a faixa junto. Mas a faixa não depende daquela fonte —
       * ela sai do preço do Bitcoin, que já está aqui na mão. Deixá-la
       * pendurada no confronto seria acoplar uma medida que funciona a uma
       * fonte que às vezes cai. */
      faixaDeBull: lerFaixaDeBull(precos),
      cruzamento: lerCruzamento(precos),
      /* AS QUATRO LINHAS DO GRÁFICO, cada uma como série de verdade.
       *
       * Antes ia só `mediaHoje`, um número — e a tela desenhava com ele uma
       * LINHA RETA chamada "média 200d". Medido em 10/09/2026 com o preço real:
       * dentro da janela do gráfico, a média de 200 dias VARIA 43%, de 98.694
       * a 69.939. A linha reta não era uma simplificação: era uma afirmação
       * falsa sobre onde a média esteve, e quem olhasse concluiria datas
       * erradas pra cada cruzamento.
       *
       * Ele viu antes de mim: "o eixo do ciclo é estagnado, parece uma foto".
       *
       * ~3 KB de JSON, arredondados pra inteiro — o preço do Bitcoin não tem
       * centavo que importe num gráfico de 200 dias. */
      grafico: (() => {
        const g = seriesDoGrafico(precos, 100);
        if (!g) return null;
        const inteiros = (a) => a.map((v) => (v == null ? null : Math.round(v)));
        return {
          dias: g.dias, atrasDe: g.atrasDe,
          preco: inteiros(g.preco),
          media50: inteiros(g.media50),
          media200: inteiros(g.media200),
          faixaBaixa: inteiros(g.faixaBaixa),
          faixaAlta: inteiros(g.faixaAlta),
        };
      })(),
    }));
    return leitura;
  } catch (erro) {
    return { erro: String(erro?.message || erro) };
  }
}

async function cicloDoBanco(env) {
  const escolhido = (await lerAjuste(env, "ciclo")) || "auto";
  let leitura = null;
  try { leitura = JSON.parse((await lerAjuste(env, "ciclo_leitura")) || "null"); } catch {}
  const efetivo = cicloEfetivo(escolhido, leitura);
  return {
    ...efetivo,
    escolhido,
    // A data da leitura vai junto: leitura de três dias atrás apresentada como
    // "agora" é a mesma armadilha do APY anunciado — um número velho com cara
    // de número de hoje.
    medidoEm: leitura?.dia || null,
  };
}

/* O chat pra onde falar. Vem do segredo, ou do primeiro chat que escreveu pro
 * bot — assim o Rayakuza não precisa descobrir o número dele em lugar nenhum. */
async function chatDoAviso(env) {
  return env.TELEGRAM_CHAT || (await lerAjuste(env, "chat"));
}

/* Grava a foto de hoje. Uma linha por rede, chave (dia, rede): rodar três vezes
 * por dia só atualiza a linha de hoje, não cria três. */
async function guardarFoto(env, dia, redes, stables) {
  const linhas = [...redes.values()].filter((r) => r.tvl > 0);
  const declaracao = env.BANCO.prepare(
    "INSERT OR REPLACE INTO fotos (dia, rede, tvl, stables) VALUES (?, ?, ?, ?)",
  );
  // Em lotes porque o D1 tem teto de comandos por batch, e 400 redes de uma vez
  // estoura em dia de mercado agitado.
  for (let i = 0; i < linhas.length; i += 100) {
    await env.BANCO.batch(
      linhas.slice(i, i + 100).map((r) =>
        declaracao.bind(dia, r.rede, r.tvl, stables.get(r.rede) ?? null)),
    );
  }
  return linhas.length;
}

export async function guardarProtocolos(env, dia, protocolos) {
  const declaracao = env.BANCO.prepare(
    `INSERT OR REPLACE INTO fotos_protocolo
       (dia, protocolo, rede, categoria, tvl, tvl_1d, tvl_7d, tvl_30d)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const guardar = protocolos.filter((p) => p.tvl >= 20e6);
  for (let i = 0; i < guardar.length; i += 100) {
    await env.BANCO.batch(
      guardar.slice(i, i + 100).map((p) =>
        declaracao.bind(dia, p.nome, p.rede, p.categoria, p.tvl, p.tvl1d, p.tvl7d, p.tvl30d)),
    );
  }
  return guardar.length;
}

/* A foto de N dias atrás, com tolerância pra dia faltando.
 *
 * Cai até três dias pra trás porque o radar pode ter ficado fora do ar num dia,
 * e comparar contra um dia vazio faria todas as redes sumirem do aviso em
 * silêncio — a pior falha possível, porque parece "não houve notícia". */
async function fotoDeDiasAtras(env, hoje, dias) {
  for (let recuo = 0; recuo <= 3; recuo++) {
    const alvo = diaMenos(hoje, dias + recuo);
    const { results } = await env.BANCO
      .prepare("SELECT rede, tvl, stables FROM fotos WHERE dia = ?").bind(alvo).all();
    if (results?.length) {
      return new Map(results.map((r) => [r.rede, { tvl: r.tvl, stables: r.stables }]));
    }
  }
  return new Map();
}

async function redesSeguidas(env) {
  const { results } = await env.BANCO.prepare("SELECT rede FROM seguidas").all();
  return new Set((results || []).map((r) => r.rede));
}

/* Os avisos recentes, pra não repetir. */
async function avisosRecentes(env, dias = 10) {
  const desde = diaMenos(hojeEmBrasilia(), dias);
  const { results } = await env.BANCO
    .prepare("SELECT tipo, alvo, forca, quando FROM avisos WHERE quando >= ?").bind(desde).all();
  const mapa = new Map();
  for (const a of results || []) {
    const chave = `${a.tipo}:${a.alvo}`;
    const antigo = mapa.get(chave);
    if (!antigo || a.quando > antigo.quando) mapa.set(chave, a);
  }
  return mapa;
}

async function anotarAvisos(env, achados, agora) {
  if (!achados.length) return;
  const declaracao = env.BANCO.prepare(
    "INSERT OR REPLACE INTO avisos (chave, tipo, alvo, forca, texto, quando) VALUES (?, ?, ?, ?, ?, ?)",
  );
  await env.BANCO.batch(achados.map((a) =>
    declaracao.bind(`${a.tipo}:${a.alvo}:${agora.slice(0, 10)}`, a.tipo, a.alvo, a.forca, a.resumo || null, agora)));
}

// ---------------------------------------------------------------------------
// A rodada

/* O MODO ECONÔMICO — o radar cabendo no plano gratuito da Cloudflare.
 *
 * O grátis dá 10 MILISSEGUNDOS de processamento por rodada. Medido em
 * 09/09/2026, o que o radar baixa:
 *
 *     redes      (/v2/chains)     64 KB   cabe folgado
 *     protocolos (/protocols)    8,8 MB   estoura sozinho
 *     pools      (/pools)       11,8 MB   estoura sozinho
 *
 * Não é a frequência que não cabe — é o peso de UMA rodada. Diminuir de três
 * para uma por dia não muda nada.
 *
 * Então no modo econômico a nuvem cuida do que é leve e constante (redes,
 * ciclo, carteira, vigia, avisos) e o COMPUTADOR de quem usa cuida do que é
 * pesado: node medir-pools.js, uma vez por dia, sem limite de processamento.
 *
 * É o mesmo padrão que o semear-pools.js já usava, e pelo mesmo motivo. */
function modoEconomico(env) {
  const v = env?.ECONOMICO;
  return v === true || v === "true" || v === "sim" || v === "1";
}

async function olharOMercado(economico = false) {
  /* Sem os 8,8 MB de protocolos: no modo econômico eles são medidos no
     computador, junto com as pools. */
  const [redes, stables, protocolos] = await Promise.all([
    redesAgora(), stablesAgora(),
    economico ? Promise.resolve(new Map()) : protocolosAgora(),
  ]);
  return { redes, stables, protocolos, semProtocolos: economico };
}

/* Monta o retrato completo: fichas, sinais, quem puxou. Usado tanto pela rodada
 * do relógio quanto pelas perguntas no Telegram e pela API do painel — um
 * caminho só, pra não haver duas versões da verdade. */
async function montarRetrato(env, { gravar = false } = {}) {
  const dia = hojeEmBrasilia();
  const economico = modoEconomico(env);
  const { redes, stables, protocolos } = await olharOMercado(economico);

  if (gravar) {
    await guardarFoto(env, dia, redes, stables);
    /* Lista vazia não vira gravação: no modo econômico os protocolos vêm do
       computador, e apagar a foto boa de ontem com um vazio de hoje seria
       trocar dado por nada. */
    if (protocolos.size) await guardarProtocolos(env, dia, protocolos);
  }

  const hoje = new Map();
  for (const [nome, r] of redes) hoje.set(nome, { tvl: r.tvl, stables: stables.get(nome) ?? 0 });

  const passado = new Map();
  for (const dias of PERIODOS) passado.set(dias, await fotoDeDiasAtras(env, dia, dias));

  const fichas = montarFichas(hoje, passado);
  const fonte = stablesConfiaveis(fichas);
  const seguidas = await redesSeguidas(env);
  const achados = sinaisDeRede(fichas, seguidas, undefined, fonte.confiavel);
  const deProtocolo = sinaisDeProtocolo(protocolos);
  const pares = possivelDestino(
    achados.filter((a) => a.tipo === "fuga"),
    achados.filter((a) => a.tipo === "entrada" || a.tipo === "pequena"),
  );

  const qualidade = await qualidadeGuardada(env);

  return { dia, fichas, achados, protocolos, deProtocolo, pares, fonte, seguidas, qualidade };
}

/* Guarda as piscinas de rendimento acima de $1M.
 *
 * Abaixo desse corte são milhares, e piscina pequena balança demais pra dizer
 * alguma coisa. Dias velhos são apagados na mesma passada: a idade da piscina
 * vem do próprio DefiLlama, então não precisamos de série nossa aqui — guardar
 * histórico seria encher o banco por nada. */
export async function guardarPiscinas(env, dia, piscinas, corte = 1e6) {
  const boas = piscinas.filter((p) => p.tvlUsd >= corte && p.id);
  const declaracao = env.BANCO.prepare(
    `INSERT OR REPLACE INTO piscinas
       (dia, id, rede, projeto, simbolo, meta, tvl, apy, apy_base, apy_reward,
        idade_dias, estavel, risco_il, exposicao, apy_var7d, balanco, volume7d)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < boas.length; i += 100) {
    await env.BANCO.batch(boas.slice(i, i + 100).map((p) =>
      declaracao.bind(
        dia, p.id, p.chain, p.projeto, p.simbolo, p.meta, p.tvlUsd,
        p.apy, p.apyBase, p.apyReward, p.idade, p.estavel ? 1 : 0,
        p.riscoIl, p.exposicao, p.apyVar7d, p.balanco, p.volume7d,
      )));
  }
  await env.BANCO.prepare("DELETE FROM piscinas WHERE dia < ?").bind(dia).run();
  return boas.length;
}

/* Acrescenta o ponto de hoje na série de cada pool.
 *
 * É o que faz o histórico se manter sozinho depois da semeadura: o APY de hoje
 * já veio na lista de pools, então guardar a série custa zero chamada de rede.
 * Rebuscar o gráfico de 60 dias de cada pool todo dia levaria 429 da API e
 * estouraria o limite de chamadas do worker — e não traria nada novo.
 *
 * O CORTE é o do método, não um número meu, e foi de $2M pra cá em 06/09/2026.
 *
 * Sem histórico a pool não é medida, e sem medida ela não chega à tela. Com o
 * corte em $2M, das 239 pools que passavam nos portões do método só 73 eram
 * visíveis — 166 sumiam caladas. E não eram quaisquer 166: a REGRA DO 3 do
 * Módulo 8 é "TVL baixo, volume alto", ou seja, a faixa de $500k a $2M é
 * exatamente onde o método manda olhar. O radar estava cego justamente no
 * lugar pra que ele foi feito.
 *
 * Amarrado a PORTOES.tvlMinimo de propósito: se um dia o mínimo do método
 * mudar, o histórico acompanha sozinho. Dois números que precisam concordar e
 * são escritos em lugares diferentes acabam discordando. */
export async function acrescentarPontoDoDia(env, dia, piscinas, corte = PORTOES.tvlMinimo) {
  const boas = piscinas.filter((p) => p.id && p.tvlUsd >= corte);
  const declaracao = env.BANCO.prepare(
    `INSERT OR REPLACE INTO historico_piscina (id, dia, apy, apy_base, apy_reward, tvl)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < boas.length; i += 100) {
    await env.BANCO.batch(boas.slice(i, i + 100).map((p) =>
      declaracao.bind(p.id, dia, p.apy, p.apyBase, p.apyReward, p.tvlUsd)));
  }
  // A série de 120 dias já cobre qualquer janela que o radar use; o resto é
  // peso morto no banco.
  await env.BANCO.prepare("DELETE FROM historico_piscina WHERE dia < ?")
    .bind(diaMenos(dia, 120)).run();
  return boas.length;
}

/* Calcula chão, oscilação, abismo e classe de cada pool, e guarda pronto.
 *
 * A conta é sobre ~60 pontos × centenas de pools e o resultado só muda uma vez
 * por dia — refazer isso a cada abertura do painel seria gastar por nada. */
export async function medirPiscinas(env, dia, piscinas) {
  const porId = new Map(piscinas.map((p) => [p.id, p]));

  const { results } = await env.BANCO.prepare(
    `SELECT id, dia, apy FROM historico_piscina
     WHERE dia >= ? ORDER BY id, dia`,
  ).bind(diaMenos(dia, 45)).all();

  const series = new Map();
  for (const linha of results || []) {
    if (!series.has(linha.id)) series.set(linha.id, []);
    series.get(linha.id).push({ dia: linha.dia, apy: Number(linha.apy) });
  }

  const medidas = [];
  for (const [id, serie] of series) {
    const p = porId.get(id);
    if (!p) continue;
    const emitido = p.apy > 0 ? ((p.apyReward || 0) / p.apy) * 100 : 0;
    const m = medirPool(serie, {
      cartaz: p.apy, emitidoPct: emitido, idade: p.idade,
      volume1d: p.volume1d, volume7d: p.volume7d,
    });

    /* O método do Defiverso entra aqui, em cima da medida.
     *
     * A ordem importa: primeiro se mede o que a pool fez (chão, oscilação,
     * trajetória), depois se aplica o método do Rayakuza em cima disso. Se fosse
     * ao contrário, mudar o método exigiria remedir tudo. */
    const par = separarPar(p.simbolo);
    const risco = riscoDoPar(p.simbolo, p.riscoIl);
    const paraFicha = {
      tvl: p.tvlUsd, volume7d: p.volume7d, apy: p.apy,
      apyBase: p.apyBase, apyReward: p.apyReward, chao: m.chao,
      parRisco: risco.rotulo, parExplica: risco.explica,
    };
    const ficha = fichaDefiverso(paraFicha);

    /* Os portões do método, avaliados aqui e GUARDADOS com o motivo.
     *
     * Guardar o motivo, e não só o veredito, é o que permite a tela dizer
     * quantas pools foram barradas e por quê. Filtro que remove em silêncio
     * faz o usuário achar que não havia nada — que é a mesma cara de "o
     * mercado está parado". */
    const portao = passaNosPortoes({
      simbolo: p.simbolo, tvl: p.tvlUsd, apyBase: p.apyBase, apy: p.apy,
      volume1d: p.volume1d,
    });

    medidas.push({ id, p, m, par, risco, ficha, paraFicha, portao });
  }

  /* A correlação dos pares voláteis que passaram nos portões.
   *
   * Só desses: é onde o método manda checar, e é o que mantém a conta dentro do
   * orçamento de chamadas. Par com stablecoin tem outro risco e outra conta;
   * pool barrada não interessa.
   *
   * Guardo só o COEFICIENTE. Nível, veredito e leitura saem dele por função
   * pura no momento de ler — guardar os três seria repetir a mesma informação em
   * quatro colunas, e daí em diante toda mudança de limiar exigiria remedir
   * tudo em vez de só publicar. */
  const volateis = medidas.filter(({ p, risco, portao }) =>
    portao.passa && /volátil|ligado/.test(risco.rotulo || "") && (p.tokens || []).length >= 2);

  const idDoToken = (rede, endereco) =>
    `${String(rede).toLowerCase().replace(/ /g, "-")}:${endereco}`;
  const ZERO = /^0x0{40}$/;

  const pedidos = new Set();
  for (const { p } of volateis) {
    for (const t of p.tokens.slice(0, 2)) {
      if (t && !ZERO.test(t)) pedidos.add(idDoToken(p.chain, t));
    }
  }

  let precos = new Map();
  if (pedidos.size) {
    try {
      ({ series: precos } = await historicoDePrecos([...pedidos]));
    } catch {
      // sem preço, os pares ficam sem correlação — que é "não sei", não "reprovou"
    }
  }

  const correlacoes = new Map();
  for (const { id, p } of volateis) {
    const [a, b] = p.tokens.slice(0, 2).map((t) => precos.get(idDoToken(p.chain, t)));
    if (!a || !b) continue;
    const c = correlacao(retornos(a), retornos(b));
    if (c != null) correlacoes.set(id, c);
  }

  const declaracao = env.BANCO.prepare(
    `INSERT OR REPLACE INTO medida_piscina
       (dia, id, rede, projeto, simbolo, meta, tvl, cartaz, chao, realizado, pior,
        oscilacao, abismo, tendencia, emitido, idade_dias, dias_serie, estavel,
        risco_il, classe, porque, apy_base, apy_ontem, apy_semana, apy_mes, trajetoria,
        volume_1d, volume_7d, volume_razao, volume_direcao,
        par_texto, par_risco, par_explica, giro, giro_nivel, ficha, zera_em,
        /* As cinco dos portões ficam NO FIM, na mesma ordem em que os valores
         * são anexados. Colocá-las no meio da lista sem mover os valores junto
         * desalinhou tudo: o banco recebeu "muito-bom" na coluna da ficha, e o
         * erro só apareceu depois, na leitura, como JSON inválido — longe de
         * onde nasceu. */
        portao_passa, portao_motivos, portao_avisos, nota_nivel, nota_selo, correlacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < medidas.length; i += 40) {
    await env.BANCO.batch(medidas.slice(i, i + 40).map(({ id, p, m, par, risco, ficha, paraFicha, portao }) =>
      declaracao.bind(
        dia, id, p.chain, p.projeto, p.simbolo, p.meta, p.tvlUsd,
        m.cartaz, m.chao, m.realizado, m.pior, m.oscilacao, m.abismo, m.tendencia,
        m.emitido, p.idade, m.dias, p.estavel ? 1 : 0, p.riscoIl, m.classe,
        // Duas frases: a da medida (o que a pool pagou) e a do método (o que o
        // Rayakuza olha). Juntas numa só porque na tela elas se leem seguidas.
        [porque(m), porqueDefiverso(paraFicha, ficha)].filter(Boolean).join(" "),
        p.apyBase ?? null,
        m.apyOntem, m.apySemana, m.apyMes, m.trajetoria,
        m.volume?.volume1d ?? null, p.volume7d ?? null,
        m.volume?.razao ?? null, m.volume?.aplica ? m.volume.direcao : null,
        par.texto, risco.rotulo, risco.explica,
        ficha.giro, ficha.leituraGiro.nivel, JSON.stringify(ficha.itens), ficha.zera,
        portao.passa ? 1 : 0, JSON.stringify(portao.motivos), JSON.stringify(portao.avisos),
        portao.nota?.nivel ?? null, portao.nota?.selo ?? null,
        correlacoes.has(id) ? correlacoes.get(id) : null,
      )));
  }
  // Guarda três dias, não só hoje: é o que permite responder "o que mudou desde
  // ontem" sem depender de o radar ter rodado exatamente ontem.
  await env.BANCO.prepare("DELETE FROM medida_piscina WHERE dia < ?")
    .bind(diaMenos(dia, 3)).run();
  return medidas.length;
}

/* O radar inteiro, montado uma vez e servido a todos.
 *
 * O painel e a mensagem do Telegram saem daqui, da mesma chamada. Se cada um
 * montasse a sua, bastaria um deles mudar de critério pra os dois passarem a
 * discordar sobre a mesma pool — e aí o Rayakuza teria que decidir em qual
 * acreditar, que é o mesmo que não ter nenhum. */
async function montarRadar(env) {
  const linha = await env.BANCO.prepare("SELECT MAX(dia) AS dia FROM medida_piscina").first();
  const dia = linha?.dia || null;

  /* O ciclo, lido do banco e não da rede.
   *
   * A leitura custa duas chamadas ao DefiLlama e muda uma vez por dia — fazê-la
   * a cada abertura do painel seria pagar isso a cada F5. Quem mede é a rodada
   * do relógio (`medirOCiclo`); aqui só se lê o que ela deixou guardado. */
  const ciclo = await cicloDoBanco(env);

  /* Ordenado pelo GIRO, não pelo chão.
   *
   * A regra do 3 do Módulo 8 é "TVL baixo, volume alto" — e é isso que decide
   * quanta taxa cada dólar depositado cata. O chão continua na tela porque
   * responde outra pergunta (quanto dá pra contar), mas quem manda na ordem é
   * o método do Rayakuza, não o meu. */
  const todas = dia
    ? (await env.BANCO.prepare(
        `SELECT * FROM medida_piscina WHERE dia = ?
         ORDER BY (apy_base IS NULL), apy_base DESC, chao DESC`,
      ).bind(dia).all()).results || []
    : [];

  /* Os portões do método decidem quem entra na lista.
   *
   * O corte de TVL saiu do SQL e virou portão: era $300k escolhido por mim, e
   * agora é $500k que é o do método — mas o mais importante é que agora existe
   * MOTIVO. Quem foi barrada e por quê aparece na tela; antes as pools somiam
   * caladas, e lista curta sem explicação tem a mesma cara de mercado parado.
   *
   * Medidas antigas (gravadas antes dos portões existirem) têm portao_passa
   * nulo. Elas passam, porque marcar como reprovada uma pool que nunca foi
   * julgada seria inventar um veredito. */
  const medidas = todas.filter((m) => m.portao_passa == null || m.portao_passa === 1);
  const barradas = todas.filter((m) => m.portao_passa === 0);

  const porMotivo = {};
  for (const m of barradas) {
    let motivos = [];
    try { motivos = JSON.parse(m.portao_motivos || "[]"); } catch {}
    /* Só o primeiro motivo conta pro resumo: é o que barrou primeiro, e somar
     * todos faria o total das razões passar do total de pools barradas.
     *
     * Agrupar exige tirar os números (senão cada pool vira um motivo próprio),
     * mas o texto agrupado vai PRA TELA — e "rende N% abaixo do piso de N%"
     * mostra a costura da implementação ao usuário. Então o agrupamento usa uma
     * etiqueta escrita à mão, não o texto original mutilado. */
    const bruto = motivos[0] || "";
    const etiqueta =
      bruto.includes("piso de") ? "as taxas rendem abaixo do piso do método"
      : bruto.includes("âncora") ? "sem nenhuma perna em token âncora"
      : bruto.includes("TVL abaixo") ? "TVL abaixo do mínimo"
      : bruto.includes("24h") ? "negociaram menos que o mínimo em 24h"
      : bruto.includes("memecoins") ? "par de duas memecoins"
      : bruto.includes("armadilha") ? "nome de token com cara de armadilha"
      : bruto ? bruto.slice(0, 60) : "sem motivo registrado";
    porMotivo[etiqueta] = (porMotivo[etiqueta] || 0) + 1;
  }

  const ontem = dia
    ? (await env.BANCO.prepare(
        `SELECT id, projeto, simbolo, classe FROM medida_piscina
         WHERE dia = (SELECT MAX(dia) FROM medida_piscina WHERE dia < ?)`,
      ).bind(dia).all()).results || []
    : [];

  const pools = dividirPools(medidas.map((m) => ({
    id: m.id, rede: m.rede, projeto: m.projeto, simbolo: m.simbolo, meta: m.meta,
    /* A faixa de taxa, lida do texto solto do DefiLlama e já interpretada.
     * Estava viajando até o navegador desde sempre e nunca era desenhada. */
    faixa: lerFaixa(faixaDeTaxa(m.meta)),
    tvl: m.tvl, cartaz: m.cartaz, chao: m.chao, realizado: m.realizado,
    pior: m.pior, oscilacao: m.oscilacao, abismo: m.abismo, tendencia: m.tendencia,
    emitido: m.emitido, idade: m.idade_dias, dias: m.dias_serie,
    estavel: !!m.estavel, classe: m.classe, porque: m.porque,
    nota: m.nota_nivel ? { nivel: m.nota_nivel, selo: m.nota_selo } : null,
    /* Derivado do coeficiente, não guardado. Trocar o limiar de correlação
     * passa a ser publicar, não remedir.
     *
     * O nome é `parVeredito` e não `par` por um motivo que custou um dia de
     * funcionalidade morta: `par` já existia mais abaixo neste mesmo objeto
     * (`par: m.par_texto`). Em JavaScript, chave repetida em objeto literal
     * não é erro — a última cala a primeira, sem aviso. Então a correlação era
     * medida, gravada no banco, montada aqui e apagada duas linhas depois. Os
     * testes passavam: eles exercitam vereditoDoPar, não este objeto. */
    parVeredito: (() => {
      const ehVolatil = /volátil|ligado/.test(m.par_risco || "");
      if (!ehVolatil) return null;
      return vereditoDoPar({ correlacao: m.correlacao, ehParVolatil: true });
    })(),
    avisos: (() => { try { return JSON.parse(m.portao_avisos || "[]"); } catch { return []; } })(),
    apyOntem: m.apy_ontem, apySemana: m.apy_semana, apyMes: m.apy_mes,
    trajetoria: m.trajetoria,
    volume1d: m.volume_1d, volume7d: m.volume_7d,
    volumeRazao: m.volume_razao, volumeDirecao: m.volume_direcao,
    par: m.par_texto, parRisco: m.par_risco, parExplica: m.par_explica,
    giro: m.giro, giroNivel: m.giro_nivel, zeraEm: m.zera_em,
    apyBase: m.apy_base,
    /* O critério do método vem do apyBase, NÃO do APY total.
     *
     * Estava usando `cartaz` (= apy total, com emissão dentro), o que fazia
     * token impresso ser contado como taxa arrecadada. O multiplicador do
     * Genesis é Taxas24h/TVL, e taxa é o que a pool COBRA de quem negocia —
     * emissão é o oposto disso, é a pool pagando pra atrair. Somar os dois
     * apaga exatamente a distinção que o método (e a classe 'alugada') existem
     * pra fazer. */
    multiplicador: multiplicador(m.apy_base),
    /* O cartaz contra o chão: quanto ela anuncia sobre quanto pagou. */
    cartazVsChao: cartazContraChao(m.chao, m.cartaz),
    ficha: m.ficha ? JSON.parse(m.ficha) : [],
  })));

  const r = await montarRetrato(env);
  const divisao = dividirRedes(r.fichas);

  /* A narrativa: qual assunto está levando dinheiro.
   *
   * Sai dos mesmos protocolos que já foram buscados — custo zero de rede. */
  const narrativas = dividirNarrativas(agruparPorNarrativa(r.protocolos));
  const enfeitarNarrativa = (lista) => lista.map((n) => ({
    ...n, porque: porqueDaNarrativa(n),
  }));
  const fluxo = fluxoDeRedes(r.fichas);
  const enfeitar = (lista, eGrande) => lista.map((f) => ({
    rede: f.rede, tvl: f.tvl,
    var1d: f.varTvl1d, var7d: f.varTvl7d, var30d: f.varTvl30d, var90d: f.varTvl90d,
    abs7d: f.absTvl7d, stables: f.stables, varStables7d: f.varStables7d,
    porque: porqueDaRede(f, { qualidade: r.qualidade.get(f.rede), eGrande }),
    qualidade: r.qualidade.get(f.rede) || null,
    puxadores: quemPuxou(f.rede, r.protocolos, 2),
  }));

  const mudou = oQueMudou(
    medidas.map((m) => ({ id: m.id, projeto: m.projeto, simbolo: m.simbolo, classe: m.classe })),
    ontem,
  );

  /* Quantas existem em cada caixa, não quantas cabem na tela.
   *
   * O cabeçalho mostrava o tamanho da lista exibida (6) como se fosse o total
   * (412). Número que parece total sendo amostra é o tipo de coisa que corrói a
   * confiança no resto da tela. */
  const totais = { firme: 0, alugada: 0, loteria: 0, nova: 0, "sem-dado": 0 };
  for (const m of medidas) if (m.classe in totais) totais[m.classe]++;

  /* As pools dele vêm junto no mesmo pedido.
   *
   * Custa uma consulta e evita uma chamada a mais do celular — e, mais
   * importante, garante que o painel e o bot leiam a mesma situação. Duas
   * fontes acabam discordando, e aí ele teria que escolher em qual acreditar. */
  const minhas = await situacaoDaCarteira(env);

  /* A cotação vai junto do radar: o painel converte a carteira sem precisar de
   * chamada nenhuma, e a data diz de quando é o número. */
  let dolar = null;
  try { dolar = JSON.parse((await lerAjuste(env, "dolar")) || "null"); } catch {}

  /* O mesmo par, em toda parte.
   *
   * Sai das MESMAS pools que já foram medidas — custo zero de rede e de banco.
   * A comparação usa a lista completa (`medidas`), não a que foi dividida em
   * caixas, porque uma pool pode ser "loteria" num lugar e "firme" noutro, e
   * comparar onde abrir é pergunta anterior à de que caixa ela é. */
  const comparacoes = paresQueValemComparar(medidas.map((m) => ({
    id: m.id, rede: m.rede, projeto: m.projeto, simbolo: m.simbolo,
    tvl: m.tvl, chao: m.chao, cartaz: m.cartaz, classe: m.classe,
    multiplicador: multiplicador(m.apy_base),
  }))).map((c) => ({ ...c, porque: porqueDaComparacao(c) }));

  return {
    dia: dia || r.dia,
    diaDasRedes: r.dia,
    ciclo,
    dolar,
    /* A referência do B.A.R.C.A. vai junto do radar, já ajustada ao ciclo que
     * está valendo. É REFERÊNCIA e não alvo: o autor do método diz na aula que
     * copiar a divisão dele não faz sentido, e o alvo de verdade é o que o
     * Rayakuza escreve na carteira. */
    barca: {
      referencia: referenciaDoCiclo(ciclo.ciclo),
      ativos: quantosAtivos(ciclo.ciclo),
      ciclo: ciclo.ciclo,
    },
    minhas,
    comparacoes,
    pools,
    totais,
    // Só as que dá pra classificar; as "sem-dado" não entram em caixa nenhuma e
    // contá-las aqui inflaria o número sem significar nada.
    quantasPools: medidas.length - totais["sem-dado"],
    portoes: {
      corte: PORTOES,
      barradas: barradas.length,
      // Ordenado do motivo que mais barrou pro que menos: é a leitura de "o que
      // o método está cortando do mercado hoje".
      porMotivo: Object.entries(porMotivo)
        .sort((a, b) => b[1] - a[1])
        .map(([motivo, quantas]) => ({ motivo, quantas })),
    },
    redes: {
      grandes: {
        subiram: enfeitar(divisao.grandes.subiram, true),
        cairam: enfeitar(divisao.grandes.cairam, true),
      },
      pequenas: {
        subiram: enfeitar(divisao.pequenas.subiram, false),
        cairam: enfeitar(divisao.pequenas.cairam, false),
      },
    },
    narrativas: {
      puxando: enfeitarNarrativa(narrativas.puxando),
      perdendo: enfeitarNarrativa(narrativas.perdendo),
      emergindo: enfeitarNarrativa(narrativas.emergindo),
    },
    fluxo: {
      ganhando: fluxo.ganhando.map((f) => ({
        rede: f.rede, tvl: f.tvl, abs7d: f.absTvl7d, var7d: f.varTvl7d,
        varStables7d: f.varStables7d,
      })),
      perdendo: fluxo.perdendo.map((f) => ({
        rede: f.rede, tvl: f.tvl, abs7d: f.absTvl7d, var7d: f.varTvl7d,
        varStables7d: f.varStables7d,
      })),
    },
    mudou: {
      entraram: mudou.entraram.slice(0, 12),
      sairam: mudou.sairam.slice(0, 12),
      tinhaOntem: ontem.length,
    },
    fonteDeStablecoin: r.fonte,
  };
}

/* Mede a qualidade das redes e guarda.
 *
 * Roda uma vez por dia, na rodada da manhã. É a parte cara do radar: são duas
 * buscas grandes (11,7 MB de piscinas de rendimento e 4,2 MB de taxas), feitas
 * UMA DE CADA VEZ de propósito — juntas, os dois picos de memória se somam e o
 * worker morre com 128 MB de teto.
 *
 * Se falhar, o radar segue sem as medidas: elas são contexto pra leitura, e um
 * radar sem contexto ainda é melhor que radar nenhum. Mas a falha é anunciada,
 * porque medida que some calada vira um "não sei" que parece "está tudo bem". */
export async function medirQualidade(env, dia, protocolos, redes) {
  const oficiais = new Set(redes.keys());

  const piscinas = await piscinasDeRendimento();
  const incentivo = dependenciaDeIncentivo(piscinas);
  await guardarPiscinas(env, dia, piscinas);

  // A série de cada pool ganha o ponto de hoje, e as medidas são recalculadas
  // em cima dela. Custa zero chamada de rede: o APY de hoje já veio acima.
  await acrescentarPontoDoDia(env, dia, piscinas);
  await medirPiscinas(env, dia, piscinas);

  const deTaxa = await taxasDosProtocolos();
  const apelidos = aprenderApelidos(deTaxa, oficiais);
  const taxas = taxasPorRede(deTaxa, apelidos);

  const linhas = [];
  for (const [nome, r] of redes) {
    if (!(r.tvl > 0)) continue;
    const f = fichaDeQualidade(nome, {
      tvl: r.tvl,
      incentivo: incentivo.get(nome),
      taxas: taxas.get(nome),
      concentra: concentracao(protocolos, nome),
    });
    // Rede sobre a qual não sabemos nada não vira linha: linha existindo com
    // tudo nulo é indistinguível de medida que deu zero.
    if (f.alugado == null && f.taxas24h == null && f.concentracao == null) continue;
    linhas.push(f);
  }

  const declaracao = env.BANCO.prepare(
    `INSERT OR REPLACE INTO qualidade
       (dia, rede, alugado, piscinas, taxas_24h, taxa_por_milhao, concentracao, maior_protocolo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < linhas.length; i += 100) {
    await env.BANCO.batch(linhas.slice(i, i + 100).map((f) =>
      declaracao.bind(dia, f.rede, f.alugado, f.piscinas, f.taxas24h, f.taxaPorMilhao, f.concentracao, f.maiorProtocolo)));
  }
  return { redes: linhas.length, apelidos: apelidos.size };
}

/* As piscinas guardadas, filtradas.
 *
 * Mesma consulta que alimenta a aba do painel — de propósito. Painel e bot
 * respondendo de fontes diferentes é como eles passam a discordar sobre um
 * número, e aí o Rayakuza teria que escolher em qual acreditar. */
async function piscinasDoBanco(env, { rede = null, novas = false, classe = null, limite = 8 } = {}) {
  const condicoes = ["dia = (SELECT MAX(dia) FROM medida_piscina)"];
  const valores = [];
  if (rede) { condicoes.push("rede = ?"); valores.push(rede); }
  if (novas) condicoes.push("classe = 'nova'");
  if (classe) { condicoes.push("classe = ?"); valores.push(classe); }

  /* Ordenado pelo CHÃO, não pelo tamanho nem pelo cartaz.
   *
   * Era `ORDER BY tvl DESC`, o que respondia "quais são as maiores" — pergunta
   * que ninguém fez. Quem vive de renda quer saber quais pagam melhor no pior
   * dia; pool grande que paga mal é só uma pool grande. */
  const ordem = novas ? "tvl DESC" : "chao DESC";
  const { results } = await env.BANCO.prepare(
    `SELECT * FROM medida_piscina WHERE ${condicoes.join(" AND ")} ORDER BY ${ordem} LIMIT ?`,
  ).bind(...valores, limite).all();
  return results || [];
}

/* Os nomes de rede que TÊM piscina guardada.
 *
 * Serve pra corrigir o que o Rayakuza digitou: ele escreve "base" ou "arbitrum", e
 * o banco guarda "Base" e "Arbitrum". Errar por causa de maiúscula seria o bot
 * dizendo "não achei" sobre uma rede que ele tem na frente. */
async function redesComPiscina(env) {
  const { results } = await env.BANCO.prepare(
    "SELECT DISTINCT rede FROM piscinas WHERE dia = (SELECT MAX(dia) FROM piscinas)",
  ).all();
  return (results || []).map((r) => r.rede).filter(Boolean);
}

/* ---------------------------------------------------------------------------
 * A CARTEIRA — as pools em que ele já está.
 * ------------------------------------------------------------------------- */

/* Acha a pool que ele descreveu.
 *
 * Ele digita "/entrei raydium RAY-USDC", não um id de 36 caracteres. Cada
 * palavra vira um filtro que precisa bater em projeto, símbolo ou rede — assim
 * "raydium ray-usdc" e "ray-usdc solana" chegam no mesmo lugar, e "uniswap"
 * sozinho devolve muitas e ele refina.
 *
 * Aceita o id direto também: é o que a lista de candidatos oferece de volta,
 * e é o único jeito de desempatar duas pools com o mesmo nome. */
async function acharPool(env, texto) {
  const cru = String(texto || "").trim();
  if (!cru) return [];

  if (/^[0-9a-f-]{30,}$/i.test(cru)) {
    const r = await env.BANCO.prepare(
      "SELECT * FROM medida_piscina WHERE id = ? AND dia = (SELECT MAX(dia) FROM medida_piscina)",
    ).bind(cru).first();
    return r ? [r] : [];
  }

  const palavras = cru.split(/\s+/).filter(Boolean).slice(0, 4);
  const condicoes = palavras.map(() =>
    "(LOWER(projeto) LIKE ? OR LOWER(simbolo) LIKE ? OR LOWER(rede) LIKE ?)");
  const valores = palavras.flatMap((w) => {
    const like = `%${w.toLowerCase()}%`;
    return [like, like, like];
  });

  const { results } = await env.BANCO.prepare(
    `SELECT * FROM medida_piscina
     WHERE dia = (SELECT MAX(dia) FROM medida_piscina) AND ${condicoes.join(" AND ")}
     ORDER BY tvl DESC LIMIT 8`,
  ).bind(...valores).all();
  return results || [];
}

async function minhasPools(env) {
  const { results } = await env.BANCO.prepare(
    "SELECT * FROM minhas_pools ORDER BY desde DESC",
  ).all();
  return results || [];
}

/* Junta cada posição com a medida de hoje daquela pool.
 *
 * Uma consulta só, e não uma por pool: com dez posições seriam dez idas ao
 * banco pra montar uma mensagem. */
async function situacaoDaCarteira(env) {
  const minhas = await minhasPools(env);
  if (!minhas.length) return [];

  const marcas = minhas.map(() => "?").join(",");
  const { results } = await env.BANCO.prepare(
    `SELECT * FROM medida_piscina
     WHERE dia = (SELECT MAX(dia) FROM medida_piscina) AND id IN (${marcas})`,
  ).bind(...minhas.map((m) => m.id)).all();

  const hojePorId = new Map((results || []).map((r) => [r.id, r]));
  return minhas.map((m) => situacaoDaMinha(m, hojePorId.get(m.id) || null));
}

async function guardarMinhaPool(env, foto) {
  await env.BANCO.prepare(
    `INSERT OR REPLACE INTO minhas_pools
       (id, rede, projeto, simbolo, desde, chao_entrada, cartaz_entrada,
        apy_base_entrada, incentivo_entrada, tvl_entrada, correlacao_entrada,
        classe_entrada, passava_entrada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    foto.id, foto.rede, foto.projeto, foto.simbolo, foto.desde,
    foto.chao_entrada, foto.cartaz_entrada, foto.apy_base_entrada,
    foto.incentivo_entrada, foto.tvl_entrada, foto.correlacao_entrada,
    foto.classe_entrada, foto.passava_entrada,
  ).run();
}

/* Lê a última medida guardada, de qualquer dia — a de ontem serve. */
async function qualidadeGuardada(env) {
  const { results } = await env.BANCO.prepare(
    `SELECT q.* FROM qualidade q
     WHERE q.dia = (SELECT MAX(dia) FROM qualidade)`,
  ).all();
  const mapa = new Map();
  for (const r of results || []) {
    mapa.set(r.rede, {
      dia: r.dia,
      alugado: r.alugado,
      piscinas: r.piscinas,
      taxas24h: r.taxas_24h,
      taxaPorMilhao: r.taxa_por_milhao,
      concentracao: r.concentracao,
      maiorProtocolo: r.maior_protocolo,
    });
  }
  return mapa;
}

/* A rodada do relógio.
 *
 * `soUrgente` é a rodada do meio-dia: ela grava a foto e olha tudo, mas só
 * interrompe o dia do Rayakuza se for dinheiro saindo. O resto espera as 18h.
 *
 * `seco` faz o caminho inteiro — grava a foto, consulta os avisos antigos,
 * monta o texto — e devolve a mensagem em vez de mandar. Existe porque
 * `ensaiar.js` não passa pelo banco: ele prova as contas, mas não prova que o
 * "não repetir" funciona. E era justamente o dedupe que dava pra publicar
 * quebrado sem ninguém ver, já que o sintoma seria o celular tocando demais
 * depois — quando o estrago já está feito. */
/* Ler posições da blockchain — a mesma leitura pra tela e pro vigia.
 *
 * Estava dentro da rota, o que servia enquanto só a tela pedia. Quando o
 * relógio de madrugada passou a precisar da mesma coisa, duplicar seria ter
 * duas verdades sobre o mesmo dinheiro — e a segunda envelhece calada.
 *
 * Devolve um mapa endereço -> leitura. Endereço que deu errado vem com o
 * motivo escrito, nunca ausente: chave que some vira espera infinita do
 * outro lado. */
async function lerPosicoesDaCadeia(pedidos, nos) {
    const posicoes = {};
    try {
      const contasPosicao = await contasEmLote(pedidos, nos);

      /* DOIS TIPOS DE POSIÇÃO, e quem decide qual é não sou eu: é o programa
       * dono da conta. Orca e Kamino guardam coisas diferentes de jeitos
       * diferentes, mas para ele são a mesma pergunta — "quanto vale isto
       * hoje?". Então o mesmo endereço serve para as duas, e ele nunca
       * precisa saber de qual protocolo é o que colou. */
      const lidas = new Map();
      const doKamino = new Map();
      for (const endereco of pedidos) {
        const c = contasPosicao.get(endereco);
        /* A CONTA NÃO EXISTE — e isto é uma RESPOSTA, não um silêncio.
         *
         * `pedir` lança quando nenhum nó responde, então chegar aqui sem erro
         * quer dizer que a rede respondeu e disse "essa conta não está aqui".
         * A informação sempre esteve disponível; eu é que a tratava igual a
         * "não consegui ler", e as duas levam a telas opostas.
         *
         * Em 09/09/2026 ele fechou a pool da Orca e o empréstimo da Kamino. As
         * duas contas sumiram da Solana, o painel disse "não consegui ler
         * agora" e continuou mostrando US$ 58,86 — dinheiro que já tinha
         * voltado pra carteira dele e já estava sendo contado lá. O total dele
         * contava a mesma quantia duas vezes.
         *
         * Quem decide se isso é "posição fechada" ou "endereço errado" é o
         * painel, não eu: ele é quem sabe se a posição já foi lida alguma vez.
         * Aqui vai só o fato. */
        if (!c) {
          posicoes[endereco] = {
            erro: "essa conta não existe na Solana",
            naoExiste: true,
          };
          continue;
        }

        if (c.dono === PROGRAMA_ORCA) {
          const p = lerPosicaoDaPool(c.bytes);
          if (p.erro) { posicoes[endereco] = { erro: p.erro }; continue; }
          lidas.set(endereco, p);
        } else if (c.dono === PROGRAMA_KAMINO) {
          const o = lerObrigacao(c.bytes, paraBase58);
          if (o.erro) { posicoes[endereco] = { erro: o.erro }; continue; }
          if (!o.depositos.length) {
            posicoes[endereco] = { erro: "essa posição está sem depósito", fechada: true };
            continue;
          }
          doKamino.set(endereco, o);
        } else {
          posicoes[endereco] = { erro: "esse endereço não é uma posição que eu saiba ler" };
        }
      }

      /* ---- os empréstimos da Kamino ---- */
      if (doKamino.size) {
        const reservas = await contasEmLote(
          [...doKamino.values()].flatMap((o) => o.depositos.map((d) => d.reserva)), nos);
        const lidasReservas = new Map();
        for (const [chave, c] of reservas) {
          const r = lerReserva(c.bytes, paraBase58);
          if (!r.erro) lidasReservas.set(chave, r);
        }
        const simbolos = await cotarMints([...lidasReservas.values()].map((r) => r.mint));

        for (const [endereco, o] of doKamino) {
          const d = o.depositos[0];
          const r = lidasReservas.get(d.reserva);
          if (!r) { posicoes[endereco] = { erro: "não achei a reserva desse empréstimo" }; continue; }
          const v = valorDoDeposito(d.cTokens, r);
          if (!v) { posicoes[endereco] = { erro: "não consegui calcular o valor" }; continue; }
          posicoes[endereco] = {
            tipo: "emprestimo",
            onde: "Kamino",
            reserva: d.reserva,
            simbolo: simbolos[r.mint]?.simbolo || "?",
            quantidade: v.emToken,
            valor: v.emDolar,
            /* O câmbio vai junto: é dele que sai o juro, e sem ele a tela
               teria que adivinhar o rendimento pela diferença de valor — que
               mistura juro com depósito novo. */
            cambio: v.cambio,
            /* O TAMANHO BRUTO, que e o que denuncia deposito e saque.
             *
             * A quantidade de cTokens so muda quando ele poe ou tira dinheiro.
             * Juro NAO mexe nela — quem sobe e o cambio, e por isso a
             * quantidade serve de marco. Comparando com a ultima olhada da pra
             * saber que ele mexeu, e quanto, sem depender de ele lembrar.
             *
             * Vai como TEXTO porque e um inteiro grande: numero solto em JSON
             * perderia os digitos finais, que sao justamente os que distinguem
             * "mudou" de "nao mudou". */
            tamanho: String(d.cTokens),
            fechada: d.cTokens === 0n,
          };
        }
      }

      if (!lidas.size) return posicoes;

      const contasPool = await contasEmLote([...lidas.values()].map((p) => p.pool), nos);
      const pools = new Map();
      for (const [endereco, p] of lidas) {
        const c = contasPool.get(p.pool);
        if (!c) { posicoes[endereco] = { erro: "não achei a pool dessa posição" }; continue; }
        const w = lerPoolDaOrca(c.bytes);
        if (w.erro) { posicoes[endereco] = { erro: w.erro }; continue; }
        pools.set(endereco, w);
      }

      const casas = await casasDosTokens(
        [...pools.values()].flatMap((w) => [w.mintA, w.mintB]), nos,
      );

      /* O PREÇO EM DÓLAR DE CADA TOKEN DAS POOLS, por endereço.
       *
       * Uma chamada só, com todos os mints de uma vez. Por endereço e não por
       * símbolo porque símbolo repete — qualquer um cria um token chamado
       * "USDC" na Solana, e valorizar patrimônio pelo nome é o jeito mais
       * rápido de acertar o token errado.
       *
       * Falhar aqui não derruba nada: sem cotação, cada posição volta pra
       * conta antiga e declara em que unidade está. */
      const cotacoes = await cotarMints(
        [...pools.values()].flatMap((w) => [w.mintA, w.mintB]),
      ).catch(() => ({}));

      /* SETE DIAS DE PREÇO DOS MESMOS TOKENS, pra saber quanto o PAR andou.
       *
       * Portal 5, página 65, na lista de como escolher uma pool: "olhe a
       * volatilidade semanal (7d)". Página 88, a regra inteira: "ativos
       * voláteis, range maior".
       *
       * Uma chamada só, com todos os mints juntos — e falhar aqui não derruba
       * nada: sem a semana, a linha simplesmente não aparece. */
      /* O QUE CUSTA RECOLHER, hoje, nesta rede.
       *
       * Relatório "APR vs APY" (Defiverso, julho/2026, p.5): "cada
       * reinvestimento paga taxa de rede. Em posições pequenas, reinvestir
       * todo dia pode custar mais do que o ganho extra".
       *
       * Uma chamada só, e ela pergunta à rede — não a mim. Falhando, a
       * prioridade fica em zero e sobra a taxa base, que é regra da rede e
       * não muda: o pior caso é subestimar num dia de congestionamento, e a
       * tela diz que é estimativa. */
      const prioridade = await prioridadeAgora(nos, PROGRAMA_ORCA).catch(() => null);

      const semana = await precosDaSemana(
        [...pools.values()].flatMap((w) => [w.mintA, w.mintB]),
      ).catch(() => new Map());

      /* AS CONTAS DE TICK, que são o que falta pro rendimento.
       *
       * Cada ponta da faixa mora numa conta que guarda 88 ticks. O endereço
       * dela é calculado — mesmo truque das posições: gero os candidatos e
       * pergunto à rede qual existe, em vez de fazer a matemática de curva.
       *
       * Tudo numa ida só: são duas contas por posição, e uma carteira com
       * cinco posições daria dez chamadas se fossem separadas. */
      const candidatosDeTick = [];
      for (const [endereco, p] of lidas) {
        const w = pools.get(endereco);
        if (!w || !w.tickSpacing) continue;
        const poolEmBytes = deBase58(p.pool);
        if (!poolEmBytes) continue;
        for (const [qual, tick] of [["fundo", p.tickBaixo], ["topo", p.tickAlto]]) {
          const inicio = inicioDoTickArray(tick, w.tickSpacing);
          /* UM endereco, o certo. Era uma lista de cinco chutes, e o array de
             tick do topo da posicao SOL/ETH dele mora no bump 248 — fora da
             janela. Sem ele, a conta de taxas nao fecha e a tela dizia "as
             taxas ainda nao entram nesta conta". */
          const c = await enderecoDerivado(
            sementesDoTickArray(poolEmBytes, inicio), PROGRAMA_ORCA);
          if (c) candidatosDeTick.push({ endereco: c.endereco, posicao: endereco, qual, inicio, tick });
        }
      }

      const contasDeTick = candidatosDeTick.length
        ? await contasEmLote(candidatosDeTick.map((c) => c.endereco), nos)
        : new Map();

      const ticksDaPosicao = new Map();
      for (const c of candidatosDeTick) {
        const conta = contasDeTick.get(c.endereco);
        if (!conta || conta.dono !== PROGRAMA_ORCA) continue;
        const w = pools.get(c.posicao);
        const t = lerTickDoArray(conta.bytes, c.inicio, w.tickSpacing, c.tick);
        if (!t) continue;
        const guardado = ticksDaPosicao.get(c.posicao) || {};
        guardado[c.qual] = t;
        ticksDaPosicao.set(c.posicao, guardado);
      }

      for (const [endereco, p] of lidas) {
        const w = pools.get(endereco);
        if (!w) continue;
        const casasA = casas.get(w.mintA), casasB = casas.get(w.mintB);
        if (casasA == null || casasB == null) {
          posicoes[endereco] = { erro: "não descobri as casas decimais dos tokens" };
          continue;
        }

        const q = quantidadesDaPosicao(p, w, casasA, casasB);
        const fundo = precoDoTick(p.tickBaixo, casasA, casasB);
        const topo = precoDoTick(p.tickAlto, casasA, casasB);

        /* O VALOR EM DÓLAR, com o preço de CADA lado.
         *
         * Aqui morava um erro que ele viu na tela em 09/09/2026: a pool
         * SOL/ETH dele, com 0,575 SOL e 0,02 ETH, aparecia valendo US$ 0,04.
         * Perto de US$ 109 de verdade.
         *
         * A conta antiga era `qtdA * preco + qtdB`, onde `preco` é o preço do
         * par (quanto de B vale um A). Isso dá o valor EM UNIDADES DE B — que
         * é dólar quando B é stablecoin, e nas duas pools que ele tinha era.
         * Numa pool SOL/ETH, B é ETH: o resultado saía em ETH e ia pra tela
         * com cifrão na frente.
         *
         * O pior é que eu tinha PREVISTO isso, num comentário aqui mesmo:
         * "quando B não for stable isto vira valor em B, e a tela precisa
         * dizer isso". Escrevi o aviso e não fiz a tela dizer. Aviso em
         * comentário não protege ninguém — só registra que dava pra evitar.
         *
         * Agora cada lado é convertido pelo PREÇO DELE em dólar, buscado por
         * endereço de token. Some a suposição de que existe uma stablecoin na
         * pool, e com ela some a classe inteira de erro. */
        const emDolar = (qtd, mint) => {
          const c = cotacoes[mint];
          return (c && c.preco > 0) ? qtd * c.preco : null;
        };
        const ladoA = emDolar(q.qtdA, w.mintA);
        const ladoB = emDolar(q.qtdB, w.mintB);

        /* Sem cotação dos dois lados, volta pra conta antiga — que continua
           certa quando B é stablecoin — e DIZ em que unidade está. Número sem
           unidade é o que criou o problema; número com unidade declarada é
           informação parcial, que é honesta. */
        const temAsDuas = ladoA != null && ladoB != null;
        const valor = temAsDuas ? (ladoA + ladoB) : (q.qtdA * q.preco + q.qtdB);
        const unidade = temAsDuas ? "USD" : (simboloDoMint(w.mintB) || "B");

        posicoes[endereco] = {
          tipo: "pool",
          onde: "Orca",
          pool: p.pool,
          faixa: { fundo, topo },
          preco: q.preco,
          leitura: lerFaixaDaPosicao(q.preco, fundo, topo),
          /* ONDE A FAIXA CAIRIA, pela conta do Portal 5 — e só quando a posição
             saiu. Dentro da faixa `remontagem` devolve null, e null aqui vira
             silêncio na tela: mostrar uma faixa nova pra uma posição que está
             rendendo seria responder pergunta que ninguém fez. */
          remontar: remontagem(q.preco, fundo, topo),
          /* QUANTO O PAR ANDOU NA SEMANA, do lado da largura da faixa.
             Os dois na mesma unidade (% ) justamente pra ele comparar de bater
             o olho — que é o que a página 88 pede e não ensina a medir. */
          volatilidade: (() => {
            const vol = volatilidadeDoPar(semana.get(w.mintA), semana.get(w.mintB));
            const larguraPct = fundo > 0 ? ((topo - fundo) / q.preco) * 100 : null;
            return faixaContraVolatilidade(larguraPct, vol);
          })(),
          qtdA: q.qtdA, qtdB: q.qtdB,
          mintA: w.mintA, mintB: w.mintB,
          simboloA: simboloDoMint(w.mintA), simboloB: simboloDoMint(w.mintB),
          valor,
          /* Em que unidade o valor está. "USD" é o normal; qualquer outra coisa
             é a tela tendo que avisar, em vez de pôr cifrão em cima. */
          unidade,
          /* CADA LADO EM DÓLAR, pra tela poder dizer DE QUE LADO a posição
             está sem refazer a conta.
             Ele pediu: "mostre se está tudo em cbBTC ou USDC, e ETH/SOL a
             mesma lógica". É a pergunta certa numa posição concentrada: o
             preço andando empurra tudo pra um lado, e a quantidade crua
             (0,00127 cbbt + 76,90 USDC) não responde isso de bater o olho.
             Nulo quando falta cotação de um dos dois — e nulo aqui vira
             silêncio na tela, não um zero que mente. */
          ladoAUsd: ladoA, ladoBUsd: ladoB,
          taxaPct: w.taxaPct,
          /* Mesma ideia do emprestimo: a liquidez da posicao so muda quando ele
             deposita ou retira. Preco andando e taxa acumulando nao mexem. */
          tamanho: String(p.liquidez),
          fechada: p.liquidez === 0n,
          /* O que a posição já rendeu e ainda não foi recolhido. Vem nulo
             quando não consegui ler as contas de tick — e nulo é honesto:
             melhor não mostrar do que mostrar um número que eu não sei. */
          taxas: (() => {
            const t = ticksDaPosicao.get(endereco);
            if (!t || !t.fundo || !t.topo) return null;
            const r = taxasNaoColhidas(p, w, t.fundo, t.topo, casasA, casasB);
            if (!r) return null;
            const tA = emDolar(r.qtdA, w.mintA);
            const tB = emDolar(r.qtdB, w.mintB);
            return {
              qtdA: r.qtdA, qtdB: r.qtdB,
              /* Mesmo raciocínio do valor da posição: cada lado pelo preço
                 dele. A conta antiga (lado A pelo preço do par, lado B como
                 stable) só valia quando B era stablecoin. */
              emDolar: (tA != null && tB != null) ? (tA + tB) : (r.qtdA * q.preco + r.qtdB),
            };
          })(),
          /* E QUANTO CUSTA IR BUSCAR, do lado do que há pra buscar.
             A comparação que ele pediu ao perguntar "cadê as taxas
             acumuladas": o número sozinho não diz se vale a viagem. */
          coleta: (() => {
            const c = custoDeUmaColeta({
              microLamportsPorUnidade: prioridade?.mediana || 0,
              precoDoSol: cotacoes[MINT_DO_SOL]?.preco || null,
            });
            /* E A COMPARACAO PRONTA, so quando ela tem o que comparar.
               `recolherVale` devolve null sem custo em dolar, e null aqui vira
               silencio: a tela mostra as taxas e para. */
            const t = (() => {
              const tk = ticksDaPosicao.get(endereco);
              if (!tk || !tk.fundo || !tk.topo) return null;
              const rr = taxasNaoColhidas(p, w, tk.fundo, tk.topo, casasA, casasB);
              if (!rr) return null;
              const a = emDolar(rr.qtdA, w.mintA), b = emDolar(rr.qtdB, w.mintB);
              return (a != null && b != null) ? (a + b) : null;
            })();
            return {
              sol: c.sol, dolar: c.dolar, estimado: true,
              vale: (t != null && c.dolar > 0) ? recolherVale(t, c.dolar) : null,
            };
          })(),
        };
      }
    } catch (e) {
      posicoes.__erro = "não consegui falar com a Solana agora: " + String(e?.message || e).slice(0, 90);
      return posicoes;
    }

    return posicoes;
}

/* ---------------------------------------------------------------------------
 * O VIGIA DAS POSIÇÕES
 *
 * Pedido dele em 09/09/2026: "seria bom ele falar se minha pool sai vendida ou
 * comprada, se está oscilando entrando e saindo do range".
 *
 * Roda em toda rodada do relógio, inclusive na do meio-dia que só olha o que é
 * urgente — porque sair da faixa É urgente: a posição para de render na hora e
 * vira 100% de um dos dois lados.
 *
 * COMO ELE SABE que mudou: guarda o estado a cada olhada. Sem isso, "saiu da
 * faixa" viraria uma mensagem por rodada enquanto ela estivesse fora.
 *
 * E ele CALA na maior parte das vezes, de propósito. Um aviso por posição por
 * rodada, no máximo, e só quando algo trocou. Bot que fala todo dia é bot que
 * se aprende a ignorar — e aí ele cala justamente no dia em que tinha algo.
 * ------------------------------------------------------------------------- */
async function vigiarPosicoes(env, { seco = false } = {}) {
  if (!temChaveDeServico(env)) {
    return { pulou: "sem a chave de serviço do Supabase — o vigia não consegue ler as posições" };
  }

  const linhas = await posicoesLigadas(env);
  if (!linhas || !linhas.length) return { olhou: 0, avisos: [] };

  const enderecos = [...new Set(linhas.map((l) => l.posicao).filter(Boolean))].slice(0, 20);
  const nos = env.SOLANA_RPC ? [env.SOLANA_RPC, ...NOS] : NOS;
  const lidas = await lerPosicoesDaCadeia(enderecos, nos);

  const historico = (await historicoDasPosicoes(env)) || [];
  const porPosicao = new Map();
  for (const h of historico) {
    const chave = h.user_id + "|" + h.posicao;
    if (!porPosicao.has(chave)) porPosicao.set(chave, []);
    porPosicao.get(chave).push(h);
  }

  const avisos = [];
  const paraAnotar = [];
  let naoLi = 0;

  for (const l of linhas) {
    const pos = lidas[l.posicao];
    if (!pos || pos.erro) { naoLi++; continue; }
    const estado = pos.leitura ? pos.leitura.estado : (pos.tipo === "emprestimo" ? "emprestimo" : null);
    if (!estado) continue;

    const chave = l.user_id + "|" + l.posicao;
    const antes = (porPosicao.get(chave) || [])[0];

    /* Empréstimo não tem faixa: não sai nem entra, então não há travessia pra
       avisar. Ele entra no histórico só pra o valor ficar registrado. */
    if (pos.tipo !== "emprestimo") {
      const aviso = olharPosicao(
        l.fatia || "sua posição",
        antes ? antes.estado : null,
        porPosicao.get(chave) || [],
        pos,
      );
      if (aviso) avisos.push(aviso);
    }

    /* Só anota quando o estado MUDOU, ou quando faz mais de seis horas desde a
       última anotação. Anotar toda rodada encheria a tabela de linhas iguais, e
       a contagem de travessias não ficaria melhor por isso. */
    const faz = antes ? Date.now() - new Date(antes.quando).getTime() : Infinity;
    if (!antes || antes.estado !== estado || faz > 6 * 3600 * 1000) {
      paraAnotar.push({
        user_id: l.user_id, posicao: l.posicao, estado,
        preco: pos.preco ?? null, valor: pos.valor ?? null,
      });
    }
  }

  /* A gravação NÃO é engolida.
   *
   * Ela estava com um catch vazio, e o resultado foi o histórico ficar vazio
   * sem ninguém saber — e histórico vazio quer dizer que o vigia nunca sabe o
   * que mudou. Falha de gravação vira motivo escrito, não silêncio.
   *
   * A limpeza continua engolida, e essa é a diferença: limpar é arrumação, e
   * arrumação que falha não estraga nada. */
  /* CONFERIR NAO PODE CONSUMIR O AVISO.
   *
   * A rota de saúde chama isto com `seco`. Sem isso ela GRAVA o estado novo — e
   * aí a rodada seguinte compara "fora" com "fora", não vê mudança nenhuma, e o
   * aviso de que a posição saiu da faixa some pra sempre. Uma rota pública de
   * conferência apagando justamente o aviso que ela existe pra provar que
   * funciona é o pior jeito de perder uma mensagem: sem erro, sem rastro.
   *
   * No seco ele olha, calcula e conta. Não grava e não fala. */
  let anotou = 0, erroAoAnotar = null;
  if (!seco) {
    try {
      anotou = await anotarEstado(env, paraAnotar);
    } catch (e) {
      erroAoAnotar = String(e?.message || e).slice(0, 160);
    }
    await limparHistoricoVelho(env);
  }

  /* CEGUEIRA TOTAL VIRA AVISO. Uma posição que não lê pode ser endereço errado,
     coisa dele; TODAS falharem é o nó da Solana que caiu — e essa é a falha
     silenciosa que derruba o total da carteira sem dizer por quê. */
  const cego = avisoDeCegueira(naoLi, linhas.length);
  if (cego) avisos.push(cego);

  return {
    olhou: enderecos.length,
    naoLi,
    avisos,
    anotou,
    tentouAnotar: paraAnotar.length,
    erroAoAnotar,
  };
}

/* ---------------------------------------------------------------------------
 * O VIGIA DOS TOKENS
 *
 * Pedido dele em 09/09/2026, depois de eu conferir que o bot so olhava as pools
 * e o emprestimo: "pode fazer com todos tokens volateis que eu for lancando —
 * o bot avisa isso? novo token etc...".
 *
 * DUAS COISAS, e ele escolheu as duas certas:
 *
 *   TOKEN NOVO      chegou algo que ele nao lancou. Airdrop, troco de swap,
 *                   transferencia. So se descobriria abrindo o app e clicando
 *                   em Importar — e coisa que so se descobre procurando e
 *                   coisa que nao se descobre.
 *
 *   CRUZOU O MEDIO  o que estava abaixo do que ele pagou voltou pro positivo,
 *                   ou o contrario. E a unica das duas que fala do dinheiro
 *                   DELE, e so ficou possivel quando o preco medio existiu.
 *
 * CUSTA POUCO: uma leitura da carteira (duas chamadas RPC) e tres consultas
 * estreitas ao Supabase. Roda junto com o vigia das posicoes.
 * ------------------------------------------------------------------------- */
async function vigiarTokens(env, { seco = false } = {}) {
  if (!temChaveDeServico(env)) return { pulou: "sem a chave de serviço" };

  const [linhas, movs, carteiras, vistos, lados] = await Promise.all([
    tokensLancados(env), movimentosDeToken(env), carteirasSolana(env),
    tokensVistos(env), ladosDeToken(env),
  ]);
  if (!linhas || !linhas.length) return { olhou: 0, avisos: [] };

  const avisos = [];
  const novosVistos = [], novosLados = [];

  /* ---- 1. O QUE CRUZOU O PRECO MEDIO ---------------------------------- */
  const simbolos = [...new Set(linhas.map((l) => l.token).filter(Boolean))].slice(0, 40);
  const cotacoes = simbolos.length ? (await cotarSimbolos(simbolos, env.BANCO)).tokens : {};

  const porChave = new Map();
  for (const m of movs || []) {
    const k = m.user_id + "|" + m.chave;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(m);
  }
  const ladoAntes = new Map((lados || []).map((x) => [x.user_id + "|" + x.chave, x.lado]));

  for (const l of linhas) {
    const k = l.user_id + "|" + l.chave;
    const pm = precoMedio(porChave.get(k) || []);
    if (!pm) continue;
    const cot = cotacoes[String(l.token).toUpperCase()];
    if (!cot || !(cot.preco > 0)) continue;

    const lado = ladoDoPreco(cot.preco, pm.medio);
    if (!lado) continue;

    const antes = ladoAntes.get(k) || null;
    const aviso = avisoDeCruzamento(l.fatia || l.token, antes, lado, pm.medio, cot.preco);
    if (aviso) avisos.push(aviso);

    if (antes !== lado) {
      novosLados.push({
        user_id: l.user_id, chave: l.chave, lado,
        medio: Number(pm.medio.toFixed(8)), preco: Number(cot.preco.toFixed(8)),
      });
    }
  }

  /* ---- 2. O QUE CHEGOU NA CARTEIRA ------------------------------------ */
  const nos = env.SOLANA_RPC ? [env.SOLANA_RPC, ...NOS] : NOS;
  for (const c of carteiras || []) {
    if (!c || !c.endereco) continue;
    let lidas;
    try { lidas = await tokensDaCarteira(c.endereco, nos); }
    catch { continue; }

    /* LEITURA INCOMPLETA NAO VIRA NOTICIA. Se um programa falhou, a lista veio
       curta — e anunciar por ela seria anunciar pela metade. */
    if (lidas.falhou.length) continue;

    const comSaldo = lidas.tokens.filter((t) => t.casas > 0 && t.quantidade > 0);
    const precos = await cotarMints(comSaldo.map((t) => t.mint));
    const achados = comSaldo.map((t) => ({
      mint: t.mint,
      simbolo: precos[t.mint]?.simbolo || simboloDoMint(t.mint),
      quantidade: t.quantidade,
      valor: precos[t.mint] ? t.quantidade * precos[t.mint].preco : null,
    }));

    const meus = linhas.filter((l) => l.user_id === c.user_id);
    const conhecidos = meus.map((l) => l.mint).filter(Boolean);
    const jaVistos = (vistos || []).filter((v) => v.user_id === c.user_id).map((v) => v.mint);

    /* PRIMEIRA OLHADA: anota a carteira inteira e cala. Senao o primeiro dia
       seria uma mensagem por token que ele sempre teve. */
    const estreia = jaVistos.length === 0;
    const novos = tokensNovos(achados, conhecidos, jaVistos);

    for (const t of novos) {
      if (!estreia) avisos.push(avisoDeTokenNovo(t));
    }
    /* Anota TODOS os que tem saldo, e nao so os avisados: a poeira de hoje nao
       pode virar novidade amanha so porque o preco dela subiu um centavo. */
    for (const t of achados) {
      if (jaVistos.includes(t.mint)) continue;
      novosVistos.push({ user_id: c.user_id, mint: t.mint, simbolo: t.simbolo });
    }
  }

  /* CONFERIR NAO PODE CONSUMIR O AVISO — a mesma regra do vigia das posicoes,
     e eu repeti o defeito aqui antes de lembrar dela.
     
     A rota /saude/vigia e publica. Sem o seco, ela gravaria o lado novo do
     token; e se o Bitcoin cruzasse o preco medio e alguem abrisse a rota antes
     da rodada, a comparacao seguinte veria "abaixo" contra "abaixo", nao veria
     travessia nenhuma, e o aviso sumiria pra sempre. */
  let erroAoAnotar = null;
  if (!seco) {
    try {
      await anotarTokensVistos(env, novosVistos);
      await anotarLadosDeToken(env, novosLados);
    } catch (e) { erroAoAnotar = String(e?.message || e).slice(0, 160); }
  }

  return {
    olhou: linhas.length,
    avisos,
    tokensNovosVistos: novosVistos.length,
    ladosAnotados: novosLados.length,
    erroAoAnotar,
  };
}

/* A impressao digital de um texto, pra saber se mudou.
 *
 * SHA-256 do JSON sem a data. Sem isso a cópia iria todo dia com o mesmo
 * conteúdo e um carimbo de hora diferente, e um arquivo por dia no Telegram
 * vira exatamente o lugar onde ele para de procurar quando precisar. */
async function digitalDe(texto) {
  const bytes = new TextEncoder().encode(texto);
  const resumo = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* A CÓPIA DA CARTEIRA, sozinha, uma vez por dia.
 *
 * Pedido dele em 08/09/2026, depois da primeira cópia feita à mão: "preciso que
 * seja automático, não vou lembrar sempre". Cópia que depende da memória de
 * alguém é cópia que não existe no dia do problema.
 *
 * VAI PELO TELEGRAM porque é o único caminho que já está de pé: o bot fala com
 * ele com o app fechado, e sendDocument aceita arquivo. O Drive dele é a outra
 * metade e mora no painel, porque exige a conta DELE — mas o Drive só grava
 * quando ele abre o app, e este aqui grava quando ele esquece.
 *
 * NÃO MANDA SE NÃO MUDOU: compara a digital do conteúdo sem a data. */
/* O VIGIA DOS ALVOS DE PREÇO DO BITCOIN.
 *
 * Ele pergunta, em 10/09/2026: "voce tem acesso ao monitor BTC ne? ele ta meio
 * parado". Fui olhar. Ele tinha quatro alvos, dois postos naquela manhã, e
 * TODOS com `disparado_em` vazio. Nunca dispararam — porque nada no Worker lia
 * a tabela. A tela mostrava a distância até o alvo quando ele abria o painel,
 * e era só isso.
 *
 * Um alvo estava a 1,7% do preço daquele momento.
 *
 * ------------------------------------------------------------------------
 * O QUE ESTE VIGIA PROMETE, E O QUE ELE NÃO PROMETE
 *
 * Ele roda junto das rodadas: 08h, 12h e 18h de Brasília. Então ele vê o preço
 * TRÊS VEZES POR DIA, e não a cada minuto.
 *
 * Isso quer dizer que um alvo pode ser cruzado e desfeito entre duas rodadas
 * sem que ninguém veja — o Bitcoin furar 76 mil às 3 da manhã e voltar antes
 * das 8. **A tela diz isso, com todas as letras.** Um alerta que se anuncia
 * como vigilância e entrega três olhadas por dia é pior que alerta nenhum:
 * quem confia nele para de olhar.
 *
 * Apertar isso é uma linha — acrescentar horas à lista de crons, que é de
 * graça (a Cloudflare conta expressões, não disparos). Fica por escolha dele,
 * não por limitação escondida.
 *
 * ------------------------------------------------------------------------
 * DISPARA UMA VEZ SÓ
 *
 * `disparado_em` é gravado logo depois do aviso sair, e a consulta só traz os
 * vazios. Alerta que repete é o jeito mais rápido de alguém aprender a ignorar
 * os alertas — e aí o próximo, o que importava, passa batido também.
 *
 * NÃO DIZ O QUE FAZER. Diz que o número que ELE escolheu foi alcançado, e para
 * por aí. O alvo é dele; a decisão também. */
/* O preço do Bitcoin AGORA, pelo caminho barato.
 *
 * `precoDoBitcoin()` traz 400 dias porque a faixa de bull market precisa de 57
 * semanas. Pra saber se um alvo bateu, isso é desperdício: o que importa é um
 * número, o de agora. `cotarSimbolos` é a mesma rota que cota os tokens da
 * carteira e que a tela já chama a cada minuto — leve, e com o D1 na frente. */
async function btcAgora(env) {
  try {
    const r = await cotarSimbolos(["BTC"], env.BANCO);
    const t = r?.tokens?.BTC;
    return t && t.preco > 0 ? t.preco : null;
  } catch { return null; }
}

async function vigiarAlertas(env, precoAgora, { seco = false } = {}) {
  const nada = { olhou: false, pendentes: 0, bateram: 0, avisados: 0 };
  if (!temChaveDeServico(env)) return { ...nada, motivo: "falta o segredo SUPABASE_SERVICE_KEY" };
  if (!(precoAgora > 0)) return { ...nada, motivo: "não tenho o preço do Bitcoin agora" };

  let lista;
  try {
    lista = await alertasPendentes(env);
  } catch (e) {
    return { ...nada, motivo: String(e?.message || e).slice(0, 120) };
  }

  const pendentes = lista || [];
  /* `above` bate quando o preço ALCANÇA ou passa; `below`, quando cai até ou
     abaixo. O igual entra nos dois: quem escreve 80.000 quer saber em 80.000,
     não em 80.000,01. */
  const bateram = pendentes.filter((a) =>
    a.direcao === "above" ? precoAgora >= Number(a.alvo) : precoAgora <= Number(a.alvo));

  const resultado = {
    olhou: true, pendentes: pendentes.length, bateram: bateram.length,
    avisados: 0, preco: Math.round(precoAgora),
  };
  if (!bateram.length || seco) return resultado;

  const chat = await chatDoAviso(env);
  if (!chat) return { ...resultado, motivo: "ainda não sei pra qual chat falar" };

  const PARA = String.fromCharCode(10) + String.fromCharCode(10);
  const dinheiro = (v) => "US$ " + Math.round(Number(v)).toLocaleString("pt-BR");

  for (const a of bateram) {
    const alvo = Number(a.alvo);
    const texto =
      "🎯 <b>Seu alvo foi alcançado</b>" + PARA +
      "Você marcou <b>" + (a.direcao === "above" ? "acima de " : "abaixo de ") +
      escapar(dinheiro(alvo)) + "</b>." + PARA +
      "O Bitcoin está em <b>" + escapar(dinheiro(precoAgora)) + "</b>." + PARA +
      "<i>Este alvo não avisa de novo. Eu olho o preço três vezes por dia — " +
      "às 8h, meio-dia e 18h —, então entre uma olhada e outra o preço pode ir " +
      "e voltar sem eu ver.</i>";

    const foi = await falar(env, chat, texto);
    if (!foi) continue;
    try {
      await anotarAlertaDisparado(env, a.id, new Date().toISOString());
      resultado.avisados++;
    } catch {
      /* O aviso saiu e a marca não entrou: na próxima rodada ele recebe de
         novo. Chato, e ainda assim melhor que o contrário — marcar sem avisar
         apagaria um alvo que ele nunca soube que bateu. Entre repetir e
         perder, repete. */
      resultado.repetiraProxima = (resultado.repetiraProxima || 0) + 1;
    }
  }
  return resultado;
}

async function mandarCopias(env) {
  if (!temChaveDeServico(env)) return 0;
  const chat = await chatDoAviso(env);
  if (!chat) return 0;

  const linhas = await donosComCarteira(env);
  const donos = [...new Set((linhas || []).map((l) => l.user_id).filter(Boolean))];
  if (!donos.length) return 0;

  const jaForam = new Map(
    ((await copiasEnviadas(env, "telegram")) || []).map((c) => [c.user_id, c.digital]),
  );

  const anotar = [];
  let mandadas = 0;
  for (const dono of donos) {
    const retrato = await retratoDaCarteira(env, dono);
    if (!retrato || !retrato.conferencia) continue;
    const semData = JSON.stringify({ ...retrato, radar_defi_backup: undefined });
    const digital = await digitalDe(semData);
    /* Igual à de ontem: calo. */
    if (jaForam.get(dono) === digital) continue;

    /* gerado_em, nao "quando" — ver o comentario gemeo no painel. */
    const dia = String(retrato?.radar_defi_backup?.gerado_em || "").slice(0, 10) ||
      new Date().toISOString().slice(0, 10);
    const c = retrato.conferencia;
    const PARA = String.fromCharCode(10) + String.fromCharCode(10);
    const legenda = "🗄️ Cópia da sua carteira — " + dia + "." + PARA +
      (c.linhas || 0) + " linha(s), " + (c.lancamentos || 0) + " lançamento(s)." + PARA +
      "Guarde este arquivo. Com ele dá pra remontar tudo do zero: as caixinhas, " +
      "os alvos, os aportes e os preços médios. Não tem senha nem chave dentro dele.";

    const foi = await mandarArquivo(
      env, chat, "carteira-" + dia + ".json", JSON.stringify(retrato, null, 2), legenda,
    );
    if (!foi) continue;
    mandadas++;
    anotar.push({ user_id: dono, onde: "telegram", digital, quando: new Date().toISOString() });
  }

  if (anotar.length) await anotarCopiaEnviada(env, anotar);
  return mandadas;
}

async function rodada(env, { soUrgente = false, semanal = false, seco = false, medir = false } = {}) {
  /* O VIGIA VEM PRIMEIRO, e antes de tudo que é caro.
   *
   * Sair da faixa é a coisa mais urgente que o radar tem pra dizer: a posição
   * para de render na hora e vira 100% de um dos dois lados. Se o resto da
   * rodada quebrar — DefiLlama fora do ar, limite de escrita, o que for — este
   * aviso já saiu.
   *
   * E ele roda inclusive na rodada do meio-dia, que só olha o urgente. */
  if (!seco) {
    try {
      const v = await vigiarPosicoes(env);
      /* Os tokens entram na mesma rodada, e os avisos saem juntos: duas
         notificações separadas com um minuto de diferença cansam mais que
         uma sequência. */
      let t = { avisos: [] };
      try { t = await vigiarTokens(env); } catch (e) { t = { avisos: [] }; }
      const todos = [...((v && v.avisos) || []), ...((t && t.avisos) || [])];
      if (todos.length) {
        const chat = await chatDoAviso(env);
        if (chat) {
          for (const a of todos) await falar(env, a.texto, chat).catch(() => {});
        }
      }
    } catch (e) {
      /* Vigia que falha não pode levar a rodada junto: o resto do radar
         continua útil sem ele. Mas também não some calado. */
      const chat = await chatDoAviso(env).catch(() => null);
      if (chat) {
        await falar(env, "O vigia das posições não conseguiu olhar agora: " +
          String(e?.message || e).slice(0, 140), chat).catch(() => {});
      }
    }
  }

  const retrato = await montarRetrato(env, { gravar: true });

  // Só a rodada da manhã mede a qualidade: é a parte cara, e as medidas mudam
  // devagar demais pra valer três vezes por dia.
  let avisoDeMedida = "";
  /* UMA MEDIÇÃO POR DIA, DE CADA COISA.
   *
   * Isto já foi de 4 em 4 horas, por um dia. Ele pediu, eu fiz, e ele mesmo
   * desfez no dia seguinte: "vi que não faz sentido várias por dia, pode
   * deixar apenas uma por dia de cada, de 24 em 24 horas".
   *
   * Ele tem razão, e o motivo é uma coisa que a gente construiu no meio do
   * caminho: o PREÇO DO BITCOIN JÁ SE ATUALIZA SOZINHO NA TELA, a cada minuto,
   * direto no navegador. As rodadas extras estavam refrescando na nuvem um
   * número que já chegava fresco por outro caminho — trabalho para ninguém.
   *
   * E o resto do que elas mediam muda devagar por natureza: o chão de uma pool
   * é medido sobre 30 dias, a média de 200 dias do Bitcoin anda um pouquinho
   * por dia, o estoque de stablecoin do mundo se move em semanas. Medir de 4 em
   * 4 horas dava a sensação de frescor sem entregar informação nova.
   *
   * A LIÇÃO, e ela vale além daqui: a frequência certa de uma medida é a do que
   * está sendo medido, não a da ansiedade de quem olha. Quando o número muda
   * devagar, medir mais vezes só custa mais. */
  /* OS ALVOS DE PREÇO, EM TODAS AS TRÊS RODADAS — e não só na das 8h.
   *
   * Tudo o mais aqui é medido uma vez por dia, e com razão: chão de pool,
   * média de 200 dias, estoque de stablecoin, todos mudam devagar. Um ALVO DE
   * PREÇO não é isso. Ele é uma pergunta de sim ou não sobre um número que
   * anda o dia inteiro, e olhar uma vez por dia responderia errado quase
   * sempre.
   *
   * Custa uma cotação (a rota barata, com o D1 na frente) e uma consulta ao
   * Supabase. Quando não há alvo pendente, para na primeira e não fala nada. */
  try {
    await vigiarAlertas(env, await btcAgora(env));
  } catch { /* um alvo não avisado é ruim; a rodada caída é pior */ }

  if (medir) {
    // Antes da qualidade porque é barato (2 chamadas contra 16 MB de download)
    // e porque o texto da manhã já quer o ciclo pronto.
    await medirOCiclo(env, retrato.dia);

    /* A cópia da carteira. Dentro de try porque perder o backup de hoje é
       ruim, mas derrubar a rodada da manhã junto seria pior. */
    try { await mandarCopias(env); } catch { /* silêncio aqui é rodada de pé */ }

    /* A cotação do dólar, uma vez por dia.
     *
     * A carteira dele mistura real (reserva de emergência) e dólar (cripto), e
     * somar as duas sem câmbio daria um total errado com cara de certo. Guardada
     * como as outras leituras: buscar a cada abertura do painel pagaria uma
     * chamada por F5 pra receber o mesmo número.
     *
     * Falhar aqui não derruba a rodada — sem cotação o painel soma só o que já
     * está na moeda escolhida e DIZ quantas linhas ficaram de fora. */
    try {
      const c = await cotacaoDoDolar();
      if (c) {
        await guardarAjuste(env, "dolar", JSON.stringify({
          valor: c.valor, fonte: c.fonte, dia: retrato.dia,
        }));
      }
    } catch { /* silêncio aqui vira "sem cotação", não vira rodada quebrada */ }

    /* A QUALIDADE DAS REDES E AS POOLS, dentro do mesmo interruptor do resto.
       Isto refaz cartaz, chão, pior dia e classe das ~3.800 pools: é a parte
       cara — 12 MB de download e milhares de escritas — e a que mais justifica
       ser diária. O chão é medido sobre 30 dias; ele não muda entre uma manhã
       e a próxima. */
    /* A QUALIDADE DAS REDES E AS POOLS — só quando NÃO estamos no modo
       econômico. No grátis isto roda no computador de quem usa, por
       node medir-pools.js: são 12 MB de download e milhares de escritas, e
       nenhum dos dois cabe em 10 milissegundos. */
    if (!modoEconomico(env)) try {
      await medirQualidade(env, retrato.dia, retrato.protocolos, new Map(
        retrato.fichas.map((f) => [f.rede, { tvl: f.tvl }]),
      ));
    } catch (erro) {
      avisoDeMedida = `

<i>(não consegui medir a qualidade das redes hoje: ${escapar(erro.message)} — os números de aluguel e taxa podem estar de ontem)</i>`;
    }
  }

  const chat = seco ? "seco" : await chatDoAviso(env);
  if (!chat) return { erro: "ainda não sei pra qual chat falar" };

  const agora = new Date().toISOString();
  const jaDados = await avisosRecentes(env);

  let candidatos = retrato.achados;
  if (soUrgente) candidatos = candidatos.filter((a) => a.tipo === "fuga");

  const { mostrar, anotar, calado } = separarParaAvisar(
    candidatos, retrato.deProtocolo, retrato.pares, jaDados, retrato.dia,
  );

  /* O silêncio vale pras rodadas do meio do dia, não pra do apanhado.
   *
   * `calado` diz que nenhuma REDE se mexeu o bastante — e isso não tem nada a
   * ver com as pools, que são o assunto principal da mensagem da manhã. Sem o
   * `!medir` aqui, um dia de mercado parado nas redes faria o radar engolir o
   * apanhado de pools inteiro e não falar nada. */
  if (calado && !semanal && !medir) return { dia: retrato.dia, avisos: 0, calou: true };

  const puxadoresPor = {};
  for (const a of mostrar.redes.slice(0, 8)) {
    puxadoresPor[a.alvo] = quemPuxou(a.alvo, retrato.protocolos, 3);
  }

  /* A rodada da manhã manda o apanhado completo, nas quatro caixas; as outras
   * mandam só o que mudou.
   *
   * A diferença existe porque as duas mensagens servem a momentos diferentes:
   * de manhã o Rayakuza quer o panorama pra decidir o dia, e às 12h e 18h ele já
   * viu o panorama — ali só interessa o que mexeu desde então. Mandar o
   * apanhado três vezes seria treiná-lo a não ler nenhuma. */
  let texto;
  if (medir) {
    const radar = await montarRadar(env);
    texto = textoDoRadar({
      dia: semanal ? `${retrato.dia} (a semana)` : retrato.dia,
      pools: radar.pools,
      redes: radar.redes,
      mudou: radar.mudou,
      endereco: await lerAjuste(env, "endereco"),
    });
  } else {
    texto = textoDoResumo({
      dia: retrato.dia,
      achados: mostrar.redes,
      protocolos: mostrar.protocolos,
      pares: mostrar.pares,
      puxadoresPor,
    });
  }

  /* O aviso da carteira vai numa mensagem SEPARADA, e vai primeiro.
   *
   * Separada porque é sobre dinheiro que já está na mesa, e misturá-la no meio
   * do apanhado do mercado faria a única mensagem que exige ação dele chegar
   * como parágrafo cinco de um boletim. Primeiro pelo mesmo motivo.
   *
   * Só na rodada que mede: as outras não recalculam nada, então comparariam a
   * entrada dele com a medida de ontem e diriam a mesma coisa três vezes. */
  if (medir) {
    try {
      const aviso = textoDeAvisoDaCarteira(await situacaoDaCarteira(env));
      if (aviso && !seco) await falar(env, aviso, chat);
    } catch (erro) {
      // Falhar aqui não pode levar o apanhado do mercado junto.
      avisoDeMedida += `

<i>(não consegui conferir suas pools hoje: ${escapar(erro.message)})</i>`;
    }
  }

  // No modo seco os avisos SÃO anotados: é o que faz a segunda chamada calar, e
  // portanto é o que prova o dedupe. Anotar só de verdade tornaria o teste
  // incapaz de testar a única coisa que ele existe pra testar.
  if (!seco) await falar(env, texto + avisoDeMedida, chat);
  await anotarAvisos(env, anotar, agora);
  return {
    dia: retrato.dia,
    // `mostrados` e `anotados` diferem de propósito: o segundo é maior quando a
    // mensagem não coube inteira. Ver os dois no retorno é o que teria feito o
    // bug das prestações aparecer na primeira vez que alguém olhou.
    mostrados: mostrar.redes.length + mostrar.protocolos.length,
    anotados: anotar.length,
    ...(seco ? { seco: true, mensagem: texto } : {}),
  };
}

// ---------------------------------------------------------------------------
// As perguntas no Telegram

async function responder(env, mensagem) {
  const chat = mensagem?.chat?.id;
  const texto = (mensagem?.text || "").trim();
  if (!chat || !texto) return;

  // O primeiro chat que fala com o bot vira o destino dos avisos. Poupa o Rayakuza
  // de ter que descobrir o número do chat em algum lugar — ele só manda um /oi.
  if (!(await lerAjuste(env, "chat"))) await guardarAjuste(env, "chat", chat);

  const [comando, ...resto] = texto.split(/\s+/);
  const argumento = resto.join(" ").trim();

  /* A barra é opcional.
   *
   * Em 02/09/2026, no primeiro minuto de uso, o Rayakuza mandou "Oi" e levou um
   * "não conheço esse comando" na cara. A barra é convenção do Telegram, não
   * obrigação de quem está falando — e um bot que corrige a forma antes de
   * entender o pedido ensina a pessoa a ter medo de escrever nele. */
  const cmd = "/" + comando.toLowerCase().replace(/^\/+/, "").replace(/@.*$/, "");

  const dizer = (t) => falar(env, t, chat);

  const CUMPRIMENTOS = ["/ajuda", "/start", "/oi", "/ola", "/olá", "/bom", "/boa", "/eai", "/menu"];
  if (CUMPRIMENTOS.includes(cmd)) return dizer(AJUDA);

  if (cmd === "/painel") {
    const endereco = (await lerAjuste(env, "endereco")) || "o endereço do worker + /painel";
    return dizer(`O painel fica em:\n${endereco}`);
  }

  /* O ciclo: `/ciclo` mostra, `/ciclo bull|bear|auto` decide.
   *
   * Fica ANTES da parte cara porque sai inteiro do banco — a leitura foi
   * guardada pela rodada da manhã. E fica sendo comando, e não dedução
   * automática, porque o método usa o ciclo pra definir a meta mensal, e uma
   * meta é coisa que a pessoa assume, não que o programa atribui a ela. */
  if (cmd === "/ciclo") {
    const pedido = argumento.toLowerCase().replace(/[^a-z]/g, "");
    if (pedido === "bull" || pedido === "bear" || pedido === "auto") {
      await guardarAjuste(env, "ciclo", pedido);
      const c = await cicloDoBanco(env);
      return dizer(textoDoCiclo(c, { acabouDeMudar: true }));
    }
    if (pedido) {
      return dizer("Não entendi. Use <code>/ciclo bull</code>, <code>/ciclo bear</code> ou <code>/ciclo auto</code> — ou só <code>/ciclo</code> pra ver como está.");
    }
    return dizer(textoDoCiclo(await cicloDoBanco(env)));
  }

  /* A carteira: o que ele JÁ TEM.
   *
   * Fica antes da parte cara porque sai inteira do banco, e porque é a pergunta
   * mais frequente de quem tem dinheiro na mesa. */
  /* `/par ETH-USDC` — sai inteiro do banco, então vem antes da parte cara. */
  if (cmd === "/par" || cmd === "/pares" || cmd === "/onde") {
    if (!argumento) {
      return dizer("Qual par? Ex.: <code>/par ETH-USDC</code>\n\nEu mostro em quais redes e protocolos ele existe hoje, ordenado pelo multiplicador do método.");
    }
    const { results } = await env.BANCO.prepare(
      `SELECT rede, projeto, simbolo, tvl, chao, cartaz, classe, apy_base
       FROM medida_piscina
       WHERE dia = (SELECT MAX(dia) FROM medida_piscina) AND portao_passa = 1 AND apy_base > 0`,
    ).all();
    const pools = (results || []).map((m) => ({
      rede: m.rede, projeto: m.projeto, simbolo: m.simbolo, tvl: m.tvl,
      chao: m.chao, cartaz: m.cartaz, classe: m.classe,
      multiplicador: multiplicador(m.apy_base),
    }));
    const alvo = chaveDoPar(argumento);
    const grupos = agruparPorPar(pools);
    const lista = alvo ? grupos.get(alvo) : null;
    return dizer(textoDaComparacao(lista ? compararPar(alvo, lista) : null, argumento));
  }

  /* A cópia agora, sem esperar a manhã.
   *
   * O automático roda às 8h e cala se nada mudou — o que é certo pra não
   * encher o histórico, e errado no dia em que ele QUER o arquivo na mão.
   * Pedido à mão sempre manda. */
  if (cmd === "/copia" || cmd === "/backup") {
    if (!temChaveDeServico(env)) return dizer("Não consigo ler sua carteira agora — falta a chave do banco.");
    const chat = await chatDoAviso(env);
    if (!chat) return dizer("Não sei pra qual conversa mandar o arquivo.");

    const linhas = await donosComCarteira(env);
    const donos = [...new Set((linhas || []).map((l) => l.user_id).filter(Boolean))];
    if (!donos.length) return dizer("Sua carteira está vazia — não há o que copiar ainda.");

    let mandadas = 0;
    const anotar = [];
    for (const dono of donos) {
      const retrato = await retratoDaCarteira(env, dono);
      if (!retrato || !retrato.conferencia) continue;
      const dia = String(retrato?.radar_defi_backup?.gerado_em || "").slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
      const c = retrato.conferencia;
      const PARA = String.fromCharCode(10) + String.fromCharCode(10);
      const foi = await mandarArquivo(env, chat, "carteira-" + dia + ".json",
        JSON.stringify(retrato, null, 2),
        "🗄️ Cópia da sua carteira — " + dia + ", a seu pedido." + PARA +
        (c.linhas || 0) + " linha(s), " + (c.lancamentos || 0) + " lançamento(s)." + PARA +
        "Guarde este arquivo. Com ele dá pra remontar tudo do zero. " +
        "Não tem senha nem chave dentro dele.");
      if (!foi) continue;
      mandadas++;
      const semData = JSON.stringify({ ...retrato, radar_defi_backup: undefined });
      anotar.push({
        user_id: dono, onde: "telegram",
        digital: await digitalDe(semData), quando: new Date().toISOString(),
      });
    }
    if (anotar.length) await anotarCopiaEnviada(env, anotar);
    if (!mandadas) return dizer("Tentei mandar e não consegui. A carteira está inteira no banco — o que falhou foi o envio.");
    return dizer("Pronto — a cópia subiu aqui em cima. Ela também vai sozinha toda manhã, quando alguma coisa muda.");
  }

  if (cmd === "/minhas" || cmd === "/minhas-pools" || cmd === "/carteira") {
    return dizer(textoDaCarteira(await situacaoDaCarteira(env)));
  }

  if (cmd === "/entrei" || cmd === "/entrar") {
    if (!argumento) {
      return dizer("Me diz qual pool. Ex.: <code>/entrei raydium RAY-USDC</code>\n\nEu guardo a foto de hoje dela — chão, incentivo, tamanho — e passo a te avisar quando isso mudar.");
    }
    const achadas = await acharPool(env, argumento);
    if (!achadas.length) {
      return dizer(`Não achei pool com "${escapar(argumento)}" na medição de hoje.\n\nSó consigo acompanhar pool que o radar mede — se ela tem menos de $500k ou não passou nos portões, ela não está na lista. Tenta o nome do protocolo junto do par: <code>/entrei orca SOL-USDC</code>`);
    }
    if (achadas.length > 1) return dizer(textoDeCandidatas(achadas, argumento));

    const foto = fotoDaEntrada(achadas[0], hojeEmBrasilia());
    await guardarMinhaPool(env, foto);
    return dizer(textoDaEntradaGuardada(foto, achadas[0]));
  }

  if (cmd === "/sai" || cmd === "/saí" || cmd === "/sair") {
    if (!argumento) return dizer("Me diz de qual pool você saiu. Ex.: <code>/sai raydium</code> — ou <code>/minhas</code> pra ver a lista.");
    const minhas = await minhasPools(env);
    const alvo = argumento.toLowerCase();
    const bate = minhas.filter((m) =>
      m.id === argumento ||
      `${m.projeto} ${m.simbolo} ${m.rede}`.toLowerCase().includes(alvo));
    if (!bate.length) return dizer(`Não estou acompanhando nada que bata com "${escapar(argumento)}". Manda <code>/minhas</code> pra ver a lista.`);
    if (bate.length > 1) {
      return dizer("Bateu em mais de uma. Qual delas?\n\n" + bate.map((m) =>
        `<code>/sai ${m.id}</code>\n   ${escapar(m.projeto)} ${escapar(m.simbolo || "")} · ${escapar(m.rede)}`).join("\n\n"));
    }
    await env.BANCO.prepare("DELETE FROM minhas_pools WHERE id = ?").bind(bate[0].id).run();
    return dizer(`Parei de acompanhar <b>${escapar(bate[0].projeto)} ${escapar(bate[0].simbolo || "")}</b>.`);
  }

  if (cmd === "/seguindo") {
    const seguidas = await redesSeguidas(env);
    return dizer(seguidas.size
      ? `Seguindo de perto:\n${[...seguidas].map((r) => `· ${r}`).join("\n")}`
      : "Não estou seguindo nenhuma rede de perto. Use /seguir Base.");
  }

  if (cmd === "/seguir" || cmd === "/parar") {
    if (!argumento) return dizer(`Falta o nome da rede. Ex.: ${cmd} Base`);
    // Confere se a rede existe antes de aceitar — senão o Rayakuza segue um nome
    // errado e fica esperando um aviso que nunca vem.
    const redes = await redesAgora();
    const achada = [...redes.keys()].find((n) => n.toLowerCase() === argumento.toLowerCase());
    if (!achada) return dizer(`Não achei a rede "${argumento}". O nome tem que ser igual ao do DefiLlama (ex.: Base, Arbitrum, Hyperliquid L1).`);
    if (cmd === "/seguir") {
      await env.BANCO.prepare("INSERT OR REPLACE INTO seguidas (rede, desde) VALUES (?, ?)")
        .bind(achada, new Date().toISOString()).run();
      return dizer(`Seguindo <b>${achada}</b> de perto. Agora eu aviso de mexida pela metade do tamanho.`);
    }
    await env.BANCO.prepare("DELETE FROM seguidas WHERE rede = ?").bind(achada).run();
    return dizer(`Parei de seguir <b>${achada}</b>.`);
  }

  /* As piscinas vêm só do banco, então respondem antes da parte cara.
   *
   * Tudo abaixo desta linha monta o retrato, que custa três chamadas ao
   * DefiLlama. Perguntar "quais pools estão pagando" não precisa de nenhuma
   * delas — e no celular a diferença entre responder na hora e responder depois
   * de buscar 6,7 MB é a diferença entre usar e desistir. */
  /* `/incentivadas` é o nome novo, na palavra do curso; `/alugadas` continua
   * valendo. Comando que some é comando que dá erro pra quem decorou — e o
   * custo de manter os dois é uma linha. */
  const ATALHOS = {
    "/firmes": "firme", "/taxas": "firme",
    "/incentivadas": "alugada", "/incentivos": "alugada", "/alugadas": "alugada",
    "/loterias": "loteria",
  };
  if (cmd in ATALHOS || cmd === "/pools" || cmd === "/novas" || cmd === "/piscinas") {
    const novas = cmd === "/novas" || /^novas?$/i.test(argumento);

    /* A classe pode vir pelo atalho (/firmes) ou como palavra (/pools firmes).
     * As duas formas porque uma é rápida de digitar e a outra é a que sai
     * naturalmente de quem não decorou os atalhos. */
    const porPalavra = {
      firme: "firme", firmes: "firme", taxa: "firme", taxas: "firme",
      incentivada: "alugada", incentivadas: "alugada", incentivo: "alugada",
      incentivos: "alugada", alugada: "alugada", alugadas: "alugada",
      loteria: "loteria", loterias: "loteria",
    };
    const primeira = argumento.split(/\s+/)[0]?.toLowerCase();
    const classe = ATALHOS[cmd] || porPalavra[primeira] || null;

    let rede = null;
    let pedida = argumento;
    if (novas) pedida = pedida.replace(/^novas?\s*/i, "");
    if (classe && porPalavra[primeira]) pedida = pedida.replace(/^\S+\s*/, "");
    pedida = pedida.trim();
    if (pedida) {
      // Corrige maiúsculas: ele digita "base", o banco guarda "Base".
      const conhecidas = await redesComPiscina(env);
      rede = conhecidas.find((r) => r.toLowerCase() === pedida.toLowerCase());
      if (!rede) {
        return dizer(
          `Não tenho piscina guardada em "${escapar(pedida)}".\n\n` +
          `Redes com piscina agora:\n${conhecidas.slice(0, 25).map((r) => `· ${escapar(r)}`).join("\n")}`,
        );
      }
    }
    const linhas = await piscinasDoBanco(env, { rede, novas, classe, limite: 8 });
    return dizer(textoDasPiscinas(linhas, { rede, novas, classe }));
  }

  // Daqui pra baixo tudo precisa do retrato — que custa três chamadas de rede.
  const r = await montarRetrato(env);

  if (cmd === "/rede") {
    if (!argumento) return dizer("Falta o nome da rede. Ex.: /rede Base");
    const f = r.fichas.find((x) => x.rede.toLowerCase() === argumento.toLowerCase());
    const q = f ? r.qualidade.get(f.rede) : null;
    return dizer(textoDaRede(
      f,
      f ? quemPuxou(f.rede, r.protocolos, 5) : [],
      q,
      q ? observacoes({ ...q, rede: f.rede }) : [],
    ));
  }

  const filtrar = { "/entrando": "entrada", "/pequenas": "pequena", "/saindo": "fuga" }[cmd];
  if (filtrar) {
    const lista = r.achados.filter((a) => a.tipo === filtrar);
    if (!lista.length) return dizer("Nada nessa categoria agora.");
    const puxadoresPor = {};
    for (const a of lista.slice(0, 5)) puxadoresPor[a.alvo] = quemPuxou(a.alvo, r.protocolos, 3);
    return dizer(lista.slice(0, 6).map((a) => textoDeAchado(a, puxadoresPor[a.alvo])).join("\n"));
  }

  if (cmd === "/radar") {
    const puxadoresPor = {};
    for (const a of r.achados.slice(0, 6)) puxadoresPor[a.alvo] = quemPuxou(a.alvo, r.protocolos, 2);
    return dizer(textoDoResumo({
      dia: r.dia, achados: r.achados, protocolos: r.deProtocolo, pares: r.pares, puxadoresPor,
    }));
  }

  // Não conhecer o pedido não é motivo pra devolver só uma negativa: quem não
  // acertou o comando é justamente quem precisa ver a lista.
  return dizer(`Não entendi "${escapar(texto.slice(0, 40))}".\n\n${AJUDA}`);
}

// ---------------------------------------------------------------------------
// As portas

export default {
  async scheduled(evento, env, contexto) {
    const hora = new Date(evento.scheduledTime).getUTCHours();
    const dia = new Date(evento.scheduledTime).getUTCDay();

    /* TRÊS RODADAS POR DIA, e cada uma faz uma coisa diferente:
     *
     *   11 (08h BRT) mede tudo — ciclo, pools, qualidade, dólar — manda a cópia
     *                de segurança da carteira e fala o que achou
     *   15 (12h BRT) só interrompe se for urgente
     *   21 (18h BRT) a rodada completa da tarde
     *   segunda 02h  o apanhado da semana
     *
     * A medição é UMA POR DIA de cada coisa: o comentário longo dentro de
     * `rodada` explica por quê, e a razão é boa — o que se mede aqui muda
     * devagar, e o preço do Bitcoin, que muda rápido, já se atualiza sozinho na
     * tela pelo navegador. */
    contexto.waitUntil(
      rodada(env, {
        soUrgente: hora === 15,          // meio-dia de Brasília: só o que é urgente
        medir: hora === 11,              // 8h de Brasília: a medição do dia
        semanal: dia === 1 && hora === 2, // segunda de madrugada: o apanhado
      }).catch(async (erro) => {
        // Um radar que quebra calado é pior que radar nenhum: o Rayakuza acha que o
        // mercado está parado quando na verdade ninguém está olhando.
        const chat = await chatDoAviso(env);
        if (chat) await falar(env, textoDaQuebra(erro), chat).catch(() => {});
      }),
    );
  },

  async fetch(pedido, env, contexto) {
    const url = new URL(pedido.url);

    // O webhook do Telegram, atrás da palavra secreta.
    if (url.pathname === `/telegram/${env.GATILHO}` && pedido.method === "POST") {
      const corpo = await pedido.json().catch(() => ({}));
      // Responde 200 na hora: o Telegram reenvia a mensagem se demorar, e aí o
      // Rayakuza receberia a mesma resposta duas ou três vezes.
      contexto.waitUntil(responder(env, corpo.message || corpo.edited_message).catch(() => {}));
      return new Response("ok");
    }

    /* Ligar o Telegram no radar, sem ninguém precisar manusear o token.
     *
     * O caminho de sempre é o dono montar à mão uma URL da api.telegram.org com
     * o token no meio dela e colar no navegador. Funciona, e é um jeito ótimo de
     * vazar o token: ele fica no histórico do navegador, e basta uma letra
     * errada pra não funcionar sem dizer por quê.
     *
     * Aqui o worker já tem o token guardado como segredo e sabe o próprio
     * endereço, então ele mesmo faz a ligação. O dono só abre um endereço que
     * não contém segredo nenhum além do gatilho. */
    if (url.pathname === `/ligar-telegram/${env.GATILHO}`) {
      const webhook = `${url.origin}/telegram/${env.GATILHO}`;
      const r = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: webhook, allowed_updates: ["message"] }),
        },
      );
      const resposta = await r.json().catch(() => ({}));
      // O endereço volta na resposta pra conferência, mas o token nunca —
      // nem aqui, nem no log.
      return Response.json({
        ligou: resposta.ok === true,
        webhook,
        recado: resposta.ok
          ? "Pronto. Agora manda /oi pro bot no Telegram."
          : resposta.description || "o Telegram recusou",
      });
    }

    // Rodar a varredura à mão, pra testar sem esperar o relógio.
    /* Só o vigia, pra conferir na hora sem esperar o relógio.
     *
     *   /rodar/SEU-GATILHO?vigia
     *
     * Devolve o que ele viu e o que MANDARIA, sem mandar — assim dá pra ver se
     * está funcionando sem acordar ninguém com uma mensagem de teste. */
    if (url.pathname === `/rodar/${env.GATILHO}` && url.searchParams.has("vigia")) {
      try {
        const v = await vigiarPosicoes(env);
        return Response.json({
          ...v,
          avisos: (v.avisos || []).map((a) => ({ tipo: a.tipo, texto: a.texto })),
          calou: !(v.avisos || []).length,
        }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        return Response.json({ erro: String(e?.message || e) }, { status: 500 });
      }
    }

    if (url.pathname === `/rodar/${env.GATILHO}`) {
      await guardarAjuste(env, "endereco", `${url.origin}/painel`);
      return Response.json(await rodada(env, {
        semanal: url.searchParams.has("tudo"),
        seco: url.searchParams.has("seco"),
        medir: url.searchParams.has("medir"),
      }));
    }

    if (url.pathname === "/painel" || url.pathname === "/") {
      return new Response(paginaDoPainel(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          /* `no-cache` NÃO é "não guarde": é "guarde, mas confirme comigo antes
           * de usar". Sem este cabeçalho o navegador escolhe sozinho por quanto
           * tempo a página vale, e num app instalado ele escolhe muito.
           *
           * Em 08/09/2026 isso deixou o Rayakuza sem ver a aba Carteira no PC:
           * publiquei, o service worker foi buscar na rede como manda o
           * desenho dele, e a rede devolveu a cópia velha do próprio
           * navegador. Página de app tem que ser sempre reconferida. */
          "cache-control": "no-cache",
        },
      });
    }

    /* As peças do app instalável.
     *
     * Servidas pelo próprio worker porque o projeto não tem etapa de build nem
     * lugar pra hospedar arquivo — os ícones moram em `icones.js` como texto e
     * viram bytes aqui. */
    if (url.pathname === "/manifest.json") {
      return Response.json({
        name: "Radar DeFi",
        short_name: "Radar",
        description: "Para onde o dinheiro do DeFi está indo",
        start_url: "/painel",
        scope: "/",
        display: "standalone",
        background_color: "#0e1013",
        theme_color: "#0e1013",
        orientation: "portrait-primary",
        icons: [
          { src: "/icone-64.png?v=" + VERSAO, sizes: "64x64", type: "image/png", purpose: "any" },
          { src: "/icone-128.png?v=" + VERSAO, sizes: "128x128", type: "image/png", purpose: "any" },
          { src: "/icone-192.png?v=" + VERSAO, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icone-512.png?v=" + VERSAO, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icone-recortavel.png?v=" + VERSAO, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      }, {
        /* Sem cache, e o motivo é o ícone.
         *
         * O manifesto ia sem cabeçalho nenhum, então cada navegador inventava
         * um prazo próprio — e é ELE que diz qual desenho o sistema usa quando
         * o app é instalado. Manifesto velho na hora de instalar significa
         * ícone velho no atalho, mesmo com a imagem nova no ar.
         *
         * Ele é pequeno; revalidar sempre não custa nada. */
        headers: { "cache-control": "no-cache" },
      });
    }

    if (/^\/icone-(32|64|128|192|512|recortavel)\.png$/.test(url.pathname)) {
      const POR_TAMANHO = {
        "/icone-32.png": ICONE_32,
        "/icone-64.png": ICONE_64,
        "/icone-128.png": ICONE_128,
        "/icone-192.png": ICONE_192,
        "/icone-512.png": ICONE_512,
        "/icone-recortavel.png": ICONE_RECORTAVEL,
      };
      const texto = POR_TAMANHO[url.pathname];
      const bytes = Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

      /* O ENDEREÇO CARREGA A VERSÃO, e é isso que faz o desenho novo aparecer.
       *
       * Em 09/09/2026 o Rayakuza trocou o alien e continuou vendo o antigo. O
       * ícone ia com "guarde por 7 dias", então o navegador obedecia e nem
       * perguntava se havia outro — publicar de novo não adiantava nada.
       *
       * Guardar por muito tempo está certo: ícone quase nunca muda. O que
       * estava errado era o endereço ser sempre o mesmo. Com a versão dentro
       * dele, imagem nova é endereço novo, e endereço novo o navegador busca.
       *
       * Sem ?v= a resposta é curta: quem chega pelo endereço velho é alguém com
       * a página velha, e não pode ficar preso a ele por uma semana. */
      const temVersao = url.searchParams.get("v") === VERSAO;
      return new Response(bytes, {
        headers: {
          "content-type": "image/png",
          "cache-control": temVersao
            ? "public, max-age=604800, immutable"
            : "no-cache",
          etag: '"' + VERSAO + '-' + url.pathname + '"',
        },
      });
    }

    /* O service worker.
     *
     * Guarda só a casca (a página e os ícones), nunca os dados. Guardar
     * `/api/retrato` faria o app abrir mostrando o mercado de ontem com cara de
     * hoje — e número velho apresentado como atual é pior que tela de erro. Os
     * dados têm o próprio guardado, no navegador, e esse vem sempre carimbado
     * com a hora. */
    if (url.pathname === "/sw.js") {
      return new Response(SERVICE_WORKER, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          /* O pior cache de todos é o do próprio service worker: um SW velho
           * decide como TODO o resto é buscado, e se conserta sozinho nunca. */
          "cache-control": "no-cache",
        },
      });
    }

    if (url.pathname === "/api/retrato") {
      const r = await montarRetrato(env);
      return Response.json({
        dia: r.dia,
        fonteDeStablecoin: r.fonte,
        seguidas: [...r.seguidas],
        redes: r.fichas.slice(0, 120).map((f) => {
          const q = r.qualidade.get(f.rede);
          return q ? { ...f, qualidade: q, notas: observacoes({ ...q, rede: f.rede }) } : f;
        }),
        qualidadeDe: r.qualidade.size ? [...r.qualidade.values()][0].dia : null,
        achados: r.achados.map((a) => ({
          tipo: a.tipo, alvo: a.alvo, forca: a.forca,
          capitalNovo: a.capitalNovo ?? null, deUmDia: a.deUmDia ?? false,
          puxadores: quemPuxou(a.alvo, r.protocolos, 3),
        })),
        protocolos: r.deProtocolo.slice(0, 25).map((a) => ({
          tipo: a.tipo, nome: a.protocolo.nome, categoria: a.protocolo.categoria,
          redes: a.protocolo.redes, tvl: a.protocolo.tvl, pct: a.forca, abs: a.abs,
        })),
        pares: r.pares.slice(0, 5),
      }, { headers: { "cache-control": "public, max-age=300" } });
    }

    /* As piscinas: quem está pagando, e onde estão montando.
     *
     * Sai do banco, não da API — a lista crua tem 11,7 MB e as medidas mudam
     * devagar. `?rede=` filtra; `?novas` traz só as recém-montadas. */
    if (url.pathname === "/api/pools") {
      const rede = url.searchParams.get("rede");
      const soNovas = url.searchParams.has("novas");
      const limite = Math.min(Number(url.searchParams.get("limite")) || 60, 200);

      const condicoes = ["dia = (SELECT MAX(dia) FROM piscinas)"];
      const valores = [];
      if (rede) { condicoes.push("rede = ?"); valores.push(rede); }
      // 21 dias: tempo suficiente pra uma piscina deixar de ser novidade, curto
      // o bastante pra "montaram agora" ainda querer dizer alguma coisa.
      if (soNovas) condicoes.push("idade_dias IS NOT NULL AND idade_dias <= 21");

      const { results } = await env.BANCO.prepare(
        `SELECT * FROM piscinas WHERE ${condicoes.join(" AND ")}
         ORDER BY tvl DESC LIMIT ?`,
      ).bind(...valores, limite).all();

      const redes = await env.BANCO.prepare(
        `SELECT rede, COUNT(*) AS piscinas, SUM(tvl) AS tvl
         FROM piscinas WHERE dia = (SELECT MAX(dia) FROM piscinas)
         GROUP BY rede ORDER BY tvl DESC LIMIT 40`,
      ).all();

      return Response.json({
        dia: results?.[0]?.dia ?? null,
        redes: redes.results || [],
        piscinas: (results || []).map((p) => ({
          rede: p.rede, projeto: p.projeto, simbolo: p.simbolo, meta: p.meta,
          tvl: p.tvl, apy: p.apy, apyBase: p.apy_base, apyReward: p.apy_reward,
          idade: p.idade_dias, estavel: !!p.estavel, riscoIl: p.risco_il,
          exposicao: p.exposicao, apyVar7d: p.apy_var7d, balanco: p.balanco,
        })),
      }, { headers: { "cache-control": "public, max-age=600" } });
    }

    /* O preço ao vivo dos tokens da carteira.
     *
     * POST e não GET, e o motivo não é técnico: a lista de símbolos é a
     * composição da carteira dele. Numa URL ela entraria em log, em histórico
     * de navegador e em cache de intermediário. Quanto ele tem continua só no
     * Supabase, atrás do login dele — daqui passa só QUAIS tokens, e nem isso
     * precisa ficar escrito num endereço.
     *
     * Também é por isso que a resposta não tem cache: preço velho num painel
     * que promete "ao vivo" é pior que preço nenhum. */
    if (url.pathname === "/api/precos" && pedido.method === "POST") {
      let corpo = null;
      try { corpo = await pedido.json(); } catch { corpo = null; }
      const pedidos = (Array.isArray(corpo?.tokens) ? corpo.tokens : [])
        .map((s) => String(s || "").trim()).filter(Boolean).slice(0, 40);
      if (!pedidos.length) return Response.json({ tokens: {}, quando: null });

      const r = await cotarSimbolos(pedidos, env.BANCO);
      // O "mexeu muito" sai junto: quem mostra o preço é quem sabe se ele pulou.
      for (const [simbolo, t] of Object.entries(r.tokens)) {
        if (t && t.variacao24h != null) t.movimento = lerMovimento(t.variacao24h);
      }
      return Response.json(r, { headers: { "cache-control": "no-store" } });
    }

    /* Achar uma pool, ou reler as que ele já lançou.
     *
     * Duas fontes, nesta ordem, e a ordem é economia: o D1 guarda 2.720 pools
     * (as de mais de US$ 1 milhão), custa zero ida à rede e responde na hora. A
     * lista ao vivo do DefiLlama tem 17 mil, pesa 11,7 MB, e só entra quando o
     * banco não deu conta.
     *
     * E ela PRECISA entrar: o método do curso procura TVL baixo, então a pool
     * que ele vai lançar tem boa chance de estar abaixo do corte do banco. Um
     * radar que só acha pool grande seria um radar contra o próprio método.
     *
     * POST pelo mesmo motivo de /api/precos: a lista de ids é a composição da
     * carteira dele, e URL vira log. */
    if (url.pathname === "/api/piscinas" && pedido.method === "POST") {
      let corpo = null;
      try { corpo = await pedido.json(); } catch { corpo = null; }
      const busca = String(corpo?.busca || "").trim().slice(0, 120);
      const ids = (Array.isArray(corpo?.ids) ? corpo.ids : []).map(String).slice(0, 30);
      if (!busca && !ids.length) return Response.json({ achados: [], pools: {} });

      const doBanco = (l) => ({
        id: l.id, rede: l.rede, projeto: l.projeto, simbolo: l.simbolo, meta: l.meta,
        tvl: Number(l.tvl) || 0, apy: Number(l.apy) || 0,
        apyBase: Number(l.apy_base) || 0, apyReward: Number(l.apy_reward) || 0,
        idade: l.idade_dias, estavel: !!l.estavel, riscoIl: l.risco_il,
        exposicao: l.exposicao, volume7d: l.volume7d,
        // O D1 não guarda os endereços dos tokens; busca por endereço vai à API.
        tokens: [],
      });
      const daApi = (p) => ({
        id: p.id, rede: p.chain, projeto: p.projeto, simbolo: p.simbolo, meta: p.meta,
        tvl: p.tvlUsd, apy: p.apy, apyBase: p.apyBase, apyReward: p.apyReward,
        idade: p.idade, estavel: p.estavel, riscoIl: p.riscoIl,
        exposicao: p.exposicao, volume7d: p.volume7d, tokens: p.tokens,
      });

      const { results } = await env.BANCO.prepare(
        `SELECT * FROM piscinas WHERE dia = (SELECT MAX(dia) FROM piscinas)`,
      ).all();
      const banco = (results || []).map(doBanco);

      const porId = new Map();
      for (const id of ids) {
        const achada = banco.find((p) => p.id === id);
        if (achada) porId.set(id, achada);
      }
      let achados = busca ? procurarPiscinas(banco, busca, { limite: 12 }).achados : [];

      /* A ida à API só acontece se ainda falta alguma coisa. Endereço de token
         sempre vai, porque o banco não guarda endereço. */
      const faltamIds = ids.filter((i) => !porId.has(i));
      const buscaFraca = busca && (achados.length < 3 ||
        entenderTermo(busca).tipo === "endereco");
      if (faltamIds.length || buscaFraca) {
        try {
          const vivas = (await piscinasDeRendimento()).map(daApi);
          for (const id of faltamIds) {
            const achada = vivas.find((p) => p.id === id);
            if (achada) porId.set(id, achada);
          }
          if (busca) {
            const maisAchados = procurarPiscinas(vivas, busca, { limite: 12 }).achados;
            const vistos = new Set(achados.map((p) => p.id));
            for (const p of maisAchados) if (!vistos.has(p.id)) achados.push(p);
            achados = achados.slice(0, 12);
          }
        } catch {
          // Sem a API, o que veio do banco continua valendo. Meia resposta é
          // melhor que erro — e a tela diz quantas achou.
        }
      }

      const enfeitar = (p) => ({ ...p, rendimento: deOndeVemORendimento(p) });
      const pools = {};
      for (const [id, p] of porId) pools[id] = enfeitar(p);

      return Response.json(
        { achados: achados.map(enfeitar), pools },
        { headers: { "cache-control": "no-store" } },
      );
    }

    /* IMPORTAR A CARTEIRA: achar o que ela tem, sem varrer a rede.
     *
     * Pedido dele em 09/09/2026: "escolha quais pools deseja usar, quais
     * empréstimos deseja usar, mas não subir automaticamente — a gente teria o
     * poder de escolher quais exportar para caixinha".
     *
     * Então esta rota SÓ ACHA. Ela não escreve nada, não escolhe caixinha, não
     * mexe na carteira dele. Devolve uma lista, e quem decide é ele.
     *
     * COMO ACHA, já que varrer a rede está bloqueado: endereço de posição na
     * Solana é CALCULADO a partir de quem é o dono. Na Orca a posição é um NFT
     * que mora na carteira, e do NFT sai o endereço. Na Kamino sai do par
     * (dono, mercado). Conferido contra as duas posições reais dele.
     *
     * O QUE ESTA ROTA NÃO ACHA, e está dito na tela: nada fora da Solana, e
     * empréstimo em mercado da Kamino fora da lista curada. */
    /* SÓ OS SALDOS — a rota barata, para as linhas seguirem a carteira.
     *
     * Pedido dele em 09/09/2026: "os que eu digito você não consegue ler, e os
     * da carteira pode atualizar automático os lançamentos ou retiradas".
     *
     * Separada de /api/carteira de propósito. Aquela descobre posições da Orca,
     * empréstimos da Kamino e cota tudo — dezenas de chamadas, e é certo, porque
     * roda quando ele manda importar. Esta roda a cada abertura do app: são
     * duas chamadas, e só responde quanto de cada token existe.
     *
     * O CAMPO QUE MANDA É `completo`, e ele é a razão de esta rota existir em
     * vez de eu reaproveitar a outra:
     *
     * `getTokenAccountsByOwner` pode falhar num programa e não no outro — e
     * quando falha, a lista volta VAZIA, sem erro. Uma lista vazia é
     * indistinguível de "ele tirou tudo da carteira". Se eu tratasse as duas
     * igual, um nó fora do ar zeraria a carteira inteira dele na tela.
     *
     * Então: ausência só vale como prova quando `completo` é verdadeiro. */
    if (url.pathname === "/api/saldos" && pedido.method === "POST") {
      let corpo = null;
      try { corpo = await pedido.json(); } catch { corpo = null; }
      const carteira = String(corpo?.carteira || "").trim();
      if (!pareceEnderecoSolana(carteira)) {
        return Response.json({ erro: "isso não parece um endereço da Solana" }, { status: 400 });
      }

      const nos = env.SOLANA_RPC ? [env.SOLANA_RPC, ...NOS] : NOS;
      try {
        const lidas = await tokensDaCarteira(carteira, nos);
        const saldos = {};
        for (const t of lidas.tokens) {
          if (!t || !t.mint) continue;
          saldos[t.mint] = (saldos[t.mint] || 0) + (Number(t.quantidade) || 0);
        }
        return Response.json({
          saldos,
          completo: lidas.falhou.length === 0,
          falhou: lidas.falhou,
          quando: Math.floor(Date.now() / 1000),
        }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        /* Falhar aqui devolve `completo: false` e nenhum saldo. O painel não
           mexe em nada — que é o comportamento certo quando eu não sei. */
        return Response.json({
          saldos: {}, completo: false, falhou: ["tudo"],
          erro: String(e?.message || e).slice(0, 120),
        }, { headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/api/carteira" && pedido.method === "POST") {
      let corpo = null;
      try { corpo = await pedido.json(); } catch { corpo = null; }
      const carteira = String(corpo?.carteira || "").trim();
      if (!pareceEnderecoSolana(carteira)) {
        return Response.json({ erro: "isso não parece um endereço da Solana" }, { status: 400 });
      }

      const achado = { posicoes: [], emprestimos: [], tokens: [], avisos: [] };
      /* Se ele puser uma chave de nó próprio no Cloudflare, ela entra na frente
         da lista e a descoberta de posição da Orca passa a funcionar. Sem ela,
         o resto (empréstimo e token) funciona igual. */
      const nos = env.SOLANA_RPC ? [env.SOLANA_RPC, ...NOS] : NOS;
      try {
        const lidas = await tokensDaCarteira(carteira, nos);
        const daCarteira = lidas.tokens;
        if (lidas.falhou.includes("Token-2022")) {
          achado.avisos.push("Não consegui perguntar pelas posições de pool: nenhum nó público de graça responde essa consulta. Empréstimo e token vieram normalmente — e pool você pode ligar colando o endereço da posição.");
        }

        /* ---- 1. POSIÇÕES DA ORCA -------------------------------------- */
        // Uma posição concentrada é um NFT: uma unidade, sem casa decimal.
        const nfts = daCarteira.filter((t) => t.casas === 0 && t.quantidade === 1);
        const candidatos = [];
        for (const n of nfts) {
          const mint = deBase58(n.mint);
          if (!mint) continue;
          const c = await enderecoDerivado(
            [new TextEncoder().encode("position"), mint], PROGRAMA_ORCA);
          if (c) candidatos.push({ endereco: c.endereco, mint: n.mint });
        }

        /* ---- 2. EMPRÉSTIMOS DA KAMINO --------------------------------- */
        const dono = deBase58(carteira);
        const zero = new Uint8Array(32);
        const candidatosK = [];
        for (const m of MERCADOS) {
          const mercado = deBase58(m.id);
          if (!mercado || !dono) continue;
          const c = await enderecoDerivado(
            [new Uint8Array([0]), new Uint8Array([0]), dono, mercado, zero, zero],
            PROGRAMA_KAMINO);
          if (c) candidatosK.push({ endereco: c.endereco, mercado: m });
        }

        // Uma ida só pros dois: são endereços, o programa dono é quem separa.
        const todos = [...candidatos, ...candidatosK];
        const contas = await contasEmLote(todos.map((c) => c.endereco), nos);

        const posicoesOrca = [], obrigacoes = [];
        for (const c of todos) {
          const conta = contas.get(c.endereco);
          if (!conta) continue;
          if (conta.dono === PROGRAMA_ORCA && conta.bytes.length === 216) {
            const lida = lerPosicaoDaPool(conta.bytes);
            if (!lida.erro) posicoesOrca.push({ endereco: c.endereco, p: lida });
          } else if (conta.dono === PROGRAMA_KAMINO && conta.bytes.length === TAMANHO_OBRIGACAO) {
            const lida = lerObrigacao(conta.bytes, paraBase58);
            if (!lida.erro && lida.dono === carteira && lida.depositos.length) {
              obrigacoes.push({ endereco: c.endereco, mercado: c.mercado, o: lida });
            }
          }
        }

        /* ---- 3. as contas de apoio: pools da Orca e reservas da Kamino - */
        const apoio = await contasEmLote([
          ...posicoesOrca.map((x) => x.p.pool),
          ...obrigacoes.flatMap((x) => x.o.depositos.map((d) => d.reserva)),
        ], nos);

        const pools = new Map();
        for (const x of posicoesOrca) {
          const c = apoio.get(x.p.pool);
          if (c) { const w = lerPoolDaOrca(c.bytes); if (!w.erro) pools.set(x.endereco, w); }
        }
        const reservas = new Map();
        for (const x of obrigacoes) {
          for (const d of x.o.depositos) {
            const c = apoio.get(d.reserva);
            if (!c || reservas.has(d.reserva)) continue;
            const r = lerReserva(c.bytes, paraBase58);
            if (!r.erro) reservas.set(d.reserva, r);
          }
        }

        const casas = await casasDosTokens([...pools.values()].flatMap((w) => [w.mintA, w.mintB]), nos);
        /* Os mesmos preços por endereço da leitura principal — ver o comentário
           longo lá. Esta rota fazia a conta antiga em paralelo, e duas cópias de
           uma conta divergem no primeiro conserto feito num lugar só. */
        const cotacoesOrca = await cotarMints(
          [...pools.values()].flatMap((w) => [w.mintA, w.mintB]),
        ).catch(() => ({}));

        for (const x of posicoesOrca) {
          const w = pools.get(x.endereco);
          if (!w) continue;
          const cA = casas.get(w.mintA), cB = casas.get(w.mintB);
          if (cA == null || cB == null) continue;
          const q = quantidadesDaPosicao(x.p, w, cA, cB);
          const fundo = precoDoTick(x.p.tickBaixo, cA, cB);
          const topo = precoDoTick(x.p.tickAlto, cA, cB);
          achado.posicoes.push({
            endereco: x.endereco, onde: "Orca",
            simboloA: simboloDoMint(w.mintA), simboloB: simboloDoMint(w.mintB),
            /* VALOR E UNIDADE ANDAM JUNTOS, aqui tambem.
               A leitura normal ja declarava a unidade; esta, a da IMPORTACAO,
               nao — e era o mesmo calculo. A tela pegava o numero, nao via
               campo de unidade nenhum, e concluia que era dolar. Numero sem
               unidade nao e meio certo: e errado com aparencia de certo. */
            valor: (function () {
              const a = cotacoesOrca[w.mintA], b = cotacoesOrca[w.mintB];
              if (a?.preco > 0 && b?.preco > 0) return q.qtdA * a.preco + q.qtdB * b.preco;
              return q.qtdA * q.preco + q.qtdB;
            })(),
            unidade: (function () {
              const a = cotacoesOrca[w.mintA], b = cotacoesOrca[w.mintB];
              return (a?.preco > 0 && b?.preco > 0) ? "USD" : (simboloDoMint(w.mintB) || "B");
            })(),
            faixa: { fundo, topo }, preco: q.preco,
            leitura: lerFaixaDaPosicao(q.preco, fundo, topo),
            fechada: x.p.liquidez === 0n,
          });
        }

        for (const x of obrigacoes) {
          for (const d of x.o.depositos) {
            const r = reservas.get(d.reserva);
            if (!r) continue;
            const v = valorDoDeposito(d.cTokens, r);
            if (!v) continue;
            achado.emprestimos.push({
              endereco: x.endereco, onde: "Kamino", mercado: x.mercado.nome,
              reserva: d.reserva, cTokens: String(d.cTokens),
              cambio: v.cambio, quantidade: v.emToken, valor: v.emDolar,
            });
          }
        }

        /* ---- 4. TOKENS PARADOS ---------------------------------------- */
        const comSaldo = daCarteira.filter((t) => t.casas > 0 && t.quantidade > 0);
        const precos = await cotarMints(comSaldo.map((t) => t.mint));
        for (const t of comSaldo) {
          const p = precos[t.mint];
          achado.tokens.push({
            mint: t.mint,
            simbolo: p?.simbolo || simboloDoMint(t.mint),
            quantidade: t.quantidade,
            preco: p?.preco ?? null,
            valor: p ? t.quantidade * p.preco : null,
          });
        }
        // Maior primeiro: numa carteira com trinta tokens, é o que ele procura.
        achado.tokens.sort((a, b) => (b.valor || 0) - (a.valor || 0));

        // O símbolo do empréstimo sai do mesmo lugar que o dos tokens.
        const precosDeReserva = await cotarMints([...reservas.values()].map((r) => r.mint));
        for (const e of achado.emprestimos) {
          const r = reservas.get(e.reserva);
          e.simbolo = (r && precosDeReserva[r.mint]?.simbolo) || "?";
        }

        if (!achado.posicoes.length && !achado.emprestimos.length) {
          achado.avisos.push("Não achei posição de pool nem empréstimo. Se você usa uma rede fora da Solana, ou um mercado da Kamino fora da lista, ela não aparece aqui — dá pra lançar à mão.");
        }
      } catch (e) {
        return Response.json(
          { ...achado, erro: "não consegui falar com a Solana agora: " + String(e?.message || e).slice(0, 90) },
          { headers: { "cache-control": "no-store" } },
        );
      }

      return Response.json(achado, { headers: { "cache-control": "no-store" } });
    }

    /* A posição de pool concentrada, lida da blockchain.
     *
     * Ele cola o Position Address que a Orca mostra e o radar chega no resto:
     * a conta da posição guarda dentro dela o endereço da pool, e a pool guarda
     * os dois tokens. De um endereço só sai faixa, valor e onde o preço está.
     *
     * Conferido contra a tela dele em 08/09/2026: faixa 120.481500–124.762300,
     * valor US$ 9,94, bordas -1,89% e +2,11%. A Orca dizia o mesmo.
     *
     * Três idas à rede no total, em lote, independente de quantas posições —
     * o Worker corta em 50 subrequisições e uma carteira com dez posições não
     * pode custar trinta chamadas.
     *
     * POST pelo mesmo motivo do resto: endereço de posição numa URL vira log. */
    if (url.pathname === "/api/posicao" && pedido.method === "POST") {
      let corpo = null;
      try { corpo = await pedido.json(); } catch { corpo = null; }
      const pedidos = (Array.isArray(corpo?.enderecos) ? corpo.enderecos : [])
        .map((e) => String(e || "").trim())
        .filter(pareceEnderecoSolana)
        .slice(0, 10);
      if (!pedidos.length) return Response.json({ posicoes: {} });

      const nos = env.SOLANA_RPC ? [env.SOLANA_RPC, ...NOS] : NOS;
      const posicoes = await lerPosicoesDaCadeia(pedidos, nos);
      const erro = posicoes.__erro;
      delete posicoes.__erro;
      return Response.json(erro ? { posicoes, erro } : { posicoes },
        { headers: { "cache-control": "no-store" } });
    }

    /* O radar inteiro numa chamada só.
     *
     * Uma chamada e não cinco porque a página precisa das quatro caixas juntas
     * pra desenhar qualquer coisa, e porque no celular cada ida à rede é uma
     * chance de a tela ficar meio pronta.
     *
     * Tudo sai do banco: a rodada da manhã já fez as contas. O painel não busca
     * nada no DefiLlama — se buscasse, abrir a página custaria 20 MB. */
    /* O CHÃO EMBAIXO DO DINHEIRO DELE: a rede e os protocolos onde ele está.
     *
     * Pedido dele em 08/09/2026, e a frase explica por que este endereço existe
     * separado de /api/radar: "hoje você só faz resumo do que está no radar, ou
     * seja, as melhores — mas de tokens específicos como os que eu coloco na
     * carteira, não faz".
     *
     * O radar manda as que se MEXERAM. A Solana, que está de lado, não aparece
     * em lugar nenhum — e é justamente onde o dinheiro dele mora. Este endereço
     * responde por nome: diga quais, e eu digo como estão.
     *
     * NADA PESSOAL PASSA POR AQUI. O que vai é "Solana" e "Orca" — nomes de
     * rede e de protocolo, iguais para qualquer pessoa. Quanto ele tem lá
     * dentro nunca sai do navegador dele.
     *
     * PROTOCOLO CASA POR PREFIXO porque ele escreve "Kamino · SOL/BTC Market" e
     * o DefiLlama chama de "Kamino Lend". Casar por prefixo devolve os dois
     * Kamino (Lend e Liquidity), e devolver os dois é o certo: eu não sei em
     * qual ele está, e escolher por ele seria adivinhar. A categoria vai junto
     * pra ele reconhecer o seu. */
    if (url.pathname === "/api/chao") {
      const limpar = (t) => String(t || "").split(",")
        .map((x) => x.trim()).filter(Boolean).slice(0, 8);
      const redes = limpar(url.searchParams.get("redes"));
      const protos = limpar(url.searchParams.get("protocolos"));
      if (!redes.length && !protos.length) {
        return Response.json({ redes: [], protocolos: [] });
      }

      const fora = { redes: [], protocolos: [] };

      if (redes.length) {
        const dia = (await env.BANCO.prepare("SELECT MAX(dia) AS d FROM fotos").first())?.d;
        if (dia) {
          const vagas = redes.map(() => "?").join(",");
          const hoje = (await env.BANCO.prepare(
            `SELECT rede, tvl, stables FROM fotos WHERE dia = ? AND rede IN (${vagas})`,
          ).bind(dia, ...redes).all()).results || [];

          const de7 = await fotoDeDiasAtras(env, dia, 7);
          const de30 = await fotoDeDiasAtras(env, dia, 30);

          const qual = new Map(((await env.BANCO.prepare(
            `SELECT * FROM qualidade WHERE dia = ? AND rede IN (${vagas})`,
          ).bind(dia, ...redes).all()).results || []).map((q) => [q.rede, q]));

          fora.dia = dia;
          fora.redes = hoje.map((f) => {
            const a7 = de7.get(f.rede), a30 = de30.get(f.rede);
            const varia = (antes) => (antes?.tvl > 0 ? ((f.tvl / antes.tvl) - 1) * 100 : null);
            const variaS = (antes) => (antes?.stables > 0 ? ((f.stables / antes.stables) - 1) * 100 : null);
            const q = qual.get(f.rede) || null;
            return {
              rede: f.rede, tvl: f.tvl, stables: f.stables,
              var7d: varia(a7), var30d: varia(a30),
              varStables7d: variaS(a7), varStables30d: variaS(a30),
              qualidade: q ? {
                alugado: q.alugado, piscinas: q.piscinas,
                taxaPorMilhao: q.taxa_por_milhao,
                concentracao: q.concentracao, maiorProtocolo: q.maior_protocolo,
              } : null,
            };
          });
        }
      }

      if (protos.length) {
        const dia = (await env.BANCO.prepare("SELECT MAX(dia) AS d FROM fotos_protocolo").first())?.d;
        if (dia) {
          /* LIKE com prefixo, um por nome. Sem curinga no meio: "Kamino%" acha
             Kamino Lend e Kamino Liquidity, e não acha "Solana Kamino Fork". */
          const onde = protos.map(() => "protocolo LIKE ?").join(" OR ");
          const r = (await env.BANCO.prepare(
            `SELECT protocolo, rede, categoria, tvl, tvl_1d, tvl_7d, tvl_30d
             FROM fotos_protocolo WHERE dia = ? AND (${onde}) ORDER BY tvl DESC LIMIT 12`,
          ).bind(dia, ...protos.map((x) => x + "%")).all()).results || [];
          fora.diaDosProtocolos = dia;
          fora.protocolos = r;
        }
      }

      return Response.json(fora, { headers: { "cache-control": "public, max-age=600" } });
    }

    /* O PRECO POR HORA, pro grafico de hoje e o da semana.
     *
     * GUARDADO POR 5 MINUTOS na borda. O preco de AGORA nao vem daqui — vem de
     * /api/precos, que a tela ja chama a cada minuto. O que vem daqui e a
     * FORMA das ultimas horas, e forma de 24 horas nao muda em 5 minutos.
     *
     * Sem esse cache, cada F5 do celular dele viraria uma chamada ao
     * DefiLlama pra receber a mesma curva — o mesmo desperdicio que o radar
     * inteiro evita guardando a leitura do dia.
     *
     * Nada aqui e dele: preco de Bitcoin e dado publico de mercado. */
    /* AS SERIES DO CICLO, SEM DEPENDER DA RODADA.
     *
     * Isto existe por causa de uma frustracao legitima dele. As medias, a faixa
     * de bull market e a cruz foram escritas, testadas e publicadas — e ele nao
     * conseguia ver NENHUMA delas, porque a tela lia a leitura guardada e a
     * rodada seguinte so viria horas depois. Eu respondi duas vezes "espera a
     * rodada". Isso nao e resposta: e transferir pra ele o custo de uma escolha
     * minha de arquitetura.
     *
     * A escolha errada foi acoplar DADO DE MERCADO ao relogio. Guardar a
     * leitura do dia faz todo sentido pro que e caro (16 MB de pools) ou pro
     * que tem cota (os indicadores on-chain, 10 chamadas por hora). O preco do
     * Bitcoin nao e nenhum dos dois: sao 400 pontos, um pedido, e a borda
     * guarda pra todo mundo.
     *
     * MEIA HORA DE CACHE na borda: as medias andam um dia por dia, entao meia
     * hora e conservador. Uma pessoa abrindo o painel cem vezes gasta uma
     * chamada; cem pessoas abrindo uma vez tambem.
     *
     * A rodada CONTINUA guardando tudo isso — o Telegram e o /saude leem de la,
     * e a leitura guardada e a que tem data. Esta rota nao substitui aquela:
     * ela tira a TELA da fila de espera. */
    /* O MACRO: inflacao, juros, a regra de Taylor, M2 e o balanco do FED.
     *
     * SEIS HORAS DE CACHE, e o numero nao e chute: o CPI e o PCE saem UMA VEZ
     * POR MES, o M2 idem, o balanco do FED e semanal. So o juro diario muda
     * mais rapido, e ele anda de 0,25 em 0,25 algumas vezes por ano. Guardar
     * menos que isso seria pagar rede pra receber o mesmo numero.
     *
     * Oito series do FRED, ~30 KB no total, sem chave nenhuma. */
    /* SONDA: quem responde de DENTRO da nuvem?
     *
     * O fredgraph.csv responde 200 do computador dele e 520 do Worker. 520 e
     * o codigo de "a origem devolveu coisa que eu nao entendo" — na pratica,
     * bloqueio pelo endereco de saida. Mesma familia do bitcoin-data.com.
     *
     * Esta rota nao adivinha: ela PERGUNTA a cada host e diz o que voltou.
     * Sem isso eu ficaria trocando cabecalho no escuro. */
    if (url.pathname === "/saude/macro") {
      const alvos = {
        blsCpi: ["https://api.bls.gov/publicAPI/v1/timeseries/data/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seriesid: ["CUUR0000SA0"], startyear: "2026", endyear: "2026" }),
        }],
        blsDesemprego: ["https://api.bls.gov/publicAPI/v1/timeseries/data/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seriesid: ["LNS14000000"], startyear: "2026", endyear: "2026" }),
        }],
        nyFedJuros: ["https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json", {}],
        fredCsv: ["https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL&cosd=2026-06-01", {}],
        dbnomics: ["https://api.db.nomics.world/v22/series/FRED/M2SL/M2SL?observations=true", {}],
      };
      const fora = {};
      for (const [nome, alvo] of Object.entries(alvos)) {
        try {
          const r = await fetch(alvo[0], alvo[1]);
          const t = (await r.text()).slice(0, 110);
          fora[nome] = { status: r.status, comeco: t.replace(/\s+/g, " ") };
        } catch (e) {
          fora[nome] = { erro: String(e?.message || e).slice(0, 90) };
        }
      }
      return Response.json(fora, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/macro") {
      try {
        const m = await olharMacro(null, env.FRED_API_KEY || null);
        return Response.json(m, { headers: { "cache-control": "public, max-age=21600" } });
      } catch (e) {
        return Response.json({ erro: String(e?.message || e).slice(0, 140), falhas: [] },
                             { headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/api/btc-ciclo") {
      try {
        const precos = await precoDoBitcoin();
        const g = seriesDoGrafico(precos, 100);
        const inteiros = (a) => a.map((v) => (v == null ? null : Math.round(v)));
        return Response.json({
          grafico: g && {
            dias: g.dias, atrasDe: g.atrasDe,
            preco: inteiros(g.preco), media50: inteiros(g.media50),
            media200: inteiros(g.media200),
            faixaBaixa: inteiros(g.faixaBaixa), faixaAlta: inteiros(g.faixaAlta),
          },
          faixaDeBull: lerFaixaDeBull(precos),
          cruzamento: lerCruzamento(precos),
          media50: lerMedia50(precos),
          /* A REGUA DO CURSO VEM JUNTO, pela fonte reserva.
           *
           * Isto e a mesma licao de meia hora atras, aplicada de novo: os
           * quatro indicadores on-chain so entravam na tela na rodada da
           * manha, e a rodada da manha de hoje falhou nos quatro. Mandar ele
           * esperar ate amanha nao e resposta.
           *
           * A reserva nao tem cota apertada, entao da pra pedir aqui — e a
           * rota inteira fica guardada meia hora na borda, o que limita isto a
           * no maximo 48 idas por dia, dividido por todo mundo que abrir.
           *
           * A LEITURA GUARDADA CONTINUA GANHANDO na tela, e a ordem esta la:
           * a referencia e melhor que o substituto. Isto aqui e o chao, nao o
           * teto. */
          ...(await (async () => {
            try {
              const r = await completarIndicadores(["mvrv", "zscore", "puell"], null);
              const v = r.valores;
              const lidos = [
                lerMvrv(v.mvrv?.valor), lerZscore(v.zscore?.valor),
                lerPuell(v.puell?.valor), null,
              ];
              return { indicadores: v, curso: vereditoDoCurso(lidos), semSubstituto: r.falhas };
            } catch { return {}; }
          })()),
        }, { headers: { "cache-control": "public, max-age=1800" } });
      } catch (e) {
        return Response.json({ erro: String(e?.message || e).slice(0, 120) },
                             { headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/api/btc-horas") {
      const horas = Math.min(336, Math.max(6, Number(url.searchParams.get("horas")) || 24));
      try {
        const pontos = await precoPorHora(horas);
        return Response.json({ horas, pontos }, {
          headers: { "cache-control": "public, max-age=300" },
        });
      } catch (e) {
        return Response.json({ erro: String(e?.message || e).slice(0, 120), pontos: [] },
                             { headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/api/radar") {
      return Response.json(await montarRadar(env), {
        headers: { "cache-control": "public, max-age=300" },
      });
    }

    /* Que versão está no ar. É o que a barrinha de abertura pergunta.
     *
     * Sem cache de propósito: uma resposta guardada diria que a versão velha é
     * a atual, que é exatamente o engano que este endereço existe pra desfazer. */
    if (url.pathname === "/versao") {
      return Response.json(
        { versao: VERSAO, numero: NUMERO_DA_VERSAO },
        { headers: { "cache-control": "no-store" } },
      );
    }

    /* O vigia está de pé?
     *
     * Só sim ou não, nunca números: esta rota é pública, e quantas posições
     * alguém tem já diz coisa demais. O que importa aqui é saber se as três
     * peças estão ligadas — a chave, o banco e a blockchain. */
    /* A cópia de segurança está de pé? Conta e mede, sem mandar nada.
     *
     * Rota pública, então nada do que ele tem sai daqui: só quantos, quantos
     * bytes, e se o conteúdo mudou desde a última cópia. Conferir não pode
     * consumir nem vazar. */
    if (url.pathname === "/saude/copia") {
      const resposta = { chaveDoBanco: temChaveDeServico(env) };
      if (!resposta.chaveDoBanco) {
        resposta.motivo = "falta o segredo SUPABASE_SERVICE_KEY";
        return Response.json(resposta, { headers: { "cache-control": "no-store" } });
      }
      try {
        resposta.chat = !!(await chatDoAviso(env));
        const linhas = await donosComCarteira(env);
        const donos = [...new Set((linhas || []).map((l) => l.user_id).filter(Boolean))];
        resposta.carteiras = donos.length;
        const jaForam = new Map(
          ((await copiasEnviadas(env, "telegram")) || []).map((c) => [c.user_id, c]),
        );
        resposta.copias = [];
        for (const dono of donos) {
          const retrato = await retratoDaCarteira(env, dono);
          const texto = JSON.stringify(retrato, null, 2);
          const semData = JSON.stringify({ ...retrato, radar_defi_backup: undefined });
          const digital = await digitalDe(semData);
          const antes = jaForam.get(dono);
          resposta.copias.push({
            linhas: retrato?.conferencia?.linhas ?? 0,
            lancamentos: retrato?.conferencia?.lancamentos ?? 0,
            bytes: texto.length,
            mudou: antes ? antes.digital !== digital : true,
            ultimaEnviada: antes ? antes.quando : null,
          });
        }
      } catch (e) {
        resposta.erro = String(e?.message || e).slice(0, 200);
      }
      return Response.json(resposta, { headers: { "cache-control": "no-store" } });
    }

    /* A RÉGUA DE PREÇO ESTÁ DE PÉ? Mede agora, e NÃO GRAVA.
     *
     * Esta rota nasceu da receita 6.6 deste projeto: código que só roda dentro
     * do cron precisa de uma porta que o exercite de fora. A faixa de bull
     * market e o cruzamento das médias só rodavam às 8h, 12h e 18h — e um erro
     * neles ficaria escondido até a próxima rodada, que é o pior lugar pra um
     * erro ficar.
     *
     * DUAS COISAS ELA NÃO FAZ, e as duas por escolha:
     *
     * 1. NÃO GRAVA. Se gravasse, a leitura da tela passaria a depender de quem
     *    abre uma URL, e não do relógio. A tela continua mostrando a medida da
     *    rodada, com a data dela — que é o combinado.
     *
     * 2. NÃO TOCA A FONTE DOS INDICADORES. bitcoin-data.com dá 10 chamadas por
     *    hora POR IP, e todas as rodadas saem do mesmo IP da Cloudflare. Uma
     *    rota pública que gastasse desse balde derrubaria a régua do curso na
     *    rodada seguinte — a conferência quebrando justamente o que ela
     *    confere. Aqui só entra o preço do Bitcoin, que é um pedido barato e
     *    sem cota.
     *
     * Nada aqui é dele: preço de Bitcoin é dado público de mercado. */
    /* A FONTE RESERVA ESTA DE PE? Olha de verdade e NAO GRAVA.
     *
     * Receita 6.6: codigo que so roda dentro do cron precisa de uma porta que
     * o exercite de fora. Sem ela, um erro na reserva so apareceria na proxima
     * vez que a fonte principal falhasse — ou seja, no pior momento possivel.
     *
     * ELA NAO TOCA A FONTE PRINCIPAL, de proposito. Aquela tem cota de 10
     * chamadas por hora e o balde ja vive vazio; uma rota publica gastando
     * dele derrubaria a rodada de verdade. A CoinMetrics nao tem cota apertada,
     * entao e ela que esta rota exercita.
     *
     * Mostra tambem o que esta guardado, com a fonte de cada valor — que e a
     * pergunta que se faz quando um numero na tela parece estranho.
     *
     * Publica, e nada dela e dele: indicador de ciclo do Bitcoin e dado de
     * mercado, igual pra todo mundo. */
    if (url.pathname === "/saude/indicadores") {
      const fora = {};
      try {
        fora.guardados = JSON.parse((await lerAjuste(env, "indicadores_bons")) || "null");
        const somas = JSON.parse((await lerAjuste(env, "mercado_somas")) || "null");
        fora.somasDoMercado = somas
          ? { dias: somas.n, ate: somas.ate }
          : "ainda nao guardadas — a semente do codigo vale";
        const r = await completarIndicadores(["mvrv", "zscore", "puell", "vdd"], somas);
        fora.reserva = {};
        for (const [k, v] of Object.entries(r.valores)) {
          fora.reserva[k] = { valor: Number(v.valor.toFixed(4)), dia: v.dia };
        }
        fora.semSubstituto = r.falhas;
        if (r.somas) fora.desvioSobre = r.somas.n + " dias, ate " + r.somas.ate;
      } catch (e) {
        fora.erro = String(e?.message || e).slice(0, 160);
      }
      fora.aviso = "esta rota OLHA e NAO GRAVA, e nao toca a fonte principal (cota de 10/hora)";
      return Response.json(fora, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/saude/ciclo") {
      try {
        const precos = await precoDoBitcoin();
        const faixa = lerFaixaDeBull(precos);
        const cruz = lerCruzamento(precos);
        const m50 = lerMedia50(precos);
        return Response.json({
          pontos: precos.length,
          semanas: Math.floor(precos.length / 7),
          faixaDeBull: faixa && {
            sma20semanas: Math.round(faixa.sma),
            ema21semanas: Math.round(faixa.ema),
            piso: Math.round(faixa.fundo),
            teto: Math.round(faixa.topo),
            bitcoin: Math.round(faixa.hoje),
            lado: faixa.lado,
            texto: faixa.texto,
          },
          cruzamento: cruz && {
            tipo: cruz.tipo,
            media50: Math.round(cruz.rapida),
            media200: Math.round(cruz.lenta),
            virouHaDias: cruz.quandoDias,
            diasVisiveis: cruz.diasVisiveis,
            texto: cruz.texto,
          },
          media50: m50 && { valor: Math.round(m50.valor), lado: m50.lado, texto: m50.texto },
          aviso: "esta rota MEDE e NÃO GRAVA — a tela mostra a medida da rodada, com a data dela",
        }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        return Response.json({ erro: String(e?.message || e).slice(0, 200) },
                             { headers: { "cache-control": "no-store" } });
      }
    }

    /* OS ALVOS DE PREÇO ESTÃO DE PÉ? Olha de verdade e NÃO AVISA.
     *
     * Receita 6.6 deste projeto, e desta vez ela tem nome e sobrenome: os
     * alertas ficaram quebrados desde 28/08/2026 justamente porque não havia
     * porta nenhuma que os exercitasse. Ninguém tinha como perguntar "isso
     * funciona?" e receber uma resposta.
     *
     * `seco: true` é o que faz esta rota ser segura: ela conta quantos alvos
     * bateriam agora e PARA. Se ela mandasse o aviso, conferir consumiria o
     * alerta — e a rodada de verdade, minutos depois, não teria mais nada pra
     * mandar. A conferência não pode gastar o que confere.
     *
     * Rota pública, então nada dele sai daqui: quantos alvos existem e quantos
     * bateriam, sem os valores. Quanto alguém marcou em quanto já diz demais. */
    if (url.pathname === "/saude/alertas") {
      const preco = await btcAgora(env);
      const r = await vigiarAlertas(env, preco, { seco: true });
      return Response.json({
        ...r,
        aviso: "esta rota OLHA e NÃO AVISA — quem avisa é a rodada, três vezes por dia",
      }, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/saude/vigia") {
      /* Olha de verdade — lê as posições na cadeia e calcula os avisos — mas
         SEM GRAVAR e SEM FALAR. Conferir não pode consumir o aviso: se esta
         rota gravasse o estado, a rodada seguinte não veria mudança nenhuma.

         `tentouAnotar` diz quantas linhas a rodada de verdade gravaria agora.

         Sem texto de aviso e sem endereço: esta rota é pública, e o que ele
         tem não é assunto de quem passa por aqui. Só números e sim/não. */
      const resposta = { chaveDoBanco: temChaveDeServico(env) };
      if (!resposta.chaveDoBanco) {
        resposta.motivo = "falta o segredo SUPABASE_SERVICE_KEY";
        return Response.json(resposta, { headers: { "cache-control": "no-store" } });
      }
      try {
        const v = await vigiarPosicoes(env, { seco: true });
        resposta.seco = true;
        /* O vigia dos tokens conta junto — contagens e tipos, nunca símbolo
           nem valor: esta rota é pública e o que ele tem não é assunto de
           quem passa por aqui. */
        try {
          const t = await vigiarTokens(env, { seco: true });
          resposta.tokens = {
            linhas: t.olhou ?? 0,
            avisos: (t.avisos || []).length,
            tipos: (t.avisos || []).map((a) => a.tipo),
          };
          if (t.erroAoAnotar) resposta.tokens.erro = t.erroAoAnotar;
          if (t.pulou) resposta.tokens.motivo = t.pulou;
        } catch (e) {
          resposta.tokens = { erro: String(e?.message || e).slice(0, 140) };
        }
        resposta.olhou = v.olhou ?? 0;
        resposta.anotou = v.anotou ?? 0;
        resposta.tentouAnotar = v.tentouAnotar ?? 0;
        resposta.avisos = (v.avisos || []).length;
        resposta.tipos = (v.avisos || []).map((a) => a.tipo);
        if (v.erroAoAnotar) resposta.erroAoAnotar = v.erroAoAnotar;
        if (v.pulou) resposta.motivo = v.pulou;
      } catch (e) {
        resposta.erro = String(e?.message || e).slice(0, 200);
      }
      return Response.json(resposta, { headers: { "cache-control": "no-store" } });
    }

    // Um cartão de saúde, pra saber se o banco tem memória suficiente.
    if (url.pathname === "/saude") {
      const dias = await env.BANCO
        .prepare("SELECT COUNT(DISTINCT dia) AS dias, MIN(dia) AS primeiro, MAX(dia) AS ultimo FROM fotos")
        .first();
      const redes = await env.BANCO
        .prepare("SELECT COUNT(*) AS n FROM fotos WHERE dia = ?").bind(dias?.ultimo || "").first();
      const hp = await env.BANCO.prepare(
        `SELECT COUNT(DISTINCT id) AS pools, COUNT(DISTINCT dia) AS dias,
                MIN(dia) AS primeiro, MAX(dia) AS ultimo
         FROM historico_piscina`,
      ).first();
      const mp = await env.BANCO.prepare(
        `SELECT COUNT(*) AS n, MAX(dia) AS dia,
                SUM(CASE WHEN classe='firme' THEN 1 ELSE 0 END) AS firmes,
                SUM(CASE WHEN classe='loteria' THEN 1 ELSE 0 END) AS loterias,
                SUM(CASE WHEN classe='nova' THEN 1 ELSE 0 END) AS novas
         FROM medida_piscina WHERE dia = (SELECT MAX(dia) FROM medida_piscina)`,
      ).first();

      // Duas metades independentes: as redes podem estar prontas e as pools
      // não. Um "pronto: sim" único esconderia isso, e o sintoma seria a aba de
      // pools vazia sem explicação.
      return Response.json({
        redes: {
          diasDeHistorico: dias?.dias ?? 0,
          primeiroDia: dias?.primeiro ?? null,
          ultimoDia: dias?.ultimo ?? null,
          naUltimaFoto: redes?.n ?? 0,
          pronto: (dias?.dias ?? 0) >= 8
            ? "sim"
            : "não — faltam fotos pra comparar 7 dias; rode `node semear.js`",
        },
        pools: {
          comHistorico: hp?.pools ?? 0,
          diasDeHistorico: hp?.dias ?? 0,
          de: hp?.primeiro ?? null,
          ate: hp?.ultimo ?? null,
          medidasNoUltimoDia: mp?.n ?? 0,
          diaDaMedida: mp?.dia ?? null,
          firmes: mp?.firmes ?? 0,
          loterias: mp?.loterias ?? 0,
          novas: mp?.novas ?? 0,
          pronto: (hp?.dias ?? 0) >= 20 && (mp?.n ?? 0) > 0
            ? "sim"
            : (hp?.pools ?? 0) === 0
              ? "não — rode `node semear-pools.js` pra semear o histórico"
              : "quase — histórico existe, falta a medição; abra /rodar/<GATILHO>?seco&medir",
        },
      });
    }

    return new Response("radar-defi", { status: 404 });
  },
};
