# Radar DeFi

Um painel e um bot de Telegram que respondem uma pergunta só: **onde vale pôr
dinheiro pra render, e o que há de estranho em cada opção.**

Dados do [DefiLlama](https://defillama.com), de graça. Roda na Cloudflare no
plano gratuito, acorda sozinho três vezes por dia, não depende de nenhum
computador ligado. Cada pessoa sobe a **sua** instância, com o seu banco, o seu
bot e a sua carteira — nada é compartilhado, nada passa por servidor de
terceiros. Como instalar a sua: **[INSTALAR.md](INSTALAR.md)**.

O método por trás das telas é o **B.A.R.C.A.** e o vocabulário dos Portais do
curso do Defiverso — as tabelas abaixo dizem, palavra por palavra, o que veio
do curso e o que é invenção desta ferramenta.

> Isto mostra para onde o dinheiro está indo e nomeia o que investigar. **Não é
> recomendação de investimento** e não escolhe nada por você. Nenhuma frase do
> radar manda fazer nada — há um teste automático que reprova qualquer mensagem
> com verbo de ordem, e ele é um dos que rodam antes de toda publicação.

---

## A ideia central: o chão, não o cartaz

Todo site de DeFi mostra o **APY anunciado**. É o melhor caso, e some quando você
precisa dele. Medindo 43 pools grandes em 05/09/2026:

| pool | anuncia | garante (chão) | some |
|---|---|---|---|
| uniswap-v3/WETH-USDC | 74,0% | **7,9%** | 66 pontos |
| orca-dex/SOL-USDC | 65,8% | **22,5%** | 43 pontos |
| raydium-amm/WSOL-USDC | 74,8% | **31,9%** | 43 pontos |

Ordenar pelo cartaz e ordenar pelo chão dão listas quase disjuntas: **3 nomes em
comum de 8**. Quem escolhe pool pelo APY anunciado está escolhendo por um número
que a pool não se comprometeu a pagar.

**Chão** = o rendimento que a pool superou em 9 de cada 10 dias dos últimos 30.
É o que dá pra contar. É por ele que o radar ordena tudo.

---

## As quatro caixas de pool

Pools não competem todas na mesma lista. Elas se dividem por **comportamento**,
porque é o comportamento que muda a decisão:

**🟢 Firme — vive de TAXAS** — paga parecido todo dia, e o dinheiro vem de quem
negocia. Taxa é a métrica que o Guia 3 do Predador chama de *"menos fraudável"*.

**🟡 Incentivada — vive de INCENTIVO** — também paga regular, mas com token que
o protocolo imprime. *"Entre cedo quando os incentivos começarem, saia antes que
terminem"* — e eles terminam sem aviso. Pode ser ótima; só não é permanente.

**🔴 Loteria** — o número grande é média de dias muito bons com dias muito
ruins. Ordenadas pelo tamanho da promessa que não se cumpre.

**🆕 Nova** — montada nos últimos 21 dias. É onde estão construindo agora, mas
ainda não pagou o suficiente pra se saber o que paga. Nunca é classificada como
firme, por melhor que pareça: chão bonito em 5 dias de vida é coincidência.

Cada linha traz os quatro números que importam — **cartaz · chão · pior dia ·
incentivos** — a frase que os liga, e um **link que leva até a pool**: a página
dela no DefiLlama, que reúne o gráfico, a rede, o protocolo, os dois tokens do
par, o explorer e um botão pra tela de adicionar liquidez naquela pool. Dizer
onde a pool está não é o mesmo que levar até lá.

### As palavras

O radar usa o vocabulário do curso onde o curso tem palavra, e diz quando a
palavra é invenção nossa:

| palavra | o que é | de onde vem |
|---|---|---|
| **taxas** | rendimento que vem de quem negocia | Guia 3 do Predador: *"Taxas/fees = Token holders, LPs, Dapp, «menos fraudável»"* |
| **incentivos** | token que o protocolo imprime pra atrair | Guia 3: *"Incentivos/Earnings"* |
| **cartaz** | o APY anunciado | nosso — mas a ideia é do curso: *"o número que você vê hoje é uma fotografia do momento, não um contrato"* (APR vs APY) |
| **chão** | o que pagou em 9 de cada 10 dias | **nosso** — mas a ideia é dele: *"esse yield pode ser um pouco ilusório, porque ele está pegando o que está acontecendo agora"* (aula "Como Escolher uma Pool") |
| **faixa** | quanto a pool cobra por troca | o campo `poolMeta` do DefiLlama; a aula manda olhar: *"Atenção a isso. Se você está vendo uma pool no swap que está com 0.05%, não"* |

`Real Yield` do Portal 5 fica reservado ao que ele significa lá (rendimento que
vem de receita) e não é reaproveitado pro chão — palavra conhecida com sentido
trocado confunde mais que palavra nova.

---

## A faixa que estava invisível

Até 06/09/2026 o radar só guardava histórico de pools acima de **$2M**. Sem
histórico não há medida, e sem medida a pool não chega à tela: das **239** que
passavam nos portões do método, só **73** apareciam. As outras 166 sumiam
caladas.

E não eram 166 quaisquer. A REGRA DO 3 do Módulo 8 é *"TVL baixo, volume
alto"* — a faixa de **$500k a $2M** é exatamente onde o método manda olhar. O
radar estava cego no lugar pra que foi feito.

O corte do histórico passou a ser o mesmo dos portões ($500k). Resultado
imediato: **236 pools** na tela em vez de 73, e a correlação dos pares voláteis
saltou de 24 para **85 medidas**.

O que apareceu ali, porém, não é uma lista de achados: das 236, **184 são
loteria** — cartaz grande, chão baixo. A faixa pequena é mesmo onde o método
olha, e é mesmo onde a maioria não sustenta o número que anuncia. O radar agora
mostra as duas coisas em vez de esconder as duas.

---

## O mesmo par, redes diferentes

Na aula "Pools na prática", o Lucas quer montar ETH-USDC e abre uma aba de
navegador por rede, anotando o multiplicador de cada uma:

> *"Ethereum está me dando 12,44. Vamos na Base — está em 3. Vamos na Polygon —
> esquece. Unichain — 6. Arbitrum — 10,92."*

O radar já tem todas essas pools no mesmo banco, então isso é uma consulta.
Medido em 07/09/2026, **ETH-USDC existe em 6 redes e 6 protocolos**, e vai de
`0,053%/dia` a `0,447%/dia` — **8,5x de diferença no mesmo par**.

A tela ordena pelo **espalhamento** (quantas vezes o melhor lugar paga mais que
o pior), e não pelo rendimento: a pergunta aqui não é qual par rende mais, e sim
onde se estaria deixando dinheiro na mesa por abrir no lugar errado.

`ETH-USDC` e `USDC-ETH` são o mesmo par, e `WETH` é `ETH`. Sem isso a comparação
se parte justamente nos pares mais comuns. Stablecoins **não** se fundem entre
si: USDC e USDT têm emissores diferentes, e juntá-los esconderia uma escolha.

### A regra que eu não teria adivinhado

> *"Se você tem pouco capital, faz mais sentido você vir para a Arbitrum. Um,
> taxas de montagem mais baratas. Dois, o TVL é consideravelmente menor — a
> representação do capital sobre 1,9 milhão te dá participação maior do TVL, e
> a participação nas taxas acompanha."*

Quando o topo está **empatado** (dentro de 20%) e o TVL difere **3x ou mais**, o
radar anota que o lugar de TVL menor tende a render mais para pouco capital.
Anota — não reordena. O método ordena pelo multiplicador, e mudar a ordem seria
decidir por ele.

```
/par ETH-USDC     onde esse par paga mais, no Telegram
```

---

## Os dois multiplicadores

O curso ensina duas contas com o mesmo nome, e diz qual presta:

**Volume ÷ TVL** — é o que a Uniswap mostra na coluna "volume por TVL", e é o que
a ferramenta POOLS Defiverso (a base do Notion do curso) calcula. Serve, mas
ignora quanto a pool cobra por troca.

**Taxas 24h ÷ TVL** — *"esse é o pulo do gato"*, nas palavras da aula. É o que o
radar usa, e vem do `apyBase` (que é a mesma coisa reescalada: `apyBase ÷ 365`).

A diferença entre os dois é exatamente a **faixa de taxa**. Conferido contra 14
pools reais em 07/09/2026:

```
giro (volume ÷ TVL)  ×  faixa  =  taxas ÷ TVL ao dia  =  apyBase ÷ 365
```

Bateu exato em 11 das 14. As três que fugiram são todas `aerodrome-slipstream`,
que cobra taxa dinâmica — a faixa declarada não é a que foi cobrada no dia.

Por isso duas pools com o mesmo volume, uma cobrando 0,05% e outra 0,30%, pagam
**seis vezes diferente** — e só o segundo multiplicador enxerga isso.

---

## As redes, separadas por porte

Ethereum caindo 3% e uma rede de $8M subindo 300% não são o mesmo tipo de
evento. Então são duas telas, e cada uma só compara com ela mesma:

**🐋 Redes grandes** (as 10 maiores) — corte de **5%**, porque mexer 5% numa
rede de bilhões são centenas de milhões trocando de lugar.

**🌱 Pequenas e novas** — corte de **25%** e no mínimo $2M de movimento, porque
é aqui que porcentagem engana.

As duas com subida **e** queda, ordenadas pelo **dinheiro movido**, não pela
porcentagem: numa caixa onde todos já passaram do corte percentual, o que separa
é quanto de fato se moveu.

---

## O que cada frase sabe dizer

- **dinheiro de verdade x preço** — TVL sobe sozinho quando o token da rede
  valoriza. O radar cruza com o estoque de stablecoin, que não valoriza.
- **evento x tendência** — quando os 4 períodos (24h/7d/1M/3M) são quase iguais,
  a rede ficou parada e saltou ontem. Um depósito, talvez.
- **recuperação x crescimento** — sobe na semana mas negativa no trimestre.
- **crescimento alugado** — quanto do rendimento da rede é token emitido.

---

## A conta, e a carteira

O painel do radar é **público** — qualquer um com o link vê o mercado, e tudo
bem, porque mercado é informação pública. Deixa de estar tudo bem no minuto em
que a carteira de alguém entra ali.

Por isso a aba **💼 Carteira** é a única parte com login, e os dados dela **não
ficam no D1**: ficam no **Supabase** (projeto `btc-monitor`, que já tinha Auth e
RLS ligados). A razão é técnica, não estética — o D1 não tem noção de "quem está
pedindo", e o Supabase sim.

O escopo é do **banco**, não do app: as policies de RLS barram a leitura da
carteira de outra pessoa mesmo que a página tenha um bug. Conferido — sem
sessão, as tabelas devolvem `[]` mesmo tendo linhas dentro. É o mesmo desenho
que separa as contas no Caderno de Entregas.

**Lançada em valor, lida em porcentagem.** Ele escreve quanto tem em cada fatia
— *"não vou saber a porcentagem do meu portfólio"* — e a proporção é conta do
radar. Pedir que a pessoa calcule a própria proporção é pedir que ela faça o
trabalho que a ferramenta existe pra fazer.

O botão **R$ / US$** é o modo de lançamento, não só de leitura: trocar converte
**as linhas também**, pra ele lançar na moeda em que está olhando — real quando
confere a reserva, dólar quando confere as stablecoins.

O que a troca **não** faz é mudar em que moeda a fatia está guardada. Um BTC
lançado em dólar continua em dólar; congelar o valor de hoje em real deixaria o
número errado amanhã, e errado em silêncio. Linha convertida mostra o original
embaixo (*"lançado em US$ 3.000,00"*).

E salvar depois de só trocar a moeda **não redenomina nada**: cada linha guarda
o que foi mostrado, e só conta como digitado o que difere disso. A cotação é
buscada uma vez por dia e guardada com o resto — duas fontes, porque a
brasileira não responde de dentro do Worker da Cloudflare.

> A objeção que eu tinha levantado contra guardar valor ("patrimônio num banco
> que serve página pública") valia pro **D1**, que é aberto. Não vale aqui:
> Supabase com RLS, conferido — sem sessão a tabela devolve `[]`.

O login não usa biblioteca: a API do Supabase é HTTP puro, e o painel inteiro
não tem uma única dependência externa. Um SDK de CDN só criaria um jeito novo de
a página quebrar.

> Multiusuário sai de graça desse desenho: quem criar conta já vê só o que é
> dele, pelo mesmo mecanismo.

---

## Suas pools — o que mudou no que você já tem

O resto do radar responde *"onde vale olhar"*. Isto responde outra pergunta, e é
a que envolve dinheiro que já está na mesa: **"o que mudou no que eu já tenho?"**

```
/entrei orca SOL-USDC    passa a acompanhar
/minhas                  o que mudou desde a entrada
/sai orca                para de acompanhar
```

Ao marcar, o radar guarda a **foto daquele dia** — chão, incentivo, tamanho,
correlação do par, classe, e se passava nos portões. É a única coisa do banco
que não dá pra remedir depois: daqui a dois meses não existe como saber qual era
o chão no dia em que você entrou se ninguém anotou naquele dia.

Depois disso ele avisa, uma vez por dia, quando:

- o **chão cai um terço** do que era na entrada
- o **incentivo acaba** (era ≥20% do rendimento, virou ≤5%) — o evento com prazo
  do método: *"saia antes que terminem"*
- o rendimento **vira incentivo** (passa de 60% tendo entrado abaixo disso)
- **metade do dinheiro sai** da pool
- os dois tokens do par **se soltam** (correlação era ≥0,80, caiu abaixo de 0,50)
- ela **deixa de passar** nos portões do método
- ela **muda de caixa**

Todo número aparece com o par dele — *"chão: 34,0% na entrada → 22,5% hoje"* —
porque "chão 22%" sozinho não diz nada a quem entrou quando era 34%.

> **Nenhuma frase daqui manda fazer nada.** Não há "saia", "venda" nem "aumente".
> O radar mostra o que mudou; a decisão é sua. Há uma conferência automática que
> falha se algum verbo de ordem entrar nesses textos.

Sobe também é avisado, não só desce: radar que só avisa de coisa ruim ensina a
temer a notificação.

---

## O Bitcoin — o eixo em que o resto se apoia

No método do Defiverso tudo aponta pro Bitcoin: ele define o **ciclo**, o ciclo
define a **meta mensal**, e a meta decide **quais pools passam na régua**. O
radar já buscava o preço dele todo dia pra isso — só que a leitura virava dois
números e sumia.

Agora tem corpo, no topo da tela de Hoje: o preço, a **média de 200 dias**
desenhada por cima, a **régua da faixa** (onde está entre o fundo e o topo da
janela) e há quantos dias está desse lado.

O gráfico é SVG escrito à mão. O painel não tem uma única dependência externa, e
um gráfico não é motivo pra criar a primeira. A série vai **guardada com a
leitura** (90 pontos, ~2 KB) — assim a página desenha sem buscar preço nenhum.

Quem entra na conta vê também os **alvos de preço** que guardou, com a distância
até cada um.

---

## B.A.R.C.A. — as cinco caixinhas

Transcrito da aula do Portal 7 em 08/09/2026. Antes disso o radar só tinha duas
migalhas soltas no código do POOLIANA e nenhuma das cinco letras.

| | | | slide |
|---|---|---|---|
| **B** | Base sólida | Bitcoin — preservação, comprado por DCA | 50% |
| **A** | Ativos voláteis | altcoins — a valorização exponencial | 20% |
| **R** | Renda passiva | pools, real yield, empréstimos | 15% |
| **C** | Caixa | stablecoins — bala na agulha pra queda | 10% |
| **A** | Aprender | airdrops — testar, interagir, errar | 5% |

A transcrição ouviu *"aprender 10%"*, o que somaria **105**. Adiante ele repete
três vezes *"esse 5%"* falando de airdrop — corrigido pela aritmética. E os 15%
de renda passiva batem com a única migalha que já existia: o POOLIANA chamava a
parcela de LP de *"o 15% BARCA"*.

**A divisão muda com o ciclo**, e o radar já sabe qual é:

| | bear | bull |
|---|---|---|
| Bitcoin | 60% | 35% |
| Altcoins | 5% | 35% |
| Renda passiva | 25% | 12% |
| Caixa | 10% | 13% |
| Aprender | 0% | 5% |

E a quantidade de ativos também: **2 a 3 em bear, 8 a 12 em bull**. Passando de
15 o risco *volta a subir* — por repetir setor, e porque ninguém acompanha 30
projetos.

### O alvo é seu, não dele

> *"Não é para você copiar, não é para você engessar o que está aqui. É ridículo
> eu querer fazer você seguir a mesma coisa que eu sigo. As alocações e as
> porcentagens **você** que vai definir."*

É a mesma recusa que ele faz sobre range. Então a referência é um **botão** que
se aperta, não um padrão que se impõe — e a coluna **alvo** é de quem usa.

### O rebalanceamento

> *"A tua carteira sempre vai te dizer o que você deve fazer."*

Quando uma fatia se afasta **5 pontos ou mais** do alvo que ele definiu, o radar
nomeia o par — uma sobrando, outra faltando, que é como a aula ensina. Cinco
pontos é o número do exemplo dela; abaixo disso é oscilação de preço, e mexer na
carteira por oscilação é pagar taxa pra ficar no mesmo lugar.

Há uma conferência automática que **falha se algum recado usar verbo de ordem**.

---

## O ciclo — bull ou bear, que decide a régua

O método do Defiverso muda de meta conforme o ciclo: **4-5% ao mês em bear,
20%+ em bull**. Só que o curso trata o ciclo como algo que o aluno já sabe — ele
nunca diz como determinar.

Então o radar não inventa a regra: ele mede **dois eixos** e mostra os dois.

**Preço** — o Bitcoin contra a própria média de 200 dias, com banda morta de ±5%.
**Capital** — o estoque mundial de stablecoin em 30 dias. Stablecoin não
valoriza: subir só acontece quando alguém depositou.

Os dois concordam, ou **não há veredito**. Uma fórmula que pondera os eixos e
sempre responde alguma coisa esconderia justamente o caso mais informativo —
06/09/2026, quando o preço tinha virado havia 19 dias e o capital não confirmava.

> O corte do capital é +4% em 30 dias, e não "positivo". Em 3 anos a mediana da
> variação de 30 dias é **+2,12%**: o estoque quase sempre cresce, então
> "positivo" não é sinal de nada. +4% é o percentil 75.

Quando os eixos discordam a meta usada é a de bear — entre errar a meta pra cima
e pra baixo, errar pra cima faz aceitar pool que não sustenta o número.

**Quem decide é você.** `/ciclo bull` no Telegram fixa, e a partir daí a medida
não sobrepõe — só avisa, se passar a discordar. `/ciclo auto` devolve pra medida.

---

## Como falar com ele

```
/minhas      as pools em que você já está
/entrei orca SOL-USDC · /sai orca
/radar       o panorama de agora
/ciclo       bull ou bear, e a meta que sai disso
/ciclo bull  fixa o ciclo · /ciclo auto volta pra medida
/pools       onde o dinheiro está rendendo, e quem paga
/pools Base  só nessa rede
/novas       pools montadas nos últimos 21 dias
/rede Base   a ficha completa de uma rede
/entrando /pequenas /saindo
/seguir Base · /parar Base · /seguindo
```

A barra é opcional. Ele fala sozinho às **8h** (o apanhado nas quatro caixas),
**12h** (só se estiver saindo dinheiro) e **18h** (o que mudou), mais o resumo de
segunda.

---

## Os arquivos

```
src/
  rendimento.js   o chão, a oscilação, o abismo, a classe  ← o miolo
  metodo.js       o método do Defiverso em código, cada regra citando a página
  ciclo.js        bull ou bear: os dois eixos, e o direito de não decidir
  carteira.js     o que mudou nas pools em que ele já está
  comparador.js   o mesmo par em toda parte, e onde ele paga mais
  cambio.js       o dólar em real, e a proporção da carteira
  barca.js        as cinco caixinhas, por ciclo, e o rebalanceamento
  correlacao.js   os dois tokens do par andam juntos?
  divisoes.js     as quatro caixas e a frase de cada linha
  sinais.js       o que merece um aviso (redes)
  qualidade.js    alugado, taxa por milhão, concentração
  llama.js        o que o DefiLlama nos conta
  narrativa.js    qual assunto está puxando capital
  telegram.js     como o radar escreve
  painel.js       a página
  index.js        o worker: relógio, rotas, Telegram
semear.js         histórico das REDES (roda uma vez)
semear-pools.js   histórico das POOLS (roda uma vez)
ensaiar.js        o que ele diria agora, sem mandar nada
testar-*.js       598 conferências, sem rede e sem banco
```

## Antes de mexer

```bash
npm run testar
```

598 conferências, sem rede e sem banco — passam igual a qualquer hora. Se ficar
vermelho, não publique. Para publicar já testando:

```bash
npm run publicar
```

## Montar do zero

1. `INSTALAR.md` — os passos de Cloudflare, banco e Telegram
2. `node semear.js` — histórico das redes (~13 min)
3. `node semear-pools.js --portoes` — histórico das pools que o método aceita (~5 min)
4. `/rodar/<GATILHO>?seco&medir` — calcula as medidas

Sem os passos 2 e 3 o radar nasce mudo: ele compara contra a própria série, e
uma foto só não se compara com nada.

---

## Limites honestos

- **Desbloqueio de token (unlock): não temos.** É endpoint pago do DefiLlama
  (`HTTP 402`). É o maior evento previsível de preço de um token, e falta.
- **Valor de mercado: só ~17% dos protocolos.** Avaliação (mcap/receita) só cobre
  esses.
- **O gráfico de pool é 1 chamada por pool e a API barra (429).** Por isso o
  histórico é semeado devagar, uma vez, e depois se mantém sozinho — cada rodada
  diária acrescenta o ponto do dia, que já vem na lista de pools.
- **Crescimento rápido em coisa pequena é o formato que golpe tem.** O radar
  mostra o movimento; ele não sabe distinguir oportunidade de armadilha.
- **A escrita no banco é maior do que parece.** Cada `INSERT OR REPLACE` conta
  **duas** escritas (apaga e insere), mais uma por índice. No plano grátis isso
  estourou o teto diário em 05 e 06/09/2026 e derrubou as rodadas das 12h e 18h.
  Resolvido com o plano pago em 06/09/2026, mas a conta continua valendo pra
  qualquer gravação nova.
- **Quando uma rodada quebra, o radar avisa no Telegram.** Não fica calado — e
  desde 06/09/2026 avisa em português, dizendo o que aconteceu e o que fazer,
  com o erro técnico no fim. Antes ele repassava o erro cru do sistema, que
  chegava em inglês e com link de documentação de desenvolvedor.

---

*Criado por **Rayakuza**. Licença [MIT](LICENSE) — use, mude, compartilhe; sem
garantia de nada, e sobre dinheiro cada decisão continua sendo sua.*
