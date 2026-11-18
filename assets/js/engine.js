/* IRREALITY · движок расчёта. Чистые функции, без DOM. */
(function () {
    'use strict';
    const ROUND = { floor: Math.floor, round: Math.round, ceil: Math.ceil };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const num = v => (Number.isFinite(+v) ? +v : 0);
    const ref = (r, ns) => (String(r).indexOf(':') >= 0 ? String(r) : ns + ':' + r);
    const sign = v => (num(v) >= 0 ? '+ ' + num(v) : '− ' + Math.abs(num(v)));
    const typeShort = (ctx, id) => { const t = ctx.types.find(x => x.id === id); return t ? t.short : String(id).toUpperCase(); };
    const typeLabel = (ctx, id) => { const t = ctx.types.find(x => x.id === id); return t ? t.label : id; };
    const pushUnique = (arr, v) => { const s = String(v || '').trim(); if (s && arr.indexOf(s) < 0) arr.push(s); };

    /* ---------- контекст из активных модулей ---------- */
    function buildContext(bundle, enabled, order, ruleValues) {
        const list = order.filter(id => enabled.indexOf(id) >= 0 && bundle.manifests[id]).map(id => bundle.manifests[id]);
        const ctx = {
            modules: list, plates: {}, ammo: {}, carriers: {}, modes: {}, classes: {}, covers: {}, weapons: {},
            types: [], rules: {}, ruleDefs: [], attributes: [], skills: [], sources: bundle.sources || {}
        };
        list.forEach(m => {
            const ns = m.namespace;
            (m.attributes || []).forEach(a => pushUnique(ctx.attributes, typeof a === 'string' ? a : a.name));
            (m.skills || []).forEach(a => pushUnique(ctx.skills, typeof a === 'string' ? a : a.name));
            (m.damageTypes || []).forEach(t => { if (!ctx.types.some(x => x.id === t.id)) ctx.types.push(Object.assign({}, t, { ns, module: m })); });
            (m.plates || []).forEach(p => { const uid = ns + ':' + p.id; ctx.plates[uid] = Object.assign({}, p, { uid, ns, module: m }); });
            (m.ammo || []).forEach(a => { const uid = ns + ':' + a.id; ctx.ammo[uid] = Object.assign({}, a, { uid, ns, module: m }); });
            (m.carriers || []).forEach(c => {
                const uid = ns + ':' + c.id;
                ctx.carriers[uid] = Object.assign({}, c, { uid, ns, module: m, plates: (c.plates || []).map(x => ref(x, ns)) });
            });
            (m.fireModes || []).forEach(f => { const uid = ns + ':' + f.id; ctx.modes[uid] = Object.assign({}, f, { uid, ns, module: m }); });
            (m.weaponClasses || []).forEach(w => { const uid = ns + ':' + w.id; ctx.classes[uid] = Object.assign({}, w, { uid, ns, module: m }); });
            (m.covers || []).forEach(c => { const uid = ns + ':' + c.id; ctx.covers[uid] = Object.assign({}, c, { uid, ns, module: m }); });
            (m.weapons || []).forEach(w => {
                const uid = ns + ':' + w.id;
                ctx.weapons[uid] = Object.assign({}, w, { uid, ns, module: m, weaponClass: w.weaponClass ? ref(w.weaponClass, ns) : null });
            });
            (m.rules || []).forEach(r => {
                const key = ns + ':' + r.id;
                const val = ruleValues && ruleValues[key] !== undefined ? ruleValues[key] : r.default;
                ctx.ruleDefs.push(Object.assign({}, r, { key, ns, module: m }));
                ctx.rules[key] = val;
                if (m.kind === 'core') ctx.rules[r.id] = val;
            });
        });
        list.forEach(m => {
            (m.carrierExtensions || []).forEach(x => {
                const c = ctx.carriers[ref(x.target, m.namespace)];
                if (!c) return;
                (x.addPlates || []).forEach(p => {
                    const uid = ref(p, m.namespace);
                    if (ctx.plates[uid] && c.plates.indexOf(uid) < 0) c.plates.push(uid);
                });
            });
        });
        if (!ctx.types.length) {
            ctx.types = [
                { id: 'aggravated', label: 'Усугублённый', short: 'УСУГ', tone: 'agg' },
                { id: 'surface', label: 'Поверхностный', short: 'ПОВ', tone: 'surf' }
            ];
        }
        if (!ctx.attributes.length) ctx.attributes = ['Сила', 'Ловкость', 'Выносливость', 'Интеллект', 'Смекалка', 'Решимость'];
        if (!ctx.skills.length) ctx.skills = ['Атлетика', 'Меткость', 'Внимательность', 'Драка', 'Скрытность'];
        return ctx;
    }

    /* ---------- пул: любые атрибуты, навыки, модификаторы ---------- */
    function computePool(inp, ctx) {
        const cls = ctx.classes[inp.weaponClassId] || null;
        const band = cls && cls.bands ? cls.bands[inp.distanceBand] : null;
        const mode = ctx.modes[inp.modeId] || null;
        const ammo = ctx.ammo[inp.ammoId] || null;
        const cover = ctx.covers[inp.coverId] || null;
        const plate = inp.plateId ? ctx.plates[inp.plateId] : null;
        const carrier = ctx.carriers[inp.carrierId] || null;
        const armored = !!(plate && carrier && (carrier.plates || []).indexOf(plate.uid) >= 0);
        const manual = rows => (rows || []).map(c => ({ label: (c.name || 'Компонент').trim() || 'Компонент', value: num(c.value), manual: true }));

        const a = manual(inp.poolAttack);
        if (band && num(band.dice)) a.push({ label: 'Дистанция · ' + band.label, value: num(band.dice) });
        if (mode) {
            let mod = num(mode.poolMod);
            if (mode.poolModByCategory && cls) {
                const by = mode.poolModByCategory;
                mod = by[cls.category] !== undefined ? num(by[cls.category]) : num(by.default || 0);
            }
            if (mod) a.push({ label: 'Режим · ' + mode.name, value: mod });
            if (mode.aim && num(inp.aimTurns) > 0) a.push({ label: 'Прицеливание · ' + Math.min(num(inp.aimTurns), mode.aim.max) + ' ход(а)', value: Math.min(num(inp.aimTurns), mode.aim.max) * num(mode.aim.perTurn) });
            if (mode.headshot && inp.headshot) a.push({ label: 'Прицел в голову', value: num(mode.headshot.dice) });
        }
        if (ammo && num(ammo.attackDice) && armored) a.push({ label: 'Патрон ' + ammo.code + ' против брони', value: num(ammo.attackDice) });

        const d = manual(inp.poolDefense);
        if (cover && num(cover.dice)) d.push({ label: 'Укрытие · ' + cover.name, value: num(cover.dice) });
        let defSuccessMod = 0;
        if (armored && plate.passive && plate.passive.mods && num(plate.passive.mods.agilityDice)) d.push({ label: 'Пластина ' + plate.code, value: num(plate.passive.mods.agilityDice) });
        if (carrier && carrier.passive && carrier.passive.mods && num(carrier.passive.mods.agilityDice)) d.push({ label: carrier.name, value: num(carrier.passive.mods.agilityDice) });
        if (armored && plate.passive && plate.passive.mods && num(plate.passive.mods.agilitySuccesses)) defSuccessMod += num(plate.passive.mods.agilitySuccesses);

        const sum = arr => arr.reduce((s, x) => s + num(x.value), 0);
        return {
            attack: { parts: a, total: Math.max(0, sum(a)) },
            defense: { parts: d, total: Math.max(0, sum(d)), successMod: defSuccessMod },
            untargetable: !!(cover && cover.untargetable)
        };
    }

    function rollPool(n) {
        const out = [];
        for (let i = 0; i < Math.max(0, Math.min(40, n)); i++) {
            const v = 1 + Math.floor(Math.random() * 10);
            out.push({ v, s: v === 10 ? 2 : v >= 6 ? 1 : 0, crit: v === 10, one: v === 1 });
        }
        return out;
    }
    const diceSuccesses = arr => (arr || []).reduce((s, d) => s + d.s, 0);
    const diceOnes = arr => (arr || []).filter(d => d.one).length;

    function cond(when, env) {
        if (!when) return true;
        if (when.ammoTag && (!env.ammo || (env.ammo.tags || []).indexOf(when.ammoTag) < 0)) return false;
        if (when.ammoId && (!env.ammo || env.ammo.uid !== when.ammoId && env.ammo.id !== when.ammoId)) return false;
        if (when.armored !== undefined && !!when.armored !== env.armored) return false;
        if (when.broken !== undefined && !!when.broken !== env.broken) return false;
        return true;
    }
    const effVal = (rules, eff, field, ruleField, dflt) => {
        const k = eff[ruleField];
        if (k && rules[k] !== undefined) return num(rules[k]);
        return num(eff[field] !== undefined ? eff[field] : dflt);
    };

    /* ---------- один обстрел ---------- */
    function computeAttack(inp, ctx) {
        const rules = ctx.rules;
        const steps = [], flags = [], warnings = [];
        const carrier = ctx.carriers[inp.carrierId] || null;
        const plate = inp.plateId ? ctx.plates[inp.plateId] || null : null;
        const armored = !!(plate && carrier && (carrier.plates || []).indexOf(plate.uid) >= 0);
        const ammo = ctx.ammo[inp.ammoId] || null;
        const mode = ctx.modes[inp.modeId] || null;
        const cover = ctx.covers[inp.coverId] || null;
        const cls = ctx.classes[inp.weaponClassId] || null;
        const band = cls && cls.bands ? cls.bands[inp.distanceBand] : null;
        const maxInt = armored ? num(plate.integrity) : 0;
        const before = armored ? clamp(num(inp.integrity), 0, maxInt) : 0;
        const wasBroken = armored && before <= 0;
        const margin = num(inp.attack) - num(inp.defense);

        const res = {
            armored, plate, carrier, ammo, mode, cover, cls, band, margin, hit: false, blocked: false,
            rating: 0, damage: {}, damageTotal: 0, bypass: {}, absorbed: 0, absorbedByType: {},
            hp: {}, hpTotal: 0, armor: { base: 0, total: 0, parts: [] },
            wear: { base: 0, shock: 0, extra: 0, total: 0, divided: false, raw: 0, rounding: null },
            integrityBefore: before, integrityAfter: before, integrityMax: maxInt,
            broke: false, wasBroken, firstApplied: null, ricochet: null, overpen: null,
            steps, flags, warnings
        };

        steps.push({ label: 'Разница (Margin)', expr: num(inp.attack) + ' − ' + num(inp.defense) + ' = ' + margin, tone: margin > 0 ? 'ok' : 'warn' });

        if (cover && cover.untargetable) {
            res.blocked = true;
            steps.push({ label: 'Полное укрытие', expr: 'Цель не простреливается — атака невозможна', tone: 'warn' });
            flags.push({ tone: 'warn', text: 'Полное укрытие: обстрел не может задеть цель.' });
            return res;
        }
        if (margin <= 0) {
            steps.push({ label: 'Промах', expr: 'Разница ≤ 0 — урон и износ Целостности не начисляются', tone: 'warn' });
            return res;
        }
        res.hit = true;

        let rating = num(inp.rating);
        if (rules.autoShotRating && band && band.rating !== undefined && band.rating !== null) {
            rating = num(band.rating);
            steps.push({ label: 'Рейтинг из таблицы дистанций', expr: cls.name + ' · ' + band.label + ' → +' + rating, tone: 'info' });
        } else {
            steps.push({ label: 'Рейтинг оружия', expr: '+' + rating, tone: 'dim' });
        }
        res.rating = rating;

        const dtype = (ammo && ammo.damageType) || 'aggravated';
        const dmg = {};
        if (ammo && ammo.fixedDamage) {
            Object.keys(ammo.fixedDamage).forEach(k => { dmg[k] = num(ammo.fixedDamage[k]); });
            steps.push({ label: 'Фиксированный урон · ' + ammo.code, expr: Object.keys(dmg).map(k => dmg[k] + ' ' + typeShort(ctx, k)).join(' + '), tone: 'info' });
            if (!rules.fixedDamageReplaces) {
                const add = rating + margin;
                dmg[dtype] = num(dmg[dtype]) + add;
                steps.push({ label: 'Правило: формула добавлена к фикс. урону', expr: '+' + rating + ' + ' + margin + ' = +' + add, tone: 'info' });
            }
        } else {
            let base = rating + margin;
            steps.push({ label: 'Базовый урон', expr: 'Рейтинг ' + rating + ' + Разница ' + margin + ' = ' + base, tone: 'agg' });
            if (ammo && num(ammo.damageBonus)) { const b = base; base += num(ammo.damageBonus); steps.push({ label: 'Патрон ' + ammo.code + ': модификатор урона', expr: b + ' ' + sign(ammo.damageBonus) + ' = ' + base, tone: 'agg' }); }
            if (ammo && num(ammo.damageVsArmor) && armored) { const b = base; base += num(ammo.damageVsArmor); steps.push({ label: ammo.name + ': против брони', expr: b + ' ' + sign(ammo.damageVsArmor) + ' = ' + base, tone: 'agg' }); }
            if (mode && num(mode.damageBonus)) { const b = base; base += num(mode.damageBonus); steps.push({ label: 'Режим «' + mode.name + '»', expr: b + ' + ' + mode.damageBonus + ' = ' + base, tone: 'agg' }); }
            if (mode && mode.headshot && inp.headshot) { const b = base; base += num(mode.headshot.damage); steps.push({ label: 'Прицел в голову', expr: b + ' + ' + mode.headshot.damage + ' = ' + base, tone: 'agg' }); }
            if (base < 0) { steps.push({ label: 'Урон не может быть отрицательным', expr: base + ' → 0', tone: 'dim' }); base = 0; }
            if (num(rules.minDamage) > 0 && base < num(rules.minDamage)) { steps.push({ label: 'Минимальный урон при попадании', expr: base + ' → ' + rules.minDamage, tone: 'dim' }); base = num(rules.minDamage); }
            dmg[dtype] = base;
        }
        res.damage = dmg;
        res.damageTotal = Object.keys(dmg).reduce((s, k) => s + num(dmg[k]), 0);
        steps.push({ label: 'Итоговый урон', expr: Object.keys(dmg).filter(k => dmg[k]).map(k => dmg[k] + ' ' + typeShort(ctx, k)).join(' + ') || '0', tone: 'agg' });

        const bypass = {};
        if (ammo && ammo.surfaceBypass && num(dmg.surface) > 0) {
            bypass.surface = num(dmg.surface);
            steps.push({ label: 'Шоковая волна', expr: dmg.surface + ' ПОВ идёт и в Здоровье, и в Целостность', tone: 'danger' });
            flags.push({ tone: 'surf', text: 'Шоковая волна: Поверхностный урон проходит сквозь броню и изнашивает её.' });
        }
        res.bypass = bypass;

        let A = 0;
        if (armored) {
            A = num(plate.defense);
            res.armor.base = num(plate.defense);
            res.armor.parts.push({ label: 'Пластина ' + plate.code, value: num(plate.defense) });
            steps.push({ label: 'Защита пластины ' + plate.code, expr: String(plate.defense), tone: 'steel' });
            if (wasBroken) {
                A -= num(plate.breakPenalty);
                res.armor.parts.push({ label: 'Поломка', value: -num(plate.breakPenalty) });
                steps.push({ label: 'Пластина сломана (' + plate.code + ')', expr: plate.defense + ' − ' + plate.breakPenalty + ' = ' + Math.max(0, A) + ' Защиты', tone: 'danger' });
                flags.push({ tone: 'danger', text: 'Пластина сломана: −' + plate.breakPenalty + ' к Защите.' });
                if (plate.brokenNote) flags.push({ tone: 'danger', text: plate.brokenNote });
            }
            const fm = inp.firstShotMode || 'auto';
            const fresh = before === num(plate.integrity);
            const firstOn = plate.firstShot && !wasBroken && (fm === 'on' || (fm === 'auto' && fresh && inp.isFirst));
            if (firstOn) {
                if (plate.firstShot.type === 'defenseBonus') {
                    A += num(plate.firstShot.value);
                    res.firstApplied = 'defenseBonus';
                    res.armor.parts.push({ label: 'Первая пуля', value: num(plate.firstShot.value) });
                    steps.push({ label: 'Первая пуля (' + plate.code + ')', expr: '+' + plate.firstShot.value + ' к Защите → ' + A, tone: 'ok' });
                    flags.push({ tone: 'ok', text: 'Первая пуля ' + plate.code + ': +' + plate.firstShot.value + ' к Защите.' });
                } else if (plate.firstShot.type === 'ignoreExcess') {
                    res.firstApplied = 'ignoreExcess';
                    steps.push({ label: 'Первая пуля (' + plate.code + ')', expr: 'Избыточный урон будет проигнорирован', tone: 'ok' });
                    flags.push({ tone: 'ok', text: 'Первая пуля ' + plate.code + ': избыток сверх Защиты гасится.' });
                }
            }
            if (ammo && num(ammo.armorPierce)) {
                const b = A; A = Math.max(0, A - num(ammo.armorPierce));
                res.armor.parts.push({ label: 'Пробитие', value: -num(ammo.armorPierce) });
                steps.push({ label: ammo.name + ': пробитие', expr: b + ' − ' + ammo.armorPierce + ' = ' + A + ' Защиты', tone: 'agg' });
            }
            if (rules.coverArmor && cover && num(cover.dice) > 0) {
                A += num(rules.coverArmorValue);
                res.armor.parts.push({ label: 'Прочность укрытия', value: num(rules.coverArmorValue) });
                steps.push({ label: 'Прочность укрытия (правило ядра)', expr: '+' + rules.coverArmorValue + ' к Защите → ' + A, tone: 'steel' });
            }
            A = Math.max(0, A);
            if (carrier.passive && carrier.passive.text) flags.push({ tone: 'warn', text: carrier.name + ': ' + carrier.passive.text });
            if (plate.passive && plate.passive.text) flags.push({ tone: 'warn', text: plate.code + ': ' + plate.passive.text });
        } else {
            steps.push({ label: 'Броня отсутствует', expr: 'Поглощение 0 — весь урон уходит в Здоровье', tone: 'warn' });
        }
        res.armor.total = A;

        const order = ctx.types.map(t => t.id);
        Object.keys(dmg).forEach(k => { if (order.indexOf(k) < 0) order.push(k); });
        const soakable = {};
        let soakTotal = 0;
        order.forEach(k => {
            let v = num(dmg[k]) - num(bypass[k]);
            if (k === 'aggravated' && !rules.soakAggravated) v = 0;
            soakable[k] = Math.max(0, v);
            soakTotal += soakable[k];
        });
        const absorbed = armored ? Math.min(soakTotal, A) : 0;
        res.absorbed = absorbed;
        let left = absorbed;
        const hp = {};
        order.forEach(k => {
            const take = Math.min(soakable[k], left);
            left -= take;
            res.absorbedByType[k] = take;
            hp[k] = num(dmg[k]) - take;
        });
        if (armored) steps.push({ label: 'Поглощено пластиной', expr: 'min(' + soakTotal + ', ' + A + ') = ' + absorbed, tone: 'steel' });
        order.forEach(k => {
            if (num(dmg[k]) > 0 || num(hp[k]) > 0) {
                steps.push({ label: 'В Здоровье · ' + typeLabel(ctx, k), expr: num(dmg[k]) + ' − ' + num(res.absorbedByType[k]) + ' = ' + num(hp[k]), tone: k === 'surface' ? 'surf' : 'agg' });
            }
        });

        const env = { ammo, armored, broken: wasBroken };
        if (armored && plate.effects) {
            plate.effects.forEach(eff => {
                if (eff.type !== 'reduceDamage') return;
                const nuclearGate = eff.when && eff.when.ammoTag === 'nuclear' && rules['iso:nuclearOnly'] === false;
                if (!nuclearGate && !cond(eff.when, env)) return;
                const t = eff.damageType || 'aggravated';
                const b = num(hp[t]);
                if (b <= 0) return;
                const amount = effVal(rules, eff, 'amount', 'rule', 0);
                const min = effVal(rules, eff, 'min', 'minRule', 0);
                const after = Math.max(min, b - amount);
                if (after === b) return;
                hp[t] = after;
                steps.push({ label: (eff.label || 'Снижение урона') + ' · ' + plate.code, expr: b + ' − ' + amount + ' = ' + after + (b - amount < min ? ' (минимум ' + min + ')' : ''), tone: 'ok' });
                flags.push({ tone: 'ok', text: plate.code + ' · ' + (eff.label || 'снижение урона') + ': ' + b + ' → ' + after + ' ' + typeShort(ctx, t) + '.' });
            });
        }

        if (res.firstApplied === 'ignoreExcess') {
            let ignored = 0;
            order.forEach(k => { const extra = num(hp[k]) - num(bypass[k]); if (extra > 0) { ignored += extra; hp[k] = num(bypass[k]); } });
            if (ignored > 0) steps.push({ label: 'Первая пуля (' + plate.code + '): избыток проигнорирован', expr: ignored + ' → 0 в Здоровье', tone: 'ok' });
        }
        res.hp = hp;
        res.hpTotal = Object.keys(hp).reduce((s, k) => s + num(hp[k]), 0);

        let wearBase = 0;
        if (armored && absorbed > 0) {
            const div = Math.max(1, num(rules.wearDivider));
            if ((ammo && ammo.ignoreWearDivision) || div === 1) {
                wearBase = absorbed;
                steps.push({ label: 'Износ Целостности', expr: absorbed + ' — без деления' + (ammo && ammo.ignoreWearDivision ? ' (' + ammo.name + ')' : ''), tone: 'steel' });
            } else {
                const raw = absorbed / div;
                const rnd = plate.rounding || rules.defaultRounding || 'floor';
                wearBase = (ROUND[rnd] || Math.floor)(raw);
                res.wear.divided = true; res.wear.raw = raw; res.wear.rounding = rnd;
                const rname = rnd === 'round' ? 'мат. округление' : rnd === 'ceil' ? 'вверх' : 'вниз';
                steps.push({ label: 'Поглощённое → Поверхностный износ', expr: absorbed + ' ÷ ' + div + ' = ' + raw + ' → ' + wearBase + ' (' + rname + ')', tone: 'steel' });
            }
        }
        const wearShock = num(bypass.surface);
        if (armored && wearShock > 0) steps.push({ label: 'Шоковая волна в Целостность', expr: '+' + wearShock, tone: 'danger' });
        let wearExtra = 0;
        if (armored && plate.effects) {
            plate.effects.forEach(eff => {
                if (eff.type !== 'extraWear') return;
                const nuclearGate = eff.when && eff.when.ammoTag === 'nuclear' && rules['iso:nuclearOnly'] === false;
                if (!nuclearGate && !cond(eff.when, env)) return;
                const v = effVal(rules, eff, 'amount', 'rule', 0);
                if (!v) return;
                wearExtra += v;
                steps.push({ label: (eff.label || 'Дополнительный износ') + ' · ' + plate.code, expr: '+' + v + ' Целостности', tone: 'danger' });
                flags.push({ tone: 'surf', text: plate.code + ' · ' + (eff.label || 'доп. износ') + ': −' + v + ' Целостности за обстрел.' });
            });
        }
        const wearTotal = armored ? wearBase + wearShock + wearExtra : 0;
        res.wear.base = wearBase; res.wear.shock = wearShock; res.wear.extra = wearExtra; res.wear.total = wearTotal;
        const after = armored ? Math.max(0, before - wearTotal) : 0;
        res.integrityAfter = after;
        res.broke = armored && before > 0 && after === 0;
        if (armored) {
            steps.push({ label: 'Целостность после обстрела', expr: before + ' − ' + wearTotal + ' = ' + after + ' / ' + maxInt, tone: 'steel' });
            if (res.broke) {
                steps.push({ label: 'ПЛАСТИНА СЛОМАНА', expr: 'Защита −' + plate.breakPenalty + ' со следующего обстрела', tone: 'danger' });
                flags.push({ tone: 'danger', text: 'Пластина сломана на этом обстреле: −' + plate.breakPenalty + ' к Защите далее.' });
                if (plate.brokenNote) flags.push({ tone: 'danger', text: plate.brokenNote });
            }
        }

        if (ammo && ammo.effects) {
            ammo.effects.forEach(eff => {
                if (!cond(eff.when, env)) return;
                if (eff.type === 'zeroIntegrity') flags.push({ tone: 'info', text: (eff.label || 'Обнуление Целостности') + ': ' + (eff.target || 'указанный слой') + ' → 0.' });
                else if (eff.type === 'note') flags.push({ tone: 'info', text: eff.text });
                else warnings.push('Неизвестный тип эффекта патрона: ' + eff.type);
            });
        }
        if (armored && plate.effects) plate.effects.forEach(eff => { if (eff.type === 'note' && cond(eff.when, env)) flags.push({ tone: 'info', text: plate.code + ': ' + eff.text }); });

        if (mode) {
            if (mode.overpenetration && margin >= num(mode.overpenetration.margin)) {
                res.overpen = { damage: num(mode.overpenetration.damage), type: mode.overpenetration.damageType };
                flags.push({ tone: 'surf', text: 'Навылет (Разница ≥ ' + mode.overpenetration.margin + '): каждый в 1–2 м за целью получает ' + mode.overpenetration.damage + ' ' + typeShort(ctx, mode.overpenetration.damageType) + '.' });
            }
            if (mode.area) flags.push({ tone: 'warn', text: 'Подавление: ' + mode.area + ' — задевает всех, включая союзников. ' + (mode.selfPenalty || '') });
            if (mode.shooterCover) flags.push({ tone: 'steel', text: 'Стрельба вслепую: ' + mode.shooterCover + '.' });
            if (mode.ricochet && mode.ricochet.halfRating) {
                const ones = num(inp.diceOnes);
                const dmgR = (ROUND[rules.ricochetRounding] || Math.floor)(rating / 2);
                res.ricochet = { ones, damage: dmgR };
                if (ones > 0) flags.push({ tone: 'surf', text: 'Рикошет: ' + ones + ' ' + (ones === 1 ? 'цель' : 'цели') + ' в 10 м получают по ' + dmgR + ' урона (половина Рейтинга).' });
                else warnings.push('Стрельба вслепую: число рикошетов считается по выпавшим «1» — бросьте пул атаки.');
            }
            if (mode.requires) {
                const okCat = !mode.requires.categories || (cls && mode.requires.categories.indexOf(cls.category) >= 0);
                const okBand = !mode.requires.bands || mode.requires.bands.indexOf(inp.distanceBand) >= 0;
                if (!okCat || !okBand) warnings.push('Режим «' + mode.name + '» доступен только для дробовика на ближней дистанции (≤ 10 м).');
            }
            if (mode.aim && num(inp.aimTurns) > 0 && inp.distanceBand === 'near') warnings.push('Прицельный режим невозможен в упор — уточните дистанцию у мастера.');
        }
        return res;
    }

    /* ---------- серия ---------- */
    function computeSeries(state, ctx, inputOf) {
        let integ = num(state.integrityStart);
        const entries = state.log.map((e, i) => {
            const inp = Object.assign({}, e.input, { integrity: integ, isFirst: i === 0 });
            const r = computeAttack(inp, ctx);
            integ = r.integrityAfter;
            return { entry: e, result: r, index: i };
        });
        const pendingInput = Object.assign({}, inputOf(state), { integrity: integ, isFirst: state.log.length === 0 });
        const pending = computeAttack(pendingInput, ctx);
        const totals = entries.reduce((t, x) => {
            t.agg += num(x.result.hp.aggravated); t.surf += num(x.result.hp.surface);
            t.wear += num(x.result.wear.total); t.hits += x.result.hit ? 1 : 0; t.misses += x.result.hit ? 0 : 1;
            return t;
        }, { agg: 0, surf: 0, wear: 0, hits: 0, misses: 0 });
        return { entries, pending, chainIntegrity: integ, totals };
    }

    window.IREngine = {
        clamp, num, buildContext, computePool, computeAttack, computeSeries,
        rollPool, diceSuccesses, diceOnes, typeShort, typeLabel, ROUND
    };
})();