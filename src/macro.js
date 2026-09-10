/* O PORTAL MACRO — inflação, juros, liquidez, e o que o curso lê neles.
 *
 * ------------------------------------------------------------------------
 * DE ONDE ISTO VEIO
 *
 * Do Portal Macro do Defiverso, de Victor Alfa (Economia/UFF, pós em Finanças
 * pela FGV, Head de Conteúdo do DeFiverso). São cinco módulos, e o Rayakuza
 * apontou pra eles: "o portal macro lá mostra tudo sobre economia macro que
 * usamos para conseguir dados para tomar decisões e se localizar no ciclo".
 *
 * E o canal confirma o peso: contei os conceitos em 84 vídeos do Investidor
 * 4.20. "inflação / CPI / PCE" aparece 240 vezes em 42 vídeos; "juros / FED",
 * 168 em 31. São o segundo e o quarto assunto mais falados — e o radar não
 * media nenhum dos dois.
 *
 * ------------------------------------------------------------------------
 * OS CORTES SÃO DO CURSO, E ESTÃO CITADOS
 *
 * Cada número aqui tem dono. Onde o corte é meu, está dito que é meu — a mesma
 * regra do indicadores.js, e pelo mesmo motivo: pra ninguém mexer num número
 * do curso achando que está ajustando um chute meu.
 *
 * ------------------------------------------------------------------------
 * A FONTE
 *
 * FRED, do Federal Reserve de St. Louis, pelo endereco fredgraph.csv — sem
 * chave nenhuma.
 *
 * E ELE QUASE VIROU OUTRA FONTE, POR CAUSA DE UM CABECALHO. As nove series
 * voltavam 520 de dentro do Worker e 200 do computador dele. Eu concluí que a
 * Cloudflare estava bloqueada, fui atras de BLS, NY Fed, DBnomics. Depois
 * concluí que era pedido demais ao mesmo tempo, e enfileirei com pausa.
 * Continuou 520.
 *
 * O que resolveu foi comparar a SONDA (que funcionava) com a chamada de
 * verdade (que nao), linha por linha: a sonda nao mandava cabecalho nenhum e a
 * chamada mandava `accept: text/csv`. Tirado o cabecalho, 200 nas nove.
 *
 * A LICAO: quando a mesma coisa funciona num lugar e falha noutro, a resposta
 * esta na DIFERENCA entre os dois — nao na primeira teoria que explica a
 * falha. Eu tinha duas teorias plausiveis em sequencia, e as duas me levavam a
 * trocar de fonte por causa de uma linha.
 *
 * A porta com chave (api.stlouisfed.org) fica como alternativa: se um dia o
 * CSV parar, `FRED_API_KEY` no Cloudflare liga a oficial sem mexer em mais
 * nada. Nao e preciso hoje.
 *
 * Cada série vira menos de 1 KB com a data de corte, fora o WALCL (3,7 KB,
 * semanal) e o DFF (21 KB, diário). As oito juntas dão ~30 KB.
 */

const FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const API = "https://api.stlouisfed.org/fred/series/observations";

/* AS SÉRIES, com o que cada uma é e por que ela está aqui. */
export const SERIES = {
  cpi:      { id: "CPIAUCSL", nome: "CPI",        mensal: true },
  pce:      { id: "PCEPI",    nome: "PCE",        mensal: true },
  cpiNucleo:{ id: "CPILFESL", nome: "CPI núcleo", mensal: true },
  pceNucleo:{ id: "PCEPILFE", nome: "PCE núcleo", mensal: true },
  m2:       { id: "M2SL",     nome: "M2",         mensal: true },
  balanco:  { id: "WALCL",    nome: "balanço do FED" },
  juros:    { id: "DFF",      nome: "juros do FED" },
  desemprego:{ id: "UNRATE",  nome: "desemprego",  mensal: true },
  natural:  { id: "NROU",     nome: "desemprego natural (NAIRU)" },
};

export const CORTES_MACRO = {
  /* "A meta de inflação do FED é de 2%" — Módulo 1, e repetido nos módulos 3
   * e 4 ao falar do duplo mandato: "pleno emprego e garantir a estabilidade de
   * preços (inflação próxima de 2% ao ano)". */
  metaDeInflacao: 2.0,

  /* A REGRA DE TAYLOR, com a fórmula do Módulo 4:
   *
   *     i = r* + π + 0,5·(π − π*) + 0,5·(hiato do produto)
   *
   * e o exemplo numérico dele, que serve de teste:
   *
   *     i = 2% + 3% + 0,5·(3% − 2%) + 0,5·(1%) = 6%
   *
   * `r*` é "a taxa de juros real neutra para a economia (aproximadamente 2%)",
   * palavras do módulo. */
  taylor: { neutra: 2.0, pesoDaInflacao: 0.5, pesoDoHiato: 0.5 },

  /* O COEFICIENTE DE OKUN É MEU, e está aqui separado por isso.
   *
   * O módulo usa "hiato do produto" e não diz como obtê-lo. O hiato do PIB
   * sai trimestral e com atraso; o desemprego sai mensal. A lei de Okun liga
   * os dois — cada ponto de desemprego acima do natural corresponde a cerca de
   * dois pontos de produto abaixo do potencial.
   *
   * Dois é a faixa usual (a literatura fala entre 1,8 e 3). É aproximação, e
   * a tela DIZ que é: chamar de "hiato do produto" um número que saiu do
   * desemprego seria vender uma medida por outra. */
  okunMeu: 2.0,

  /* Marcos do balanço do FED, do Módulo 2 — servem de régua pra dizer onde o
   * número de hoje cai entre o pico do aperto e o fundo:
   *   "max US$ 8,97T Abr.2022 (+138,35%)" · "min US$ 6,59T Out.2025 (-26,53%)" */
  balanco: { pico: 8.97e12, fundo: 6.59e12 },
};

/* ------------------------------------------------------------------------ */

/* Uma série do FRED. Devolve [{ dia, valor }] em ordem, sem os buracos.
 *
 * O FRED marca dado ausente com um PONTO, não com vazio — e "." vira NaN em
 * silêncio se ninguém olhar. Feriado em série diária é exatamente isso, e um
 * NaN no meio contamina qualquer média que passe por ele. */
export async function serieDoFred(id, desde, chave = null) {
  if (chave) return await pelaApiOficial(id, desde, chave);
  return await peloCsv(id, desde);
}

/* A porta oficial. Devolve JSON, e marca ausente com ".". */
async function pelaApiOficial(id, desde, chave) {
  const u = API + "?series_id=" + encodeURIComponent(id) +
    "&file_type=json&api_key=" + encodeURIComponent(chave) +
    (desde ? "&observation_start=" + encodeURIComponent(desde) : "");
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("FRED respondeu " + r.status + " para " + id);
  const d = await r.json();
  const fora = [];
  for (const o of d?.observations || []) {
    const v = Number(o?.value);
    if (!o?.date || !Number.isFinite(v)) continue;
    fora.push({ dia: String(o.date).trim(), valor: v });
  }
  return fora;
}

/* A porta sem chave. Funciona de fora da Cloudflare. */
async function peloCsv(id, desde) {
  const u = FRED + "?id=" + encodeURIComponent(id) +
    (desde ? "&cosd=" + encodeURIComponent(desde) : "");
  /* SEM CABECALHO NENHUM, e isso e o conserto.
   *
   * Com { accept: "text/csv" } o FRED devolvia 520 pra TODAS as series, de
   * dentro do Worker. Sem cabecalho nenhum, 200. Descobri comparando a sonda
   * (que nao mandava headers) com a chamada de verdade (que mandava): mesmo
   * endereco, mesma hora, resultado oposto.
   *
   * Antes disso eu tinha certeza de duas coisas erradas em sequencia — que o
   * FRED bloqueava o IP da Cloudflare, e depois que era pedido demais ao mesmo
   * tempo. As duas explicacoes eram plausiveis, e as duas me levariam a trocar
   * de fonte por um problema de UMA LINHA.
   *
   * A licao: quando algo funciona num lugar e falha noutro, a resposta esta na
   * DIFERENCA entre os dois, e nao na primeira teoria que explica a falha. */
  const r = await fetch(u);
  if (!r.ok) throw new Error("FRED respondeu " + r.status + " para " + id);
  const texto = await r.text();
  const fora = [];
  for (const l of texto.trim().split("\n").slice(1)) {
    const [dia, bruto] = l.split(",");
    const v = Number(bruto);
    if (!dia || !Number.isFinite(v)) continue;
    fora.push({ dia: dia.trim(), valor: v });
  }
  return fora;
}

const ultimo = (s) => (s && s.length ? s[s.length - 1] : null);

/* A variação em DOZE MESES, comparando com o mesmo mês do ano passado.
 *
 * Não é "o valor de 12 posições atrás": em série diária isso daria 12 dias, e
 * em série com buraco daria um mês qualquer. A comparação é pelo ANO-MÊS, que
 * é o que "ao ano" quer dizer. */
export function variacaoEmDozeMeses(serie) {
  const fim = ultimo(serie);
  if (!fim) return null;
  const ano = Number(fim.dia.slice(0, 4)) - 1;
  const mes = fim.dia.slice(4, 7);
  const alvo = String(ano) + mes;
  const antes = serie.find((p) => p.dia.slice(0, 7) === alvo);
  if (!antes || !(antes.valor > 0)) return null;
  return { pct: (fim.valor / antes.valor - 1) * 100, de: antes.dia, ate: fim.dia };
}

const um = (v, casas = 2) =>
  (v == null || !Number.isFinite(v) ? "?" : Number(v).toFixed(casas).replace(".", ","));

/* A INFLAÇÃO CONTRA A META DE 2% DO FED.
 *
 * O PCE vem primeiro de propósito: "o Personal Consumption Expenditures Index
 * é o índice preferido pelo Federal Reserve (FED) para medir a inflação"
 * (Módulo 1). Quem decide juros olha o PCE — então é ele que diz se a política
 * tende a apertar ou afrouxar, e é o afrouxamento que o Módulo 5 liga ao
 * Bitcoin. O CPI vai junto porque é o que sai no noticiário. */
export function lerInflacao({ pce, cpi, pceNucleo, cpiNucleo }, meta = CORTES_MACRO.metaDeInflacao) {
  const principal = pce ?? cpi;
  if (principal == null) return null;
  const acima = principal > meta;
  const distancia = principal - meta;

  const partes = [];
  if (pce != null) partes.push("PCE " + um(pce) + "%");
  if (cpi != null) partes.push("CPI " + um(cpi) + "%");
  if (pceNucleo != null) partes.push("núcleo do PCE " + um(pceNucleo) + "%");
  if (cpiNucleo != null) partes.push("núcleo do CPI " + um(cpiNucleo) + "%");

  return {
    nome: "Inflação",
    pce, cpi, pceNucleo, cpiNucleo, meta,
    acimaDaMeta: acima,
    distancia,
    /* "topo"/"fundo" aqui NÃO são topo e fundo de ciclo de preço: são o lado
       em que a inflação cai em relação à meta. O nome é o mesmo do resto do
       radar pra a contagem funcionar igual, e este comentário existe pra
       ninguém ler "topo" como "topo do Bitcoin". */
    zona: acima ? "topo" : "fundo",
    texto: partes.join(" · ") + " ao ano — " +
      (Math.abs(distancia) < 0.15
        ? "praticamente na meta de 2% do FED"
        : acima
        ? um(distancia, 1) + " ponto(s) ACIMA da meta de 2% do FED"
        : um(-distancia, 1) + " ponto(s) ABAIXO da meta de 2% do FED"),
  };
}

/* A REGRA DE TAYLOR, com a fórmula e os pesos do Módulo 4.
 *
 * O que ela responde: dado o quanto a inflação passou da meta e o quanto a
 * economia está acima ou abaixo do potencial, em que altura a regra põe os
 * juros. Comparar com o juro de verdade diz se a política está mais frouxa ou
 * mais apertada do que a regra — e o Módulo 5 é sobre o que política frouxa
 * faz com o preço de ativos.
 *
 * NÃO É PREVISÃO E NÃO É CONSELHO. É uma conta com entradas públicas, e o
 * próprio módulo mostra que o FED se afasta dela com frequência. */
export function lerTaylor({ inflacao, desemprego, natural },
                          c = CORTES_MACRO.taylor, okun = CORTES_MACRO.okunMeu,
                          meta = CORTES_MACRO.metaDeInflacao) {
  if (!(inflacao > -50) || !Number.isFinite(inflacao)) return null;

  /* O hiato, quando dá pra estimar. Sem o desemprego natural ele fica zero e a
     leitura DIZ que ficou — meia conta anunciada como inteira é o defeito que
     este projeto mais persegue. */
  let hiato = null;
  if (Number.isFinite(desemprego) && Number.isFinite(natural)) {
    hiato = okun * (natural - desemprego);
  }

  const taxa = c.neutra + inflacao +
    c.pesoDaInflacao * (inflacao - meta) +
    c.pesoDoHiato * (hiato || 0);

  return {
    nome: "Regra de Taylor",
    taxa, hiato, temHiato: hiato != null,
    texto: "a regra de Taylor aponta " + um(taxa, 1) + "% de juros" +
      (hiato == null
        ? " (sem o hiato do produto: faltou o desemprego natural)"
        : ""),
  };
}

/* O JURO DE HOJE CONTRA A REGRA. */
export function lerPostura(jurosHoje, taylor) {
  if (!Number.isFinite(jurosHoje) || !taylor) return null;
  const folga = taylor.taxa - jurosHoje;
  /* MEIO PONTO É O MEU CORTE, e está marcado. O módulo não dá um limite pra
     "quanto de diferença já é frouxo"; meio ponto é menos que um passo de
     reunião do FED (0,25 é o passo usual, e eles costumam andar de dois em
     dois), então abaixo disso não vale chamar de folga. */
  const CORTE_MEU = 0.5;
  const frouxa = folga > CORTE_MEU;
  const apertada = folga < -CORTE_MEU;
  return {
    jurosHoje, folga, frouxa, apertada,
    zona: frouxa ? "fundo" : apertada ? "topo" : "meio",
    texto: "o FED está em " + um(jurosHoje, 2) + "% — " +
      (frouxa
        ? um(folga, 1) + " ponto(s) ABAIXO do que a regra aponta, ou seja, política mais frouxa que a regra"
        : apertada
        ? um(-folga, 1) + " ponto(s) ACIMA do que a regra aponta, ou seja, política mais apertada que a regra"
        : "praticamente onde a regra aponta"),
  };
}

/* O M2 — a oferta de moeda, que é o eixo do Módulo 5.
 *
 * "Correlação: Bitcoin x Expansão Monetária (M2)" é o título de sete slides
 * seguidos. Os números do módulo: o M2 dos EUA saiu de US$ 7,52 tri em 2008
 * pra US$ 22,2 tri em 2025, +195,24%. */
export function lerM2(nivel, variacao12m) {
  if (!Number.isFinite(nivel)) return null;
  const cresce = Number.isFinite(variacao12m) ? variacao12m : null;
  return {
    nome: "M2",
    nivel, variacao12m: cresce,
    /* Crescendo = mais dinheiro no sistema. O módulo liga isso a preço de
       ativo; o radar mede e para por aí. */
    zona: cresce == null ? "meio" : cresce > 0 ? "topo" : "fundo",
    texto: "M2 dos EUA em US$ " + um(nivel / 1e12, 2) + " tri" +
      (cresce == null ? "" :
        " — " + (cresce >= 0 ? "+" : "") + um(cresce, 1) + "% em 12 meses"),
  };
}

/* O BALANÇO DO FED, entre os marcos que o Módulo 2 cita. */
export function lerBalanco(nivel, variacao12m, marcos = CORTES_MACRO.balanco) {
  if (!Number.isFinite(nivel)) return null;
  const cresce = Number.isFinite(variacao12m) ? variacao12m : null;
  const vao = marcos.pico - marcos.fundo;
  const ondeNaFaixa = vao > 0 ? ((nivel - marcos.fundo) / vao) * 100 : null;
  return {
    nome: "Balanço do FED",
    nivel, variacao12m: cresce, ondeNaFaixa,
    zona: cresce == null ? "meio" : cresce > 0 ? "topo" : "fundo",
    texto: "balanço do FED em US$ " + um(nivel / 1e12, 2) + " tri" +
      (cresce == null ? "" : " (" + (cresce >= 0 ? "+" : "") + um(cresce, 1) + "% em 12 meses)") +
      (ondeNaFaixa == null ? "" :
        " — entre o pico de US$ 8,97 tri (abr/2022) e o fundo de US$ 6,59 tri (out/2025), " +
        "está em " + um(ondeNaFaixa, 0) + "% do caminho"),
  };
}

/* ------------------------------------------------------------------------ */

/* Busca o que precisa e monta as leituras. Oito chamadas ao FRED, ~30 KB.
 *
 * `desde` é o corte: dois anos bastam pra a variação de doze meses e sobra
 * folga. Pedir a série inteira traria 26 mil linhas de DFF (desde 1954) pra
 * usar duas. */
export async function olharMacro(desde = null, chaveDoFred = null) {
  const corte = desde || new Date(Date.now() - 800 * 86400000).toISOString().slice(0, 10);
  const fora = { falhas: [], comChave: !!chaveDoFred };

  /* `qual` e o nome da serie aqui dentro; `chaveDoFred` e a credencial. Dois
     "chave" diferentes na mesma funcao foi como eu escrevi da primeira vez, e
     e o tipo de colisao que passa no teste e confunde na leitura. */
  const pegar = async (qual) => {
    try { return await serieDoFred(SERIES[qual].id, corte, chaveDoFred); }
    catch (e) { fora.falhas.push(SERIES[qual].nome + ": " + String(e?.message || e).slice(0, 50)); return null; }
  };

  /* UMA DE CADA VEZ, COM PAUSA — e isto foi um erro meu que quase virou
   * "trocar de fonte".
   *
   * A primeira versao disparava as NOVE em Promise.all. De dentro do Worker
   * voltaram 520 nas nove, e eu conclui que o FRED bloqueava o IP da
   * Cloudflare. Fui sondar host por host e o mesmo endereco respondeu 200 —
   * sozinho. O que ele recusa nao e a origem: e nove pedidos no mesmo
   * instante. O BLS, sondado no mesmo teste, devolveu literalmente
   * "Requests Per Second Limit Exceeded" com apenas DOIS.
   *
   * Eu quase saí procurando fonte nova pra um problema de ritmo. A licao:
   * antes de trocar a fonte, perguntar se o problema e a fonte ou o modo de
   * pedir. Uma sonda que pergunta host por host responde isso em um deploy.
   *
   * O paralelo continua valendo pra fontes DIFERENTES; o que nao vale e
   * paralelo contra o MESMO servidor. Aqui sao nove series da mesma casa. */
  const respirar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const emFila = [];
  for (const qual of ["cpi", "pce", "cpiNucleo", "pceNucleo",
                      "m2", "balanco", "juros", "desemprego", "natural"]) {
    if (emFila.length) await respirar(250);
    emFila.push(await pegar(qual));
  }
  const [cpi, pce, cpiN, pceN, m2, balanco, juros, desemprego, natural] = emFila;

  const pct = (s) => { const v = variacaoEmDozeMeses(s); return v ? v.pct : null; };

  fora.inflacao = lerInflacao({
    cpi: pct(cpi), pce: pct(pce), cpiNucleo: pct(cpiN), pceNucleo: pct(pceN),
  });

  const uHoje = ultimo(desemprego)?.valor;
  const nHoje = ultimo(natural)?.valor;
  fora.taylor = fora.inflacao
    ? lerTaylor({ inflacao: fora.inflacao.pce ?? fora.inflacao.cpi,
                  desemprego: uHoje, natural: nHoje })
    : null;

  const jHoje = ultimo(juros)?.valor;
  fora.postura = lerPostura(jHoje, fora.taylor);
  fora.juros = jHoje == null ? null : { valor: jHoje, dia: ultimo(juros).dia };
  fora.desemprego = uHoje == null ? null : { valor: uHoje, natural: nHoje ?? null };

  const m2Hoje = ultimo(m2);
  fora.m2 = m2Hoje ? lerM2(m2Hoje.valor * 1e9, pct(m2)) : null;   // M2SL vem em bilhões

  const bHoje = ultimo(balanco);
  fora.balanco = bHoje ? lerBalanco(bHoje.valor * 1e6, pct(balanco)) : null;  // WALCL em milhões

  fora.dia = m2Hoje?.dia || bHoje?.dia || null;
  return fora;
}
