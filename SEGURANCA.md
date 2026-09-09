# Onde os dados moram, e o que os protege

> Escrito para a instância original e mantido junto com o código: toda camada
> nova de proteção entra aqui, toda camada removida sai. Uma lista de segurança
> desatualizada promete proteção que não existe.

Pedido dele em 09/09/2026: *"escreva e guarde bem esse tipo de informação, as
de segurança — você também pode esquecer, precisa de um arquivo atualizado:
quais são as ferramentas de segurança que usamos para não perder dados"*.

Está certo. Este arquivo é a resposta, e é para ser lido por ele sem depender
de mim. **Ao mexer em qualquer camada abaixo, atualizar aqui.**

---

## As duas bases, e por que são duas

| | onde | o que tem | quem pode ler |
|---|---|---|---|
| **Mercado** | Cloudflare D1 | fotos das redes, pools, tokens, ciclo | qualquer um — a página é pública |
| **Carteira** | Supabase | lançamentos, aportes, preço médio, posições | **só ele**, com a senha dele |

A separação é a primeira camada de segurança e não é detalhe de arquitetura:
**o painel é uma página pública**. Se o patrimônio dele estivesse no D1, estaria
a um endereço de distância de qualquer pessoa. Por isso nada pessoal entra no
D1 — nunca.

O esquema das duas está no repositório: `schema.sql` (mercado) e
`supabase/migracoes/todas.sql` (carteira). Sem dado nenhum, só a forma.

## Quem consegue ler a carteira

**Só ele.** As tabelas da Supabase têm RLS (row level security) ligado, e a
regra de cada uma é a mesma: `user_id = auth.uid()`. Sem o login dele, a
consulta devolve lista vazia — não erro, vazia. Já conferido na prática:
`/rest/v1/movimento` sem sessão responde `[]`.

**A exceção, e ela precisa estar escrita:** o bot roda às 8h, 12h e 18h, quando
não há ninguém logado. Para ler as posições e mandar aviso, ele usa a **chave de
serviço**, que passa por cima do RLS. Três cuidados a mantê-la honesta:

1. Vive num segredo da Cloudflare (`SUPABASE_SERVICE_KEY`), posto pelo teclado
   dele. Nunca no código, nunca comigo.
2. Nunca chega ao navegador — nenhuma rota do painel a usa.
3. As leituras são estreitas de propósito (`src/supabase.js`): só as colunas que
   o vigia precisa. Chave que abre tudo não é motivo pra ler tudo.

## O que sai do navegador dele

O painel é uma página pública, e vale escrever o que ele manda pro servidor —
porque a resposta é curta e a tentação de crescer é permanente.

| endereço | o que vai | tem dado dele? |
|---|---|---|
| `/api/precos` | símbolos de token (`BTC`, `SOL`) | não — quantidade nenhuma |
| `/api/chao` | nomes de rede e protocolo (`Solana`, `Orca`) | não |
| `/api/posicao`, `/api/saldos` | o endereço público da carteira | público por natureza |
| Supabase | tudo o mais, atrás do login dele | sim, e só ele lê |

**A regra:** o que o radar precisa saber pra responder é sempre o NOME de uma
coisa pública, nunca o quanto ele tem dela. Quando `/api/chao` foi escrito, a
saída fácil era mandar as linhas da carteira e deixar o servidor decidir quais
redes buscar. Mandar dois nomes de rede custa a mesma coisa e não cria um lugar
novo onde o patrimônio dele passe.

## Os segredos, e a regra que nunca mudou

Nenhum deles passou por mim. Todos foram digitados por ele direto na Cloudflare.

| segredo | pra quê |
|---|---|
| `TELEGRAM_TOKEN` | falar no bot |
| `GATILHO` | a palavra secreta que vira endereço do webhook |
| `SOLANA_RPC` | a chave da Helius, que lê as posições |
| `SUPABASE_SERVICE_KEY` | o bot ler a carteira às 3h da manhã |

**A carteira Solana dele é só o endereço público.** Endereço não move dinheiro:
com ele dá para ler saldo e posição, e mais nada. Frase-semente e chave privada
nunca entram aqui, nunca são pedidas, e se algum dia forem — não fui eu.

## As camadas contra perder dado

**1. O salvamento é uma transação só.**
`salvar_alocacao` apaga e reinsere dentro de uma função do banco. Em 08/09/2026
isso aconteceu em dois pedidos separados: o apagar passou, o gravar falhou, e os
lançamentos dele sumiram. Hoje, se qualquer coisa quebra no meio, o apagar volta
atrás junto.

**2. Cópia de segurança a cada salvamento.**
Uma foto da carteira inteira (linhas, alvos e lançamentos) antes de cada
gravação. Sobrevivem **as 30 mais recentes** e **a última de cada dia dos
últimos 180** — a segunda regra existe porque uma tarde de edição gastava as 30
e apagava o histórico da semana.

**3. Cópia local no aparelho.**
`localStorage`, gravada a cada leitura e a cada salvamento que deu certo. Só
oferece restaurar se a carteira vier vazia — carteira que se repovoa sozinha é
assustadora. É por aparelho: a do celular não é a do computador.

**4. Lançamento nunca é apagado.**
Aporte, saque e colheita não somem quando a linha some — ficam órfãos e
reaparecem na tela pra ele religar em qualquer linha. Já salvou o histórico
dele duas vezes em 08/09.

**5. Apagar pede confirmação.**
Linha, lançamento e descarte de alterações: todos em dois toques, e o segundo
diz o que está em jogo ("apagar mesmo? 14 lançamentos").

**6. Aviso do que não foi salvo.**
Faixa grudada no alto enquanto houver alteração pendente. Ignora de propósito o
que muda sozinho (as quantidades que seguem a carteira), senão viraria ruído.

**7. A última leitura boa.**
Se o nó da Solana cair, a linha mostra o último valor lido, marcado como velho,
em vez de sumir. Falha de rede não pode parecer perda de dinheiro. E o bot
avisa, com a frase que importa: *"Nada foi perdido — eu é que estou sem
enxergar"*.

**8. Cópia diária no Telegram, sozinha.**
Toda manhã, na mesma rodada em que o bot mede o ciclo, ele monta o retrato da
carteira inteira e manda como arquivo (`carteira-AAAA-MM-DD.json`) na conversa
dele. **Só manda se mudou** — compara a impressão digital do conteúdo sem a
data, senão um arquivo idêntico por dia viraria exatamente o lugar onde ele
para de procurar quando precisar.

Ele também pode pedir a qualquer hora: **`/copia`** no bot. O pedido à mão
sempre manda, mesmo sem mudança.

É a camada que não depende de ele lembrar de nada, e a única que já está no
celular dele antes de o problema acontecer. O conteúdo é o mesmo do Drive:
linhas, alvos, todos os lançamentos, o último tamanho das posições e o histórico
do vigia. Sem senha, sem chave privada, sem frase-semente.

Conferir sem consumir nada: `/saude/copia` — diz quantas carteiras, quantos
lançamentos, quantos bytes, se mudou desde a última, e quando foi a última.

**9. Cópia no Drive dele, fora da Supabase — automática.**
Pasta **"Radar DeFi — cópias da carteira"**, na conta Google dele. Um arquivo
por dia (`carteira-AAAA-MM-DD.json`) com as linhas, todos os lançamentos, os
alvos, o último tamanho das posições e o histórico do vigia — o bastante pra
reconstruir tudo do zero. Sem senha, sem chave privada, sem frase-semente.

**Grava sozinha quando ele abre a carteira**, e só se alguma coisa mudou desde a
última. O botão no rodapé força a cópia a qualquer momento.

É a única camada que sobrevive à Supabase sumir. E é dele: se ele quiser sair do
radar, leva embora — o arquivo já está na conta dele.

Três decisões que sustentam esta camada, e que não são detalhe:

- **Escopo `drive.file`, não `drive`.** O app só enxerga os arquivos que ele
  mesmo criou. O resto do Drive dele é invisível — e isso não é promessa nossa,
  é o Google que recusa.
- **O token do Google nunca vai pro `localStorage`.** Vive só na memória da
  página e some quando ele fecha a aba. A sessão da Supabase mora em disco
  porque sem ela o app não abre; o do Drive não tem essa desculpa.
- **Ele pode cortar o acesso sozinho**, em `myaccount.google.com/permissions`,
  sem pedir nada a ninguém.

> **O que ainda depende dele:** a cópia acontece quando ele ABRE o painel. Se
> ficar um mês sem abrir, o Drive fica um mês parado — e é a camada 8 (Telegram,
> que roda sozinha na nuvem) que cobre esse buraco. As duas juntas cobrem os dois
> jeitos de falhar; nenhuma das duas cobre sozinha.

## O que ainda NÃO existe

- **O app está em modo "Testando" no Google.** Só as contas na lista de
  usuários de teste conseguem ligar a cópia no Drive. Hoje há uma (a dele), e o
  limite é 100. Para outra pessoa usar, ou entra na lista, ou o app precisa
  passar pela verificação do Google.
- **A cópia no Drive só acontece com o painel aberto.** Ver a ressalva na
  camada 9.
- **Aviso de que a chave da Helius está para expirar.** Só se descobre quando
  para de funcionar — e aí a defesa é a última leitura boa (camada 7), que
  segura a tela mas não resolve.
- **Nada protege contra ele perder a senha da Supabase.** Não há recuperação
  além do e-mail dele.

## A escolha que decide tudo isso

Discutida com ele em 09/09/2026, e vale ficar escrita porque volta sempre:

> **Aviso com o app fechado** → alguma coisa precisa guardar uma chave dos
> dados dele.
> **Ninguém guarda nada dele** → sem aviso; só quando ele abrir o app.

Não dá pra ter os dois. A ideia de pôr o banco no Drive de cada pessoa **não
resolve** isso — só troca a chave da Supabase por um token do Google, que é
mais grosso e abre mais coisa. Por isso o Drive entra como **cópia**, não como
base.

## Ao mexer aqui

Toda camada nova entra nesta lista. Toda camada que sair, sai daqui também —
uma lista de segurança desatualizada é pior que nenhuma, porque promete
proteção que não existe mais.
