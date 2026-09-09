/* Prova o vigia das posições: quando ele fala, e o que fala.
 *
 *   node testar-vigia-posicao.js
 *
 * Duas conferências mandam neste arquivo, e nenhuma é sobre número:
 *
 * 1. QUANDO CALAR. Bot que fala todo dia é bot que se aprende a ignorar, e aí
 *    ele cala justamente no dia em que tinha algo. A maior parte dos testes
 *    aqui é sobre o silêncio.
 *
 * 2. NENHUMA FRASE MANDA FAZER NADA. "Saiu por cima e parou de render" é fato.
 *    "Melhor sair" seria palpite sobre um futuro que ninguém tem — e a decisão
 *    depende do imposto dele, do plano dele e do resto da carteira.
 */

import {
  estadoDaPosicao, ladoDaPosicao, contarTravessias, OSCILACAO,
  avisoDeTravessia, avisoDeBorda, avisoDeOscilacao, olharPosicao, avisoDeCegueira,
} from "./src/vigia-posicao.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* A posição real dele, com o estado trocado conforme o teste. */
const posicao = (estado, extras = {}) => ({
  simboloA: "SOL", simboloB: "USDC",
  faixa: { fundo: 120.481500, topo: 124.762300 },
  preco: 103.13,
  valor: 9.94,
  taxas: { qtdA: 0.00005864, qtdB: 0.00364, emDolar: 0.007515 },
  leitura: {
    estado,
    dentro: estado === "dentro" || estado === "perto-da-borda",
    perto: estado === "perto-da-borda",
    ateFundo: -1.88, ateTopo: 2.13,
    texto: "…",
  },
  ...extras,
});

// ---------------------------------------------------------------------------
titulo("Estado e LADO são coisas diferentes");

conferir("fora por cima é estar vendida", ladoDaPosicao("fora-cima") === "vendida",
  "o preço subiu e a pool vendeu o volátil no caminho");
conferir("fora por baixo é estar comprada", ladoDaPosicao("fora-baixo") === "comprada",
  "o preço caiu e a pool comprou o volátil com a stable");
conferir("dentro e perto da borda são o MESMO lado",
  ladoDaPosicao("dentro") === ladoDaPosicao("perto-da-borda"),
  "nos dois ela está rendendo — trocar entre eles não merece mensagem de madrugada");

// ---------------------------------------------------------------------------
titulo("O aviso de travessia: só quando troca de lado");

{
  const r = avisoDeTravessia("SOL/USDC na Orca", "dentro", posicao("fora-cima"));
  conferir("saindo por cima, avisa que saiu VENDIDA", r && r.tipo === "saiu-vendida");
  conferir("e diz que a pool vendeu o SOL", r.texto.includes("vendeu o seu SOL"));
  conferir("e que parou de render", r.texto.includes("parou de render"));
  conferir("e traz o limite que foi passado", r.texto.includes("124,7623"));
}

{
  const r = avisoDeTravessia("SOL/USDC na Orca", "dentro", posicao("fora-baixo"));
  conferir("saindo por baixo, avisa que saiu COMPRADA", r && r.tipo === "saiu-comprada");
  conferir("e diz que a pool comprou SOL", r.texto.includes("comprou SOL"));
  conferir("e traz o limite de baixo", r.texto.includes("120,4815"));
}

conferir("voltando pra dentro, avisa que voltou",
  avisoDeTravessia("x", "fora-baixo", posicao("dentro")).tipo === "voltou");

conferir("de dentro pra perto da borda NÃO é travessia",
  avisoDeTravessia("x", "dentro", posicao("perto-da-borda")) === null,
  "é o mesmo lado; avisar aqui seria acordar ele à toa");
conferir("continuar dentro não gera aviso",
  avisoDeTravessia("x", "dentro", posicao("dentro")) === null);
conferir("continuar fora não gera aviso",
  avisoDeTravessia("x", "fora-cima", posicao("fora-cima")) === null,
  "sair é notícia uma vez; continuar fora é o estado das coisas");

// ---------------------------------------------------------------------------
titulo("A primeira olhada: sem estado anterior");

{
  /* O DEFEITO QUE ISTO PEGA: sem estado anterior, o código comparava null com
   * "rendendo", achava que tinha mudado, e anunciava "VOLTOU PRA DENTRO DA
   * FAIXA" numa posição que nunca saiu. Mensagem falsa na estreia é o pior
   * jeito de começar — quem recebe aprende na primeira vez que o bot inventa. */
  conferir("posição dentro na estreia não vira mensagem",
    avisoDeTravessia("x", null, posicao("dentro")) === null,
    "não há de onde ela teria vindo");
  conferir("nem perto da borda", avisoDeTravessia("x", null, posicao("perto-da-borda")) === null);

  /* Mas se ela já está FORA na primeira olhada, isso ele precisa saber: pode
   * ter saído antes de o vigia existir. */
  conferir("posição JÁ FORA na estreia avisa",
    avisoDeTravessia("x", null, posicao("fora-cima")).tipo === "saiu-vendida",
    "ela pode ter saído antes de o vigia existir");
  conferir("e por baixo também",
    avisoDeTravessia("x", null, posicao("fora-baixo")).tipo === "saiu-comprada");

  conferir("na estreia o olhar completo também cala se está dentro",
    olharPosicao("x", null, [], posicao("dentro")) === null);
}

// ---------------------------------------------------------------------------
titulo("O aviso de borda: uma vez por aproximação");

{
  const r = avisoDeBorda("SOL/USDC", "dentro", posicao("perto-da-borda"));
  conferir("chegando perto, avisa", r && r.tipo === "perto-da-borda");
  conferir("e diz de que lado", r.texto.includes("BAIXO"),
    "-1,88% até o fundo é mais perto que +2,13% até o topo");
  conferir("e o que acontece se passar", r.texto.includes("100% SOL"));

  conferir("continuando perto, cala",
    avisoDeBorda("x", "perto-da-borda", posicao("perto-da-borda")) === null,
    "senão ele repete a mesma coisa a cada rodada");
  conferir("longe da borda, cala", avisoDeBorda("x", "dentro", posicao("dentro")) === null);
}

// ---------------------------------------------------------------------------
titulo("A oscilação: contar travessias, não estados");

{
  const agora = Date.now();
  const h = (horasAtras, estado) => ({ quando: new Date(agora - horasAtras * 3600e3).toISOString(), estado });

  conferir("histórico vazio não tem travessia", contarTravessias([]).travessias === 0);
  conferir("ficar sempre dentro não conta nada",
    contarTravessias([h(20, "dentro"), h(10, "dentro"), h(1, "perto-da-borda")]).travessias === 0,
    "dentro e perto da borda são o mesmo lado");

  const vaiEVem = [h(20, "dentro"), h(16, "fora-cima"), h(12, "dentro"), h(8, "fora-baixo"), h(2, "dentro")];
  conferir("quatro trocas de lado contam quatro", contarTravessias(vaiEVem).travessias === 4);
  conferir("e isso já é demais", contarTravessias(vaiEVem).demais === true);
  conferir("o corte é quatro em 24h", OSCILACAO.muitasEm24h === 4);

  conferir("o que aconteceu ontem não conta",
    contarTravessias([h(40, "dentro"), h(36, "fora-cima"), h(30, "dentro")]).travessias === 0,
    "a janela é de 24 horas");

  const r = avisoDeOscilacao("SOL/USDC", vaiEVem, posicao("dentro"));
  conferir("e o aviso sai com o número", r && r.texto.includes("4 vezes"));
  conferir("explicando o que cada travessia faz",
    r.texto.includes("por cima ela vende") && r.texto.includes("por baixo ela compra"));

  conferir("duas travessias não incomodam ninguém",
    avisoDeOscilacao("x", [h(20, "dentro"), h(10, "fora-cima"), h(2, "dentro")], posicao("dentro")) === null);
}

// ---------------------------------------------------------------------------
titulo("Um aviso por rodada, e o silêncio como padrão");

{
  const agora = Date.now();
  const h = (ha, e) => ({ quando: new Date(agora - ha * 3600e3).toISOString(), estado: e });
  const oscilando = [h(20, "dentro"), h(16, "fora-cima"), h(12, "dentro"), h(8, "fora-baixo"), h(2, "dentro")];

  /* Travessia ganha de oscilação: sair da faixa agora é mais urgente que o
     padrão dos últimos dias. */
  const r = olharPosicao("x", "dentro", oscilando, posicao("fora-cima"));
  conferir("sair da faixa ganha de estar oscilando", r.tipo === "saiu-vendida");

  conferir("nada acontecendo é silêncio",
    olharPosicao("x", "dentro", [], posicao("dentro")) === null,
    "é o caso mais comum, e tem que ser o mais quieto");
  conferir("posição com erro não vira mensagem",
    olharPosicao("x", "dentro", [], { erro: "não achei" }) === null);
  conferir("posição sem leitura não vira mensagem",
    olharPosicao("x", "dentro", [], { simboloA: "SOL" }) === null);
}

// ---------------------------------------------------------------------------
titulo("Nenhuma frase manda fazer nada");

{
  /* A conferência que dá nome ao arquivo. A tentação aqui é grande: "saia da
   * posição" é a frase natural quando ela sai da faixa. Mas quando sair é
   * decisão dele, e o radar não sabe o imposto nem o plano dele. */
  const PROIBIDO = /\b(saia|retire|feche|fechar|desfaça|venda|compre|recolha|invista|deveria|recomendo|sugiro|melhor|aguarde|espere)\b/i;
  const agora = Date.now();
  const h = (ha, e) => ({ quando: new Date(agora - ha * 3600e3).toISOString(), estado: e });
  const oscilando = [h(20, "dentro"), h(16, "fora-cima"), h(12, "dentro"), h(8, "fora-baixo"), h(2, "dentro")];

  const textos = [
    avisoDeTravessia("x", "dentro", posicao("fora-cima")).texto,
    avisoDeTravessia("x", "dentro", posicao("fora-baixo")).texto,
    avisoDeTravessia("x", "fora-cima", posicao("dentro")).texto,
    avisoDeBorda("x", "dentro", posicao("perto-da-borda")).texto,
    avisoDeOscilacao("x", oscilando, posicao("dentro")).texto,
  ];
  const culpada = textos.find((t) => PROIBIDO.test(t));
  conferir("nenhum aviso usa verbo de ordem", !culpada, culpada || "");

  conferir("mas todos dizem o que ESTÁ acontecendo",
    textos.every((t) => t.length > 60),
    "calar não é o mesmo que ser vago");
}

// ---------------------------------------------------------------------------
titulo("A CEGUEIRA: quando eu não consigo ler nada");

{
  /* O DEFEITO QUE ISTO DEFENDE, e é o mais perigoso que este radar pode ter.
   *
   * A leitura das posições depende de um nó da Solana. Se a chave expirar ou
   * bater limite, as linhas ficam sem valor, o TOTAL DA CARTEIRA CAI, e as
   * porcentagens do método se refazem sobre um total errado. Ele abriria o app
   * e veria "Renda passiva 0%" — indistinguível de ter perdido a pool.
   *
   * Falha de rede com cara de perda de dinheiro. */
  conferir("nenhuma falhou: silêncio", avisoDeCegueira(0, 2) === null);
  conferir("uma de duas falhou: silêncio", avisoDeCegueira(1, 2) === null,
    "uma posição que não lê pode ser endereço errado, coisa dele");
  conferir("TODAS falharam: avisa", avisoDeCegueira(2, 2).tipo === "nao-consegui-ler",
    "todas falharem é o nó que caiu, e isso ele precisa saber");
  conferir("com uma posição só, também avisa", avisoDeCegueira(1, 1) !== null);
  conferir("sem posição nenhuma, não há o que avisar", avisoDeCegueira(0, 0) === null);

  const t = avisoDeCegueira(2, 2).texto;
  conferir("o aviso diz que NADA foi perdido", t.includes("Nada foi perdido"),
    "é a frase que separa falha de prejuízo, e é o motivo de o aviso existir");
  conferir("e que os números da tela são da última leitura boa",
    t.includes("última leitura"));
  conferir("e onde olhar", t.includes("nó da Solana"));
  conferir("e não manda fazer nada",
    !/\b(saia|venda|compre|troque|refaça|apague)\b/i.test(t));
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
