# Estúdio de Gestos · Gabura

**Link:** https://gaburadigital.github.io/gabura-estudio-gestos/

![QR code do link](docs/qrcode.png)

O Quest 3S não lê QR codes sozinho: o QR serve para abrir no celular ou com um app leitor de QR da loja do Quest.
Na primeira visita pelo navegador do Quest, **adicione aos favoritos ou instale como app** (menu ⋮ → Instalar).
Depois disso o Estúdio funciona sem internet.

Ferramenta genérica da Gabura Digital para **gravar, rever e testar gestos** de qualquer jogo ou experiência:

- **Gravar para VR (Meta Quest):** grava a cabeça, as duas mãos, gatilho, grip e botões.
- **Gravar para PC (teclado e mouse):** grava sequências de teclas, cliques, roda e movimentos do mouse
  (por exemplo, para adaptar um gesto do VR, fazer combos ou sequências de personagens).

As duas gravações são sempre separadas: grave no Quest e depois no PC.

## Como usar

1. Abra o Estúdio e clique em **Importar ações (.json)**. Esse arquivo lista o que precisa ser gravado.
   Ele vem do projeto do jogo. Para conhecer o Estúdio, clique em **Abrir o exemplo**.
2. Escolha **Gravar para VR** ou **Gravar para PC**.
3. Grave cada parte de cada ação (5 vezes, se o arquivo não disser outro número). Depois da contagem 3, 2, 1, o Estúdio grava pela duração da parte.
4. O boneco repete cada gravação. Escreva as **observações** de cada gesto (como ativar, condições especiais) e ajuste a **tolerância**.
5. Clique em **Testar** e faça os gestos: o Estúdio diz o que reconheceu e o boneco usa o poder.
6. **Exporte** um gesto, um bloco ou tudo em .zip e leve ao projeto do jogo.

Tudo fica guardado **no próprio navegador** (nada vai para a internet). Exporte para levar a outro aparelho ou
juntar o trabalho do Quest com o do PC: **Importar gestos (.zip)** junta as gravações de volta.

### No Quest (dentro do VR)

O painel fica à esquerda e o boneco à frente, imitando você como um espelho.

| Controle | O que faz |
|---|---|
| Analógico direito ↑ ↓ | escolhe a ação |
| Analógico direito ← → | escolhe a parte (por exemplo, engatilhar e liberar) |
| A | grava (contagem 3, 2, 1) |
| B | apaga a última gravação desta parte |
| X | revê as gravações desta parte no boneco |
| Y | liga e desliga o modo testar |

Durante a contagem e a gravação, todos os botões fazem parte do gesto. As observações e a tolerância se
editam na página (no Quest, antes de entrar no VR, ou no PC depois de importar o zip).

### No PC

Escolha **Gravar para PC**, clique em **Gravar** e, depois da contagem, faça a sequência. Os cliques e a roda
valem dentro da área do boneco; as teclas valem na página inteira (menos enquanto você digita nas observações).

### O boneco

O boneco é um humanoide cinza low-poly que serve para qualquer jogo. Com **Aparência do personagem**, ele usa a
aparência do arquivo de ações (altura, proporções, cores e acessórios), para ficar parecido com o personagem.
**Espelho** faz o boneco imitar como um espelho; sem espelho, ele repete como outra pessoa de frente para você.

## Para usar em outro projeto

Veja [CONFIGURACAO.md](CONFIGURACAO.md): como montar o arquivo de ações, a aparência do boneco, os efeitos do
modo testar e o que vem no zip exportado. O exemplo está em `public/configs/exemplo_basico.json`.

## Rodar no computador

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # monta em dist/
python3 testes/rodar_todos.py   # testes automáticos (veja testes/LEIA.md)
```

Para testar no Quest pelo computador: publique (o GitHub Actions monta e publica a cada push na `main`) ou use a
depuração remota (`chrome://inspect` com o Quest ligado por USB).

Publicação: commit e push pelo GitHub Desktop → aguarde a Action (aba Actions) → recarregue no Quest.
No GitHub: Settings → Pages → Source: **GitHub Actions**.

## Licença

Código sob a licença MIT (veja `LICENSE`). Os arquivos de ações, gravações e personagens dos projetos não fazem
parte deste repositório: cada projeto guarda os seus.
