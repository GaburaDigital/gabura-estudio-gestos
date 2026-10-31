# Testes automáticos (computador)

Rodam a página no Chrome sem janela (Playwright), sem óculos: os gestos do "Quest" são gerados por
`gestos_sinteticos.js` (cabeça e mãos a 72 quadros por segundo, com pessoas de alturas, lugares, direções e
velocidades diferentes). O servidor liga sozinho e desliga no fim, mesmo se um teste falhar.

```bash
pip install playwright && python3 -m playwright install chromium
python3 testes/rodar_todos.py
```

| Arquivo | O que confere |
|---|---|
| `teste_estudio.py` | exemplo; arquivos ruins; versão 1 convertida; gravar 5 vezes cada gesto; reconhecer outra pessoa e com a outra mão; engatilhar e liberar; movimentos à toa não disparam; carga por ciclos (mínimo, máximo, níveis), preparação que precisa segurar a pose, soco curto que não vale, liberações alternativas, gravado com a direita e testado com a esquerda; biblioteca de preparações e ajustes guardados; exportar e importar; guardar no navegador; teclado e mouse; menu do Quest (analógico, A, B, segurar Y); palma muda de cor com A; dedos no lugar; direção dos poderes |
