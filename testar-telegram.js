/* Prova o texto que o bot escreve.
 *
 *   node testar-telegram.js
 *
 * Até 06/09/2026 nenhum teste tocava telegram.js: as contas eram provadas e a
 * frase que o Rayakuza de fato lê, não. Este arquivo começa a cobrir isso pelos
 * dois textos mais recentes — o do ciclo e o de quebra de rodada.
 *
 * O que se testa aqui não é formatação bonita. É que a mensagem não afirme mais
 * do que a medida sustenta, e que não esconda o que a pessoa precisa saber pra
 * decidir — que são exatamente os dois jeitos de um texto mentir sem errar
 * nenhum número.
 */

import { textoDoCiclo, textoDaQuebra } from "./src/telegram.js";
import { cicloEfetivo, cicloParaMeta } from "./src/ciclo.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const semTags = (t) => t.replace(/<[^>]+>/g, "");

/* Monta o objeto que `cicloDoBanco` devolveria, sem banco. */
const doBanco = (escolhido, leitura) => {
  const e = cicloEfetivo(escolhido, leitura);
  return {
    ...e, escolhido, medidoEm: leitura?.dia || null,
  };
};

/* A massa do caso real de 06/09: o preco virou pra cima e o capital nao
   confirmou. Isso NAO e um terceiro ciclo — e bear (o lado conservador) com a
   falta de consenso dita. A massa mudou junto com o conceito; deixa-la em
   "indefinido" seria testar contra um estado que o programa nao produz mais. */
const LEITURA_HOJE = {
  ciclo: "bear", semConsenso: true,
  firmeza: "o preço virou, o capital ainda não confirmou",
  porque: [
    "Bitcoin 14.6% acima da média de 200 dias",
    "capital parado: stablecoin +1.5% em 30 dias — positivo, mas abaixo do mês normal do mercado (US$ 312 bi)",
  ],
  dia: "2026-09-06",
  diasNoRegime: 19,
};
const LEITURA_BEAR = {
  ciclo: "bear", firmeza: "os dois eixos concordam",
  porque: ["Bitcoin 12.0% abaixo da média de 200 dias", "dinheiro saindo: estoque de stablecoin -2.1% em 30 dias"],
  dia: "2026-09-06", diasNoRegime: 60,
};

// ---------------------------------------------------------------------------
titulo("O texto do ciclo diz a meta, que é o número que muda a decisão");

{
  const t = semTags(textoDoCiclo(doBanco("auto", LEITURA_HOJE)));
  /* ESTAS CONFERENCIAS EXIGIAM "4% ao mês" NO TEXTO, e a meta foi removida.
     Ela citava um documento que não existe (veja metodo.js). O que continua
     valendo é que "indefinido" não pode ficar sozinho: a mensagem tem que
     dizer qual lado está sendo usado enquanto ele não decide. */
  /* Nao ha mais "indefinido": ha bear com a duvida dita. O que continua
     importando e que a duvida NAO suma — dizer "bear" com a mesma firmeza de
     quando as medidas concordam seria esconder a diferenca que importa. */
  conferir("a dúvida é dita, e o lado também",
    /não concordam/i.test(t) && /bear/i.test(t),
    "dizer bear com a mesma firmeza dos dois casos apagaria a diferença");
  conferir("os dois eixos aparecem", t.includes("Bitcoin 14.6%") && t.includes("stablecoin +1.5%"));
  conferir("a idade do regime aparece", t.includes("19 dias"),
    "regime de 19 dias e de 8 meses não valem o mesmo");
  conferir("a data da medida aparece", t.includes("2026-09-06"),
    "leitura de três dias atrás sem data é número velho com cara de novo");
  conferir("ensina como mudar", t.includes("/ciclo bull"));
}

// ---------------------------------------------------------------------------
titulo("Escolha na mão: manda, mas não some com a medida");

{
  const t = semTags(textoDoCiclo(doBanco("bull", LEITURA_HOJE), { acabouDeMudar: true }));
  conferir("diz que quem definiu foi ele", t.includes("definido por você"));
  conferir("o texto acompanha a escolha", /bull/i.test(t));
  conferir("os eixos continuam na tela", t.includes("Bitcoin 14.6%"),
    "esconder a medida faria a escolha envelhecer sem ele perceber");
  conferir("e são apresentados como medida, não como motivo da escolha",
    t.includes("O que eu estou medindo"),
    "dizer 'por quê' embaixo de uma escolha dele seria atribuir a ele o meu raciocínio");
  conferir("confirma que a mudança valeu", /Pronto/.test(t));
}

{
  const t = semTags(textoDoCiclo(doBanco("bull", LEITURA_BEAR)));
  conferir("quando a medida contraria a escolha, isso é dito", /Você fixou/.test(t));
  conferir("e a escolha continua valendo", /bull/i.test(t) && !/mudei|troquei/i.test(t),
    "o botão dele não pode virar sugestão");
  conferir("com o caminho de volta", t.includes("/ciclo auto"));
}

{
  const t = semTags(textoDoCiclo(doBanco("bear", LEITURA_BEAR)));
  conferir("concordar não vira aviso", !/Você fixou/.test(t),
    "aviso que aparece quando não há nada de errado ensina a ignorar aviso");
}

// ---------------------------------------------------------------------------
titulo("Sem leitura ainda, não se inventa nenhuma");

{
  const t = semTags(textoDoCiclo(doBanco("auto", null)));
  conferir("diz que ainda não mediu", /Ainda não medi/.test(t));
  conferir("e ainda assim diz qual lado está valendo", /bear/i.test(t), t.slice(0, 90));
  conferir("sem inventar eixo nenhum", !t.includes("Bitcoin"));
}

// ---------------------------------------------------------------------------
titulo("A quebra da rodada: o que aconteceu antes do que o programa cuspiu");

{
  const d1 = new Error("D1_ERROR: Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.");
  const t = semTags(textoDaQuebra(d1));
  conferir("o limite do banco é reconhecido e explicado em português",
    t.includes("limite de escrita do dia"));
  conferir("diz o que acontece agora", /rodada da manhã se recompõe/.test(t));
  conferir("diz quando volta, em horário daqui", t.includes("21h de Brasília"),
    "'midnight UTC' obriga a pessoa a fazer a conta no meio do susto");
  conferir("o texto cru continua disponível", t.includes("Motivo técnico"),
    "traduzir não pode virar esconder: quem for procurar precisa do original");
  conferir("e fica DEPOIS da explicação",
    t.indexOf("limite de escrita") < t.indexOf("Motivo técnico"));
}

{
  const t = semTags(textoDaQuebra(new Error("as piscinas de rendimento respondeu 503")));
  conferir("erro da fonte não é apresentado como defeito nosso",
    t.includes("instabilidade deles"));
}

{
  const t = semTags(textoDaQuebra(new Error("no such column: correlacao")));
  conferir("erro de banco é apresentado como defeito nosso",
    /defeito nosso/.test(t),
    "confundir defeito nosso com problema do mercado manda a pessoa investigar o lugar errado");
}

{
  const t = semTags(textoDaQuebra(new Error("coisa nunca vista")));
  conferir("motivo desconhecido não é maquiado", t.includes("Não reconheci o motivo"));
  conferir("e vai cru", t.includes("coisa nunca vista"));
}

conferir("erro sem mensagem não quebra o texto do erro",
  typeof textoDaQuebra(undefined) === "string" && textoDaQuebra(undefined).length > 0);

// ---------------------------------------------------------------------------
titulo("Nada aqui passa do teto do Telegram");

{
  const gigante = new Error("x".repeat(9000));
  conferir("mensagem crua enorme é cortada", textoDaQuebra(gigante).length < 1000,
    "o Telegram corta em 4096 e a mensagem chegaria pela metade");
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
