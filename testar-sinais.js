/* Prova as regras do radar com casos inventados.
 *
 *   node testar-sinais.js
 *
 * Não toca na rede nem no banco de propósito. Um teste que depende de como o
 * mercado está hoje não é teste: passa numa terça e falha na quarta sem ninguém
 * ter mexido em nada, e aí a gente aprende a ignorar o vermelho.
 *
 * Cada caso monta o próprio cenário do zero — nenhum depende do anterior.
 */

import {
  LIMIARES, variacao, montarFichas, sinaisDeRede, sinaisDeProtocolo,
  quemPuxou, possivelDestino, jaAvisou, stablesConfiaveis, separarParaAvisar,
} from "./src/sinais.js";
import {
  aprenderApelidos, taxasPorRede, dependenciaDeIncentivo,
  concentracao, fichaDeQualidade, observacoes, TAXA_IMPLAUSIVEL,
} from "./src/qualidade.js";

let passou = 0, falhou = 0;
const M = 1e6;

function conferir(oQue, condicao, detalhe = "") {
  if (condicao) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${detalhe ? ` — ${detalhe}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* Monta hoje + passado no formato que montarFichas espera. */
function cenario(redes) {
  const hoje = new Map(), ha1 = new Map(), ha7 = new Map(), ha30 = new Map();
  for (const r of redes) {
    hoje.set(r.rede, { tvl: r.tvl, stables: r.stables ?? 0 });
    ha1.set(r.rede, { tvl: r.tvl1d ?? r.tvl, stables: r.stables1d ?? r.stables ?? 0 });
    ha7.set(r.rede, { tvl: r.tvl7d ?? r.tvl, stables: r.stables7d ?? r.stables ?? 0 });
    ha30.set(r.rede, { tvl: r.tvl30d ?? r.tvl, stables: r.stables30d ?? r.stables ?? 0 });
  }
  return montarFichas(hoje, new Map([[1, ha1], [7, ha7], [30, ha30]]));
}
const acha = (lista, tipo, alvo) => lista.find((a) => a.tipo === tipo && a.alvo === alvo);

// ---------------------------------------------------------------------------
titulo("A porcentagem sozinha não pode mandar");

conferir(
  "sair de quase zero não vira porcentagem nenhuma",
  variacao(500000, 1000) === null,
  "base minúscula tem que devolver null, não +49.900%",
);
conferir("com base de verdade, a conta é a conta", Math.round(variacao(150 * M, 100 * M)) === 50);
conferir("dado faltando devolve null", variacao(100, null) === null && variacao(null, 100) === null);

{
  // A rede de brinquedo: dobrou de tamanho, mas dobrou 200 mil dólares.
  const fichas = cenario([{ rede: "Poeira", tvl: 0.4 * M, tvl7d: 0.2 * M }]);
  conferir(
    "rede de brinquedo que dobrou não vira sinal",
    sinaisDeRede(fichas).length === 0,
    "+100% de 200 mil dólares é uma pessoa movendo dinheiro, não tendência",
  );
}

{
  // Mesma porcentagem, tamanho de gente grande.
  const fichas = cenario([{ rede: "Grande", tvl: 400 * M, tvl7d: 200 * M }]);
  conferir("a mesma alta, em rede grande, vira sinal", !!acha(sinaisDeRede(fichas), "entrada", "Grande"));
}

// ---------------------------------------------------------------------------
titulo("Dinheiro entrando de verdade x token que valorizou");

{
  // TVL subiu 50%, mas a stablecoin não se mexeu: foi preço, não depósito.
  const soPreco = cenario([
    { rede: "SoPreco", tvl: 300 * M, tvl7d: 200 * M, stables: 50 * M, stables7d: 50 * M },
  ]);
  const s = acha(sinaisDeRede(soPreco), "entrada", "SoPreco");
  conferir("o sinal aparece", !!s);
  conferir(
    "mas não é marcado como capital novo",
    s && s.capitalNovo === false,
    "sem stablecoin subindo junto, o mais provável é que o token só valorizou",
  );

  // Agora com stablecoin entrando junto.
  const comDinheiro = cenario([
    { rede: "ComGrana", tvl: 300 * M, tvl7d: 200 * M, stables: 80 * M, stables7d: 50 * M },
  ]);
  const c = acha(sinaisDeRede(comDinheiro), "entrada", "ComGrana");
  conferir("com stablecoin subindo junto, é capital novo", c && c.capitalNovo === true);
}

// ---------------------------------------------------------------------------
titulo("Redes pequenas acelerando");

{
  const fichas = cenario([
    { rede: "Pequena",  tvl: 50 * M,   tvl7d: 30 * M },    // +67%, cabe no teto
    { rede: "Gigante",  tvl: 2000 * M, tvl7d: 1200 * M },  // +67%, mas é gente grande
    { rede: "Parada",   tvl: 50 * M,   tvl7d: 49 * M },    // +2%, nada demais
  ]);
  const s = sinaisDeRede(fichas);
  conferir("a pequena que acelerou aparece como 'pequena'", !!acha(s, "pequena", "Pequena"));
  conferir(
    "a gigante com a mesma alta cai em 'entrada', não em 'pequena'",
    !!acha(s, "entrada", "Gigante") && !acha(s, "pequena", "Gigante"),
  );
  conferir("a parada não aparece", !acha(s, "pequena", "Parada") && !acha(s, "entrada", "Parada"));
}

// ---------------------------------------------------------------------------
titulo("Dinheiro saindo");

{
  const fichas = cenario([
    { rede: "Sangrando", tvl: 100 * M, tvl7d: 150 * M, tvl1d: 101 * M }, // -33% na semana
    { rede: "Susto",     tvl: 100 * M, tvl7d: 100 * M, tvl1d: 130 * M }, // -23% num dia só
  ]);
  const s = sinaisDeRede(fichas);
  const sangria = acha(s, "fuga", "Sangrando");
  const susto = acha(s, "fuga", "Susto");
  conferir("a sangria de 7 dias vira aviso", !!sangria);
  conferir("o tombo de um dia vira aviso", !!susto);
  conferir("e o de um dia vem marcado como tal", susto && susto.deUmDia === true);
}

{
  // O caso que o `else` teria comido: subiu a semana toda e despencou hoje.
  const fichas = cenario([
    { rede: "ViradaHoje", tvl: 180 * M, tvl7d: 100 * M, tvl1d: 240 * M },
  ]);
  const s = sinaisDeRede(fichas);
  conferir("subiu na semana E despencou hoje: os dois avisos saem", !!acha(s, "entrada", "ViradaHoje") && !!acha(s, "fuga", "ViradaHoje"));
}

// ---------------------------------------------------------------------------
titulo("Redes que o Rayakuza mandou seguir");

{
  // +15% precisa cair exatamente no meio: abaixo do limiar normal (20%) e acima
  // do limiar cortado pela metade (10%). É o único jeito de a folga ser o que
  // está sendo testado, e não outra coisa.
  const fichas = cenario([{ rede: "Base", tvl: 115 * M, tvl7d: 100 * M }]);
  conferir("sem seguir, 15% não chega no limiar de 20%", sinaisDeRede(fichas).length === 0);
  conferir(
    "seguindo, o limiar cai pela metade e o mesmo 15% vira sinal",
    !!acha(sinaisDeRede(fichas, new Set(["Base"])), "entrada", "Base"),
  );
}

// ---------------------------------------------------------------------------
titulo("Protocolos");

{
  const protos = [
    { nome: "Subindo",  tvl: 200 * M, tvl7d: 100 * M, categoria: "Dexs",    porRede: {} },
    { nome: "Caindo",   tvl: 60 * M,  tvl7d: 200 * M, categoria: "Lending", porRede: {} },
    { nome: "Miudinho", tvl: 10 * M,  tvl7d: 2 * M,   categoria: "Dexs",    porRede: {} },
    { nome: "Quieto",   tvl: 500 * M, tvl7d: 495 * M, categoria: "Lending", porRede: {} },
  ];
  const s = sinaisDeProtocolo(protos);
  conferir("protocolo que dobrou vira alta", !!acha(s, "protocolo-alta", "Subindo"));
  conferir("protocolo que despencou vira queda", !!acha(s, "protocolo-queda", "Caindo"));
  conferir(
    "protocolo abaixo do piso não entra, mesmo tendo quintuplicado",
    !acha(s, "protocolo-alta", "Miudinho"),
  );
  conferir("protocolo parado não entra", !s.find((a) => a.alvo === "Quieto"));
}

// ---------------------------------------------------------------------------
titulo("Quem puxou o crescimento de uma rede");

{
  const protos = [
    {
      nome: "SoNaBase", categoria: "Dexs", tvl: 60 * M, tvl7d: 20 * M,
      porRede: { Base: { tvl: 60 * M, tvlPrevWeek: 20 * M } },
    },
    {
      // Cresceu MUITO, mas cresceu em Solana. Não pode virar mérito da Base.
      nome: "CresceuNoutraRede", categoria: "Lending", tvl: 500 * M, tvl7d: 100 * M,
      porRede: {
        Base:   { tvl: 10 * M,  tvlPrevWeek: 10 * M },
        Solana: { tvl: 490 * M, tvlPrevWeek: 90 * M },
      },
    },
  ];
  const donos = quemPuxou("Base", protos);
  conferir("quem cresceu na rede aparece", donos[0]?.nome === "SoNaBase");
  conferir(
    "quem cresceu em outra rede não é creditado aqui",
    !donos.find((d) => d.nome === "CresceuNoutraRede"),
    "o protocolo cresceu 400M, mas nenhum dólar disso foi na Base",
  );
}

// ---------------------------------------------------------------------------
titulo("De onde pode ter vindo o dinheiro");

{
  const fichas = cenario([
    { rede: "Esvaziou", tvl: 100 * M, tvl7d: 200 * M },
    { rede: "Encheu",   tvl: 210 * M, tvl7d: 105 * M },
    { rede: "Nada",     tvl: 300 * M, tvl7d: 299 * M },
  ]);
  const s = sinaisDeRede(fichas);
  const pares = possivelDestino(s.filter((a) => a.tipo === "fuga"), s.filter((a) => a.tipo === "entrada"));
  conferir("o par de tamanhos parecidos é encontrado", pares[0]?.de === "Esvaziou" && pares[0]?.para === "Encheu");
  conferir("rede parada não vira destino", !pares.find((p) => p.para === "Nada"));
}

// ---------------------------------------------------------------------------
titulo("Não tocar o celular duas vezes pela mesma coisa");

{
  const achado = { tipo: "entrada", alvo: "Base", forca: 25 };
  const vazio = new Map();
  conferir("primeira vez sempre avisa", jaAvisou(achado, vazio, "2026-09-02") === false);

  const ontem = new Map([["entrada:Base", { forca: 25, quando: "2026-09-01T10:00:00Z" }]]);
  conferir("o mesmo achado no dia seguinte cala", jaAvisou(achado, ontem, "2026-09-02") === true);

  conferir(
    "mas se o movimento piorou muito, avisa de novo",
    jaAvisou({ ...achado, forca: 60 }, ontem, "2026-09-02") === false,
    "de +25% pra +60% é notícia nova, não repetição",
  );

  const semanaPassada = new Map([["entrada:Base", { forca: 25, quando: "2026-08-20T10:00:00Z" }]]);
  conferir("passada a espera, pode avisar de novo", jaAvisou(achado, semanaPassada, "2026-09-02") === false);
}

// ---------------------------------------------------------------------------
titulo("Buracos no histórico não podem virar número inventado");

{
  // Rede nova: existe hoje, não existia 7 dias atrás.
  const hoje = new Map([["Novata", { tvl: 50 * M, stables: 10 * M }]]);
  const fichas = montarFichas(hoje, new Map([[7, new Map()]]));
  conferir("rede sem passado continua na lista", fichas.length === 1);
  conferir(
    "e a variação dela é 'não sei', não zero",
    fichas[0].varTvl7d === null && fichas[0].absTvl7d === null,
  );
  conferir("rede sem passado não vira sinal", sinaisDeRede(fichas).length === 0);
}

// ---------------------------------------------------------------------------
titulo("A trava da fonte de stablecoin quebrada");

{
  // O caso de 02/09/2026, reconstruído: dez redes grandes, todas "perdendo" 98%
  // das stablecoins na mesma semana. Isso não é mercado, é fonte errada.
  const quebradas = cenario(
    Array.from({ length: 10 }, (_, i) => ({
      rede: `Rede${i}`, tvl: 200 * M, tvl7d: 190 * M,
      stables: 1 * M, stables7d: 60 * M,
    })),
  );
  const veredito = stablesConfiaveis(quebradas);
  conferir("dez redes perdendo 98% de stablecoin é reconhecido como fonte quebrada", veredito.confiavel === false);

  // Um mercado plausível: mexidas pequenas, uma ou outra grande.
  const sadias = cenario([
    ...Array.from({ length: 9 }, (_, i) => ({
      rede: `Boa${i}`, tvl: 200 * M, tvl7d: 190 * M, stables: 60 * M, stables7d: 58 * M,
    })),
    { rede: "UmaSubiuMuito", tvl: 200 * M, tvl7d: 190 * M, stables: 120 * M, stables7d: 50 * M },
  ]);
  conferir("mercado normal com um caso extremo continua confiável", stablesConfiaveis(sadias).confiavel === true);

  conferir(
    "poucas redes com dado também não é confiável",
    stablesConfiaveis(cenario([{ rede: "So1", tvl: 200 * M, tvl7d: 190 * M, stables: 60 * M, stables7d: 58 * M }])).confiavel === false,
    "sem amostra não dá pra dizer se a fonte está sã",
  );
}

{
  // Com a fonte suspeita, o radar não pode afirmar "não é dinheiro novo".
  const fichas = cenario([
    { rede: "Subindo", tvl: 300 * M, tvl7d: 200 * M, stables: 1 * M, stables7d: 50 * M },
  ]);
  const comFonteQuebrada = acha(sinaisDeRede(fichas, new Set(), LIMIARES, false), "entrada", "Subindo");
  conferir("o sinal de TVL continua saindo", !!comFonteQuebrada);
  conferir(
    "mas 'é dinheiro novo?' vira 'não sei', não 'não'",
    comFonteQuebrada.capitalNovo === null,
    "false seria uma afirmação errada dita com confiança",
  );
}

// ---------------------------------------------------------------------------
titulo("A notícia não pode sair em prestações");

{
  // Doze protocolos se mexeram; só cinco cabem na mensagem.
  const doze = Array.from({ length: 12 }, (_, i) => ({
    tipo: "protocolo-alta", alvo: `Proto${i}`, forca: 100 - i, abs: 50 * M,
    protocolo: { nome: `Proto${i}`, redes: ["Base"], categoria: "Dexs", tvl: 100 * M },
  }));

  const primeira = separarParaAvisar([], doze, [], new Map(), "2026-09-02");
  conferir("a mensagem mostra só cinco", primeira.mostrar.protocolos.length === 5);
  conferir(
    "mas anota os doze",
    primeira.anotar.length === 12,
    "anotar só os cinco mostrados faz os outros sete voltarem na rodada seguinte",
  );

  // A rodada seguinte, quatro horas depois, com os doze já anotados.
  const jaVistos = new Map(doze.map((a) => [`${a.tipo}:${a.alvo}`, { forca: a.forca, quando: "2026-09-02T08:00:00Z" }]));
  const segunda = separarParaAvisar([], doze, [], jaVistos, "2026-09-02");
  conferir(
    "na rodada seguinte ele cala, em vez de entregar o próximo lote",
    segunda.calado === true && segunda.mostrar.protocolos.length === 0,
  );
}

{
  // A troca de lugar não pode aparecer se a fuga que ela comenta foi silenciada.
  const fichas = cenario([
    { rede: "Esvaziou", tvl: 100 * M, tvl7d: 200 * M },
    { rede: "Encheu", tvl: 210 * M, tvl7d: 105 * M },
  ]);
  const s = sinaisDeRede(fichas);
  const pares = possivelDestino(s.filter((a) => a.tipo === "fuga"), s.filter((a) => a.tipo !== "fuga"));
  conferir("com a fuga sendo anunciada, a troca aparece", separarParaAvisar(s, [], pares, new Map(), "2026-09-02").mostrar.pares.length > 0);

  const jaVistos = new Map(s.map((a) => [`${a.tipo}:${a.alvo}`, { forca: a.forca, quando: "2026-09-02T08:00:00Z" }]));
  conferir(
    "com a fuga silenciada, a troca some junto",
    separarParaAvisar(s, [], pares, jaVistos, "2026-09-02").mostrar.pares.length === 0,
    "senão a mensagem comenta uma saída de dinheiro que ela própria não mencionou",
  );
}

// ---------------------------------------------------------------------------
titulo("Qualidade: o apelido de rede que a API de taxas usa");

{
  // A API chama "Robinhood Chain" de `robinhood` e "Gnosis" de `xdai`. Nenhum
  // dos dois sai de transformar o nome — por isso o mapa se aprende dos dados.
  const oficiais = new Set(["Robinhood Chain", "Gnosis", "Ethereum"]);
  const protocolos = [
    { chains: ["Robinhood Chain"], breakdown24h: { robinhood: { "Pons V2": 5.7e6 } } },
    { chains: ["Gnosis"], breakdown24h: { xdai: { "Algum DEX": 1e4 } } },
    // Multi-rede não ensina nada: não dá pra saber qual apelido é qual.
    { chains: ["Ethereum", "Gnosis"], breakdown24h: { ethereum: { X: 1 }, xdai: { X: 2 } } },
  ];
  const mapa = aprenderApelidos(protocolos, oficiais);
  conferir("aprende que 'robinhood' é Robinhood Chain", mapa.get("robinhood") === "Robinhood Chain");
  conferir("aprende que 'xdai' é Gnosis", mapa.get("xdai") === "Gnosis");
  conferir(
    "não inventa par a partir de protocolo multi-rede",
    !mapa.has("ethereum"),
    "com duas redes e dois apelidos não dá pra saber qual é qual",
  );

  const taxas = taxasPorRede(protocolos, mapa);
  conferir("soma a taxa na rede certa", Math.round(taxas.get("Robinhood Chain").taxas24h) === 5.7e6);
  conferir(
    "apelido desconhecido não vira rede nem some com o valor no lugar errado",
    !taxas.has("ethereum") && !taxas.has(undefined),
  );
}

// ---------------------------------------------------------------------------
titulo("Qualidade: rendimento alugado");

{
  const piscinas = [
    // Rede alugada: quase todo o rendimento é token emitido.
    { chain: "Alugada", tvlUsd: 100 * M, apyBase: 1, apyReward: 19 },
    // Rede de uso real.
    { chain: "Trabalhada", tvlUsd: 100 * M, apyBase: 8, apyReward: 0.2 },
    // Piscina minúscula pagando uma fortuna: não pode mandar na conta da rede.
    { chain: "Trabalhada", tvlUsd: 1000, apyBase: 0, apyReward: 5000 },
    // Rede sem rendimento nenhum.
    { chain: "Vazia", tvlUsd: 50 * M, apyBase: 0, apyReward: 0 },
  ];
  const d = dependenciaDeIncentivo(piscinas);
  conferir("rede alugada é reconhecida", d.get("Alugada").fatiaAlugada > 90);
  conferir(
    "piscina de mil dólares não sequestra a conta da rede",
    d.get("Trabalhada").fatiaAlugada < 10,
    "5000% ao ano sobre 1000 dólares é troco perto de 8% sobre 100 milhões",
  );
  conferir(
    "sem rendimento nenhum, a resposta é 'não sei' e não '0% alugado'",
    d.get("Vazia").fatiaAlugada === null,
    "0% seria um elogio inventado a uma rede sobre a qual não sabemos nada",
  );
}

// ---------------------------------------------------------------------------
titulo("Qualidade: concentração e observações");

{
  const protos = [
    { nome: "Dono", categoria: "Lending", porRede: { Ilha: { tvl: 85 * M } } },
    { nome: "Resto1", categoria: "Dexs", porRede: { Ilha: { tvl: 10 * M } } },
    { nome: "Resto2", categoria: "Yield", porRede: { Ilha: { tvl: 5 * M } } },
  ];
  const c = concentracao(protos, "Ilha");
  conferir("acha o maior protocolo", c.maior === "Dono");
  conferir("a fatia é medida contra a soma dos protocolos", Math.round(c.fatiaDoMaior) === 85);
  conferir("nunca passa de 100%", c.fatiaDoMaior <= 100);
  conferir("rede sem protocolo devolve null", concentracao(protos, "Deserta") === null);

  const ficha = fichaDeQualidade("Ilha", {
    tvl: 100 * M,
    incentivo: { fatiaAlugada: 89, piscinas: 3 },
    taxas: { taxas24h: 300 },
    concentra: c,
  });
  conferir("taxa por milhão é calculada", Math.round(ficha.taxaPorMilhao) === 3);

  const notas = observacoes(ficha);
  const tem = (t) => notas.some((n) => n.texto.includes(t));
  conferir("avisa do rendimento de incentivo", tem("incentivo"));
  conferir("avisa do dinheiro parado sem uso", tem("por dia a cada $1M"));
  conferir("avisa da concentração num protocolo só", tem("num protocolo só"));
  conferir("toda observação diz o que estudar", notas.every((n) => n.estudar && n.estudar.length > 10));
  conferir(
    "nenhuma observação manda fazer nada",
    !notas.some((n) => /\b(compre|venda|entre|invista|saia|recomend)/i.test(n.texto + n.estudar)),
    "o radar mostra e nomeia; quem decide é o Rayakuza",
  );
}

// ---------------------------------------------------------------------------
titulo("Qualidade: taxa alta demais pra ser verdade");

{
  // Canton, 03/09/2026: $8,2M parados gerando $1,7M de taxa por dia. Isso seria
  // a rede devolver 20% do capital dela POR DIA. A taxa não vem desse capital —
  // é de emissor, corretora ou ponte, atribuída à rede.
  const canton = fichaDeQualidade("Canton", {
    tvl: 8.2 * M,
    incentivo: null,
    taxas: { taxas24h: 1.7 * M },
    concentra: null,
  });
  const notas = observacoes(canton);
  const duvida = notas.find((n) => n.peso === "duvidoso");
  conferir("taxa absurda é marcada como duvidosa", !!duvida);
  conferir(
    "e NÃO é elogiada como muito uso",
    !notas.some((n) => n.peso === "bom"),
    "um número enorme medindo outra coisa é o pior erro possível aqui",
  );
  conferir("a dúvida diz onde procurar a explicação", !!duvida && duvida.estudar.includes("emissor"));

  // Logo abaixo do corte continua sendo elogio legítimo.
  const forte = fichaDeQualidade("Forte", {
    tvl: 100 * M,
    incentivo: null,
    taxas: { taxas24h: 100 * (TAXA_IMPLAUSIVEL - 1000) },
    concentra: null,
  });
  const n2 = observacoes(forte);
  conferir("abaixo do corte, uso alto continua sendo elogio", n2.some((n) => n.peso === "bom"));
  conferir("e não vira dúvida", !n2.some((n) => n.peso === "duvidoso"));
}

// ---------------------------------------------------------------------------
console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
