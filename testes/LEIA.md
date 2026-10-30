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
| `teste_estudio.py` | abrir o exemplo; arquivos de ações ruins recusados; gravar 5 vezes cada parte no VR e recusar a sexta; achar o trecho com movimento; reconhecer cada gesto feito por outra pessoa e com a outra mão; engatilhar e liberar (e expirar); movimentos à toa não disparam; exportar e importar o zip; guardar no navegador; gravar e reconhecer teclado e mouse; o Quest simulado (A grava, Y testa); fotos do boneco |
