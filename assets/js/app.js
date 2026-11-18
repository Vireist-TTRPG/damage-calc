/* IRREALITY · состояние, события, оркестрация. */
(function () {
    'use strict';
    const E = window.IREngine, M = window.IRModules, R = window.IRRender;
    const $ = R.$;
    const LS = 'irreality.firecalc.v2';
    const POOL_MIN = -5, POOL_MAX = 12;

    const DEFAULTS = {
        configured: false, uiMode: 'simple', theme: 'dark',
        enabled: ['irreality-core', 'isotope-tier'], order: [], ruleValues: {},
        attack: 5, defense: 2, rating: 4,
        poolAttack: [{ name: 'Меткость', value: 4, custom: false }, { name: 'Ловкость', value: 3, custom: false }],
        poolDefense: [{ name: 'Ловкость', value: 3, custom: false }, { name: 'Атлетика', value: 2, custom: false }],
        weaponClassId: 'core:assault', distanceBand: 'near', weaponId: '',
        modeId: 'core:burst', aimTurns: 0, headshot: false,
        ammoId: 'core:fmj', carrierId: 'core:light', plateId: 'core:kevlar', integrityStart: 6, firstShotMode: 'auto',
        coverId: 'core:none', autoApply: true, dice: { attack: [], defense: [] },
        log: [], logFilter: 'all', logSearch: ''
    };
    const LIM = { attack: [0, 30], defense: [0, 30], rating: [0, 15], aimTurns: [0, 3] };
    const PRESETS = {
        attack: [[['Меткость', 4], ['Ловкость', 3]], [['Меткость', 4], ['Смекалка', 3]]],
        defense: [[['Ловкость', 3], ['Атлетика', 2]], [['Выносливость', 3], ['Атлетика', 2]]]
    };

    let fresh = false;
    let state = load();
    let bundle = null, ctx = null, series = null;
    let ui = { refTab: 'plates', refQuery: '' };
    let undoData = null, toastTimer = null, dragMod = null, dragLog = null;

    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(LS));
            if (!raw || typeof raw !== 'object') { fresh = true; return JSON.parse(JSON.stringify(DEFAULTS)); }
            const s = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), raw);
            s.dice = { attack: [], defense: [] };
            ['log', 'enabled', 'order', 'poolAttack', 'poolDefense'].forEach(k => { if (!Array.isArray(s[k])) s[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); });
            if (['simple', 'full'].indexOf(s.uiMode) < 0) s.uiMode = 'simple';
            if (['dark', 'light'].indexOf(s.theme) < 0) s.theme = 'dark';
            return s;
        } catch (e) { fresh = true; return JSON.parse(JSON.stringify(DEFAULTS)); }
    }
    function save() {
        try { const c = Object.assign({}, state); c.dice = { attack: [], defense: [] }; localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {}
    }
    const uid = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const rowsOf = side => (side === 'attack' ? state.poolAttack : state.poolDefense);

    function inputOf(s) {
        return {
            attack: s.attack, defense: s.defense, rating: s.rating,
            poolAttack: s.poolAttack.map(r => ({ name: r.name, value: r.value })),
            poolDefense: s.poolDefense.map(r => ({ name: r.name, value: r.value })),
            weaponClassId: s.weaponClassId, distanceBand: s.distanceBand,
            modeId: s.modeId, aimTurns: s.aimTurns, headshot: s.headshot,
            ammoId: s.ammoId, carrierId: s.carrierId, plateId: s.plateId,
            coverId: s.coverId, firstShotMode: s.firstShotMode,
            diceOnes: E.diceOnes(s.dice.attack)
        };
    }
    function rebuild() { ctx = E.buildContext(bundle, state.enabled, state.order, state.ruleValues); }

    function ensure() {
        const first = o => Object.keys(o)[0];
        if (!ctx.classes[state.weaponClassId]) state.weaponClassId = first(ctx.classes);
        if (!ctx.modes[state.modeId]) state.modeId = first(ctx.modes);
        if (!ctx.ammo[state.ammoId]) state.ammoId = first(ctx.ammo);
        if (!ctx.covers[state.coverId]) state.coverId = first(ctx.covers);
        if (!ctx.carriers[state.carrierId]) state.carrierId = first(ctx.carriers);
        const carrier = ctx.carriers[state.carrierId];
        if (carrier && carrier.plates.length) {
            if (carrier.plates.indexOf(state.plateId) < 0) { state.plateId = carrier.plates[0]; state.integrityStart = ctx.plates[state.plateId].integrity; }
            state.integrityStart = E.clamp(state.integrityStart, 0, ctx.plates[state.plateId].integrity);
        }
        if (state.weaponId && !ctx.weapons[state.weaponId]) state.weaponId = '';
        Object.keys(LIM).forEach(k => { state[k] = E.clamp(state[k], LIM[k][0], LIM[k][1]); });
        ['poolAttack', 'poolDefense'].forEach(k => {
            state[k] = state[k].filter(r => r && typeof r === 'object').map(r => ({
                name: String(r.name == null ? '' : r.name), custom: !!r.custom, value: E.clamp(E.num(r.value), POOL_MIN, POOL_MAX)
            }));
        });
        ctx.ruleDefs.forEach(r => {
            const v = ctx.rules[r.key];
            if (r.type === 'number') ctx.rules[r.key] = E.clamp(v, r.min != null ? r.min : 0, r.max != null ? r.max : 99);
            if (r.type === 'toggle') ctx.rules[r.key] = !!v;
        });
    }

    function applyTheme() {
        document.documentElement.dataset.theme = state.theme;
        document.documentElement.style.colorScheme = state.theme;
        const light = state.theme === 'light';
        $('themeIcLight').hidden = !light;
        $('themeIcDark').hidden = light;
        $('themeLbl').textContent = light ? 'СВЕТЛАЯ' : 'ТЁМНАЯ';
        $('themeBtn').title = light ? 'Переключить на тёмную тему' : 'Переключить на светлую тему';
    }
    function applyUiMode() {
        document.body.classList.toggle('ui-simple', state.uiMode === 'simple');
        $('uiSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.value === state.uiMode ? 'true' : 'false'));
    }

    function refreshCalc() {
        series = E.computeSeries(state, ctx, inputOf);
        R.syncInputs(state, ctx);
        R.renderPool(state, E.computePool(inputOf(state), ctx));
        R.renderResults(state, series.pending, ctx);
        R.renderLog(state, series, ctx);
        save();
    }
    function refreshAll() {
        rebuild(); ensure();
        R.buildStatic(ctx, state);
        refreshCalc();
        R.renderReference(ctx, ui.refTab, ui.refQuery);
        if (!$('gate').hidden) R.renderGate(bundle, state);
    }

    function toast(msg, undo) {
        clearTimeout(toastTimer);
        $('toastMsg').textContent = msg;
        undoData = undo || null;
        $('toastAct').hidden = !undo;
        const t = $('toast');
        t.hidden = false;
        requestAnimationFrame(() => t.classList.add('show'));
        toastTimer = setTimeout(hideToast, undo ? 7000 : 3200);
    }
    function hideToast() {
        const t = $('toast');
        t.classList.remove('show');
        setTimeout(() => { t.hidden = true; }, 250);
        undoData = null;
    }

    /* ---------- отчёт ---------- */
    function report() {
        const s = series || E.computeSeries(state, ctx, inputOf);
        const poolTxt = rows => rows.map(r => (r.name || 'компонент') + ' ' + r.value).join(' + ') || '—';
        const L = ['# IRREALITY · отчёт по огнестрелу', ''];
        L.push('Модули: ' + ctx.modules.map(m => m.name + ' (' + m.namespace + ' v' + (m.version || '1.0.0') + ')').join(' → '));
        L.push('Интерфейс: ' + (state.uiMode === 'simple' ? 'простой' : 'полный') + ' · тема: ' + (state.theme === 'light' ? 'светлая' : 'тёмная'));
        L.push('', '## Параметры');
        L.push('- Бросок: атака ' + state.attack + ' − защита ' + state.defense);
        L.push('- Пул атаки: ' + poolTxt(state.poolAttack));
        L.push('- Пул защиты: ' + poolTxt(state.poolDefense));
        L.push('- Оружие: Рейтинг +' + s.pending.rating + ' · ' + ((ctx.classes[state.weaponClassId] || {}).name || '—') + ' · ' + state.distanceBand);
        L.push('- Режим: ' + ((ctx.modes[state.modeId] || {}).name || '—') + ' · патрон ' + ((ctx.ammo[state.ammoId] || {}).name || '—'));
        const p = ctx.plates[state.plateId];
        L.push('- Броня: ' + ((ctx.carriers[state.carrierId] || {}).name || '—') + (p && s.pending.armored ? ' · ' + p.name + ' (' + p.code + '), Целостность в начале серии ' + state.integrityStart + '/' + p.integrity : ''));
        L.push('- Укрытие: ' + ((ctx.covers[state.coverId] || {}).name || '—'));
        L.push('- Правила: ' + ctx.ruleDefs.map(r => r.label + ' = ' + (r.type === 'toggle' ? (ctx.rules[r.key] ? 'вкл' : 'выкл') : ctx.rules[r.key])).join('; '));
        L.push('');
        const block = (title, r) => {
            L.push('## ' + title, '');
            L.push('Итог: ' + (r.hit ? 'попадание' : r.blocked ? 'цель недоступна' : 'промах') +
                ' · Усугублённый ' + E.num(r.hp.aggravated) + ' · Поверхностный ' + E.num(r.hp.surface) +
                ' · Износ ' + r.wear.total + (r.armored ? ' · Целостность ' + r.integrityBefore + ' → ' + r.integrityAfter + '/' + r.integrityMax : ''), '');
            r.steps.forEach((st, i) => L.push((i + 1) + '. ' + st.label + ': `' + st.expr + '`'));
            const fl = r.flags.concat(r.warnings.map(w => ({ text: w })));
            if (fl.length) { L.push(''); fl.forEach(f => L.push('- ' + f.text)); }
            L.push('');
        };
        if (s.entries.length) {
            L.push('# Серия обстрелов', '');
            s.entries.forEach(x => block('Обстрел ' + (x.index + 1), x.result));
            L.push('Сводка серии: попаданий ' + s.totals.hits + ', промахов ' + s.totals.misses + ', Σ Усугублённый ' + s.totals.agg + ', Σ Поверхностный ' + s.totals.surf + ', Σ износ ' + s.totals.wear, '');
        }
        block('Текущий обстрел', s.pending);
        return L.join('\n');
    }
    function copyText(txt, okMsg) {
        const done = () => toast(okMsg);
        const fb = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                const ok = document.execCommand('copy'); document.body.removeChild(ta);
                ok ? done() : toast('Не удалось скопировать — скачайте .md');
            } catch (e) { toast('Не удалось скопировать — скачайте .md'); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fb); else fb();
    }
    function download(name, txt, mime) {
        try {
            const blob = new Blob([txt], { type: mime || 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 900);
            toast('Файл сохранён: ' + name);
        } catch (e) { toast('Скачивание недоступно в этом браузере'); }
    }

    /* ---------- журнал ---------- */
    function logAdd() {
        state.log.push({ id: uid(), at: Date.now(), input: inputOf(state) });
        refreshCalc();
        toast('Обстрел зафиксирован. Целостность перенесена дальше.', () => { state.log.pop(); refreshCalc(); toast('Запись убрана'); });
    }
    function logDel(id) {
        const i = state.log.findIndex(e => e.id === id);
        if (i < 0) return;
        const snap = state.log[i];
        state.log.splice(i, 1); refreshCalc();
        toast('Обстрел удалён — серия пересчитана', () => { state.log.splice(i, 0, snap); refreshCalc(); toast('Запись возвращена'); });
    }
    function logDup(id) {
        const i = state.log.findIndex(e => e.id === id);
        if (i < 0) return;
        state.log.splice(i + 1, 0, { id: uid(), at: Date.now(), input: JSON.parse(JSON.stringify(state.log[i].input)) });
        refreshCalc(); toast('Обстрел продублирован');
    }
    function logMove(id, dir) {
        const i = state.log.findIndex(e => e.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= state.log.length) return;
        const t = state.log[i]; state.log[i] = state.log[j]; state.log[j] = t;
        refreshCalc();
    }
    function logClear() {
        if (!state.log.length) { toast('Серия уже пуста'); return; }
        const snap = state.log.slice();
        state.log = []; refreshCalc();
        toast('Серия очищена', () => { state.log = snap; refreshCalc(); toast('Серия восстановлена'); });
    }
    function seedSeries(rows) {
        const base = inputOf(state);
        state.log = rows.map(o => ({ id: uid(), at: Date.now(), input: Object.assign({}, base, o) }));
    }
    function logDemo() {
        const snap = state.log.slice();
        const p = ctx.plates[state.plateId];
        if (p && series.pending.armored) state.integrityStart = p.integrity;
        seedSeries([{ attack: 5, defense: 2 }, { attack: 6, defense: 1 }, { attack: 2, defense: 3 }, { attack: 7, defense: 2 }]);
        refreshCalc();
        toast('Демо-серия из 4 обстрелов загружена', () => { state.log = snap; refreshCalc(); toast('Демо-серия убрана'); });
    }

    /* ---------- бросок ---------- */
    function roll(which) {
        const pool = E.computePool(inputOf(state), ctx);
        if (which === 'both' || which === 'attack') state.dice.attack = E.rollPool(pool.attack.total);
        if (which === 'both' || which === 'defense') state.dice.defense = E.rollPool(pool.defense.total);
        if (state.autoApply) {
            if (which === 'both' || which === 'attack') state.attack = E.diceSuccesses(state.dice.attack);
            if (which === 'both' || which === 'defense') {
                const mod = ctx.rules.applyPassiveSuccessMods ? pool.defense.successMod : 0;
                state.defense = Math.max(0, E.diceSuccesses(state.dice.defense) + mod);
            }
        }
        refreshCalc();
        if (!state.dice.attack.length && !state.dice.defense.length) toast('Пул пуст — добавьте компоненты пула');
    }

    /* ---------- конфигурация ---------- */
    function openGate() {
        R.renderGate(bundle, state);
        $('gate').hidden = false;
        document.body.classList.add('locked');
    }
    function closeGate() { $('gate').hidden = true; document.body.classList.remove('locked'); }
    function applyGate() {
        state.configured = true;
        refreshAll(); closeGate();
        toast('Конфигурация применена: ' + ctx.modules.map(m => m.name).join(', '));
    }
    function modToggle(id) {
        const m = bundle.manifests[id];
        if (!m || m.kind === 'core' || m.required) return;
        const i = state.enabled.indexOf(id);
        if (i >= 0) {
            state.enabled.splice(i, 1);
            const dep = state.order.filter(x => state.enabled.indexOf(x) >= 0 && (bundle.manifests[x].requires || []).indexOf(id) >= 0);
            dep.forEach(x => state.enabled.splice(state.enabled.indexOf(x), 1));
            if (dep.length) toast('Вместе с модулем выключены зависимые: ' + dep.map(x => bundle.manifests[x].name).join(', '));
        } else {
            (m.requires || []).forEach(r => { if (bundle.manifests[r] && state.enabled.indexOf(r) < 0) state.enabled.push(r); });
            state.enabled.push(id);
        }
        save(); R.renderGate(bundle, state);
    }
    function modMove(id, dir) {
        const i = state.order.indexOf(id), j = i + dir;
        if (i < 1 || j < 1 || j >= state.order.length) return;
        const t = state.order[i]; state.order[i] = state.order[j]; state.order[j] = t;
        save(); R.renderGate(bundle, state);
    }

    /* ---------- события ---------- */
    function onClick(ev) {
        const el = ev.target.closest('[data-act]');
        if (!el) return;
        const act = el.dataset.act, key = el.dataset.key;
        switch (act) {
            case 'step':
                state[key] = E.clamp(state[key] + (+el.dataset.dir), LIM[key][0], LIM[key][1]);
                refreshCalc(); break;
            case 'set':
                state[key] = key === 'aimTurns' ? +el.dataset.value : el.dataset.value;
                if (key === 'modeId') { state.aimTurns = 0; state.headshot = false; }
                refreshCalc(); break;
            case 'toggle': state[key] = !state[key]; refreshCalc(); break;
            case 'ui-mode':
                if (state.uiMode === el.dataset.value) break;
                state.uiMode = el.dataset.value;
                applyUiMode(); refreshCalc();
                if (!$('gate').hidden) R.renderGate(bundle, state);
                else toast(state.uiMode === 'simple' ? 'Простой интерфейс: только главное' : 'Полный интерфейс: все инструменты');
                break;
            case 'theme':
                state.theme = state.theme === 'light' ? 'dark' : 'light';
                applyTheme(); save();
                if (!$('gate').hidden) R.renderGate(bundle, state);
                break;
            case 'theme-set':
                state.theme = el.dataset.value; applyTheme(); save();
                if (!$('gate').hidden) R.renderGate(bundle, state);
                break;
            case 'pool-add': {
                const rows = rowsOf(el.dataset.side);
                const used = rows.map(r => r.name);
                const dict = ctx.skills.concat(ctx.attributes);
                const next = dict.find(n => used.indexOf(n) < 0);
                rows.push(next ? { name: next, value: 1, custom: false } : { name: 'Модификатор', value: 0, custom: true });
                refreshCalc(); break;
            }
            case 'pool-del':
                rowsOf(el.dataset.side).splice(+el.dataset.idx, 1);
                refreshCalc(); break;
            case 'pool-step': {
                const r = rowsOf(el.dataset.side)[+el.dataset.idx];
                if (r) r.value = E.clamp(r.value + (+el.dataset.dir), POOL_MIN, POOL_MAX);
                refreshCalc(); break;
            }
            case 'pool-preset': {
                const side = el.dataset.side;
                const preset = PRESETS[side][+el.dataset.preset];
                const cur = rowsOf(side);
                state[side === 'attack' ? 'poolAttack' : 'poolDefense'] = preset.map(([n, v]) => {
                    const old = cur.find(r => r.name === n);
                    return { name: n, value: old ? old.value : v, custom: false };
                });
                refreshCalc(); toast('Пул собран: ' + preset.map(p => p[0]).join(' + ')); break;
            }
            case 'carrier': {
                const v = el.dataset.value;
                if (state.carrierId === v) break;
                const hadLog = state.log.length > 0;
                state.carrierId = v;
                const c = ctx.carriers[v];
                if (c && c.plates.length) {
                    if (c.plates.indexOf(state.plateId) < 0) state.plateId = c.plates[0];
                    state.integrityStart = ctx.plates[state.plateId].integrity;
                }
                if (hadLog) { const snap = state.log.slice(); state.log = []; refreshCalc(); toast('Сменился носитель брони — серия сброшена', () => { state.log = snap; refreshCalc(); }); }
                else refreshCalc();
                break;
            }
            case 'plate': {
                const v = el.dataset.value;
                if (state.plateId === v) break;
                const hadLog = state.log.length > 0;
                state.plateId = v;
                state.integrityStart = ctx.plates[v].integrity;
                if (hadLog) { const snap = state.log.slice(); state.log = []; refreshCalc(); toast('Сменилась пластина — серия сброшена', () => { state.log = snap; refreshCalc(); }); }
                else refreshCalc();
                break;
            }
            case 'roll': roll(el.dataset.pool); break;
            case 'rule-toggle':
                state.ruleValues[el.dataset.rule] = !ctx.rules[el.dataset.rule];
                rebuild(); refreshCalc(); R.renderReference(ctx, ui.refTab, ui.refQuery); break;
            case 'rule-step': {
                const k = el.dataset.rule, def = ctx.ruleDefs.find(r => r.key === k);
                state.ruleValues[k] = E.clamp(ctx.rules[k] + (+el.dataset.dir), def.min != null ? def.min : 0, def.max != null ? def.max : 99);
                rebuild(); refreshCalc(); R.renderReference(ctx, ui.refTab, ui.refQuery); break;
            }
            case 'log-add': logAdd(); break;
            case 'log-del': logDel(el.dataset.id); break;
            case 'log-dup': logDup(el.dataset.id); break;
            case 'log-up': logMove(el.dataset.id, -1); break;
            case 'log-down': logMove(el.dataset.id, 1); break;
            case 'log-clear': logClear(); break;
            case 'log-demo': logDemo(); break;
            case 'log-export': download('irreality-series.md', report()); break;
            case 'log-filter': state.logFilter = el.dataset.value; refreshCalc(); break;
            case 'copy': copyText(report(), 'Отчёт скопирован в буфер обмена'); break;
            case 'md': download('irreality-report.md', report()); break;
            case 'print': window.print(); break;
            case 'tpl': download('my-setting.json', JSON.stringify(M.template(), null, 2), 'application/json;charset=utf-8'); break;
            case 'idx-copy': copyText($('formatCode').textContent, 'Реестр скопирован'); break;
            case 'ref-tab': ui.refTab = el.dataset.tab; R.renderReference(ctx, ui.refTab, ui.refQuery); break;
            case 'gate-open': openGate(); break;
            case 'gate-close': closeGate(); break;
            case 'gate-enter': applyGate(); break;
            case 'mod-toggle': modToggle(el.dataset.id); break;
            case 'mod-up': modMove(el.dataset.id, -1); break;
            case 'mod-down': modMove(el.dataset.id, 1); break;
            case 'mod-remove': {
                const id = el.dataset.id;
                M.removeLocal(id);
                delete bundle.manifests[id];
                bundle.order = bundle.order.filter(x => x !== id);
                state.order = state.order.filter(x => x !== id);
                state.enabled = state.enabled.filter(x => x !== id);
                save(); R.renderGate(bundle, state); toast('Локальная копия модуля удалена');
                break;
            }
            case 'reset': {
                const snap = JSON.parse(JSON.stringify(state));
                const keep = { enabled: state.enabled, order: state.order, ruleValues: state.ruleValues, configured: true, uiMode: state.uiMode, theme: state.theme };
                state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), keep);
                refreshAll();
                toast('Параметры расчёта сброшены', () => { state = snap; refreshAll(); toast('Параметры восстановлены'); });
                break;
            }
            case 'jump': $('results').scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
            case 'toast-act': { const f = undoData; hideToast(); if (f) f(); break; }
            case 'toast-close': hideToast(); break;
        }
    }

    function onInput(ev) {
        const t = ev.target, d = t.dataset || {};
        if (d.poolValue) {
            const v = parseInt(t.value, 10);
            if (!Number.isFinite(v)) return;
            const r = rowsOf(d.poolValue)[+d.idx];
            if (r) r.value = E.clamp(v, POOL_MIN, POOL_MAX);
            refreshCalc(); return;
        }
        if (d.poolCustom) {
            const r = rowsOf(d.poolCustom)[+d.idx];
            if (r) r.name = t.value;
            refreshCalc(); return;
        }
        if (d.key) {
            const k = d.key;
            if (t.type === 'range' || t.type === 'number') {
                const v = parseInt(t.value, 10);
                if (!Number.isFinite(v)) return;
                if (k === 'integrityStart') {
                    const p = ctx.plates[state.plateId];
                    state.integrityStart = E.clamp(v, 0, p ? p.integrity : 0);
                } else state[k] = E.clamp(v, LIM[k] ? LIM[k][0] : 0, LIM[k] ? LIM[k][1] : 99);
                if (t.type === 'range') R.paintRange(t);
                refreshCalc();
            }
            return;
        }
        if (d.ruleInput) {
            const def = ctx.ruleDefs.find(r => r.key === d.ruleInput);
            const v = parseInt(t.value, 10);
            if (!Number.isFinite(v)) return;
            state.ruleValues[d.ruleInput] = E.clamp(v, def.min != null ? def.min : 0, def.max != null ? def.max : 99);
            rebuild(); refreshCalc(); return;
        }
        if (t.id === 'logSearch') { state.logSearch = t.value; R.renderLog(state, series, ctx); save(); }
        if (t.id === 'refSearch') { ui.refQuery = t.value; R.renderReference(ctx, ui.refTab, ui.refQuery); }
    }

    function onChange(ev) {
        const t = ev.target, d = t.dataset || {};
        if (d.poolName) {
            const r = rowsOf(d.poolName)[+d.idx];
            if (!r) return;
            if (t.value === '__custom') { r.custom = true; r.name = r.name && ctx.attributes.concat(ctx.skills).indexOf(r.name) < 0 ? r.name : ''; }
            else { r.custom = false; r.name = t.value; }
            refreshCalc(); return;
        }
        if (d.key) {
            const k = d.key;
            if (t.type === 'checkbox') { state[k] = t.checked; refreshCalc(); return; }
            if (t.tagName === 'SELECT') {
                state[k] = t.value;
                if (k === 'weaponId' && t.value && ctx.weapons[t.value]) {
                    const w = ctx.weapons[t.value];
                    state.rating = w.rating;
                    if (w.weaponClass && ctx.classes[w.weaponClass]) state.weaponClassId = w.weaponClass;
                }
                if (k === 'weaponClassId') state.weaponId = '';
                refreshCalc(); return;
            }
            if (t.type === 'number' || t.type === 'range') { refreshCalc(); return; }
        }
        if (d.ruleSelect) {
            state.ruleValues[d.ruleSelect] = t.value;
            rebuild(); refreshCalc(); R.renderReference(ctx, ui.refTab, ui.refQuery); return;
        }
        if (t.id === 'localFile' && t.files && t.files[0]) {
            const f = t.files[0], rd = new FileReader();
            rd.onload = () => {
                try {
                    const man = JSON.parse(String(rd.result));
                    const v = M.validate(man);
                    if (!v.ok) { toast('Модуль не прошёл валидацию: ' + v.errors[0]); return; }
                    if (bundle.manifests[man.id]) { toast('Модуль с id «' + man.id + '» уже загружен'); return; }
                    if (Object.keys(bundle.manifests).some(k => bundle.manifests[k].namespace === man.namespace)) { toast('namespace «' + man.namespace + '» уже занят'); return; }
                    M.addLocal(man);
                    bundle.manifests[man.id] = man;
                    bundle.order.push(man.id);
                    bundle.sources[man.id] = 'local';
                    state.order.push(man.id);
                    save(); R.renderGate(bundle, state);
                    toast('Модуль «' + man.name + '» загружен локально');
                } catch (e) { toast('Не удалось разобрать JSON: ' + e.message); }
            };
            rd.readAsText(f);
            t.value = '';
        }
    }

    function onBlur(ev) {
        const t = ev.target, d = t.dataset || {};
        if (d.key && t.type === 'number') t.value = d.key === 'integrityStart' ? state.integrityStart : state[d.key];
        if (d.ruleInput) t.value = ctx.rules[d.ruleInput];
        if (d.poolValue) { const r = rowsOf(d.poolValue)[+d.idx]; if (r) t.value = r.value; }
    }

    function onDragStart(ev) {
        const mh = ev.target.closest('[data-drag-mod]'), lh = ev.target.closest('[data-drag-log]');
        if (mh) { dragMod = mh.dataset.dragMod; mh.closest('.gcard').classList.add('dragging'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', dragMod); }
        if (lh) { dragLog = lh.dataset.dragLog; lh.closest('.log-item').classList.add('dragging'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', dragLog); }
    }
    function onDragOver(ev) {
        if (!dragMod && !dragLog) return;
        const card = ev.target.closest(dragMod ? '.gcard' : '.log-item');
        if (!card) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        const sel = dragMod ? '.gcard' : '.log-item';
        document.querySelectorAll(sel + '.drop-target').forEach(c => c.classList.remove('drop-target'));
        card.classList.add('drop-target');
    }
    function onDrop(ev) {
        if (dragMod) {
            const card = ev.target.closest('.gcard');
            ev.preventDefault();
            if (card) {
                const from = state.order.indexOf(dragMod), to = state.order.indexOf(card.dataset.mod);
                if (from > 0 && to > 0 && from !== to) { state.order.splice(from, 1); state.order.splice(to, 0, dragMod); save(); R.renderGate(bundle, state); }
            }
        }
        if (dragLog) {
            const card = ev.target.closest('.log-item');
            ev.preventDefault();
            if (card) {
                const from = state.log.findIndex(e => e.id === dragLog), to = state.log.findIndex(e => e.id === card.dataset.log);
                if (from >= 0 && to >= 0 && from !== to) { const it = state.log.splice(from, 1)[0]; state.log.splice(to, 0, it); refreshCalc(); }
            }
        }
        endDrag();
    }
    function endDrag() {
        document.querySelectorAll('.dragging,.drop-target').forEach(c => c.classList.remove('dragging', 'drop-target'));
        dragMod = null; dragLog = null;
    }

    function initObservers() {
        if (!('IntersectionObserver' in window)) return;
        const nav = new IntersectionObserver(es => {
            es.forEach(e => { if (e.isIntersecting) document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === e.target.id)); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['calc', 'log', 'ref', 'format'].forEach(id => { const el = $(id); if (el) nav.observe(el); });
        const out = new IntersectionObserver(es => { es.forEach(e => $('jumpPill').classList.toggle('away', e.isIntersecting)); }, { threshold: 0.04 });
        out.observe($('results'));
    }

    function bind() {
        document.addEventListener('click', onClick);
        document.addEventListener('input', onInput);
        document.addEventListener('change', onChange);
        document.addEventListener('blur', onBlur, true);
        document.addEventListener('dragstart', onDragStart);
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('drop', onDrop);
        document.addEventListener('dragend', endDrag);
        document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('gate').hidden && state.configured) closeGate(); });
        window.addEventListener('beforeunload', save);
    }

    (async function boot() {
        bundle = await M.load();
        if (!state.order.length) state.order = bundle.order.slice();
        bundle.order.forEach(id => { if (state.order.indexOf(id) < 0) state.order.push(id); });
        state.order = state.order.filter(id => bundle.manifests[id]);
        bundle.order.forEach(id => {
            const m = bundle.manifests[id];
            if ((m.kind === 'core' || m.required) && state.enabled.indexOf(id) < 0) state.enabled.push(id);
        });
        state.enabled = state.enabled.filter(id => bundle.manifests[id]);
        if (fresh && bundle.manifests['isotope-tier'] && state.enabled.indexOf('isotope-tier') < 0) state.enabled.push('isotope-tier');

        applyTheme(); applyUiMode();
        rebuild(); ensure();
        if (fresh) seedSeries([{ attack: 5, defense: 2 }, { attack: 6, defense: 2 }, { attack: 2, defense: 3 }]);
        R.buildStatic(ctx, state);
        bind(); initObservers();
        refreshCalc();
        R.renderReference(ctx, ui.refTab, ui.refQuery);
        if (!state.configured) openGate();
        else if (bundle.errors.length) toast('Модули загружены с замечаниями — откройте конфигурацию');
    })();
})();