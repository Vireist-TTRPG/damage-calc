/* IRREALITY · рендер. Чистые функции отображения. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const E = window.IREngine;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const plural = (n, a, b, c) => { const m = n % 100; if (m >= 11 && m <= 14) return c; const k = n % 10; return k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
    const sgn = n => (n > 0 ? '+' + n : String(n));

    function tween(el, val, prefix) {
        if (!el) return;
        prefix = prefix || '';
        const target = Number(val) || 0;
        if (RM) { el._v = target; el.textContent = prefix + target; return; }
        const from = Number.isFinite(el._v) ? el._v : 0;
        if (from === target) { el.textContent = prefix + target; return; }
        cancelAnimationFrame(el._raf);
        const t0 = performance.now(), dur = 260;
        const step = t => {
            const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
            el._v = Math.round(from + (target - from) * e);
            el.textContent = prefix + el._v;
            if (p < 1) el._raf = requestAnimationFrame(step); else el._v = target;
        };
        el._raf = requestAnimationFrame(step);
    }

    const ICON = {
        shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/></svg>',
        hex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 21 7 21 17 12 22 3 17 3 7"/></svg>',
        lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
        warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".7" fill="currentColor"/></svg>',
        grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
        chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 15 6-6 6 6"/></svg>',
        down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
        target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
        miss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/></svg>'
    };

    /* Чип патрона/режима: код и полное название — всегда две строки,
       выбор меняет только подсветку, но не раскладку подписи. */
    const chipLabel = (code, name) => '<b>' + esc(code) + '</b><small>' + esc(name) + '</small>';

    function buildStatic(ctx, state) {
        const cs = $('classSelect');
        cs.innerHTML = Object.keys(ctx.classes).map(k => '<option value="' + k + '">' + esc(ctx.classes[k].name) + '</option>').join('');
        cs.value = state.weaponClassId;
        const wKeys = Object.keys(ctx.weapons);
        $('weaponSelectWrap').hidden = wKeys.length === 0;
        if (wKeys.length) {
            $('weaponSelect').innerHTML = '<option value="">— задать Рейтинг вручную —</option>' +
                wKeys.map(k => '<option value="' + k + '">' + esc(ctx.weapons[k].name) + ' (+' + ctx.weapons[k].rating + ')</option>').join('');
            $('weaponSelect').value = state.weaponId || '';
        }
        $('modCount').textContent = ctx.modules.length;
        $('activeModChips').innerHTML = ctx.modules.map(m =>
            '<span class="mod-chip' + (m.kind === 'core' ? '' : ' iso') + '"><i></i>' + esc(m.name) + ' · ' + esc(m.namespace) + '</span>').join('');
        $('ammoCount').textContent = Object.keys(ctx.ammo).length + ' в базе';
    }

    /* ---------- конструктор пула ---------- */
    function poolOptions(ctx, row) {
        const grp = (label, arr) => arr.length
            ? '<optgroup label="' + esc(label) + '">' + arr.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('') + '</optgroup>'
            : '';
        let html = grp('Атрибуты', ctx.attributes) + grp('Навыки', ctx.skills);
        const known = ctx.attributes.concat(ctx.skills);
        if (!row.custom && row.name && known.indexOf(row.name) < 0) html += '<optgroup label="Из модуля"><option value="' + esc(row.name) + '">' + esc(row.name) + '</option></optgroup>';
        html += '<optgroup label="Прочее"><option value="__custom">Своё название / модификатор…</option></optgroup>';
        return html;
    }
    function syncPoolRows(state, ctx) {
        [['attack', 'poolAttackRows', state.poolAttack], ['defense', 'poolDefenseRows', state.poolDefense]].forEach(([side, elId, rows]) => {
            const box = $(elId);
            if (!box) return;
            const sig = side + '|' + rows.map(r => (r.custom ? '#' : r.name)).join(',') + '|' + ctx.attributes.length + ':' + ctx.skills.length;
            if (box._sig !== sig) {
                const act = document.activeElement;
                const restore = act && act.dataset && act.dataset.poolName === side ? +act.dataset.idx : -1;
                box.innerHTML = rows.map((r, i) =>
                    '<div class="prow">' +
                    '<select data-pool-name="' + side + '" data-idx="' + i + '" aria-label="Компонент пула ' + (side === 'attack' ? 'атаки' : 'защиты') + '">' + poolOptions(ctx, r) + '</select>' +
                    '<div class="stepper sm"><button type="button" data-act="pool-step" data-side="' + side + '" data-idx="' + i + '" data-dir="-1" aria-label="минус">−</button>' +
                    '<input type="number" data-pool-value="' + side + '" data-idx="' + i + '" value="' + r.value + '" min="-5" max="12" aria-label="Значение компонента">' +
                    '<button type="button" data-act="pool-step" data-side="' + side + '" data-idx="' + i + '" data-dir="1" aria-label="плюс">+</button></div>' +
                    '<button type="button" class="icon-btn del" data-act="pool-del" data-side="' + side + '" data-idx="' + i + '" title="Убрать компонент">✕</button>' +
                    (r.custom ? '<input class="pcustom" data-pool-custom="' + side + '" data-idx="' + i + '" value="' + esc(r.name) + '" placeholder="Название компонента" aria-label="Своё название компонента">' : '') +
                    '</div>').join('');
                box._sig = sig;
                if (restore >= 0) { const s = box.querySelector('[data-pool-name="' + side + '"][data-idx="' + restore + '"]'); if (s) s.focus(); }
            }
            rows.forEach((r, i) => {
                const sel = box.querySelector('[data-pool-name="' + side + '"][data-idx="' + i + '"]');
                const val = box.querySelector('[data-pool-value="' + side + '"][data-idx="' + i + '"]');
                const cus = box.querySelector('[data-pool-custom="' + side + '"][data-idx="' + i + '"]');
                if (sel && document.activeElement !== sel) sel.value = r.custom ? '__custom' : r.name;
                if (val && document.activeElement !== val) val.value = r.value;
                if (cus && document.activeElement !== cus) cus.value = r.name;
            });
        });
    }

    function syncInputs(state, ctx) {
        ['attack', 'defense', 'rating'].forEach(k => {
            const el = $('in-' + k);
            if (el && document.activeElement !== el) el.value = state[k];
        });
        const aa = $('autoApply'); if (aa) aa.checked = !!state.autoApply;
        const cs = $('classSelect'); if (cs && document.activeElement !== cs) cs.value = state.weaponClassId;
        syncPoolRows(state, ctx);

        const c = ctx.classes[state.weaponClassId];
        const bands = [['near', 'Ближняя'], ['mid', 'Средняя'], ['far', 'Дальняя']];
        $('distSeg').innerHTML = bands.map(b => {
            const band = c && c.bands ? c.bands[b[0]] : null;
            const d = band ? E.num(band.dice) : 0;
            return '<button type="button" data-act="set" data-key="distanceBand" data-value="' + b[0] + '" class="' + (state.distanceBand === b[0] ? 'on' : '') + '">' +
                b[1].toUpperCase() + '<small>' + esc(band ? band.label : '—') + (d ? ' · ' + sgn(d) + ' куб.' : '') + '</small></button>';
        }).join('');

        const band = c && c.bands ? c.bands[state.distanceBand] : null;
        const auto = ctx.rules.autoShotRating && band && band.rating !== undefined && band.rating !== null;
        $('in-rating').disabled = !!auto;
        $('in-rating').parentNode.querySelectorAll('button').forEach(b => { b.disabled = !!auto; });
        $('ratingNote').innerHTML = auto
            ? '<b>Рейтинг задан таблицей дистанций:</b> ' + esc(c.name) + ' · ' + esc(band.label) + ' → +' + band.rating + '. Отключается правилом «Авто-Рейтинг дроби по дистанции».'
            : (c ? esc(c.note || '') : '');

        $('modeChips').innerHTML = Object.keys(ctx.modes).map(k => {
            const m = ctx.modes[k], on = state.modeId === k;
            return '<button type="button" class="mchip' + (on ? ' on' : '') + '" data-act="set" data-key="modeId" data-value="' + k + '" aria-pressed="' + on + '">' +
                chipLabel(m.code, m.name) + '</button>';
        }).join('');
        const mode = ctx.modes[state.modeId];
        $('aimWrap').hidden = !(mode && mode.aim);
        if (mode && mode.aim) {
            const r = $('in-aimTurns');
            r.max = mode.aim.max; if (document.activeElement !== r) r.value = state.aimTurns;
            $('aimVal').textContent = state.aimTurns;
            $('headshotTgl').setAttribute('aria-checked', state.headshot ? 'true' : 'false');
            paintRange(r);
        }
        $('modeNote').innerHTML = mode ? '<b>' + esc(mode.name) + '.</b> Расход: ' + esc(mode.cost) + '. ' + esc(mode.note || '') : '';

        const byMod = {};
        Object.keys(ctx.ammo).forEach(k => { const a = ctx.ammo[k]; (byMod[a.ns] = byMod[a.ns] || { m: a.module, list: [] }).list.push(a); });
        $('ammoGroups').innerHTML = Object.keys(byMod).map(ns => {
            const g = byMod[ns];
            return '<div class="ammo-group"><div class="ag-head' + (g.m.kind === 'core' ? '' : ' iso') + '"><i></i>' + esc(g.m.name.toUpperCase()) + '<span>' + g.list.length + '</span></div><div class="ammo-chips">' +
                g.list.map(a => {
                    const on = state.ammoId === a.uid;
                    return '<button type="button" class="achip' + (g.m.kind === 'core' ? '' : ' iso') + (on ? ' on' : '') + '" data-act="set" data-key="ammoId" data-value="' + a.uid + '" aria-pressed="' + on + '">' +
                        chipLabel(a.code, a.name) + '</button>';
                }).join('') + '</div></div>';
        }).join('');
        const am = ctx.ammo[state.ammoId], ad = $('ammoDesc');
        if (am) {
            ad.className = 'ammo-desc' + (am.module.kind === 'core' ? '' : ' iso');
            const tags = ['<span class="badge ' + (am.damageType === 'surface' ? 'surf' : 'agg') + '">' + esc(E.typeLabel(ctx, am.damageType || 'aggravated').toUpperCase()) + '</span>'];
            if (am.fixedDamage) tags.push('<span class="badge dim">ФИКС. УРОН</span>');
            if (am.armorPierce) tags.push('<span class="badge agg">ПРОБИТИЕ ' + am.armorPierce + '</span>');
            if (am.attackDice) tags.push('<span class="badge steel">' + sgn(am.attackDice) + ' КУБИК</span>');
            if (am.ignoreWearDivision) tags.push('<span class="badge surf">БЕЗ ДЕЛЕНИЯ</span>');
            (am.tags || []).forEach(t => tags.push('<span class="badge iso">' + esc(t.toUpperCase()) + '</span>'));
            ad.innerHTML = '<b>' + esc(am.name) + ' · ' + esc(am.code) + '.</b> ' + esc(am.description || '') + '<div class="ammo-tags">' + tags.join('') + '</div>';
        } else ad.innerHTML = '';

        $('carrierSeg').innerHTML = Object.keys(ctx.carriers).map(k =>
            '<button type="button" data-act="carrier" data-value="' + k + '" class="' + (state.carrierId === k ? 'on' : '') + '">' + esc(ctx.carriers[k].name.toUpperCase()) + '</button>').join('');
        const carrier = ctx.carriers[state.carrierId];
        const noArmor = !carrier || !carrier.plates.length;
        $('armorBody').hidden = noArmor;
        if (!noArmor) {
            $('plateGrid').innerHTML = Object.keys(ctx.plates).map(k => {
                const p = ctx.plates[k], ok = carrier.plates.indexOf(k) >= 0;
                return '<button type="button" class="plate' + (state.plateId === k ? ' on' : '') + '" data-act="plate" data-value="' + k + '"' + (ok ? '' : ' disabled') + ' title="' + (ok ? esc(p.name) : 'Недоступно для этого носителя') + '">' +
                    '<span class="pcode">' + esc(p.code) + '</span><span class="pname">' + esc(p.name) + '</span>' +
                    '<span class="pstats"><span class="pd">' + ICON.shield + p.defense + '</span><span class="pi">' + ICON.hex + p.integrity + '</span></span>' +
                    (ok ? (p.module.kind === 'core' ? '' : '<span class="pmod">' + esc(p.ns.toUpperCase()) + '</span>') : '<span class="plock">' + ICON.lock + '</span>') +
                    '</button>';
            }).join('');
            const p = ctx.plates[state.plateId];
            if (p) {
                const r = $('in-integrity');
                r.max = p.integrity; if (document.activeElement !== r) r.value = state.integrityStart;
                paintRange(r);
                $('integVal').textContent = state.integrityStart;
                $('integMax').textContent = p.integrity;
                const st = state.integrityStart === 0 ? ['bad', 'СЛОМАНА'] : state.integrityStart === p.integrity ? ['ok', 'ЦЕЛА'] : ['warn', 'ИЗНОС'];
                $('integState').className = 'state-tag ' + st[0];
                $('integState').textContent = st[1];
            }
            $('firstSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === state.firstShotMode));
            let fn = '';
            if (!p || !p.firstShot) fn = 'У этой пластины нет эффекта первой пули.';
            else if (state.firstShotMode === 'off') fn = 'Эффект выключен вручную.';
            else if (state.firstShotMode === 'on') fn = 'Принудительно включён для текущего обстрела.';
            else fn = 'Авто: сработает при полной Целостности и первом обстреле серии.';
            $('firstNote').innerHTML = fn + (p && p.firstShot ? ' Эффект: ' + (p.firstShot.type === 'defenseBonus' ? '+' + p.firstShot.value + ' к Защите' : 'игнорирование избыточного урона') + '.' : '');
            const notes = [];
            if (carrier.passive && carrier.passive.text) notes.push(carrier.name + ': ' + carrier.passive.text);
            if (p && p.passive && p.passive.text) notes.push(p.code + ': ' + p.passive.text);
            if (p && p.notes) notes.push(p.code + ': ' + p.notes);
            $('passiveBox').innerHTML = notes.map(n => '<div class="passive">' + ICON.warn + '<span>' + esc(n) + '</span></div>').join('');
        }

        $('coverSeg').innerHTML = Object.keys(ctx.covers).map(k => {
            const cv = ctx.covers[k];
            return '<button type="button" data-act="set" data-key="coverId" data-value="' + k + '" class="' + (state.coverId === k ? 'on' : '') + '">' + esc(cv.name.toUpperCase()) +
                '<small>' + (cv.untargetable ? 'не атаковать' : cv.dice ? '+' + cv.dice + ' куб.' : '—') + '</small></button>';
        }).join('');
        $('coverNote').textContent = ctx.covers[state.coverId] ? ctx.covers[state.coverId].note : '';

        const groups = {};
        ctx.ruleDefs.forEach(r => { (groups[r.ns] = groups[r.ns] || { m: r.module, list: [] }).list.push(r); });
        $('rulesBox').innerHTML = Object.keys(groups).map(ns => {
            const g = groups[ns];
            return '<div class="rule-group"><div class="rg-head' + (g.m.kind === 'core' ? '' : ' iso') + '"><i></i>' + esc(g.m.name.toUpperCase()) + '</div>' +
                g.list.map(r => {
                    const val = ctx.rules[r.key];
                    const dep = r.dependsOn ? !!ctx.rules[r.dependsOn] : true;
                    let control;
                    if (r.type === 'toggle') control = '<button type="button" class="switch" data-act="rule-toggle" data-rule="' + r.key + '" role="switch" aria-checked="' + (val ? 'true' : 'false') + '" aria-label="' + esc(r.label) + '"' + (dep ? '' : ' disabled') + '><i></i></button>';
                    else if (r.type === 'number') control = '<div class="rule-num"><button type="button" data-act="rule-step" data-rule="' + r.key + '" data-dir="-1" aria-label="минус">−</button><input type="number" data-rule-input="' + r.key + '" value="' + val + '" min="' + (r.min != null ? r.min : 0) + '" max="' + (r.max != null ? r.max : 99) + '"' + (dep ? '' : ' disabled') + ' aria-label="' + esc(r.label) + '"><button type="button" data-act="rule-step" data-rule="' + r.key + '" data-dir="1" aria-label="плюс">+</button></div>';
                    else control = '<select data-rule-select="' + r.key + '"' + (dep ? '' : ' disabled') + ' aria-label="' + esc(r.label) + '">' + (r.options || []).map(o => '<option value="' + esc(o.value) + '"' + (String(val) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
                    return '<div class="rule' + (dep ? '' : ' disabled') + '">' + control + '<div class="sw-txt"><b>' + esc(r.label) + '</b><small>' + esc(r.hint || '') + '</small></div></div>';
                }).join('') + '</div>';
        }).join('');

        const sc = $('simpleCtx');
        if (sc) {
            const bl = band ? band.label : '—';
            sc.innerHTML = 'Скрытые параметры сейчас: <b>' + esc(mode ? mode.name : '—') + '</b> · ' + esc(c ? c.name : '—') +
                ' · ' + esc(bl) + ' · укрытие: <b>' + esc(ctx.covers[state.coverId] ? ctx.covers[state.coverId].name : '—') + '</b>.';
        }
    }

    function paintRange(r) {
        if (!r) return;
        const max = +r.max || 1, v = +r.value || 0;
        const pct = Math.round((v / max) * 100);
        r.style.background = 'linear-gradient(to right, var(--steel) ' + pct + '%, var(--line) ' + pct + '%)';
    }

    function renderPool(state, pool) {
        $('poolAttackTotal').textContent = pool.attack.total;
        $('poolDefenseTotal').textContent = pool.defense.total;
        const chip = p => '<span class="pm ' + (p.manual ? 'man' : p.value > 0 ? 'pos' : p.value < 0 ? 'neg' : '') + '">' + esc(p.label) + ' ' + sgn(p.value) + '</span>';
        $('poolRead').innerHTML =
            '<div class="pool-pill a' + (pool.attack.total <= 0 ? ' warn' : '') + '"><small>ИТОГО АТАКА</small><b>' + pool.attack.total + '</b><i>' + plural(pool.attack.total, 'кубик', 'кубика', 'кубиков') + '</i></div>' +
            '<div class="pool-pill d' + (pool.defense.total <= 0 ? ' warn' : '') + '"><small>ИТОГО ЗАЩИТА</small><b>' + pool.defense.total + '</b><i>' + (pool.defense.successMod ? sgn(pool.defense.successMod) + ' к успехам' : plural(pool.defense.total, 'кубик', 'кубика', 'кубиков')) + '</i></div>' +
            '<div class="pool-mods">' + pool.attack.parts.concat(pool.defense.parts).filter(p => !p.manual && p.value).map(chip).join('') + '</div>';
        const tray = (title, arr, mod) => {
            if (!arr || !arr.length) return '';
            const s = Math.max(0, E.diceSuccesses(arr) + (mod || 0));
            return '<div class="dice-tray"><div class="dt-head">' + title + '<b>' + s + ' ' + plural(s, 'успех', 'успеха', 'успехов') + (mod ? ' (' + sgn(mod) + ' пассив)' : '') + '</b></div><div class="dice">' +
                arr.map((d, i) => '<span class="die ' + (d.crit ? 'c' : d.s ? 's' : d.one ? 'one' : '') + '" style="--i:' + i + '">' + d.v + '</span>').join('') + '</div></div>';
        };
        $('diceTrays').innerHTML = tray('АТАКА', state.dice.attack, 0) + tray('ЗАЩИТА', state.dice.defense, pool.defense.successMod);
    }

    const traceHTML = steps => steps.map(s => '<li class="' + esc(s.tone || 'dim') + '"><span class="tl">' + esc(s.label) + '</span><span class="te">' + esc(s.expr) + '</span></li>').join('');

    function renderResults(state, r, ctx) {
        const v = $('verdict');
        const label = r.blocked ? 'ЦЕЛЬ НЕДОСТУПНА' : r.hit ? 'ПОПАДАНИЕ' : 'ПРОМАХ';
        v.className = 'verdict ' + (r.blocked ? 'blocked' : r.hit ? 'hit' : 'miss');
        v.innerHTML = (r.hit ? ICON.target : ICON.miss) + '<div><div class="vw">' + label + '</div><div class="vs">Разница ' + r.margin + ' · ' +
            esc(r.ammo ? r.ammo.code : '—') + ' · ' + esc(r.mode ? r.mode.name : '—') + ' · ' + (r.armored ? esc(r.plate.code) + ' ' + esc(r.plate.name) : 'без брони') + '</div></div>';

        const agg = E.num(r.hp.aggravated), surf = E.num(r.hp.surface);
        tween($('roAgg'), agg); tween($('roSurf'), surf);
        tween($('roWear'), r.wear.total, r.wear.total > 0 ? '−' : '');
        $('roAgg').parentNode.classList.toggle('zero', agg === 0);
        $('roSurf').parentNode.classList.toggle('zero', surf === 0);
        $('roWear').parentNode.classList.toggle('zero', r.wear.total === 0);

        tween($('mMargin'), r.margin); tween($('mDamage'), r.damageTotal); tween($('mAbsorbed'), r.absorbed);
        $('mIntegrity').textContent = r.armored ? r.integrityAfter + '/' + r.integrityMax : '—';

        const mr = $('marginRead');
        mr.className = 'margin-read' + (r.margin <= 0 ? ' miss' : '');
        mr.innerHTML = 'РАЗНИЦА = <b>' + state.attack + ' − ' + state.defense + ' = ' + r.margin + '</b>' +
            '<span class="tag">' + (r.blocked ? 'ЦЕЛЬ НЕДОСТУПНА' : r.margin > 0 ? 'ПОПАДАНИЕ' : 'ПРОМАХ · УРОНА И ИЗНОСА НЕТ') + '</span>';

        const total = Math.max(1, r.damageTotal), segs = [];
        if (r.absorbed > 0) segs.push({ cls: 'absorbed', v: r.absorbed, t: 'ПОГЛОЩЕНО ' + r.absorbed });
        if (agg > 0) segs.push({ cls: 'agg', v: agg, t: 'УСУГ ' + agg });
        if (surf > 0) segs.push({ cls: 'surf', v: surf, t: 'ПОВ ' + surf });
        $('splitBox').innerHTML =
            '<div class="split-head">РАСПРЕДЕЛЕНИЕ УРОНА<b>' + r.damageTotal + '</b></div>' +
            '<div class="split-bar">' + (segs.length ? segs.map(s => '<div class="sb ' + s.cls + '" style="width:' + ((s.v / total) * 100).toFixed(2) + '%"><span>' + s.t + '</span></div>').join('') : '<div class="sb empty">УРОН НЕ НАЧИСЛЕН</div>') + '</div>' +
            '<div class="split-legend"><span class="sl absorbed"><i></i>Поглощено пластиной <b>' + r.absorbed + '</b></span>' +
            '<span class="sl agg"><i></i>Усугублённый в здоровье <b>' + agg + '</b></span>' +
            '<span class="sl surf"><i></i>Поверхностный в здоровье <b>' + surf + '</b></span></div>';

        const g = $('gaugeBox');
        if (r.armored) {
            const max = Math.max(1, r.integrityMax);
            const lost = Math.min(r.wear.total, r.integrityBefore);
            const leftPct = (r.integrityAfter / max) * 100, lostPct = (lost / max) * 100;
            const gonePct = Math.max(0, 100 - leftPct - lostPct);
            const st = r.integrityAfter === 0 ? ['bad', 'СЛОМАНА'] : r.integrityAfter === r.integrityMax ? ['ok', 'ЦЕЛА'] : ['warn', 'ИЗНОС'];
            g.innerHTML = '<div class="gauge-head">ЦЕЛОСТНОСТЬ ПЛАСТИНЫ ' + esc(r.plate.code) +
                '<b><span class="was">' + r.integrityBefore + ' →</span> ' + r.integrityAfter + ' / ' + r.integrityMax + '</b></div>' +
                '<div class="gauge-track"><div class="gt left" style="width:' + leftPct.toFixed(2) + '%"></div><div class="gt lost" style="width:' + lostPct.toFixed(2) + '%"></div><div class="gt gone" style="width:' + gonePct.toFixed(2) + '%"></div></div>' +
                '<div class="gauge-foot"><span>износ за обстрел −' + r.wear.total + '</span>' +
                (r.wear.divided ? '<span>· ' + r.absorbed + ' ÷ ' + ctx.rules.wearDivider + ' → ' + r.wear.base + '</span>' : '') +
                (r.wear.extra ? '<span>· доп. −' + r.wear.extra + '</span>' : '') +
                '<span class="lamp ' + st[0] + '"><u></u>' + st[1] + '</span></div>';
        } else {
            g.innerHTML = '<div class="gauge-head">ЦЕЛОСТНОСТЬ ПЛАСТИНЫ<b>—</b></div><div class="gauge-track"><div class="gt gone" style="width:100%"></div></div>' +
                '<div class="gauge-foot"><span>броня не надета — износ не начисляется</span><span class="lamp none"><u></u>БЕЗ БРОНИ</span></div>';
        }

        const flags = r.flags.concat(r.warnings.map(w => ({ tone: 'warn', text: w })));
        $('flagBox').innerHTML = flags.map(f => '<span class="flag ' + esc(f.tone) + '"><i></i><span>' + esc(f.text) + '</span></span>').join('');
        $('traceBox').innerHTML = traceHTML(r.steps);
        $('traceCount').textContent = r.steps.length + ' ' + plural(r.steps.length, 'шаг', 'шага', 'шагов');
        $('jumpTxt').textContent = 'УСУГ ' + agg + ' · ПОВ ' + surf + (r.armored ? ' · БРОНЯ −' + r.wear.total : '');
    }

    function renderLog(state, series, ctx) {
        const t = series.totals, n = series.entries.length;
        const armed = series.pending.armored;
        const p = armed ? ctx.plates[state.plateId] : null;
        $('logSummary').innerHTML =
            '<div class="ls"><small>ОБСТРЕЛОВ</small><b>' + n + '</b></div>' +
            '<div class="ls ok adv"><small>ПОПАДАНИЙ</small><b>' + t.hits + '</b></div>' +
            '<div class="ls adv"><small>ПРОМАХОВ</small><b>' + t.misses + '</b></div>' +
            '<div class="ls agg"><small>Σ УСУГУБЛЁННЫЙ</small><b>' + t.agg + '</b></div>' +
            '<div class="ls surf adv"><small>Σ ПОВЕРХНОСТНЫЙ</small><b>' + t.surf + '</b></div>' +
            '<div class="ls steel"><small>ЦЕЛОСТНОСТЬ СЕЙЧАС</small><b>' + (p ? series.chainIntegrity + '/' + p.integrity : '—') + '</b></div>';
        $('logSimpleCount').textContent = n + ' ' + plural(n, 'обстрел', 'обстрела', 'обстрелов') + ' в серии · усуг ' + t.agg + ' · пов ' + t.surf;

        $('logFilter').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === state.logFilter));
        const simple = state.uiMode === 'simple';
        const q = simple ? '' : (state.logSearch || '').trim().toLowerCase();
        const rows = series.entries.filter(x => {
            if (!simple && state.logFilter === 'hit' && !x.result.hit) return false;
            if (!simple && state.logFilter === 'miss' && x.result.hit) return false;
            if (!q) return true;
            const r = x.result;
            return [r.ammo && r.ammo.code, r.ammo && r.ammo.name, r.plate && r.plate.code, r.plate && r.plate.name, r.mode && r.mode.name, r.carrier && r.carrier.name].join(' ').toLowerCase().indexOf(q) >= 0;
        });

        $('logEmpty').classList.toggle('show', n === 0);
        $('logList').innerHTML = rows.map(x => {
            const r = x.result, e = x.entry;
            const badges = [
                '<span class="badge ' + (r.ammo && r.ammo.module.kind === 'core' ? '' : 'iso') + '">' + esc(r.ammo ? r.ammo.code : '—') + '</span>',
                '<span class="badge steel">' + esc(r.plate && r.armored ? r.plate.code : 'БЕЗ БРОНИ') + '</span>',
                '<span class="badge dim">' + esc(r.mode ? r.mode.code : '—') + '</span>',
                r.hit ? '<span class="badge ok">РАЗНИЦА ' + r.margin + '</span>' : '<span class="badge surf">' + (r.blocked ? 'НЕДОСТУПНА' : 'ПРОМАХ') + '</span>',
                r.firstApplied ? '<span class="badge ok">ПЕРВАЯ ПУЛЯ</span>' : '',
                r.broke ? '<span class="badge agg">ПОЛОМКА</span>' : ''
            ].join('');
            return '<article class="log-item' + (r.hit ? '' : ' miss') + '" data-log="' + esc(e.id) + '">' +
                '<div class="li-head">' +
                '<span class="drag-handle" draggable="true" data-drag-log="' + esc(e.id) + '" title="Перетащите, чтобы изменить порядок">' + ICON.grip + '</span>' +
                '<span class="li-idx">' + (x.index + 1) + '</span>' +
                '<span class="li-meta">' + badges + '</span>' +
                '<span class="li-cell agg"><small>УСУГ</small>' + E.num(r.hp.aggravated) + '</span>' +
                '<span class="li-cell surf"><small>ПОВ</small>' + E.num(r.hp.surface) + '</span>' +
                '<span class="li-cell steel"><small>ИЗНОС</small>' + (r.wear.total ? '−' + r.wear.total : '0') + '</span>' +
                '<span class="li-cell hide-m"><small>ОСТАТОК</small>' + (r.armored ? r.integrityAfter + '/' + r.integrityMax : '—') + '</span>' +
                '<span class="li-acts">' +
                '<button class="icon-btn adv" data-act="log-up" data-id="' + esc(e.id) + '" title="Выше">' + ICON.up + '</button>' +
                '<button class="icon-btn adv" data-act="log-down" data-id="' + esc(e.id) + '" title="Ниже">' + ICON.down + '</button>' +
                '<button class="icon-btn adv" data-act="log-dup" data-id="' + esc(e.id) + '" title="Дублировать">' + ICON.copy + '</button>' +
                '<button class="icon-btn del" data-act="log-del" data-id="' + esc(e.id) + '" title="Удалить">' + ICON.trash + '</button>' +
                '</span></div>' +
                '<details class="li-body"><summary>Вычисления обстрела ' + (x.index + 1) + ICON.chev + '</summary><ol class="trace">' + traceHTML(r.steps) + '</ol></details>' +
                '</article>';
        }).join('');
        if (n > 0 && rows.length === 0) $('logList').innerHTML = '<div class="ref-empty">Под фильтр не попал ни один обстрел.</div>';
    }

    const TABS = [['plates', 'ПЛАСТИНЫ'], ['ammo', 'ПАТРОНЫ'], ['carriers', 'НОСИТЕЛИ'], ['dist', 'ДИСТАНЦИИ'], ['modes', 'РЕЖИМЫ'], ['rules', 'ПРАВИЛА'], ['weapons', 'ОРУЖИЕ']];
    function renderReference(ctx, tab, query) {
        const tabs = TABS.filter(t => t[0] !== 'weapons' || Object.keys(ctx.weapons).length);
        $('refTabs').innerHTML = tabs.map(t => {
            const count = t[0] === 'plates' ? Object.keys(ctx.plates).length : t[0] === 'ammo' ? Object.keys(ctx.ammo).length
                : t[0] === 'carriers' ? Object.keys(ctx.carriers).length : t[0] === 'dist' ? Object.keys(ctx.classes).length
                    : t[0] === 'modes' ? Object.keys(ctx.modes).length : t[0] === 'rules' ? ctx.ruleDefs.length : Object.keys(ctx.weapons).length;
            return '<button role="tab" data-act="ref-tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + ' · ' + count + '</button>';
        }).join('');
        const q = (query || '').trim().toLowerCase();
        const match = (...parts) => !q || parts.join(' ').toLowerCase().indexOf(q) >= 0;
        const srcBadge = m => '<span class="badge ' + (m.kind === 'core' ? '' : 'iso') + '">' + esc(m.name) + '</span>';
        let html = '';

        if (tab === 'plates') {
            const items = Object.keys(ctx.plates).map(k => ctx.plates[k]).filter(p => match(p.code, p.name, p.notes));
            html = '<p class="ref-note">Защита вычитается из итогового урона. Поглощённая часть делится на делитель ядра (округление — по пластине) и вычитается из Целостности один раз за обстрел. При Целостности 0 пластина ломается и теряет часть Защиты, но продолжает поглощать.</p><div class="ref-grid">' +
                items.map((p, i) => {
                    const first = p.firstShot ? (p.firstShot.type === 'defenseBonus' ? '+' + p.firstShot.value + ' к Защите' : 'Игнорирование избыточного урона') : '—';
                    const rnd = p.rounding ? ({ floor: 'Вниз', round: 'Математическое', ceil: 'Вверх' }[p.rounding]) : 'По правилу ядра (' + ({ floor: 'вниз', round: 'математическое', ceil: 'вверх' }[ctx.rules.defaultRounding] || 'вниз') + ')';
                    const eff = (p.effects || []).map(e => '<b>' + esc(e.label || e.type) + '</b>: ' + esc(e.type === 'reduceDamage' ? '−' + (e.rule ? ctx.rules[e.rule] : e.amount) + ' ' + E.typeShort(ctx, e.damageType || 'aggravated') + ', минимум ' + (e.minRule ? ctx.rules[e.minRule] : e.min) : e.type === 'extraWear' ? '−' + (e.rule ? ctx.rules[e.rule] : e.amount) + ' Целостности' : e.text || '')).join('<br>');
                    const carriers = Object.keys(ctx.carriers).filter(c => ctx.carriers[c].plates.indexOf(p.uid) >= 0).map(c => ctx.carriers[c].name).join(', ') || '—';
                    return '<div class="rcard' + (p.module.kind === 'core' ? '' : ' iso') + '" style="animation-delay:' + (i * 25) + 'ms">' +
                        '<div class="rc-head"><b>' + esc(p.code) + '</b><span>' + esc(p.name) + '</span><span class="rc-stats"><span class="d">ЗАЩ ' + p.defense + '</span><span class="i">ЦЕЛ ' + p.integrity + '</span></span></div>' +
                        '<div class="rc-tags">' + srcBadge(p.module) + '<span class="badge dim">' + esc(p.uid) + '</span></div>' +
                        '<dl><dt>Первая пуля</dt><dd>' + esc(first) + '</dd><dt>Округление</dt><dd>' + esc(rnd) + '</dd>' +
                        '<dt>Поломка</dt><dd><b>−' + p.breakPenalty + ' к Защите</b>' + (p.brokenNote ? ' · ' + esc(p.brokenNote) : '') + '</dd>' +
                        '<dt>Пассивная</dt><dd>' + esc(p.passive && p.passive.text ? p.passive.text : '—') + '</dd><dt>Носители</dt><dd>' + esc(carriers) + '</dd>' +
                        (eff ? '<dt>Эффекты</dt><dd>' + eff + '</dd>' : '') + (p.notes ? '<dt>Заметки</dt><dd>' + esc(p.notes) + '</dd>' : '') + '</dl></div>';
                }).join('') + '</div>';
            if (!items.length) html = '<div class="ref-empty">Ничего не найдено.</div>';
        }
        if (tab === 'ammo') {
            const items = Object.keys(ctx.ammo).map(k => ctx.ammo[k]).filter(a => match(a.code, a.name, a.description, (a.tags || []).join(' ')));
            html = '<p class="ref-note">Весь огнестрел ядра наносит Усугублённый урон. Поверхностный появляется только по спецправилам патронов и режимов. Модификаторы попадания — это кубики к пулу, а не готовые успехи.</p><div class="ref-grid">' +
                items.map((a, i) => {
                    const tags = ['<span class="badge ' + (a.damageType === 'surface' ? 'surf' : 'agg') + '">' + esc(E.typeLabel(ctx, a.damageType || 'aggravated').toUpperCase()) + '</span>'];
                    if (a.fixedDamage) tags.push('<span class="badge dim">ФИКС: ' + Object.keys(a.fixedDamage).map(k => a.fixedDamage[k] + ' ' + E.typeShort(ctx, k)).join(' + ') + '</span>');
                    if (a.damageBonus) tags.push('<span class="badge agg">' + sgn(a.damageBonus) + ' УРОН</span>');
                    if (a.damageVsArmor) tags.push('<span class="badge surf">' + sgn(a.damageVsArmor) + ' ПРОТИВ БРОНИ</span>');
                    if (a.attackDice) tags.push('<span class="badge steel">' + sgn(a.attackDice) + ' КУБИК</span>');
                    if (a.armorPierce) tags.push('<span class="badge agg">ПРОБИТИЕ ' + a.armorPierce + '</span>');
                    if (a.ignoreWearDivision) tags.push('<span class="badge surf">БЕЗ ДЕЛЕНИЯ</span>');
                    if (a.surfaceBypass) tags.push('<span class="badge surf">ШОКОВАЯ ВОЛНА</span>');
                    (a.tags || []).forEach(t => tags.push('<span class="badge iso">' + esc(t.toUpperCase()) + '</span>'));
                    return '<div class="rcard' + (a.module.kind === 'core' ? '' : ' iso') + '" style="animation-delay:' + (i * 25) + 'ms">' +
                        '<div class="rc-head"><b>' + esc(a.code) + '</b><span>' + esc(a.name) + '</span></div><div class="rc-tags">' + tags.join('') + '</div>' +
                        '<dl><dt>Эффект</dt><dd>' + esc(a.description || '') + '</dd>' +
                        (a.effects ? '<dt>Особое</dt><dd>' + a.effects.map(e => esc(e.text || ((e.label || e.type) + (e.target ? ': ' + e.target : '')))).join('<br>') + '</dd>' : '') +
                        '<dt>Источник</dt><dd>' + srcBadge(a.module) + ' <span class="rc-id">' + esc(a.uid) + '</span></dd></dl></div>';
                }).join('') + '</div>';
            if (!items.length) html = '<div class="ref-empty">Ничего не найдено.</div>';
        }
        if (tab === 'carriers') {
            const items = Object.keys(ctx.carriers).map(k => ctx.carriers[k]).filter(c => match(c.name, (c.passive && c.passive.text) || ''));
            html = '<p class="ref-note">Носитель определяет, какие пластины можно установить. Вместимость из ранних документов не используется. Пассивные штрафы носителя учитываются в пуле защиты.</p>' +
                '<div class="table-wrap"><table class="ref"><thead><tr><th>Носитель</th><th>Допустимые пластины</th><th>Особенности</th><th>Источник</th></tr></thead><tbody>' +
                items.map(c => '<tr><td>' + esc(c.name) + '</td><td>' + (c.plates.map(p => ctx.plates[p] ? esc(ctx.plates[p].code) + ' <small>' + esc(ctx.plates[p].name) + '</small>' : esc(p)).join(', ') || '—') + '</td><td>' + esc(c.passive && c.passive.text ? c.passive.text : '—') + '</td><td>' + srcBadge(c.module) + '</td></tr>').join('') +
                '</tbody></table></div>';
            if (!items.length) html = '<div class="ref-empty">Ничего не найдено.</div>';
        }
        if (tab === 'dist') {
            const items = Object.keys(ctx.classes).map(k => ctx.classes[k]).filter(c => match(c.name, c.note));
            html = '<p class="ref-note">Тип оружия задаётся без калибра: калибр и баллистика живут в патроне. Штрафы применяются к пулу до броска. Урон дроби (5 / 4 / 2) подставляется в Рейтинг автоматически.</p>' +
                '<div class="table-wrap"><table class="ref"><thead><tr><th>Тип оружия</th><th>Ближняя</th><th>Средняя</th><th>Дальняя</th><th>Реальность</th></tr></thead><tbody>' +
                items.map(c => {
                    const cell = (b, cls) => { const x = c.bands[b]; if (!x) return '<td>—</td>'; const d = E.num(x.dice); return '<td class="' + cls + '">' + esc(x.label) + '<small>' + (d ? sgn(d) + ' кубика' : 'без штрафа') + (x.rating !== undefined ? ' · Рейтинг +' + x.rating : '') + '</small></td>'; };
                    return '<tr><td>' + esc(c.name) + '</td>' + cell('near', 'near') + cell('mid', 'mid') + cell('far', 'far') + '<td>' + esc(c.note || '') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
            if (!items.length) html = '<div class="ref-empty">Ничего не найдено.</div>';
        }
        if (tab === 'modes') {
            const items = Object.keys(ctx.modes).map(k => ctx.modes[k]).filter(m => match(m.name, m.code, m.note));
            html = '<p class="ref-note">Режим не умножает урон и износ: один обстрел — один расчёт и одно списание Целостности. Режим влияет на пул, расход патронов и побочные эффекты.</p><div class="ref-grid">' +
                items.map((m, i) => {
                    let pool = m.poolMod ? sgn(m.poolMod) + ' кубик(а)' : 'базовый бросок';
                    if (m.poolModByCategory) pool = 'автоматы/ПП −1, остальные 0';
                    if (m.aim) pool = '+' + m.aim.perTurn + ' кубик за ход (макс. +' + m.aim.max + ')';
                    return '<div class="rcard" style="animation-delay:' + (i * 25) + 'ms"><div class="rc-head"><b>' + esc(m.code) + '</b><span>' + esc(m.name) + '</span></div>' +
                        '<dl><dt>Расход</dt><dd>' + esc(m.cost) + '</dd><dt>Пул</dt><dd><b>' + esc(pool) + '</b></dd>' +
                        '<dt>Урон</dt><dd>Рейтинг + Разница' + (m.damageBonus ? ' + ' + m.damageBonus : '') + (m.headshot ? '; в голову: ' + m.headshot.dice + ' кубика, +' + m.headshot.damage + ' урона' : '') + '</dd>' +
                        '<dt>Особое</dt><dd>' + esc(m.note || '') + '</dd></dl></div>';
                }).join('') + '</div>';
            if (!items.length) html = '<div class="ref-empty">Ничего не найдено.</div>';
        }
        if (tab === 'rules') {
            const items = ctx.ruleDefs.filter(r => match(r.label, r.hint, r.key));
            html = '<p class="ref-note">Текущие значения правил. Изменяются в блоке «Правила» — расчёт обновляется сразу.</p>' +
                '<div class="table-wrap"><table class="ref"><thead><tr><th>Правило</th><th>Значение</th><th>Описание</th><th>Источник</th></tr></thead><tbody>' +
                items.map(r => {
                    const v = ctx.rules[r.key];
                    const shown = r.type === 'toggle' ? (v ? 'ВКЛ' : 'ВЫКЛ') : r.type === 'select' ? (((r.options || []).find(o => o.value === v) || {}).label || v) : v;
                    return '<tr><td>' + esc(r.label) + '<small>' + esc(r.key) + '</small></td><td>' + esc(shown) + '</td><td>' + esc(r.hint || '') + '</td><td>' + srcBadge(r.module) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
            if (!items.length) html = '<div class="ref-empty">Ничего не найдено.</div>';
        }
        if (tab === 'weapons') {
            const items = Object.keys(ctx.weapons).map(k => ctx.weapons[k]).filter(w => match(w.name, w.description));
            html = '<div class="ref-grid">' + items.map((w, i) =>
                '<div class="rcard iso" style="animation-delay:' + (i * 25) + 'ms"><div class="rc-head"><b>+' + w.rating + '</b><span>' + esc(w.name) + '</span></div>' +
                '<dl><dt>Класс</dt><dd>' + esc(ctx.classes[w.weaponClass] ? ctx.classes[w.weaponClass].name : '—') + '</dd>' +
                '<dt>Описание</dt><dd>' + esc(w.description || '—') + '</dd><dt>Источник</dt><dd>' + srcBadge(w.module) + ' <span class="rc-id">' + esc(w.uid) + '</span></dd></dl></div>').join('') + '</div>';
            if (!items.length) html = '<div class="ref-empty">Ни один активный модуль не задаёт базу стволов.</div>';
        }
        $('refPane').innerHTML = html;
    }

    function renderGate(bundle, state) {
        const srcLabel = { file: 'ФАЙЛ /modules', embedded: 'ВСТРОЕННАЯ КОПИЯ', local: 'ЛОКАЛЬНАЯ ПРОВЕРКА' };
        const counts = m => [['пластин', (m.plates || []).length], ['патронов', (m.ammo || []).length], ['стволов', (m.weapons || []).length], ['правил', (m.rules || []).length], ['навыков', (m.skills || []).length]]
            .filter(x => x[1]).map(x => '<span>' + x[0] + ' <b>' + x[1] + '</b></span>').join('');
        $('gateMeta').innerHTML =
            '<span class="mod-chip"><i></i>ИСТОЧНИК: ' + (bundle.mode === 'files' ? 'ФАЙЛЫ /modules' : 'ВСТРОЕННЫЕ КОПИИ') + '</span>' +
            '<span class="mod-chip"><i></i>ЗАГРУЖЕНО: ' + bundle.order.length + '</span>' +
            '<span class="mod-chip' + (bundle.errors.length ? ' iso' : '') + '"><i></i>ЗАМЕЧАНИЙ: ' + bundle.errors.length + '</span>';
        $('gateUiSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === state.uiMode));
        $('gateThemeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === state.theme));

        $('gateList').innerHTML = state.order.filter(id => bundle.manifests[id]).map(id => {
            const m = bundle.manifests[id];
            const core = m.kind === 'core' || m.required;
            const on = state.enabled.indexOf(id) >= 0 || core;
            const reqs = m.requires || [];
            const missing = reqs.filter(r => state.enabled.indexOf(r) < 0 && !(bundle.manifests[r] && (bundle.manifests[r].kind === 'core' || bundle.manifests[r].required)));
            const reqTxt = reqs.length ? '<div class="gc-req ' + (missing.length ? '' : 'ok') + '">Требует: ' + reqs.map(r => esc(bundle.manifests[r] ? bundle.manifests[r].name : r)).join(', ') + (missing.length ? ' — не включено' : ' — выполнено') + '</div>' : '';
            return '<article class="gcard' + (core ? ' core' : '') + (m.example ? ' example' : '') + (on ? ' on' : '') + '" data-mod="' + esc(id) + '">' +
                (core ? '<span class="drag-handle" style="opacity:.3;cursor:default">' + ICON.lock + '</span>' : '<span class="drag-handle" draggable="true" data-drag-mod="' + esc(id) + '" title="Порядок загрузки">' + ICON.grip + '</span>') +
                '<div class="gc-main"><div class="gc-title"><b>' + esc(m.name) + '</b><span class="ver">v' + esc(m.version || '1.0.0') + '</span></div>' +
                '<div class="gc-desc">' + esc(m.description || '') + '</div><div class="gc-badges">' +
                '<span class="badge ' + (core ? 'agg' : m.example ? 'iso' : 'steel') + '">' + (core ? 'ЯДРО' : m.example ? 'ШАБЛОН · НЕ КАНОН' : 'МОДУЛЬ') + '</span>' +
                '<span class="badge dim">' + esc(m.namespace) + '</span><span class="badge dim">' + esc(srcLabel[bundle.sources[id]] || '—') + '</span>' +
                (m.author ? '<span class="badge dim">' + esc(m.author) + '</span>' : '') +
                '</div><div class="gc-counts">' + counts(m) + '</div>' + reqTxt + '</div>' +
                '<div class="gc-side">' +
                (core ? '<span class="gc-lock">' + ICON.lock + 'ВСЕГДА ВКЛ</span>'
                    : '<button type="button" class="switch" data-act="mod-toggle" data-id="' + esc(id) + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="Модуль ' + esc(m.name) + '"' + (missing.length ? ' disabled title="Сначала включите зависимости"' : '') + '><i></i></button>') +
                (core ? '' : '<span class="gc-order"><button class="icon-btn" data-act="mod-up" data-id="' + esc(id) + '" title="Выше">' + ICON.up + '</button><button class="icon-btn" data-act="mod-down" data-id="' + esc(id) + '" title="Ниже">' + ICON.down + '</button>' +
                    (bundle.sources[id] === 'local' ? '<button class="icon-btn del" data-act="mod-remove" data-id="' + esc(id) + '" title="Удалить локальную копию">' + ICON.trash + '</button>' : '') + '</span>') +
                '</div></article>';
        }).join('');

        const on = state.order.filter(id => state.enabled.indexOf(id) >= 0 && bundle.manifests[id]);
        $('gateCount').innerHTML = 'Включено модулей: <b>' + on.length + '</b> · порядок: ' + on.map(id => esc(bundle.manifests[id].namespace)).join(' → ');
        $('gateErrorsCard').hidden = bundle.errors.length === 0;
        $('gateErrors').innerHTML = bundle.errors.map(e => '<li><b>' + esc(e.id) + '</b>: ' + esc(e.message) + '</li>').join('');
        $('gateClose').hidden = !state.configured;
        $('gateEnter').textContent = state.configured ? 'Применить и закрыть' : 'Войти в калькулятор';
    }

    window.IRRender = { $, esc, ICON, plural, buildStatic, syncInputs, renderPool, renderResults, renderLog, renderReference, renderGate, traceHTML, paintRange, tween };
})();