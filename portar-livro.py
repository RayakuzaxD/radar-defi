# -*- coding: utf-8 -*-
"""Leva o livro-razao pro painel — a copia literal entre os marcadores.

    python portar-livro.py

Mesmo desenho do portar-patrimonio.py, e pela mesma razao: o navegador nao
importa modulo (receita 5.2), entao a classificacao vive duas vezes. O teste de
concordancia em testar-livro.js compara as duas caractere a caractere.
"""
import io, os

RAIZ = os.path.dirname(os.path.abspath(__file__))

mod = io.open(RAIZ + "/src/livro.js", encoding="utf-8").read()
ini = mod.index("export const NOVO")
copia = mod[ini:].replace("export ", "")
assert "\\" not in copia, "barra invertida quebraria o template literal"
copia = copia.replace("`", "'")
assert "${" not in copia, "interpolacao seria executada pelo servidor"

P = RAIZ + "/src/painel.js"
s = io.open(P, encoding="utf-8").read()

ABRE = "/* >>>>> COPIA LITERAL DE src/livro.js — NAO EDITE AQUI <<<<<"
FECHA = "/* >>>>> FIM DA COPIA DE src/livro.js <<<<< */"

if ABRE not in s:
    # primeira vez: entra logo antes da copia do patrimonio
    ancora = "/* >>>>> COPIA LITERAL DE src/patrimonio.js"
    assert s.count(ancora) == 1
    cabeca = (ABRE + "\n"
      " *\n"
      " * UM LUGAR SO DECIDE o que e lucro e o que e dinheiro andando. Esta copia\n"
      " * existe porque o navegador nao importa modulo, e o teste de concordancia\n"
      " * a compara com src/livro.js caractere a caractere.\n"
      " *\n"
      " * Pra mudar a regra, mude src/livro.js e rode portar-livro.py. */\n")
    s = s.replace(ancora, cabeca + copia + "\n" + FECHA + "\n\n" + ancora, 1)
else:
    i = s.index("*/", s.index(ABRE)) + 2
    f = s.index(FECHA)
    s = s[:i] + "\n" + copia + "\n" + s[f:]

io.open(P, "w", encoding="utf-8").write(s)
print("copia do livro atualizada:", len(copia), "caracteres")
