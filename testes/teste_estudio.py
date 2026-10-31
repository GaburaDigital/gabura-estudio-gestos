"""Testes do Estúdio de Gestos (Playwright + Chrome sem janela, sem óculos).
Versão 2 (C35): biblioteca de gestos e preparações, o que conta (uma mão, duas, mão e cabeça…), vale com a outra mão,
tamanho do movimento (um soco curto não vale pelo completo), segurar a pose, carga por ciclos (mínimo, máximo e
níveis), liberações alternativas, menu do VR (analógico, A, B, segurar Y), palma muda de cor com A e X, mãos com os
dedos no lugar e a direção dos poderes. Mais: arquivos ruins, versão 1 convertida, exportar e importar, guardar no
navegador e teclado/mouse."""
import sys, os, json, time
from base import *

AQUI = os.path.dirname(os.path.abspath(__file__))
GESTOS = open(os.path.join(AQUI, 'gestos_sinteticos.js')).read()

AJUDA = """
window.__s = {
  T: 100,
  passar(amostras) { const e = window.__teste.estudio, ev = []; for (const a of amostras) { const b = { ...a, t: this.T }; ev.push(...e.quadroVR(b, this.T)); this.T += 1 / 72; } return ev; },
  parado(seg, op = {}) { const r = []; const base = __gestos.gerar('parado', op); for (let i = 0; i < seg * 72; i++) r.push(base[0]); return r; },
  // grava um gesto da biblioteca com um gesto de mentira (contagem, um pouco parado, o gesto e o resto parado)
  async gravarVR(gesto, nome, op = {}) {
    const e = window.__teste.estudio; e.escolherGesto(gesto);
    if (!e.gravar(this.T)) return false;
    this.passar(this.parado(e.config.gravacao.contagem + 0.05, op));
    const g = __gestos.gerar(nome, { ...op, t0: 0 }), dur = e.gesto.ajustes.duracao, antes = 0.3;
    this.passar(this.parado(antes, op));
    this.passar(g.slice(0, Math.floor((dur - antes) * 72)));
    const ult = g[g.length - 1], resto = Math.max(0, dur - antes - g.length / 72) + 0.1;
    for (let i = 0; i < resto * 72; i++) this.passar([ult]); // fica parado na pose final
    e.tempo(this.T + 0.01); await new Promise((r) => setTimeout(r, 20));
    return true;
  },
  async gravar5(gesto, nome, base = {}) { __gestos.semear(gesto.length * 7); let ok = 0;
    for (let i = 0; i < 5; i++) ok += (await this.gravarVR(gesto, nome, { velocidade: 0.88 + i * 0.06, x: i * 0.1, z: -i * 0.05, yaw: (i - 2) * 0.1, altura: 1.56 + i * 0.03, ...base })) ? 1 : 0;
    return ok; },
  // faz uma sequência de gestos (com pausas) e devolve os eventos
  fazer(nomes, op = {}, pausa = 0.5) { const ev = []; for (const n of nomes) { ev.push(...this.passar(this.parado(pausa, op))); const g = __gestos.gerar(n, op); ev.push(...this.passar(g)); const u = g[g.length - 1]; for (let i = 0; i < 0.5 * 72; i++) ev.push(...this.passar([u])); } ev.push(...this.passar(this.parado(1.2, op))); return ev; },
  disparos(ev) { return ev.filter((x) => x.tipo === 'disparou').map((x) => [x.acao, x.alternativa, x.ciclos, x.nivel, x.lado]); },
};
"""

# configuração de teste com furadeira (carga 3 a 10, preparação, jab ou gancho) e agulhas (níveis 3 e 6)
CFG_TESTE = {
  'versao_formato': 2, 'projeto': 'teste_carga', 'nome': 'Teste de carga',
  'gestos': [
    {'id': 'giro', 'nome': 'Giro', 'ajustes': {'conta': 'mao_dir', 'espelhado': True, 'duracao': 1.4}},
    {'id': 'prep', 'nome': 'Cotovelo', 'tipo': 'preparacao', 'ajustes': {'conta': 'mao_dir', 'espelhado': True, 'duracao': 1.4, 'segurar': 0.4}},
    {'id': 'jab', 'nome': 'Jab', 'ajustes': {'conta': 'mao_dir', 'espelhado': True, 'duracao': 1.2}},
    {'id': 'gancho', 'nome': 'Gancho', 'ajustes': {'conta': 'mao_dir', 'espelhado': True, 'duracao': 1.2}},
  ],
  'blocos': [{'id': 'b', 'nome': 'B', 'acoes': [
    {'id': 'furadeira', 'nome': 'Furadeira', 'tempo_maximo': 10, 'carga': {'passo': 'engatilhar', 'minimo': 3, 'maximo': 10},
     'passos': [{'id': 'engatilhar', 'nome': 'Engatilhar', 'gesto': 'giro'}, {'id': 'preparar', 'nome': 'Preparar', 'gesto': 'prep'},
                {'id': 'liberar', 'nome': 'Liberar', 'alternativas': [
                  {'id': 'jab', 'nome': 'Jab', 'gesto': 'jab', 'efeito': {'forma': 'broca', 'direcao': 'pulso', 'origem': 'mao'}},
                  {'id': 'gancho', 'nome': 'Gancho', 'gesto': 'gancho', 'efeito': {'forma': 'tornado', 'direcao': 'cima', 'origem': 'corpo'}}]}],
     'efeito': {'forma': 'broca', 'cor': '#bfe9ff'}},
  ]}],
}

def S(pg, js): return pg.evaluate('async () => { const s = window.__s, t = window.__teste; ' + js + ' }')
erros_teste = []
def confere(nome, ok, info=''):
    print(('OK   ' if ok else 'FALHA') + ' ' + nome + (' · ' + str(info) if info != '' else ''))
    if not ok: erros_teste.append(nome)

with servidor(), sync_playwright() as p:
    b, pg, erros = abrir(p, 1400, 820)
    pg.goto(URL); pg.wait_for_function('() => window.__teste', timeout=60000)
    pg.evaluate('() => {' + GESTOS + AJUDA + '}')

    # 1) exemplo (versão 2)
    pg.click('#btExemplo')
    ate(pg, "return document.querySelectorAll('#lista .item').length === 4", 8)
    r = S(pg, "return { gestos: t.estudio.config.gestos.length, prep: t.estudio.preparacoes.length };")
    confere('abre o exemplo (4 ações, 6 gestos, 1 preparação)', r == {'gestos': 6, 'prep': 1}, r)

    # 2) arquivos ruins
    r = S(pg, """const ruins = [
        { versao_formato: 3, projeto: 'x', blocos: [] },
        { versao_formato: 2, projeto: 'x', gestos: [], blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'b', nome: 'B', passos: [{ id: 'p', gesto: 'nao_existe' }] }] }] },
        { versao_formato: 2, projeto: 'x', gestos: [{ id: 'g', ajustes: { conta: 'pe' } }], blocos: [] },
        { versao_formato: 2, projeto: 'x', gestos: [{ id: 'g' }], blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'b', nome: 'B', passos: [{ id: 'p', gesto: 'g' }], carga: { passo: 'outro' } }] }] },
        { versao_formato: 2, projeto: 'x', gestos: [{ id: 'g', ajustes: { duracao: 99 } }], blocos: [] } ];
      const msgs = []; for (const c of ruins) { try { await t.abrirConfig(c); msgs.push('aceitou'); } catch (e) { msgs.push(e.message); } }
      return { msgs, projeto: t.estudio.config.projeto };""")
    confere('arquivos ruins recusados', all(m != 'aceitou' for m in r['msgs']) and r['projeto'] == 'exemplo_basico', r['msgs'])

    # 3) versão 1 continua aceita (vira gestos <acao>_<parte>)
    r = S(pg, """const v1 = { versao_formato: 1, projeto: 'velho', blocos: [{ id: 'a', nome: 'A', acoes: [{ id: 'soco', nome: 'Soco', maos: 'uma', partes: [{ id: 'engatilhar' }, { id: 'liberar' }] }] }] };
      await t.abrirConfig(v1); const c = t.estudio.config;
      const r = { gestos: c.gestos.map((g) => [g.id, g.ajustes.conta, g.ajustes.espelhado]), passos: c.blocos[0].acoes[0].passos.length };
      await t.abrirConfig(await (await fetch('configs/exemplo_basico.json')).json()); return r;""")
    confere('versão 1 convertida (uma mão = mão direita, vale com a outra)', r['gestos'] == [['soco_engatilhar', 'mao_dir', True], ['soco_liberar', 'mao_dir', True]] and r['passos'] == 2, r)

    # 4) gravar o exemplo e reconhecer (outra pessoa, outra mão)
    r = S(pg, """const ok = [await s.gravar5('acenar', 'aceno'), await s.gravar5('palmas', 'palma'), await s.gravar5('bracos_para_cima', 'bracos_cima'),
        await s.gravar5('bola_engatilhar', 'engatilhar'), await s.gravar5('bola_liberar', 'liberar')];
      const e = t.estudio, extra = e.gravar(s.T);
      const g = e.gravacoes.find((x) => x.gesto === 'acenar');
      return { ok, extra, aviso: e.aviso && e.aviso.chave, trecho: [g.inicio, g.fim], altura: g.altura_olhos };""")
    confere('grava 5 vezes cada gesto e recusa a sexta', r['ok'] == [5] * 5 and r['extra'] is False and r['aviso'] == 'cheio', r)
    confere('acha o trecho com movimento e a altura dos olhos', 0.1 < r['trecho'][0] < 0.4 and 1.5 < r['altura'] < 1.6, r)
    r = S(pg, """const e = t.estudio; e.alternarTeste(1.75); __gestos.semear(99);
      const op = { altura: 1.75, x: 0.7, z: 0.4, yaw: 0.6, velocidade: 1.12, tremido: 0.015 };
      const d = (n, o = op) => s.disparos(s.fazer([n], o)).map((x) => x[0]);
      return { aceno: d('aceno'), palma: d('palma'), vitoria: d('bracos_cima'), outraMao: s.disparos(s.fazer(['aceno'], { ...op, espelhar: true })),
        empurrar: d('empurrar'), bola: d.call(null, 'engatilhar').concat(d('liberar')), andar: d('andar'), coçar: d('coçar'), parado: d('parado') };""")
    confere('reconhece o aceno, as palmas e a vitória de outra pessoa', r['aceno'] == ['acenar'] and r['palma'] == ['palmas'] and r['vitoria'] == ['bracos_para_cima'], r)
    confere('aceno com a outra mão vale (e diz que foi a esquerda)', [x[0] for x in r['outraMao']] == ['acenar'] and r['outraMao'][0][4] == 'esq', r['outraMao'])
    confere('engatilhar e liberar dispara; empurrar sem engatilhar não', r['bola'] == ['bola_de_energia'] and r['empurrar'] == [], r)
    confere('andar, coçar e ficar parado não disparam', r['andar'] == [] and r['coçar'] == [] and r['parado'] == [], r)
    S(pg, "t.estudio.alternarTeste();")

    # 5) carga, preparação, tamanho do soco e alternativas
    r = S(pg, f"""await t.abrirConfig({json.dumps(CFG_TESTE)});
      return [await s.gravar5('giro', 'giro'), await s.gravar5('prep', 'cotovelo'), await s.gravar5('jab', 'socoCompleto'), await s.gravar5('gancho', 'gancho')];""")
    confere('grava os gestos da furadeira', r == [5, 5, 5, 5], r)
    r = S(pg, """const e = t.estudio; e.alternarTeste(1.6); __gestos.semear(5); const op = { altura: 1.62, x: -0.3, yaw: -0.4, velocidade: 1.05 };
      const f = (lista, o = op) => { const ev = s.fazer(lista, o, 0.3); return { d: s.disparos(ev), cargas: ev.filter((x) => x.tipo === 'carga').map((x) => x.ciclos) }; };
      const r = {};
      r.quatro = f(['giro', 'giro', 'giro', 'giro', 'cotovelo', 'socoCompleto']);
      r.socoCurto = f(['giro', 'giro', 'giro', 'cotovelo', 'socoCurto']); s.passar(s.parado(11, op));
      r.semPreparar = f(['giro', 'giro', 'giro', 'socoCompleto']); s.passar(s.parado(11, op));
      r.poucaCarga = f(['giro', 'giro', 'cotovelo', 'socoCompleto']); s.passar(s.parado(11, op));
      r.prepRapida = f(['giro', 'giro', 'giro', 'cotoveloRapido', 'socoCompleto']); s.passar(s.parado(11, op));
      r.gancho = f(['giro', 'giro', 'giro', 'cotovelo', 'gancho']);
      r.esquerda = f(['giro', 'giro', 'giro', 'cotovelo', 'socoCompleto'], { ...op, espelhar: true });
      r.doze = f(['giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'giro', 'cotovelo', 'socoCompleto']);
      return r;""")
    confere('4 giros + preparação + soco completo = jab com carga 4', r['quatro']['d'] == [['furadeira', 'jab', 4, None, 'dir']], r['quatro'])
    confere('soco curto não dispara (precisa do tamanho do soco gravado)', r['socoCurto']['d'] == [], r['socoCurto'])
    confere('sem a preparação não dispara', r['semPreparar']['d'] == [], r['semPreparar'])
    confere('com menos de 3 giros não dispara', r['poucaCarga']['d'] == [], r['poucaCarga'])
    confere('preparação sem segurar a pose não vale', r['prepRapida']['d'] == [], r['prepRapida'])
    confere('gancho é a outra alternativa', [x[1] for x in r['gancho']['d']] == ['gancho'], r['gancho'])
    confere('gravado com a direita, vale com a esquerda (teste com a esquerda)', r['esquerda']['d'] == [['furadeira', 'jab', 3, None, 'esq']], r['esquerda'])
    confere('carga para no máximo (10)', r['doze']['d'] and r['doze']['d'][0][2] == 10, r['doze'])
    # níveis (agulhas): 4 ou 5 ciclos = 1 agulha; 6 = 500
    r = S(pg, """const { nivelDaCarga } = { nivelDaCarga: (c, n) => { const m = Math.min(c.maximo, n); let v = null; for (const x of c.niveis) if (m >= x.ciclos) v = x; return v && v.nome.pt; } };
      const c = { minimo: 3, maximo: 6, niveis: [{ ciclos: 3, nome: { pt: '1 agulha' } }, { ciclos: 6, nome: { pt: '500 agulhas' } }] };
      return [3, 4, 5, 6, 9].map((n) => nivelDaCarga(c, n));""")
    confere('níveis da carga das agulhas', r == ['1 agulha', '1 agulha', '1 agulha', '500 agulhas', '500 agulhas'], r)
    S(pg, "t.estudio.alternarTeste();")

    # 6) biblioteca de preparações e ajustes (guardados; continuam ao reimportar o arquivo)
    r = S(pg, f"""const e = t.estudio; const id = await e.criarPreparacao('Mãos no peito');
      await e.adicionarPreparacao('furadeira', id); const passos1 = e.config.blocos[0].acoes[0].passos.map((p) => p.id);
      await e.ajustar('jab', {{ conta: 'mao_cabeca', tolerancia: 1.4, duracao: 9 }});
      await t.abrirConfig({json.dumps(CFG_TESTE)}); // mesmo projeto: as edições continuam
      const a = e.config.blocos[0].acoes[0], jab = e.config.gestos.find((g) => g.id === 'jab');
      const r = {{ id, passos1, passos2: a.passos.map((p) => p.id), jab: [jab.ajustes.conta, jab.ajustes.tolerancia, jab.ajustes.duracao], usos: e.usosDoGesto('prep').length }};
      await e.removerPreparacao('furadeira', 'preparar_2'); r.passos3 = e.config.blocos[0].acoes[0].passos.map((p) => p.id);
      await e.ajustar('jab', {{ conta: 'mao_dir', tolerancia: 1, duracao: 1.2 }}); return r;""")
    confere('criar preparação e pôr antes de liberar', r['id'] == 'prep_maos_no_peito' and r['passos1'] == ['engatilhar', 'preparar', 'preparar_2', 'liberar'], r)
    confere('ajustes e preparações continuam ao reimportar; tempo fica no limite (8 s)', r['passos2'] == r['passos1'] and r['jab'] == ['mao_cabeca', 1.4, 8], r)
    confere('tirar a preparação da ação', r['passos3'] == ['engatilhar', 'preparar', 'liberar'], r['passos3'])

    # 7) exportar e importar (com a biblioteca)
    r = S(pg, """const zip = t.exportar({ tipo: 'tudo' }), um = t.exportar({ tipo: 'acao', acao: 'furadeira' }); return { tam: zip.length, um: um.length, dados: Array.from(zip) };""")
    import zipfile, io
    z = zipfile.ZipFile(io.BytesIO(bytes(r['dados']))); nomes = z.namelist()
    cfg = json.loads(z.read('configuracao.json'))
    confere('o zip tem a configuração com a preparação nova e as gravações por gesto', 'gestos/giro/vr/5.json' in nomes and 'gestos/prep/vr/1.json' in nomes and any(g['id'] == 'prep_maos_no_peito' for g in cfg['gestos']), len(nomes))
    r2 = S(pg, f"""const e = t.estudio; await e.apagar({{ modo: 'vr', gesto: 'giro', n: 2 }}); const antes = e.tentativas('giro').length;
      await t.importar({json.dumps(r['dados'])}); return {{ antes, depois: e.tentativas('giro').length }};""")
    confere('importar devolve as gravações', r2 == {'antes': 4, 'depois': 5}, r2)
    r3 = S(pg, "try { await t.importar([1, 2, 3]); return 'aceitou'; } catch (e) { return e.message; }")
    confere('zip estragado é recusado', r3 != 'aceitou', r3)

    # 8) guardado no navegador
    pg.reload(); pg.wait_for_function('() => window.__teste && window.__teste.estudio.config', timeout=60000)
    r = pg.evaluate("() => ({ projeto: window.__teste.estudio.config.projeto, giro: window.__teste.estudio.tentativas('giro').length, prep: window.__teste.estudio.preparacoes.map((g) => g.id) })")
    confere('recarregar a página mantém o projeto, gravações e preparações', r['giro'] == 5 and 'prep_maos_no_peito' in r['prep'], r)
    pg.evaluate('() => {' + GESTOS + AJUDA + '}')

    # 9) teclado e mouse (modo PC)
    r = S(pg, """const e = t.estudio; e.trocarModo('pc');
      const seq = { giro: [['baixo', 'KeyQ'], ['cima', 'KeyQ']], prep: [['baixo', 'KeyE'], ['cima', 'KeyE']], jab: [['baixo', 'Mouse0'], ['cima', 'Mouse0']], gancho: [['mover', 'Mouse', 0, -90], ['baixo', 'Mouse0']] };
      const fazer = (lista, passo = 0.12) => { const ev = []; for (const [tipo, codigo, dx, dy] of lista) { s.T += passo; ev.push(...e.eventoPC({ tipo, codigo, dx, dy }, s.T)); } return ev; };
      for (const [g, lista] of Object.entries(seq)) for (let i = 0; i < 5; i++) { e.escolherGesto(g); e.gravar(s.T); s.T += 3.1; e.tempo(s.T); fazer(lista, 0.1 + i * 0.02); s.T += 2; e.tempo(s.T); await new Promise((r) => setTimeout(r, 10)); }
      e.alternarTeste(); s.T += 2;
      const d = (l) => { s.T += 1; return fazer(l, 0.15).filter((x) => x.tipo === 'disparou').map((x) => [x.acao, x.alternativa, x.ciclos]); };
      const q3 = [...seq.giro, ...seq.giro, ...seq.giro];
      return { por: Object.fromEntries(Object.keys(seq).map((g) => [g, e.tentativas(g, 'pc').length])), pcs: e.gravacoes.filter((g) => g.modo === 'pc').length, ok: d([...q3, ...seq.prep, ...seq.jab]), soJab: d(seq.jab) };""")
    confere('PC: grava e reconhece a sequência com carga', r['pcs'] == 20 and r['ok'] == [['furadeira', 'jab', 3]] and r['soJab'] == [], r)
    S(pg, "t.estudio.alternarTeste(); t.estudio.trocarModo('vr'); document.querySelector('input[name=modo][value=vr]').checked = true;")

    # 10) Quest simulado: menu (analógico, A, B), gravar pelo menu, segurar Y cancela, palma muda de cor
    S(pg, """const en = t.entrada; en.modo = 'vr';
      for (const [l, h] of [['esq', 'left'], ['dir', 'right']]) { const m = en.maos[l]; m.conectada = true;
        m.fonte = { handedness: h, gamepad: { buttons: [...Array(7)].map(() => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] } }; }
      t.camera.position.set(0, 1.6, 0); t.camera.quaternion.identity();
      en.maos.esq.pose.position.set(-0.2, 0.9, -0.1); en.maos.dir.pose.position.set(0.2, 0.9, -0.1);
      await t.estudio.apagar({ modo: 'vr', gesto: 'giro', n: 5 }); /* abre espaço para mais uma gravação */""")
    # o Chrome sem tela desenha poucos quadros: cada toque espera o menu reagir (com limite), em vez de um tempo fixo
    def botao(l, i, condicao, limite=5):
        T(pg, f"t.entrada.maos.{l}.fonte.gamepad.buttons[{i}].pressed = true;")
        ate(pg, condicao, limite)
        T(pg, f"t.entrada.maos.{l}.fonte.gamepad.buttons[{i}].pressed = false;"); time.sleep(0.4)
    def analogico(y, condicao):
        T(pg, f"t.entrada.maos.dir.fonte.gamepad.axes[3] = {y};"); ate(pg, condicao, 5)
        T(pg, "t.entrada.maos.dir.fonte.gamepad.axes[3] = 0;"); ate(pg, "return Math.abs(t.entrada.maos.dir.analogico.y) < 0.3", 5); time.sleep(0.3)
    analogico(1, "return t.painel.cursor === 1")                    # desce do "Testar" para a primeira ação
    botao('dir', 4, "return t.painel.nomeTela === 'acao'")          # A: abre a ação
    botao('dir', 4, "return t.painel.nomeTela === 'gesto'")         # A: abre o primeiro gesto
    tela = T(pg, "return t.painel.nomeTela")
    botao('dir', 4, "return t.estudio.estado === 'contagem'")       # A: Gravar
    r = T(pg, "return t.estudio.estado")
    confere('Quest: menu abre a ação, o gesto e grava com A', tela == 'gesto' and r == 'contagem', [tela, r])
    botao('esq', 5, "return t.painel.nomeTela === 'inicio' && t.estudio.estado === 'parado'", 6)  # segurar Y
    r = T(pg, "return [t.estudio.estado, t.painel.nomeTela]")
    confere('Quest: segurar Y cancela a gravação e volta ao começo', r == ['parado', 'inicio'], r)
    analogico(1, "return t.painel.cursor === 1")
    botao('dir', 4, "return t.painel.nomeTela === 'acao'"); botao('dir', 4, "return t.painel.nomeTela === 'gesto'")
    botao('dir', 5, "return t.painel.nomeTela === 'acao'")          # B volta para a ação
    r = T(pg, "return t.painel.nomeTela")
    confere('Quest: B volta', r == 'acao', r)
    r = T(pg, """const b = t.boneco, p = b.poseDeDescanso(); p.maos.dir.botao = true; b.aplicar(p);
      return b.bracos.dir.palma.emissive.getHexString();""")
    confere('palma muda de cor com A', r == 'ffb800', r)
    # mãos: indicador em cima (perto do polegar) e palma para dentro, nas duas mãos
    r = T(pg, """const b = t.boneco, s = (l) => { const m = b.bracos ? null : null; return null; };
      const p = b.poseDeDescanso(); b.aplicar(p); const res = {};
      for (const l of ['esq', 'dir']) { const br = b['bracos'][l]; res[l] = { indicadorAcima: br.indicador.position.y > br.dedos.position.y, palma: -Math.sign(br.lado) }; } // a palma fica do lado −lado (os dedos dobram para lá)
      return res;""")
    confere('mãos com o indicador em cima e a palma para dentro (dir −x, esq +x)', r == {'esq': {'indicadorAcima': True, 'palma': 1}, 'dir': {'indicadorAcima': True, 'palma': -1}}, r)

    # 11) direção dos poderes: pulso segue o controle; cabeça um pouco abaixo dos olhos; movimento segue a mão
    r = T(pg, """const THREE = t.THREE, m = t.entrada.maos.dir.pose; m.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); m.updateMatrixWorld(true);
      t.camera.updateMatrixWorld(true);
      const f = (e) => { const r = t.origemEDirecao(e, 'dir', false); return [r.d.x, r.d.y, r.d.z].map((v) => +v.toFixed(2)); };
      for (let i = 0; i < 8; i++) t.anotarRastro('dir', new THREE.Vector3(0.2, 0.9 + i * 0.1, -0.1));
      const r = { pulso: f({ origem: 'mao', direcao: 'pulso' }), cabeca: f({ origem: 'boca', direcao: 'cabeca' }), movimento: f({ origem: 'mao', direcao: 'movimento' }) };
      m.quaternion.identity(); return r;""")
    confere('direção: pulso segue o controle, cabeça um pouco abaixo, movimento segue a mão', r['pulso'] == [1, 0, 0] and r['cabeca'][1] < -0.1 and r['cabeca'][2] < -0.9 and r['movimento'] == [0, 1, 0], r)
    T(pg, "t.entrada.modo = 'pc';")

    # 12) fotos: menu, boneco com aparência e a seta de um poder
    S(pg, "await t.abrirConfig(await (await fetch('configs/exemplo_basico.json')).json()); t.trocarAparencia(true); const THREE = t.THREE; t.efeitos.soltar('broca', '#bfe9ff', t.boneco.maoMundo('dir'), new THREE.Vector3(0.3, 0.2, 1), t.boneco.altura, 3);")
    time.sleep(0.4); pg.screenshot(path=F + '01_aparencia_e_seta.png')
    pg.click('#opAparencia'); time.sleep(0.4); pg.screenshot(path=F + '02_cinza.png')

    reais = [e for e in erros if 'GPU stall' not in e and 'WebGL' not in e and 'favicon' not in e]
    if reais: print('erros no console:', reais[:5]); erros_teste.append('console')
    b.close()
print('sem erros' if not erros_teste else 'FALHAS: ' + ', '.join(erros_teste))
sys.exit(1 if erros_teste else 0)
