/* Встроенные копии модулей — резерв для file:// и недоступного /modules.
   Содержимое идентично JSON-файлам в папке modules/. */
window.IR_EMBEDDED = {
    registry: [
        { id: 'irreality-core', file: 'irreality-core.json', required: true },
        { id: 'isotope-tier', file: 'isotope-tier.json' },
        { id: 'example-template', file: 'example-template.json', example: true }
    ],
    manifests: {
        'irreality-core': {
            schema: 'irreality.module/1', id: 'irreality-core', kind: 'core', name: 'Irreality · Ядро', namespace: 'core',
            version: '2.0.0', author: 'Irreality', required: true, requires: [],
            description: 'Сеттингонезависимое ядро огнестрела: пул d10 из любых атрибутов и навыков, Разница, Рейтинг оружия, поглощение бронёй и износ Целостности один раз за обстрел. Базовые пластины, патроны, носители, дистанции, режимы и укрытия.',
            attributes: ['Сила', 'Ловкость', 'Выносливость', 'Харизма', 'Манипулирование', 'Самообладание', 'Интеллект', 'Смекалка', 'Решимость'],
            skills: ['Атлетика', 'Внимательность', 'Вождение', 'Воровство', 'Драка', 'Меткость', 'Ближний бой', 'Ремесло', 'Этикет', 'Исполнение', 'Запугивание', 'Расследование', 'Медицина', 'Оккультизм', 'Политика', 'Наука', 'Скрытность', 'Выживание', 'Проницательность', 'Уличные порядки', 'Обращение с животными', 'Академические знания', 'Техника', 'Финансы'],
            damageTypes: [
                { id: 'aggravated', label: 'Усугублённый', short: 'УСУГ', tone: 'agg' },
                { id: 'surface', label: 'Поверхностный', short: 'ПОВ', tone: 'surf' }
            ],
            rules: [
                { id: 'wearDivider', label: 'Делитель износа брони', hint: 'Поглощённый урон делится на это число (переходит в Поверхностный) и вычитается из Целостности.', type: 'number', default: 2, min: 1, max: 6 },
                { id: 'defaultRounding', label: 'Округление по умолчанию', hint: 'Применяется, если у пластины округление не задано.', type: 'select', default: 'floor', options: [{ value: 'floor', label: 'Вниз' }, { value: 'round', label: 'Математическое' }, { value: 'ceil', label: 'Вверх' }] },
                { id: 'soakAggravated', label: 'Броня поглощает Усугублённый', hint: 'Система задумана на поглощение Усугублённого урона пластинами.', type: 'toggle', default: true },
                { id: 'minDamage', label: 'Минимальный урон при попадании', hint: '0 — минимум не применяется. Особые стволы модулей задают свой минимум эффектами.', type: 'number', default: 0, min: 0, max: 3 },
                { id: 'autoShotRating', label: 'Авто-Рейтинг дроби по дистанции', hint: 'Дробовик (дробь): +5 / +4 / +2 на ближней / средней / дальней.', type: 'toggle', default: true },
                { id: 'fixedDamageReplaces', label: 'Фиксированный урон заменяет формулу', hint: 'Патроны с фиксированным уроном не добавляют Рейтинг + Разницу.', type: 'toggle', default: true },
                { id: 'coverArmor', label: 'Укрытие даёт дополнительную Защиту', hint: 'Опция мастера: прочность укрытия добавляется к Защите при поглощении. Кубики укрытия работают всегда.', type: 'toggle', default: false },
                { id: 'coverArmorValue', label: 'Прочность укрытия', hint: 'Сколько пунктов Защиты добавляет укрытие.', type: 'number', default: 2, min: 0, max: 6, dependsOn: 'core:coverArmor' },
                { id: 'ricochetRounding', label: 'Округление урона рикошета', hint: 'Стрельба вслепую: половина Рейтинга случайной цели.', type: 'select', default: 'floor', options: [{ value: 'floor', label: 'Вниз' }, { value: 'round', label: 'Математическое' }] },
                { id: 'applyPassiveSuccessMods', label: 'Пассивные штрафы к успехам защиты', hint: 'Штрафы вида «−2 к успехам Ловкости» вычитаются из результата броска защиты. Введённые вручную успехи считаются финальными.', type: 'toggle', default: true }
            ],
            covers: [
                { id: 'none', name: 'Нет', dice: 0, note: 'Цель на открытом месте.' },
                { id: 'light', name: 'Лёгкое', dice: 2, note: '+2 кубика к пулу защиты: дверь, куст, борт легковой машины.' },
                { id: 'heavy', name: 'Тяжёлое', dice: 4, note: '+4 кубика к пулу защиты: стена, бетон, двигатель грузовика.' },
                { id: 'full', name: 'Полное', dice: 0, untargetable: true, note: 'Цель не видна и не простреливается — атака невозможна.' }
            ],
            weaponClasses: [
                { id: 'pistol', name: 'Пистолет', category: 'pistol', bands: { near: { label: '0–15 м', dice: 0 }, mid: { label: '15–30 м', dice: -2 }, far: { label: '30+ м', dice: -4 } }, note: 'На 30 м попасть в стрессе почти нереально без упора.' },
                { id: 'smg', name: 'Пистолет-пулемёт', category: 'smg', bands: { near: { label: '0–25 м', dice: 0 }, mid: { label: '25–75 м', dice: -2 }, far: { label: '75+ м', dice: -4 } }, note: 'Тяжёлый затвор и пистолетный патрон: пуля быстро теряет энергию и падает.' },
                { id: 'shotgun-shot', name: 'Дробовик (дробь)', category: 'shotgun', bands: { near: { label: '0–10 м', dice: 1, rating: 5 }, mid: { label: '10–25 м', dice: 0, rating: 4 }, far: { label: '25+ м', dice: -3, rating: 2 } }, note: 'Дробь рассеивается: дальше 25 м в человека попадает лишь пара дробин.' },
                { id: 'shotgun-slug', name: 'Дробовик (пуля)', category: 'shotgun', bands: { near: { label: '0–25 м', dice: 0 }, mid: { label: '25–75 м', dice: -1 }, far: { label: '75+ м', dice: -3 } }, note: 'Тяжёлая свинцовая пуля быстро теряет высоту.' },
                { id: 'assault', name: 'Штурмовая винтовка', category: 'auto', bands: { near: { label: '0–50 м', dice: 0 }, mid: { label: '50–200 м', dice: 0 }, far: { label: '200–400 м', dice: -2 } }, note: 'Промежуточный патрон. На 50+ м пуля летит стабильно, но в тесных коридорах длинный ствол мешает.' },
                { id: 'marksman', name: 'Боевая / снайперская', category: 'marksman', bands: { near: { label: '0–30 м', dice: -2 }, mid: { label: '30–300 м', dice: 0 }, far: { label: '300–800 м', dice: 0 } }, note: 'Мощный винтовочный патрон. В упор длинный ствол и оптика делают оружие неповоротливым.' },
                { id: 'antimaterial', name: 'Антиматериальная', category: 'marksman', bands: { near: { label: '0–50 м', dice: -3 }, mid: { label: '50–500 м', dice: 0 }, far: { label: '500–1500 м', dice: 0 } }, note: 'Чудовищная отдача и вес. Стрельба с рук в упор — вывих плеча и промах. Требует сошек.' }
            ],
            fireModes: [
                { id: 'burst', code: 'ОЧ', name: 'Очередь', cost: '3–5 патронов', poolMod: 0, damageBonus: 0, summary: 'Базовый режим', note: 'Зацеп соседей: при Разнице ≥ 4 пули прошивают цель — любой в 1–2 м за ней получает 2 Поверхностного урона.', overpenetration: { margin: 4, damage: 2, damageType: 'surface' } },
                { id: 'single', code: 'ОД', name: 'Одиночный', cost: '1 патрон', poolMod: 0, poolModByCategory: { auto: -1, smg: -1, default: 0 }, damageBonus: 0, summary: 'Экономия', note: 'Для автоматов и ПП −1 кубик: на адреналине выстрелить ровно один раз сложнее, чем дать очередь. Пистолеты и снайперские работают штатно.' },
                { id: 'blind', code: 'ВС', name: 'Вслепую', cost: '1–3 патрона', poolMod: -4, damageBonus: 0, summary: 'Македонский', note: 'Стрелок в полном укрытии (+3 к Защите). За каждую выпавшую «1» — рикошет: случайная цель в 10 м получает половину Рейтинга урона.', ricochet: { halfRating: true }, shooterCover: '+3 к Защите стрелка' },
                { id: 'suppression', code: 'ПД', name: 'Подавление', cost: '10 патронов / магазин', poolMod: 2, damageBonus: 0, summary: 'Конус 5 м', note: 'Бьёт по всем в конусе 5 м — врагам и союзникам. Уклониться можно только нырнув за укрытие. Отдача и перегрев: −1 кубик на любое действие в следующий ход.', area: 'конус 5 м', selfPenalty: '−1 кубик в следующий ход' },
                { id: 'aimed', code: 'ПР', name: 'Прицельный', cost: '1 патрон', poolMod: 0, damageBonus: 0, summary: 'Хладнокровие', note: '+1 кубик за ход прицеливания (максимум +3). Невозможен в упор или под огнём; при получении урона прицел сбивается.', aim: { perTurn: 1, max: 3 }, headshot: { dice: -2, damage: 2 } },
                { id: 'doubletap', code: 'ДП', name: 'Дуплет', cost: '2 патрона', poolMod: -1, damageBonus: 2, summary: 'Дробовик ≤ 10 м', note: 'Два быстрых выстрела из помпы или двустволки: один бросок, −1 кубик, +2 к итоговому урону.', requires: { categories: ['shotgun'], bands: ['near'] } }
            ],
            carriers: [
                { id: 'none', name: 'Без брони', plates: [] },
                { id: 'vest', name: 'Ударный жилет', plates: ['kevlar'] },
                { id: 'light', name: 'Лёгкая броня', plates: ['kevlar', 'steel', 'ceramic'] },
                { id: 'heavy', name: 'Тяжёлая броня', plates: ['kevlar', 'steel', 'ceramic', 'kevlar-plus', 'steel-plus', 'ceramic-plus'], passive: { text: '−1 Ловкость (пассивная)', mods: { agilityDice: -1 } } }
            ],
            plates: [
                { id: 'kevlar', code: 'КВ', name: 'Кевларовая', defense: 2, integrity: 6, rounding: 'floor', breakPenalty: 1, firstShot: { type: 'defenseBonus', value: 1 }, notes: 'Первая пуля: +1 к Защите. Весь поглощённый урон уходит в Целостность.' },
                { id: 'steel', code: 'СТ', name: 'Стальная', defense: 3, integrity: 20, rounding: 'round', breakPenalty: 1, notes: 'Весь поглощённый урон уходит в Целостность. Математическое округление.' },
                { id: 'ceramic', code: 'КР', name: 'Керамическая', defense: 4, integrity: 5, rounding: 'floor', breakPenalty: 3, firstShot: { type: 'ignoreExcess' }, notes: 'Первая пуля: игнорирование лишнего урона. Целостность тратится от поглощённого.' },
                { id: 'kevlar-plus', code: 'УКВ', name: 'Кевларовая (усил.)', defense: 4, integrity: 10, rounding: 'floor', breakPenalty: 3, firstShot: { type: 'defenseBonus', value: 1 }, notes: 'Первая пуля: +1 к Защите.' },
                { id: 'steel-plus', code: 'УСТ', name: 'Стальная (усил.)', defense: 5, integrity: 30, rounding: 'round', breakPenalty: 3, passive: { text: '−1 к успехам на выносливость' }, notes: 'Самая ёмкая пластина ядра.' },
                { id: 'ceramic-plus', code: 'УКР', name: 'Керамическая (усил.)', defense: 6, integrity: 8, rounding: 'floor', breakPenalty: 4, firstShot: { type: 'ignoreExcess' }, passive: { text: '−1 выносливость' }, notes: 'Первая пуля: игнорирование лишнего урона.' }
            ],
            ammo: [
                { id: 'fmj', code: 'FMJ', name: 'Оболочечный', damageType: 'aggravated', tags: ['ballistic'], description: 'Обычный патрон. Без модификаторов.' },
                { id: 'jhp', code: 'JHP', name: 'Экспансивный', damageType: 'aggravated', damageBonus: 1, attackDice: -1, tags: ['ballistic'], description: '+1 к урону; −1 кубик к попаданию против брони/укрытия. Раскрывается в теле, но вязнет в пластинах.' },
                { id: 'ap', code: 'AP', name: 'Бронебойный', damageType: 'aggravated', attackDice: 1, tags: ['ballistic'], description: '+1 кубик к попаданию против брони/укрытия.' },
                { id: 'shot', code: 'ДР', name: 'Дробь', damageType: 'aggravated', damageVsArmor: -2, ignoreWearDivision: true, tags: ['ballistic', 'shot'], description: '−2 к урону против брони. Весь поглощённый бронёй урон не режется вдвое — сноп дроби выгрызает пластину целиком.' }
            ]
        },
        'isotope-tier': {
            schema: 'irreality.module/1', id: 'isotope-tier', kind: 'module', name: 'Изотопный Ярус', namespace: 'iso',
            version: '2.0.0', author: 'Модуль сеттинга', requires: ['irreality-core'],
            description: 'Модуль брони, патронов и оружия: аблятивный композит «Саркофаг» и линейка ядерных боеприпасов — гиперзвуковой вольфрам, термобар, кавитационная игла, ЭМИ-разрядник и разрывная плазма.',
            skills: ['Ядерная инженерия', 'Радиационная разведка'],
            rules: [
                { id: 'ablativeReduction', label: '«Саркофаг»: снижение Усугублённого', hint: 'На сколько пунктов композит гасит Усугублённый урон.', type: 'number', default: 2, min: 0, max: 6 },
                { id: 'ablativeMin', label: '«Саркофаг»: минимум урона', hint: 'Ниже этого значения урон не снижается (если он вообще был).', type: 'number', default: 1, min: 0, max: 3 },
                { id: 'sacrificialWear', label: 'Жертвенный слой', hint: 'Сколько Целостности броня теряет дополнительно за обстрел ядерным патроном.', type: 'number', default: 4, min: 0, max: 10 },
                { id: 'nuclearOnly', label: 'Аблятивная защита только против ядерных', hint: 'Выкл — композит снижает любой Усугублённый урон.', type: 'toggle', default: true }
            ],
            carrierExtensions: [{ target: 'core:heavy', addPlates: ['sarcophagus'] }],
            plates: [
                { id: 'sarcophagus', code: 'АК', name: 'Аблятивный композит «Саркофаг»', defense: 6, integrity: 12, breakPenalty: 4,
                    passive: { text: '−2 к успехам на все проверки Ловкости и Реакции', mods: { agilitySuccesses: -2 } },
                    effects: [
                        { type: 'reduceDamage', damageType: 'aggravated', amount: 2, min: 1, rule: 'iso:ablativeReduction', minRule: 'iso:ablativeMin', when: { ammoTag: 'nuclear' }, label: 'Аблятивное рассеивание' },
                        { type: 'extraWear', amount: 4, rule: 'iso:sacrificialWear', when: { ammoTag: 'nuclear' }, label: 'Жертвенный слой' },
                        { type: 'note', text: 'Бег или активная драка дольше 2 раундов: проверка Выносливости (Сложность 7), иначе 1 Поверхностный урон от перегрева и удушья.', when: {} }
                    ],
                    brokenNote: 'Сломанный «Саркофаг» фонит: носитель получает 1 Поверхностный урон в час.',
                    notes: 'Округление не задано в источнике — применяется правило ядра. Чудовищный вес и громоздкость.' }
            ],
            ammo: [
                { id: 'tungsten', code: 'ВФ', name: 'Гиперзвуковой вольфрам', damageType: 'aggravated', armorPierce: 1, tags: ['nuclear'], description: 'Стандарт Яруса. Базовый урон — Усугублённый. Игнорирует 1 пункт Защиты брони, создаёт гигантскую кавитационную полость.' },
                { id: 'thermo', code: 'ТБ', name: 'Термобарический микрозаряд', damageType: 'aggravated', fixedDamage: { aggravated: 2, surface: 3 }, surfaceBypass: true, tags: ['nuclear'], description: 'Урон: 2 Усугублённых + 3 Поверхностных. Поверхностный идёт и в Целостность брони, и в Здоровье (шоковая волна). При попадании — микровзрыв плазмы.' },
                { id: 'needle', code: 'КИ', name: 'Кавитационная игла', damageType: 'aggravated', armorPierce: 2, tags: ['nuclear'], description: 'Снайперская. Базовый урон — Усугублённый. Игнорирует 2 пункта Защиты: волна дробит кости внутри тела.' },
                { id: 'emp', code: 'ЭМИ', name: 'ЭМИ-разрядник', damageType: 'surface', fixedDamage: { surface: 1 }, tags: ['nonlethal'], effects: [{ type: 'zeroIntegrity', target: 'киберимпланты и электронная броня', label: 'ЭМИ-разряд' }, { type: 'note', text: 'Отключает «Око Бога» на 1d3 раунда.', when: {} }], description: 'Нелетальный. Урон: 1 Поверхностный. Мгновенно обнуляет Целостность любого киберимпланта или электронной брони.' },
                { id: 'plasma', code: 'ПЛ', name: 'Разрывная плазма', damageType: 'aggravated', fixedDamage: { aggravated: 2 }, ignoreWearDivision: true, tags: ['nuclear', 'shot'], description: 'Ядерная дробь. Урон: 2 Усугублённых на близкой дистанции. Поглощённый урон не делится пополам — мгновенно выжигает защитные пластины.' }
            ]
        },
        'example-template': {
            schema: 'irreality.module/1', id: 'example-template', kind: 'module', name: 'Шаблон модуля (пример)', namespace: 'demo',
            version: '0.2.0', author: 'Irreality', example: true, requires: ['irreality-core'],
            description: 'Не канон. Демонстрация формата: своя пластина с округлением вверх, патрон с фиксированным уроном, ствол в базе оружия, собственный навык для конструктора пула и настраиваемое правило износа.',
            attributes: ['Резонанс'], skills: ['Пси-фокус'],
            rules: [{ id: 'extraWear', label: 'Доп. износ за обстрел (пример)', hint: 'Демонстрация ссылки эффекта на значение правила модуля.', type: 'number', default: 0, min: 0, max: 5 }],
            carrierExtensions: [{ target: 'core:light', addPlates: ['polymer'] }],
            plates: [{ id: 'polymer', code: 'ПМ', name: 'Полимерная плита (пример)', defense: 3, integrity: 14, rounding: 'ceil', breakPenalty: 2, effects: [{ type: 'extraWear', amount: 0, rule: 'demo:extraWear', when: {}, label: 'Доп. износ (правило модуля)' }], notes: 'Округление вверх — демонстрация альтернативы ядру.' }],
            ammo: [{ id: 'flechette', code: 'ФЛ', name: 'Игловой разряд (пример)', damageType: 'surface', fixedDamage: { surface: 2 }, armorPierce: 1, tags: ['demo'], description: 'Фиксированные 2 Поверхностных, игнорирует 1 пункт Защиты. Показывает, что модуль может вводить любой тип урона.' }],
            weapons: [{ id: 'needler', name: 'Игольчатый карабин (пример)', rating: 3, weaponClass: 'core:assault', description: 'Демонстрация базы стволов: Рейтинг +3, класс штурмовой винтовки.' }]
        }
    }
};