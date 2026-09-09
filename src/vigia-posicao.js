/* O vigia das posições: o que mudou desde a última olhada.
 *
 * Pedido dele em 09/09/2026: "seria bom ele falar se minha pool sai vendida ou
 * comprada, se está oscilando entrando e saindo do range".
 *
 * A OBSERVAÇÃO É BOA e vale escrever por quê, porque é ela que dá nome aos
 * avisos daqui. Numa pool de faixa concentrada, sair da faixa não é só "parou
 * de render" — é uma ORDEM EXECUTADA:
 *
 *   saiu por CIMA  → o preço subiu e a pool foi vendendo o seu volátil no
 *                    caminho. Você termina 100% na stable. Vendeu.
 *
 *   saiu por BAIXO → o preço caiu e a pool foi comprando o volátil com a sua
 *                    stable. Você termina 100% no volátil. Comprou.
 *
 * Em qualquer dos dois a posição para de render taxa. E a diferença entre eles
 * é enorme pro método: sair vendido em bull é deixar de subir junto; sair
 * comprado em bear é ficar com o ativo que está caindo.
 *
 * A OSCILAÇÃO é o outro lado. Cada travessia troca a composição da posição, e
 * uma faixa que é atravessada muitas vezes por dia está estreita demais pro
 * que o preço está fazendo. O radar conta as travessias e mostra o número.
 *
 * A REGRA DE SEMPRE: nada aqui manda fazer nada. "Saiu por cima e parou de
 * render" é fato. "Melhor sair" seria palpite sobre um futuro que ninguém tem,
 * e a decisão depende do imposto dele, do plano dele e do resto da carteira.
 *
 * Nada aqui fala com a rede nem com banco: recebe leitura, devolve texto.
 */

/* Os quatro estados, e a diferença entre estado e LADO.
 *
 * "perto da borda" e "dentro" são o mesmo lado — a posição está rendendo nos
 * dois. Trocar de um pro outro não merece mensagem de madrugada; trocar de
 * lado, sim. É a mesma distinção que o ciclo faz entre estado e lado. */
export function estadoDaPosicao(leitura) {
  if (!leitura) return null;
  return leitura.estado;
}

export function ladoDaPosicao(estado) {
  if (estado === "fora-cima") return "vendida";
  if (estado === "fora-baixo") return "comprada";
  if (estado === "dentro" || estado === "perto-da-borda") return "rendendo";
  return null;
}

/* Quantas travessias em quantas horas — e o veredito só quando há base.
 *
 * Uma travessia é a posição trocar de lado: rendendo → vendida, vendida →
 * rendendo, e assim por diante. Duas por dia é o preço passeando; seis é a
 * faixa estar apertada demais pro que o mercado está fazendo.
 *
 * O corte é declarado aqui em cima porque número solto no meio do código é
 * número que ninguém consegue discutir. */
export const OSCILACAO = { muitasEm24h: 4 };

export function contarTravessias(historico, horas = 24) {
  const agora = Date.now();
  const corte = agora - horas * 3600 * 1000;
  const dentroDaJanela = (historico || [])
    .filter((h) => h && h.quando && new Date(h.quando).getTime() >= corte)
    .sort((a, b) => new Date(a.quando) - new Date(b.quando));

  let travessias = 0;
  for (let i = 1; i < dentroDaJanela.length; i++) {
    if (ladoDaPosicao(dentroDaJanela[i].estado) !== ladoDaPosicao(dentroDaJanela[i - 1].estado)) {
      travessias++;
    }
  }
  return { travessias, horas, demais: travessias >= OSCILACAO.muitasEm24h };
}

const dinheiro = (v) => "US$ " + Number(v || 0).toFixed(v != null && Math.abs(v) < 0.01 ? 6 : 2).replace(".", ",");
const numero = (v, casas) => Number(v || 0).toFixed(casas).replace(".", ",");

/* O texto das taxas acumuladas, em token primeiro.
 *
 * A quantidade em token é exata e só sobe; o que ela vale em dólar muda a cada
 * minuto. Pôr o dólar na frente seria pôr o número instável antes do certo. */
function textoDasTaxas(pos) {
  const t = pos && pos.taxas;
  if (!t || (!(t.qtdA > 0) && !(t.qtdB > 0))) return "";
  return "\nTaxas acumuladas: " + numero(t.qtdA, 8) + " " + pos.simboloA +
    " + " + numero(t.qtdB, 6) + " " + pos.simboloB +
    " (" + dinheiro(t.emDolar) + " ao preço de agora).";
}

/* O aviso de que a posição trocou de lado.
 *
 * Devolve null quando não há o que dizer — e isso é a maior parte das vezes.
 * Bot que fala todo dia é bot que se aprende a ignorar, e aí ele cala
 * justamente no dia em que tinha algo. */
export function avisoDeTravessia(nome, antes, pos) {
  const agora = estadoDaPosicao(pos && pos.leitura);
  if (!agora) return null;

  /* PRIMEIRA OLHADA: não há de onde ter vindo.
   *
   * Sem estado anterior, o código comparava null com "rendendo", achava que
   * tinha mudado, e anunciava "VOLTOU PRA DENTRO DA FAIXA" numa posição que
   * nunca saiu. Mensagem falsa na estreia é o pior jeito de começar.
   *
   * Mas se na primeira olhada ela já está FORA, isso ele precisa saber — pode
   * ter saído antes de o vigia existir. Então: cala se está dentro, fala se
   * está fora. */
  if (!antes) {
    if (agora === "dentro" || agora === "perto-da-borda") return null;
  } else if (ladoDaPosicao(antes) === ladoDaPosicao(agora)) {
    return null;
  }

  const faixa = pos.faixa || {};
  const taxas = textoDasTaxas(pos);

  if (agora === "fora-cima") {
    return {
      tipo: "saiu-vendida",
      texto: "⚠️ " + nome + " SAIU DA FAIXA POR CIMA.\n\n" +
        "O preço passou de " + numero(faixa.topo, 4) + " e a posição virou 100% " +
        pos.simboloB + ". Na prática a pool vendeu o seu " + pos.simboloA +
        " no caminho.\n\nEla parou de render taxa enquanto estiver aqui fora." +
        taxas + "\nValor agora: " + dinheiro(pos.valor) + ".",
    };
  }
  if (agora === "fora-baixo") {
    return {
      tipo: "saiu-comprada",
      texto: "⚠️ " + nome + " SAIU DA FAIXA POR BAIXO.\n\n" +
        "O preço caiu abaixo de " + numero(faixa.fundo, 4) + " e a posição virou 100% " +
        pos.simboloA + ". Na prática a pool comprou " + pos.simboloA +
        " com o seu " + pos.simboloB + ".\n\nEla parou de render taxa enquanto estiver aqui fora." +
        taxas + "\nValor agora: " + dinheiro(pos.valor) + ".",
    };
  }
  return {
    tipo: "voltou",
    texto: "✅ " + nome + " VOLTOU PRA DENTRO DA FAIXA.\n\n" +
      "O preço está em " + numero(pos.preco, 4) + ", entre " + numero(faixa.fundo, 4) +
      " e " + numero(faixa.topo, 4) + ". Ela voltou a render taxa." + taxas,
  };
}

/* O aviso de que a borda está perto — antes de sair, não depois.
 *
 * Este é o único que chega enquanto ainda dá pra fazer alguma coisa. Só sai uma
 * vez por aproximação: enquanto ela continuar perto, cala. */
export function avisoDeBorda(nome, antes, pos) {
  const agora = estadoDaPosicao(pos && pos.leitura);
  if (agora !== "perto-da-borda") return null;
  if (antes === "perto-da-borda") return null;

  const l = pos.leitura;
  const paraBaixo = Math.abs(l.ateFundo) < Math.abs(l.ateTopo);
  return {
    tipo: "perto-da-borda",
    texto: "🔸 " + nome + " está perto da borda de " + (paraBaixo ? "BAIXO" : "CIMA") + ".\n\n" +
      "O preço está a " + numero(Math.abs(paraBaixo ? l.ateFundo : l.ateTopo), 2) +
      "% de " + numero(paraBaixo ? pos.faixa.fundo : pos.faixa.topo, 4) + ".\n\n" +
      "Se passar, a posição vira 100% " + (paraBaixo ? pos.simboloA : pos.simboloB) +
      " e para de render." + textoDasTaxas(pos),
  };
}

/* O aviso de que ela está indo e voltando. */
export function avisoDeOscilacao(nome, historico, pos) {
  const c = contarTravessias(historico);
  if (!c.demais) return null;
  return {
    tipo: "oscilando",
    texto: "🔁 " + nome + " entrou e saiu da faixa " + c.travessias +
      " vezes nas últimas " + c.horas + " horas.\n\n" +
      "Cada travessia troca a composição da posição: por cima ela vende, por " +
      "baixo ela compra. Faixa estreita rende mais enquanto o preço fica " +
      "dentro, e troca de lado mais vezes quando ele anda." + textoDasTaxas(pos),
  };
}

/* O AVISO DE QUE EU NAO CONSEGUI LER — a falha silenciosa.
 *
 * A leitura das posicoes depende de um no da Solana. Se a chave expirar ou
 * bater limite, as linhas ficam sem valor, o total da carteira CAI, e as
 * porcentagens do metodo se refazem sobre um total errado. Ele abriria o app e
 * veria "Renda passiva 0%" — indistinguivel de ter perdido a pool.
 *
 * Na tela isso ja esta defendido: a linha cai pra ultima leitura boa e diz que
 * o numero e velho. Mas se ele NAO abrir o app, ninguem conta.
 *
 * SO FALA QUANDO FALHOU TUDO. Uma posicao que nao le pode ser um endereco
 * errado, coisa dele; TODAS falharem e o no que caiu. Avisar caso a caso
 * encheria a caixa por um endereco digitado errado uma vez. */
const PARA = String.fromCharCode(10);

export function avisoDeCegueira(quantasFalharam, quantasNoTotal) {
  if (!(quantasNoTotal > 0)) return null;
  if (quantasFalharam < quantasNoTotal) return null;
  return {
    tipo: "nao-consegui-ler",
    texto: "🔌 Não consegui ler " +
      (quantasNoTotal === 1 ? "a sua posição" : "nenhuma das suas " + quantasNoTotal + " posições") +
      " na Solana agora." + PARA + PARA +
      "Os números da carteira no app estão da última leitura que deu certo, e vêm " +
      "marcados como tal. Nada foi perdido — eu é que estou sem enxergar." + PARA + PARA +
      "Se continuar assim na próxima rodada, o nó da Solana ou a chave dele é " +
      "o lugar de olhar.",
  };
}

/* Tudo junto, na ordem de importância.
 *
 * Um aviso por posição por rodada, no máximo. Três mensagens sobre a mesma
 * pool na mesma madrugada é ruído, e ruído é o que faz alguém desligar o bot —
 * e um bot desligado não avisa nada. */
export function olharPosicao(nome, antes, historico, pos) {
  if (!pos || pos.erro) return null;
  return avisoDeTravessia(nome, antes, pos)
    || avisoDeBorda(nome, antes, pos)
    || avisoDeOscilacao(nome, historico, pos);
}
