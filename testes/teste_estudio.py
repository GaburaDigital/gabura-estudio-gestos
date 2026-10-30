"""Testes do Estúdio de Gestos (Playwright + Chrome sem janela, sem óculos):
abrir o exemplo, conferir arquivos ruins, gravar gestos de mentira no "VR" e no PC, reconhecer no modo testar
(também com outra pessoa, outro tamanho, outra direção e com a outra mão), engatilhar e liberar, não reconhecer
movimentos à toa, exportar e importar o zip, guardar no navegador, o fluxo do Quest simulado (A grava, Y testa)
e fotos do boneco cinza e com a aparência de um personagem."""
import sys, os, json, time
from base import *

AQUI = os.path.dirname(os.path.abspath(__file__))
GESTOS = open(os.path.join(AQUI, 'gestos_sinteticos.js')).read()

AJUDA = """
window.__s = {
  T: 100,
  // alimenta o Estúdio com amostras (o relógio do teste anda junto)
  passar(amostras) { const e = window.__teste.estudio, ev = []; for (const a of amostras) { const b = { ...a, t: this.T }; ev.push(...e.quadroVR(b, this.T)); this.T += 1 / 72; } return ev; },
  parado(seg, op = {}) { const r = []; const base = __gestos.gerar('parado', op); for (let i = 0; i < seg * 72; i++) r.push(base[0]); return r; },
  async gravarVR(acao, parte, nome, op = {}) {
    const e = window.__teste.estudio; e.escolherPorId(acao, parte);
    if (!e.gravar(this.T)) return false;
    this.passar(this.parado(e.config.gravacao.contagem + 0.05, op));          // contagem
    const g = __gestos.gerar(nome, { ...op, t0: 0 }), dur = e.parte.duracao, antes = 0.3;
    this.passar(this.parado(antes, op));                                       // demora um pouco para começar
    this.passar(g.slice(0, Math.floor((dur - antes) * 72)));
    const resto = Math.max(0, dur - antes - g.length / 72) + 0.1; this.passar(this.parado(resto, op));
    e.tempo(this.T + 0.01); await new Promise((r) => setTimeout(r, 20));
    return true;
  },
};
"""

def S(pg, js): return pg.evaluate('async () => { const s = window.__s, t = window.__teste; ' + js + ' }')
erros_teste = []
def confere(nome, ok, info=''):
    print(('OK   ' if ok else 'FALHA') + ' ' + nome + (' · ' + str(info) if info != '' else ''))
    if not ok: erros_teste.append(nome)

with servidor(), sync_playwright() as p:
    b, pg, erros = abrir(p, 1400, 820)
    pg.goto(URL); pg.wait_for_function('() => window.__teste', timeout=60000)
    pg.evaluate('() => {' + GESTOS + AJUDA + '}')

    # 1) página sem projeto e o exemplo
    vazio = pg.inner_text('#detalhe')
    pg.click('#btExemplo')
    ate(pg, "return document.querySelectorAll('#lista .item').length === 4", 8)
    confere('abre o exemplo (4 ações em 2 blocos)', 'Importe' in vazio or 'Import' in vazio, pg.evaluate("() => [...document.querySelectorAll('#lista h3')].map((h) => h.innerText)"))
    pg.screenshot(path=F + '01_exemplo.png')

    # 2) arquivos ruins são recusados com uma mensagem (nada é executado)
    r = S(pg, """const ruins = [
        { versao_formato: 2, projeto: 'x', blocos: [] },
        { versao_formato: 1, projeto: 'Com Espaço', blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'b', nome: 'B' }] }] },
        { versao_formato: 1, projeto: 'x', blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'b', nome: 'B', efeito: { cor: 'red' } }] }] },
        { versao_formato: 1, projeto: 'x', blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'b', nome: 'B' }, { id: 'b', nome: 'C' }] }] },
        { versao_formato: 1, projeto: 'x', blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'b', nome: 'B', tipo: 'alert(1)' }] }] } ];
      const msgs = []; for (const c of ruins) { try { await t.abrirConfig(c); msgs.push('aceitou'); } catch (e) { msgs.push(e.message); } }
      return { msgs, projeto: t.estudio.config.projeto };""")
    confere('arquivos ruins recusados e o projeto continua o mesmo', all(m != 'aceitou' for m in r['msgs']) and r['projeto'] == 'exemplo_basico', r)

    # 3) gravar 5 vezes cada parte no "VR", com pequenas diferenças
    r = S(pg, """const plano = [['acenar', 'gesto', 'aceno'], ['palmas', 'gesto', 'palma'], ['bracos_para_cima', 'gesto', 'bracos_cima'],
        ['bola_de_energia', 'engatilhar', 'engatilhar'], ['bola_de_energia', 'liberar', 'liberar']];
      __gestos.semear(3); const ok = [];
      for (const [acao, parte, nome] of plano) for (let i = 0; i < 5; i++)
        ok.push(await s.gravarVR(acao, parte, nome, { velocidade: 0.85 + i * 0.07, x: i * 0.1, z: -i * 0.05, yaw: (i - 2) * 0.1, altura: 1.55 + i * 0.03 }));
      const e = t.estudio; const extra = e.gravar(s.T); // a sexta não cabe
      const g = e.gravacoes.find((x) => x.acao === 'acenar');
      return { gravou: ok.filter(Boolean).length, total: e.gravacoes.length, extra, aviso: e.aviso && e.aviso.chave, quadros: g.quadros.length, trecho: [g.inicio, g.fim], altura: g.altura_olhos };""")
    confere('grava 5 vezes cada parte (25 gravações) e recusa a sexta', r['gravou'] == 25 and r['total'] == 25 and r['extra'] is False and r['aviso'] == 'cheio', r)
    confere('acha o trecho com movimento e a altura dos olhos', 0.1 < r['trecho'][0] < 0.35 and r['trecho'][1] - r['trecho'][0] > 1.2 and 1.5 < r['altura'] < 1.6, r)
    time.sleep(0.5)
    confere('a lista mostra 5/5', pg.evaluate("() => document.querySelectorAll('#lista .ponto.cheio').length") == 5)

    # 4) modo testar: cada gesto, feito por "outra pessoa" (outra altura, lugar, direção e velocidade), é reconhecido
    r = S(pg, """const e = t.estudio; e.alternarTeste(1.75); __gestos.semear(99);
      const op = { altura: 1.75, x: 0.7, z: 0.4, yaw: 0.6, velocidade: 1.12, tremido: 0.015 };
      const testar = (nome, o = op) => { s.passar(s.parado(1.2, o)); const ev = s.passar(__gestos.gerar(nome, o)); ev.push(...s.passar(s.parado(1.0, o))); return ev.filter((x) => x.tipo === 'disparou').map((x) => x.acao); };
      const r = { aceno: testar('aceno'), palma: testar('palma'), bracos_cima: testar('bracos_cima'),
        acenoOutraMao: testar('aceno', { ...op, espelhar: true }),
        liberarSozinho: testar('empurrar'), engatilharLiberar: (() => { const a = testar('engatilhar'); const b = testar('liberar'); return [a, b]; })(),
        andar: testar('andar'), coçar: testar('coçar'), soco: testar('soco'), parado: testar('parado') };
      const med = {}; for (const [k, v] of e.reconhecedor.medidas) med[k] = +v.limite.toFixed(3);
      r.limites = med; r.coçarMed = {}; return r;""")
    confere('reconhece o aceno de outra pessoa', r['aceno'] == ['acenar'], r['aceno'])
    confere('reconhece as palmas', r['palma'] == ['palmas'], r['palma'])
    confere('reconhece os braços para cima', r['bracos_cima'] == ['bracos_para_cima'], r['bracos_cima'])
    confere('reconhece o aceno com a outra mão (uma mão = qualquer lado)', r['acenoOutraMao'] == ['acenar'], r['acenoOutraMao'])
    confere('empurrar as mãos sem engatilhar não dispara', r['liberarSozinho'] == [], r['liberarSozinho'])
    confere('engatilhar e depois liberar dispara a bola de energia', r['engatilharLiberar'] == [[], ['bola_de_energia']], r['engatilharLiberar'])
    confere('andar, coçar a cabeça, um soco e ficar parado não disparam nada', r['andar'] == [] and r['coçar'] == [] and r['soco'] == [] and r['parado'] == [], {k: r[k] for k in ['andar', 'coçar', 'soco', 'parado']})
    print('    limites:', r['limites'])

    # 5) engatilhado expira depois do tempo máximo
    r = S(pg, """const op = { altura: 1.6 }; s.passar(s.parado(1.2, op)); const a = s.passar(__gestos.gerar('engatilhar', op));
      s.passar(s.parado(0.6, op)); const eng = t.estudio.reconhecedor.engatilhadas(); const b = s.passar(s.parado(6, op));
      return { eng, expirou: b.filter((x) => x.tipo === 'expirou').map((x) => x.acao), depois: t.estudio.reconhecedor.engatilhadas() };""")
    confere('engatilhado aparece e expira depois de 5 s', r['eng'] == ['bola_de_energia'] and r['expirou'] == ['bola_de_energia'] and r['depois'] == [], r)
    S(pg, "t.estudio.alternarTeste();")

    # 6) observações, tolerância, exportar e importar
    r = S(pg, """const e = t.estudio; await e.salvarNotas('palmas', { observacoes: 'Só vale com as duas mãos abertas.', tolerancia: 1.3 });
      const zip = t.exportar({ tipo: 'tudo' }), umGesto = t.exportar({ tipo: 'acao', acao: 'palmas' }), bloco = t.exportar({ tipo: 'bloco', bloco: 'poderes' });
      return { tam: zip.length, um: umGesto.length, bloco: bloco.length, dados: Array.from(zip) };""")
    confere('exporta tudo, um gesto e um bloco', r['tam'] > r['um'] > 1000 and r['bloco'] > 1000, {k: r[k] for k in ['tam', 'um', 'bloco']})
    import zipfile, io
    z = zipfile.ZipFile(io.BytesIO(bytes(r['dados'])))
    nomes = z.namelist()
    acao = json.loads(z.read('acoes/palmas/acao.json'))
    confere('o zip tem configuração, observações e as gravações', 'configuracao.json' in nomes and 'estudio_gestos.json' in nomes and 'acoes/bola_de_energia/vr/liberar_5.json' in nomes
            and acao['observacoes'].startswith('Só vale') and acao['tolerancia'] == 1.3 and acao['partes'][0]['vr'] == 5, len(nomes))
    with open(F + 'gestos_exemplo_tudo.zip', 'wb') as f: f.write(bytes(r['dados']))
    r2 = S(pg, f"""const dados = {json.dumps(r['dados'])};
      // apaga uma gravação e importa de novo: volta a ter tudo
      const e = t.estudio; await e.apagar({{ modo: 'vr', acao: 'acenar', parte: 'gesto', n: 2 }}); const antes = e.gravacoes.length;
      await t.importar(dados); return {{ antes, depois: e.gravacoes.length, obs: e.notas.palmas.observacoes }};""")
    confere('importar o zip devolve as gravações e as observações', r2['antes'] == 24 and r2['depois'] == 25 and r2['obs'].startswith('Só vale'), r2)
    # zip estragado é recusado
    r3 = S(pg, "try { await t.importar([1, 2, 3, 4]); return 'aceitou'; } catch (e) { return e.message; }")
    confere('zip estragado é recusado', r3 != 'aceitou', r3)

    # 7) guardado no navegador: recarregar a página reabre o projeto com tudo
    pg.reload(); pg.wait_for_function('() => window.__teste && window.__teste.estudio.config', timeout=60000)
    r = pg.evaluate("() => ({ n: window.__teste.estudio.gravacoes.length, obs: window.__teste.estudio.notas.palmas && window.__teste.estudio.notas.palmas.observacoes, persistente: window.__teste.armazem.persistente })")
    confere('recarregar a página mantém gravações e observações', r['n'] == 25 and r['obs'].startswith('Só vale') and r['persistente'], r)
    pg.evaluate('() => {' + GESTOS + AJUDA + '}')

    # 8) modo PC: gravar sequências de teclas e mouse e reconhecer
    r = S(pg, """const e = t.estudio; e.trocarModo('pc');
      const seq = { acenar: [['mover', 'Mouse', -80, 0], ['mover', 'Mouse', 90, 0], ['mover', 'Mouse', -90, 0]],
        palmas: [['baixo', 'Mouse0'], ['baixo', 'Mouse2'], ['cima', 'Mouse0'], ['cima', 'Mouse2']],
        bracos_para_cima: [['baixo', 'Space'], ['baixo', 'KeyW'], ['cima', 'KeyW'], ['cima', 'Space']],
        'bola_de_energia/engatilhar': [['baixo', 'KeyQ'], ['cima', 'KeyQ']], 'bola_de_energia/liberar': [['baixo', 'Mouse0'], ['cima', 'Mouse0']] };
      const fazer = (lista, passo = 0.12) => { const ev = []; for (const [tipo, codigo, dx, dy] of lista) { s.T += passo; ev.push(...e.eventoPC({ tipo, codigo, dx, dy }, s.T)); } return ev; };
      for (const [chave, lista] of Object.entries(seq)) { const [acao, parte] = chave.split('/');
        for (let i = 0; i < 5; i++) { e.escolherPorId(acao, parte); e.gravar(s.T); s.T += 3.1; e.tempo(s.T); fazer(lista, 0.1 + i * 0.02); s.T += 3; e.tempo(s.T); await new Promise((r) => setTimeout(r, 10)); } }
      const pcs = e.gravacoes.filter((g) => g.modo === 'pc').length;
      e.alternarTeste(); s.T += 2;
      const disparos = (lista) => { s.T += 2; return fazer(lista, 0.13).filter((x) => x.tipo === 'disparou').map((x) => x.acao); };
      return { pcs, prontas: e.reconhecedor.prontas, palmas: disparos(seq.palmas), vitoria: disparos(seq.bracos_para_cima), aceno: disparos(seq.acenar),
        soLiberar: disparos(seq['bola_de_energia/liberar']), bola: [disparos(seq['bola_de_energia/engatilhar']), disparos(seq['bola_de_energia/liberar'])],
        aToa: disparos([['baixo', 'KeyA'], ['cima', 'KeyA'], ['baixo', 'KeyD'], ['cima', 'KeyD']]) };""")
    confere('PC: 25 gravações de teclado e mouse', r['pcs'] == 25 and r['prontas'] == 5, r)
    confere('PC: reconhece palmas, vitória e aceno', r['palmas'] == ['palmas'] and r['vitoria'] == ['bracos_para_cima'] and r['aceno'] == ['acenar'], r)
    confere('PC: liberar só depois de engatilhar; teclas à toa não disparam', r['soLiberar'] == [] and r['bola'] == [[], ['bola_de_energia']] and r['aToa'] == [], r)
    S(pg, "t.estudio.alternarTeste(); t.estudio.trocarModo('vr'); document.querySelector('input[name=modo][value=vr]').checked = true;")

    # 9) Quest simulado no quadro a quadro de verdade: A grava (com contagem), o boneco repete, Y liga o teste
    r = S(pg, """const en = t.entrada; en.modo = 'vr';
      for (const [l, h] of [['esq', 'left'], ['dir', 'right']]) { const m = en.maos[l]; m.conectada = true;
        m.fonte = { handedness: h, gamepad: { buttons: [...Array(7)].map(() => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] } }; }
      t.camera.position.set(0, 1.6, 0); t.camera.quaternion.identity();
      en.maos.esq.pose.position.set(-0.2, 0.9, -0.1); en.maos.dir.pose.position.set(0.2, 0.9, -0.1);
      const e = t.estudio; e.escolherPorId('acenar'); await e.apagar({ modo: 'vr', acao: 'acenar', parte: 'gesto', n: 5 });
      const A = en.maos.dir.fonte.gamepad.buttons[4]; A.pressed = true; await new Promise((r) => setTimeout(r, 400)); A.pressed = false;
      return e.estado;""")
    confere('Quest: A começa a contagem', r == 'contagem', r)
    # durante a gravação, a mão direita acena (no ritmo dos quadros que o Chrome sem tela conseguir desenhar)
    for i in range(80):
        st = T(pg, "const p = t.entrada.maos.dir.pose.position; const k = performance.now() / 1000; if (t.estudio.estado === 'gravando') p.set(0.35 + Math.sin(k * 14) * 0.15, 1.55, -0.25); return t.estudio.estado;")
        if st == 'parado' and i > 5: break
        time.sleep(0.1)
    r = T(pg, "const e = t.estudio; const g = e.tentativas('acenar', 'gesto'); return { n: g.length, quadros: g[g.length - 1].quadros.length, reprise: !!t.reprise, aviso: e.aviso && e.aviso.chave };")
    confere('Quest: gravou pelo quadro a quadro e o boneco repete', r['n'] == 5 and r['quadros'] >= 5 and r['reprise'] and r['aviso'] == 'gravou', r)
    pg.screenshot(path=F + '02_repetindo.png')
    T(pg, "const Y = t.entrada.maos.esq.fonte.gamepad.buttons[5]; Y.pressed = true; setTimeout(() => { Y.pressed = false; }, 400);")
    ok = ate(pg, "return t.estudio.estado === 'testando'", 4)
    confere('Quest: Y liga o modo testar', bool(ok))
    T(pg, "t.estudio.alternarTeste(); t.entrada.modo = 'pc';")

    # 10) fotos: boneco cinza e com a aparência de um personagem; efeito do poder
    r = S(pg, """t.trocarAparencia(true); await new Promise((r) => setTimeout(r, 600));
      const a = t.estudio.acoes.find((x) => x.id === 'bola_de_energia'); t.efeitos.soltar(a.efeito.forma, a.efeito.cor, t.boneco.maoMundo('dir'), t.boneco.olharMundo(), t.boneco.altura);
      return t.boneco.altura;""")
    time.sleep(0.3); pg.screenshot(path=F + '03_aparencia_e_efeito.png')
    confere('aparência do personagem (altura do arquivo)', r == 1.5, r)
    pg.click('#opAparencia'); time.sleep(0.5); pg.screenshot(path=F + '04_cinza.png')

    reais = [e for e in erros if 'GPU stall' not in e and 'WebGL' not in e and 'favicon' not in e]
    if reais: print('erros no console:', reais[:5]); erros_teste.append('console')
    b.close()
print('sem erros' if not erros_teste else 'FALHAS: ' + ', '.join(erros_teste))
sys.exit(1 if erros_teste else 0)
