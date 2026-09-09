/* Buscar contas na Solana. A parte que fala com a rede.
 *
 * Fica separada de orca.js de propósito: lá são bytes virando números, e dá
 * pra testar sem rede nenhuma contra os bytes da posição real do Rayakuza. Aqui é
 * só o pedido. Misturar as duas coisas faria a conta do dinheiro dele só ser
 * testável com internet, que é o jeito de ninguém testar.
 *
 * O nó público da Solana não pede chave nem cadastro. Ele tem limite de uso, e
 * é por isso que tudo aqui vai em LOTE: uma chamada para todas as posições,
 * uma para todas as pools, uma para todos os tokens. Três idas à rede, não
 * importa se ele tem uma posição ou dez — e o Worker corta em 50.
 */

/* Os nós, em ordem de tentativa.
 *
 * O oficial (api.mainnet-beta.solana.com) responde do meu computador e devolve
 * 403 quando quem pergunta é o Worker — a Cloudflare sai por faixas de IP de
 * datacenter, e o nó oficial as recusa. Descoberto testando: funcionou aqui,
 * quebrou no ar.
 *
 * E não basta um substituto: cada nó recusa perguntas diferentes. O publicnode
 * responde getAccountInfo e getMultipleAccounts, mas devolve 403 quando a
 * pergunta é "o que esta carteira tem" (getTokenAccountsByOwner) — que é
 * justamente a pergunta da importação. O leorpc responde essa.
 *
 * Então a lista não é redundância, é COBERTURA: a função tenta um por um até
 * alguém responder, e cada pergunta acha o nó que a aceita. */
import { paraBase58 } from "./orca.js";

export const NOS = [
  "https://solana-rpc.publicnode.com",
  "https://solana.leorpc.com/?api_key=FREE",
  "https://api.mainnet-beta.solana.com",
];

/* Casas decimais que já se sabe, para não gastar uma chamada perguntando.
 *
 * Não é atalho: são os dois lados de quase toda pool que ele vai abrir, e o
 * número deles não muda nunca — casa decimal de token é gravada na criação. */
export const CASAS_CONHECIDAS = {
  So11111111111111111111111111111111111111112: 9,   // SOL
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,   // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 6,   // USDT
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 9,    // mSOL
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 9,   // jitoSOL
};

/* O símbolo dos tokens que ele tem chance de ver numa pool da Solana.
 *
 * Serve só para dar nome à linha ("SOL/USDC na Orca") — nenhuma conta depende
 * disto. Token que não estiver aqui aparece pelo começo do endereço, e ele
 * renomeia se quiser. */
export const SIMBOLOS_CONHECIDOS = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "jitoSOL",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "ETH",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "WBTC",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
};

export function simboloDoMint(mint) {
  return SIMBOLOS_CONHECIDOS[mint] || String(mint || "").slice(0, 4);
}

const ALFABETO58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function deBase58(texto) {
  let n = 0n;
  for (const c of String(texto)) {
    const i = ALFABETO58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const fora = [];
  while (n > 0n) { fora.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of String(texto)) { if (c === "1") fora.unshift(0); else break; }
  return new Uint8Array(fora);
}

function juntarBytes(pedacos) {
  let tamanho = 0;
  for (const p of pedacos) tamanho += p.length;
  const fora = new Uint8Array(tamanho);
  let onde = 0;
  for (const p of pedacos) { fora.set(p, onde); onde += p.length; }
  return fora;
}

/* Os endereços que UMA posição pode ter, dadas as sementes.
 *
 * Endereço de posição na Solana não é sorteado: é calculado a partir de quem é
 * o dono e de que protocolo é. Por isso dá pra achar a posição de alguém sem
 * varrer a rede — e varrer é justamente o que o nó público não deixa fazer.
 *
 * O jeito oficial de calcular exige checar se o ponto cai fora de uma curva
 * matemática, o que é umas cinquenta linhas de aritmética que eu não quero
 * dentro de um Worker. O atalho: o cálculo tem um "bump" que quase sempre é
 * 255, 254 ou 253. Em vez de decidir qual é por matemática, eu gero os
 * candidatos e PERGUNTO À REDE qual deles existe. Uma ida a mais, zero
 * aritmética de curva.
 *
 * Conferido contra as duas posições reais do Rayakuza: a da Orca saiu no bump 253,
 * a da Kamino no 255. */
export async function candidatosDeEndereco(sementes, programa, quantos = 5) {
  const prog = deBase58(programa);
  const marca = new TextEncoder().encode("ProgramDerivedAddress");
  const base = juntarBytes(sementes);
  const fora = [];
  for (let bump = 255; bump > 255 - quantos; bump--) {
    const dados = juntarBytes([base, new Uint8Array([bump]), prog, marca]);
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", dados));
    fora.push({ bump, endereco: paraBase58(h) });
  }
  return fora;
}

/* Tudo que uma carteira tem em token. Duas idas: o programa antigo e o novo.
 *
 * O NOVO IMPORTA, e é onde tudo travou em 09/09/2026. A posição da Orca é um
 * NFT do Token-2022 (o programa novo), e nenhum nó público gratuito responde
 * essa pergunta: o publicnode devolve 403, o leorpc devolve erro interno, e os
 * outros oito que testei pedem chave ou estão fora. Só o nó oficial responde —
 * e é justamente o que recusa a Cloudflare.
 *
 * Por isso a função devolve o que FALHOU junto com o que achou. Sem isso a
 * importação diria "não achei posição nenhuma", que soa como "você não tem" —
 * quando na verdade é "não consegui perguntar". São coisas diferentes e ele
 * precisa saber qual das duas aconteceu. */
/* O mint do SOL embrulhado. Serve de chave para o SOL nativo também, e isso é
 * de propósito — veja a explicação em `tokensDaCarteira`. */
export const MINT_DO_SOL = "So11111111111111111111111111111111111111112";

export async function tokensDaCarteira(dono, nos = NOS) {
  const fora = [];
  const falhou = [];

  /* O SOL NATIVO, QUE NÃO É UMA CONTA DE TOKEN — e por isso ficou invisível.
   *
   * Descoberto em 09/09/2026, e por um caminho que vale registrar. Ele entrou
   * numa pool da Orca com auto-swap: mandou só USDC, a Orca converteu parte em
   * SOL, e sobraram 0,005306 SOL de troco na carteira. Fui atrás de US$ 0,55
   * que não tinham chegado na posição e achei um buraco muito maior — a
   * carteira dele tinha 0,159385 SOL, US$ 16,50, que o radar nunca contou.
   *
   * A causa: `getTokenAccountsByOwner` devolve contas de token, e o SOL nativo
   * não é uma. É o saldo da própria conta, e pede outra pergunta.
   *
   * Vai com o MINT DO SOL EMBRULHADO como chave, somando com ele se houver.
   * Economicamente são o mesmo ativo, e quem olha a carteira quer saber quanto
   * tem de SOL — não quantos formatos de SOL tem.
   *
   * Falhar aqui entra em `falhou` como qualquer outro: saldo que não deu pra
   * ler não pode virar zero, senão a linha dele some sozinha. */
  try {
    const r = await pedir("getBalance", [dono], nos);
    const lamports = Number(r?.value);
    if (Number.isFinite(lamports) && lamports > 0) {
      fora.push({ mint: MINT_DO_SOL, quantidade: lamports / 1e9, casas: 9 });
    }
  } catch {
    falhou.push("SOL nativo");
  }
  const programas = [
    { id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", nome: "token comum" },
    { id: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", nome: "Token-2022" },
  ];
  for (const programa of programas) {
    try {
      const r = await pedir("getTokenAccountsByOwner",
        [dono, { programId: programa.id }, { encoding: "jsonParsed" }], nos);
      for (const c of (r?.value || [])) {
        const i = c?.account?.data?.parsed?.info;
        if (!i?.mint) continue;
        fora.push({
          mint: i.mint,
          quantidade: Number(i.tokenAmount?.uiAmount) || 0,
          casas: Number(i.tokenAmount?.decimals) || 0,
        });
      }
    } catch {
      falhou.push(programa.nome);
    }
  }
  return { tokens: fora, falhou };
}

function deBase64(texto) {
  const bruto = atob(texto);
  const fora = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) fora[i] = bruto.charCodeAt(i);
  return fora;
}

async function pedir(metodo, params, nos = NOS) {
  let ultimoErro = null;
  for (const no of nos) {
    try {
      const r = await fetch(no, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Nó público sem user-agent costuma ser tratado como robô.
          "user-agent": "radar-defi (painel pessoal)",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: metodo, params }),
      });
      if (!r.ok) { ultimoErro = new Error("o nó respondeu " + r.status); continue; }
      const d = await r.json();
      if (d?.error) { ultimoErro = new Error(d.error?.message || "pedido recusado"); continue; }
      return d?.result;
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro || new Error("nenhum nó da Solana respondeu");
}

/* Os bytes de várias contas, numa ida só. Devolve um mapa endereço -> bytes;
 * endereço que não existe simplesmente não aparece, e quem chamou decide o que
 * dizer sobre isso. */
export async function contasEmLote(enderecos, nos = NOS) {
  const lista = [...new Set((enderecos || []).filter(Boolean))];
  const fora = new Map();
  if (!lista.length) return fora;

  /* O nó aceita 100 por chamada. Na prática ele nunca vai ter tanto, mas o
     laço evita que uma carteira grande devolva erro em vez de resposta. */
  for (let i = 0; i < lista.length; i += 100) {
    const fatia = lista.slice(i, i + 100);
    const r = await pedir("getMultipleAccounts", [fatia, { encoding: "base64" }], nos);
    (r?.value || []).forEach((conta, j) => {
      if (conta?.data?.[0]) fora.set(fatia[j], { dono: conta.owner, bytes: deBase64(conta.data[0]) });
    });
  }
  return fora;
}

/* Quantas casas decimais tem cada token. O que já se sabe não vira pedido. */
export async function casasDosTokens(mints, nos = NOS) {
  const fora = new Map();
  const faltando = [];
  for (const m of [...new Set((mints || []).filter(Boolean))]) {
    if (CASAS_CONHECIDAS[m] != null) fora.set(m, CASAS_CONHECIDAS[m]);
    else faltando.push(m);
  }
  if (!faltando.length) return fora;

  const r = await pedir("getMultipleAccounts", [faltando, { encoding: "jsonParsed" }], nos);
  (r?.value || []).forEach((conta, j) => {
    const casas = conta?.data?.parsed?.info?.decimals;
    if (Number.isInteger(casas)) fora.set(faltando[j], casas);
  });
  return fora;
}
