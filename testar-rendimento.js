/* Prova as medidas de rendimento com séries inventadas.
 *
 *   node testar-rendimento.js
 *
 * Os casos não são hipóteses: são pools reais medidas em 05/09/2026,
 * reconstruídas em forma mínima. Se um dia alguém "melhorar" a métrica e um
 * destes ficar vermelho, é sinal de que a melhoria apagou a coisa que fez o
 * módulo existir.
 */

import {
  LIMIARES_POOL, percentil, desvio, medirPool, classificar, porque,
  ordenarPorConfianca, nota,
} from "./src/rendimento.js";

let passou = 0, falhou = 0;
function conferir(oQue, condicao, detalhe = "") {
  if (condicao) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${detalhe ? ` — ${detalhe}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* Monta uma série de N dias a partir de uma lista de rendimentos. */
const serie = (apys) => apys.map((apy, i) => ({
  dia: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10),
  apy, tvl: 10e6,
}));

/* 30 dias em que quase todos pagam `base`, e `quantosRuins` dias despencam. */
function comDiasRuins(base, ruim, quantosRuins) {
  const a = Array(30).fill(base);
  for (let i = 0; i < quantosRuins; i++) a[i * 3] = ruim;
  return serie(a);
}

// ---------------------------------------------------------------------------
titulo("O chão: o que a pool supera em 9 de cada 10 dias");

conferir("percentil devolve um valor que existiu de verdade na série",
  [1, 2, 3, 4, 5].includes(percentil([1, 2, 3, 4, 5], 0.1)),
  "com 30 pontos, inventar valor entre dois dias reais seria mentira precisa");
conferir("série vazia devolve null", percentil([], 0.1) === null);
conferir("desvio de um ponto só devolve null", desvio([5]) === null);
conferir("desvio de série constante é zero", desvio([5, 5, 5, 5]) === 0);

// ---------------------------------------------------------------------------
titulo("O caso que fez este módulo existir");

{
  // uniswap-v3/WETH-USDC, 05/09/2026: cartaz 74,0% e chão 7,9%.
  // Uma pool de taxa de negociação: alguns dias enormes, a maioria magra.
  const picos = Array(30).fill(6);
  [3, 9, 17, 25].forEach((i) => { picos[i] = 180; });
  const m = medirPool(serie(picos), { cartaz: 74.0, emitidoPct: 0 });

  conferir("mede quando há série suficiente", m.medivel === true);
  conferir("o chão fica bem abaixo do cartaz", m.chao < 10,
    `chão saiu ${m.chao}`);
  conferir("o abismo entre cartaz e chão é enorme", m.abismo > 60);
  conferir("é classificada como loteria, não como boa pagadora",
    m.classe === "loteria",
    "média alta feita de poucos dias ótimos não é renda");

  const frase = porque(m);
  conferir("a frase diz quanto do cartaz não dá pra contar",
    frase.includes("não dá pra contar"));
  conferir("a frase traz o pior dia", frase.includes("Pior dia"));
}

{
  // aerodrome-v1/USDC-AERO, 05/09/2026: cartaz 19,8%, chão 21,7%,
  // oscilação 1,3 — e 100% token emitido.
  const m = medirPool(serie(Array(30).fill(22).map((v, i) => v + (i % 3) - 1)),
    { cartaz: 19.8, emitidoPct: 100 });

  conferir("pagadora regular não vira loteria", m.classe !== "loteria");
  conferir("mas é marcada como alugada por ser toda emitida",
    m.classe === "alugada");
  conferir("e a frase avisa do prazo, na palavra do curso",
    porque(m).includes("incentivo"),
    "sem esse aviso ela pareceria a melhor da lista");
}

{
  // Uma pagadora de uso real, estável: o que o Rayakuza procura.
  const m = medirPool(serie(Array(30).fill(12).map((v, i) => v + (i % 2) * 0.4)),
    { cartaz: 12.2, emitidoPct: 3 });
  conferir("pagadora estável de uso real é 'firme'", m.classe === "firme");
  conferir("e a frase diz que ela sustenta o cartaz",
    porque(m).includes("sustenta"));
}

// ---------------------------------------------------------------------------
titulo("Sem histórico não se inventa medida");

{
  const m = medirPool(serie([10, 11, 9]), { cartaz: 40, idade: 4 });
  conferir("série curta não é medível", m.medivel === false);
  conferir("pool recém-montada é classificada como nova", m.classe === "nova");
  conferir("chão e realizado ficam null, não zero",
    m.chao === null && m.realizado === null,
    "zero seria uma afirmação; null é 'não sei'");
  conferir("a frase avisa que não há como saber",
    porque(m).includes("não existe histórico"));
  conferir("a idade vem do DefiLlama, não do tamanho da nossa série",
    porque(m).includes("há 4 dias"),
    "a série tinha 3 pontos e a pool tem 4 dias; quem manda é a pool");

  const ontem = medirPool(serie([10]), { cartaz: 12, idade: 1 });
  conferir("um dia de vida vira 'ontem', não '1 dias'", porque(ontem).includes("Montada ontem"));

  const semRendimento = medirPool(serie([0]), { cartaz: 0, idade: 2 });
  conferir("pool que não declara rendimento não é descrita como se prometesse",
    porque(semRendimento).includes("Ainda não declara rendimento") &&
    !porque(semRendimento).includes("Anuncia 0.0%"));
}

{
  const m = medirPool([], { cartaz: 30 });
  conferir("série vazia não quebra", m.medivel === false && m.classe === "sem-dado");
}

// ---------------------------------------------------------------------------
titulo("Subindo ou caindo");

{
  // 23 dias a 5%, última semana a 12%: um DEGRAU, não uma aceleração.
  const subindo = medirPool(serie([...Array(23).fill(5), ...Array(7).fill(12)]),
    { cartaz: 12, emitidoPct: 0 });
  conferir("detecta que a semana rendeu mais", subindo.tendencia > 5);
  conferir("e escreve quanto a mais",
    porque(subindo).includes("pontos a mais"));
  conferir(
    "degrau seguido de patamar NÃO é chamado de aceleração",
    subindo.trajetoria === "estável",
    "ontem igual à semana quer dizer que já parou de subir; chamar de acelerando seria promessa",
  );

  const caindo = medirPool(serie([...Array(23).fill(20), ...Array(7).fill(8)]),
    { cartaz: 8, emitidoPct: 0 });
  conferir("detecta que a semana rendeu menos", caindo.tendencia < -5);
  conferir("e escreve quanto a menos", porque(caindo).includes("pontos a menos"));
}

// ---------------------------------------------------------------------------
titulo("A ordenação privilegia o chão, não o teto");

{
  const alta = medirPool(comDiasRuins(80, 1, 8), { cartaz: 80, emitidoPct: 0 });
  const firme = medirPool(serie(Array(30).fill(14)), { cartaz: 14, emitidoPct: 0 });

  conferir("a instável tem média maior que a firme",
    alta.realizado > firme.realizado);
  const ordenado = ordenarPorConfianca([alta, firme]);
  conferir("mas a firme vem primeiro na ordenação por confiança",
    ordenado[0] === firme,
    "quem vive de renda não pode depender do dia bom");
  conferir("pool sem medida vai pro fim",
    ordenarPorConfianca([medirPool([], {}), firme])[0] === firme);
  conferir("nota de pool não medível é negativa", nota(medirPool([], {})) === -1);
}

{
  // Mesmo chão, oscilação diferente: ganha a que balança menos.
  const calma = medirPool(serie(Array(30).fill(10)), { cartaz: 10, emitidoPct: 0 });
  const nervosa = medirPool(serie(Array(30).fill(10).map((v, i) => v + (i % 2 ? 9 : 0))),
    { cartaz: 19, emitidoPct: 0 });
  conferir("com chão parecido, a mais calma ganha",
    ordenarPorConfianca([nervosa, calma])[0] === calma);
}

// ---------------------------------------------------------------------------
titulo("A classificação não pode elogiar o que não conhece");

{
  conferir("sem chão, a classe é 'sem-dado' e não 'firme'",
    classificar({ chao: null, oscilacao: 0, abismo: null, emitido: 0 }) === "sem-dado");
  conferir("pool nova nunca é classificada como firme",
    classificar({ chao: 30, oscilacao: 0, abismo: 0, emitido: 0, idade: 5 }) === "nova",
    "chão bonito em 5 dias de vida não é chão, é coincidência");
  conferir("loteria vem antes de alugada",
    classificar({ chao: 5, oscilacao: 40, abismo: 50, emitido: 100 }) === "loteria",
    "não cumprir o anunciado é problema maior que ter prazo");
}

// ---------------------------------------------------------------------------
console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
