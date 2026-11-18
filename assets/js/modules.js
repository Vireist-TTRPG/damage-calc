/* IRREALITY · загрузка, валидация и порядок модулей. */
(function () {
    'use strict';
    const NS_RE = /^[a-z][a-z0-9-]{0,23}$/;

    function validate(m) {
        const errors = [];
        if (!m || typeof m !== 'object') return { ok: false, errors: ['Манифест не является объектом.'] };
        if (!m.id || typeof m.id !== 'string') errors.push('Отсутствует поле id.');
        if (!m.name) errors.push('Отсутствует поле name.');
        if (!m.namespace || !NS_RE.test(m.namespace)) errors.push('namespace должен быть строчным латинским идентификатором (a-z, 0-9, дефис).');
        if (m.kind && ['core', 'module'].indexOf(m.kind) < 0) errors.push('kind должен быть core или module.');
        ['plates', 'ammo', 'carriers', 'fireModes', 'weaponClasses', 'covers', 'rules', 'weapons', 'damageTypes', 'attributes', 'skills'].forEach(k => {
            if (m[k] !== undefined && !Array.isArray(m[k])) errors.push('Поле ' + k + ' должно быть массивом.');
        });
        (m.plates || []).forEach(p => {
            if (!p.id) errors.push('Пластина без id.');
            if (!Number.isFinite(+p.defense)) errors.push('Пластина ' + (p.code || p.id) + ': defense должен быть числом.');
            if (!Number.isFinite(+p.integrity)) errors.push('Пластина ' + (p.code || p.id) + ': integrity должна быть числом.');
        });
        (m.ammo || []).forEach(a => { if (!a.id) errors.push('Патрон без id.'); });
        (m.rules || []).forEach(r => {
            if (!r.id) errors.push('Правило без id.');
            if (['toggle', 'number', 'select'].indexOf(r.type) < 0) errors.push('Правило ' + r.id + ': тип должен быть toggle, number или select.');
        });
        return { ok: errors.length === 0, errors };
    }

    function add(out, man, source) {
        const v = validate(man);
        if (!v.ok) { out.errors.push({ id: man.id || '?', message: v.errors.join(' ') }); return false; }
        if (out.manifests[man.id]) { out.errors.push({ id: man.id, message: 'Дубликат id — модуль пропущен.' }); return false; }
        const clash = Object.keys(out.manifests).find(k => out.manifests[k].namespace === man.namespace);
        if (clash) { out.errors.push({ id: man.id, message: 'namespace «' + man.namespace + '» уже занят модулем ' + clash + ' — пропущен.' }); return false; }
        out.manifests[man.id] = man;
        out.order.push(man.id);
        out.sources[man.id] = source;
        return true;
    }

    function useEmbedded(out, reason) {
        out.manifests = {}; out.order = []; out.sources = {};
        window.IR_EMBEDDED.registry.forEach(ent => {
            const m = window.IR_EMBEDDED.manifests[ent.id];
            if (m) add(out, JSON.parse(JSON.stringify(m)), 'embedded');
        });
        out.mode = 'embedded';
        if (reason) out.errors.unshift({ id: 'загрузка', message: reason });
        loadLocal().forEach(m => add(out, m, 'local'));
        return out;
    }

    async function load() {
        const out = { manifests: {}, order: [], sources: {}, errors: [], mode: 'files' };
        if (location.protocol === 'file:') return useEmbedded(out, 'Открыто как файл (file://) — использованы встроенные копии модулей. На GitHub Pages будут читаться файлы из /modules.');
        let reg;
        try {
            const r = await fetch('modules/index.json', { cache: 'no-cache' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            reg = await r.json();
        } catch (e) {
            return useEmbedded(out, 'Реестр modules/index.json недоступен (' + e.message + ') — использованы встроенные копии.');
        }
        const entries = Array.isArray(reg.modules) ? reg.modules : [];
        for (const ent of entries) {
            const file = typeof ent === 'string' ? ent : ent.file;
            const id = (typeof ent === 'object' && ent.id) || file;
            try {
                const r = await fetch('modules/' + file, { cache: 'no-cache' });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                add(out, await r.json(), 'file');
            } catch (e) {
                const emb = window.IR_EMBEDDED.manifests[id];
                if (emb) {
                    add(out, JSON.parse(JSON.stringify(emb)), 'embedded');
                    out.errors.push({ id, message: 'Файл недоступен (' + e.message + ') — взята встроенная копия.' });
                } else out.errors.push({ id, message: 'Не загружен: ' + e.message });
            }
        }
        if (!out.order.length) return useEmbedded(out, 'Ни один модуль не загружен — использованы встроенные копии.');
        loadLocal().forEach(m => add(out, m, 'local'));
        return out;
    }

    const LK = 'irreality.localmodules.v2';
    function loadLocal() { try { const a = JSON.parse(localStorage.getItem(LK)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function saveLocal(list) { try { localStorage.setItem(LK, JSON.stringify(list)); } catch (e) {} }
    function addLocal(man) {
        const v = validate(man);
        if (!v.ok) return v;
        const list = loadLocal().filter(m => m.id !== man.id);
        list.push(man); saveLocal(list);
        return { ok: true, errors: [] };
    }
    function removeLocal(id) { saveLocal(loadLocal().filter(m => m.id !== id)); }

    function template() {
        return {
            schema: 'irreality.module/1',
            id: 'my-setting', kind: 'module', name: 'Мой сеттинг', namespace: 'my',
            version: '1.0.0', author: '', description: 'Опишите, что добавляет модуль.',
            requires: ['irreality-core'],
            attributes: [], skills: [],
            rules: [{ id: 'extraWear', label: 'Доп. износ за обстрел', hint: 'Пример настраиваемого правила.', type: 'number', default: 0, min: 0, max: 5 }],
            carrierExtensions: [{ target: 'core:heavy', addPlates: ['my-plate'] }],
            plates: [{ id: 'my-plate', code: 'МП', name: 'Моя пластина', defense: 4, integrity: 12, rounding: 'floor', breakPenalty: 2, firstShot: { type: 'defenseBonus', value: 1 }, effects: [{ type: 'extraWear', amount: 0, rule: 'my:extraWear', when: {}, label: 'Доп. износ' }], notes: '' }],
            ammo: [{ id: 'my-ammo', code: 'МЙ', name: 'Мой патрон', damageType: 'aggravated', damageBonus: 1, armorPierce: 0, tags: [], description: 'Описание эффекта патрона.' }],
            weapons: [{ id: 'my-gun', name: 'Мой ствол', rating: 4, weaponClass: 'core:assault', description: '' }]
        };
    }

    window.IRModules = { load, validate, addLocal, removeLocal, loadLocal, template };
})();