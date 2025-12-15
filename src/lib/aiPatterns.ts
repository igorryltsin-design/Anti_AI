// AI Patterns and Stop Words for detection and replacement
// Паттерны и стоп-слова ИИ для обнаружения и замены

type PatternReplacement = string | ((substring: string, ...args: unknown[]) => string)

export interface AIPattern {
    id: string
    pattern: string | RegExp
    description: string
    category: 'phrase' | 'structure' | 'transition' | 'filler'
    enabled: boolean
    // Можно заменить на строку или функцию (для контекстных исправлений)
    replacement?: PatternReplacement
    // Дополнительные сигналы для ранжирования
    severity?: 'low' | 'medium' | 'high'
    weight?: number
}

// Типичные фразы-клише ИИ на русском языке
export const defaultAIPatterns: AIPattern[] = [
    // Структурные артефакты
    {
        id: 'struct-1',
        pattern: /\b([А-ЯЁA-Z][а-яёa-z]{2,})\s*:\s+\1\b/giu,
        description: 'Повтор слова по обе стороны двоеточия (слово с заглавной буквы после двоеточия)',
        category: 'structure',
        enabled: true,
        replacement: (_match, word: unknown) => `${String(word)}: `,
    },
    {
        id: 'struct-2',
        pattern: /\b(данные|данных)\s*:\s+(данные|данных)\b/gi,
        description: 'Повтор «данные/данных» вокруг двоеточия',
        category: 'structure',
        enabled: true,
        replacement: (_match, left: unknown) => `${String(left)}: `,
    },
    {
        id: 'struct-3',
        pattern: /(?<![\n.?!])\s([А-ЯЁ][а-яё]{2,}(?:\s+[А-ЯЁ][а-яё]{2,}){2,})/g,
        description: 'Последовательность 3+ слов с заглавной буквы в середине предложения (Title Case)',
        category: 'structure',
        enabled: true,
    },
    {
        id: 'struct-4',
        pattern: /\b(являет(?:ся|тесь|ся)|являлось|являлась|являлся|являлись)\b/gi,
        description: 'Чрезмерное «является» как калька is',
        category: 'structure',
        enabled: true,
        replacement: '',
    },
    {
        id: 'struct-5',
        pattern: /\b(был[аио]?|будет|были|будут)\s+[а-яё]+н[а-яё]+(?:[а-яё]|ся)\b/gi,
        description: 'Страдательный залог (была решена командой)',
        category: 'structure',
        enabled: true,
    },

    // Вводные фразы
    {
        id: 'intro-1',
        pattern: /в заключение,?/gi,
        description: 'Вводная фраза "в заключение"',
        category: 'transition',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-2',
        pattern: /важно отметить,? что/gi,
        description: 'Фраза "важно отметить, что"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-3',
        pattern: /следует отметить,? что/gi,
        description: 'Фраза "следует отметить, что"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-4',
        pattern: /стоит упомянуть,? что/gi,
        description: 'Фраза "стоит упомянуть, что"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-5',
        pattern: /необходимо подчеркнуть,? что/gi,
        description: 'Фраза "необходимо подчеркнуть, что"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    // Новые русские паттерны
    {
        id: 'intro-6',
        pattern: /подводя итоги?,?/gi,
        description: 'Фраза "подводя итоги"',
        category: 'transition',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-7',
        pattern: /в данном контексте,?/gi,
        description: 'Фраза "в данном контексте"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-8',
        pattern: /не стоит забывать,? что/gi,
        description: 'Фраза "не стоит забывать, что"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-9',
        pattern: /как уже было сказано,?/gi,
        description: 'Фраза "как уже было сказано"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-10',
        pattern: /в первую очередь,?/gi,
        description: 'Фраза "в первую очередь"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'intro-11',
        pattern: /прежде всего,?/gi,
        description: 'Фраза "прежде всего"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'intro-12',
        pattern: /в целом,?/gi,
        description: 'Фраза "в целом"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'intro-13',
        pattern: /с уверенностью можно сказать,? что/gi,
        description: 'Фраза "с уверенностью можно сказать"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-14',
        pattern: /нельзя не отметить,? что/gi,
        description: 'Фраза "нельзя не отметить"',
        category: 'filler',
        enabled: true,
        replacement: '',
    },
    {
        id: 'intro-15',
        pattern: /очевидно,? что/gi,
        description: 'Фраза "очевидно, что"',
        category: 'filler',
        enabled: true,
    },

    // Переходные фразы
    {
        id: 'trans-1',
        pattern: /кроме того,?/gi,
        description: 'Переход "кроме того"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-2',
        pattern: /более того,?/gi,
        description: 'Переход "более того"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-3',
        pattern: /таким образом,?/gi,
        description: 'Переход "таким образом"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-4',
        pattern: /в связи с этим,?/gi,
        description: 'Переход "в связи с этим"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-5',
        pattern: /с другой стороны,?/gi,
        description: 'Переход "с другой стороны"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-6',
        pattern: /вместе с тем,?/gi,
        description: 'Переход "вместе с тем"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-7',
        pattern: /следовательно,?/gi,
        description: 'Переход "следовательно"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'trans-8',
        pattern: /исходя из вышесказанного,?/gi,
        description: 'Переход "исходя из вышесказанного"',
        category: 'transition',
        enabled: true,
        replacement: '',
    },

    // Усилители
    {
        id: 'amp-1',
        pattern: /крайне важно/gi,
        description: 'Усилитель "крайне важно"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'amp-2',
        pattern: /чрезвычайно важно/gi,
        description: 'Усилитель "чрезвычайно важно"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'amp-3',
        pattern: /безусловно,?/gi,
        description: 'Усилитель "безусловно"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'amp-4',
        pattern: /несомненно,?/gi,
        description: 'Усилитель "несомненно"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'amp-5',
        pattern: /абсолютно/gi,
        description: 'Усилитель "абсолютно"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'amp-6',
        pattern: /принципиально важно/gi,
        description: 'Усилитель "принципиально важно"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'amp-7',
        pattern: /игра(е|ю)т важную роль/gi,
        description: 'Фраза "играет важную роль"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-1',
        pattern: /в (данной|настоящей) (работе|статье|главе)/gi,
        description: 'Фраза "в данной работе/статье/главе"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-2',
        pattern: /как показывает практика/gi,
        description: 'Фраза "как показывает практика"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-3',
        pattern: /в (современном|нынешнем|сегодняшнем) мире/gi,
        description: 'Фраза "в современном/нынешнем мире"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-4',
        pattern: /результаты (исследования|анализа) показывают,?\s+что/gi,
        description: 'Фраза "результаты исследования показывают, что"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-5',
        pattern: /нельзя отрицать тот факт,?\s+что/gi,
        description: 'Фраза "нельзя отрицать тот факт, что"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-6',
        pattern: /погружаясь в (эту|данную) тему/gi,
        description: 'Фраза "погружаясь в эту тему"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-7',
        pattern: /в мире (цифровых технологий|современных технологий)/gi,
        description: 'Фраза "в мире цифровых технологий"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-8',
        pattern: /важно учитывать контекст/gi,
        description: 'Повторяемая фраза "важно учитывать контекст"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-9',
        pattern: /в контексте (данной|текущей) (темы|задачи|работы)/gi,
        description: 'Фраза "в контексте данной темы"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'filler-10',
        pattern: /это сделает разницу/gi,
        description: 'Калька make a difference: "сделает разницу"',
        category: 'phrase',
        enabled: true,
        replacement: 'изменит ситуацию',
    },
    {
        id: 'filler-11',
        pattern: /волнующий опыт/gi,
        description: 'Калька excited experience: "волнующий опыт"',
        category: 'phrase',
        enabled: true,
        replacement: 'захватывающий опыт',
    },
    {
        id: 'filler-12',
        pattern: /он покачал своей головой|я положил руку в свой карман/gi,
        description: 'Избыточные притяжательные местоимения ("своей головой", "в свой карман")',
        category: 'phrase',
        enabled: true,
    },

    // Англоязычные паттерны
    {
        id: 'en-1',
        pattern: /in conclusion,?/gi,
        description: 'English: "in conclusion"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-2',
        pattern: /it'?s important to note that/gi,
        description: 'English: "it\'s important to note that"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-3',
        pattern: /it'?s worth mentioning that/gi,
        description: 'English: "it\'s worth mentioning that"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-4',
        pattern: /furthermore,?/gi,
        description: 'English: "furthermore"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-5',
        pattern: /moreover,?/gi,
        description: 'English: "moreover"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-6',
        pattern: /additionally,?/gi,
        description: 'English: "additionally"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-7',
        pattern: /in summary,?/gi,
        description: 'English: "in summary"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-8',
        pattern: /to summarize,?/gi,
        description: 'English: "to summarize"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-9',
        pattern: /it can be argued that/gi,
        description: 'English: "it can be argued that"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-10',
        pattern: /on the other hand,?/gi,
        description: 'English: "on the other hand"',
        category: 'transition',
        enabled: true,
    },
    // Новые английские паттерны
    {
        id: 'en-11',
        pattern: /delve into/gi,
        description: 'English: "delve into"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-12',
        pattern: /it is crucial (to|that)/gi,
        description: 'English: "it is crucial"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-13',
        pattern: /at the end of the day,?/gi,
        description: 'English: "at the end of the day"',
        category: 'transition',
        enabled: true,
    },
    {
        id: 'en-14',
        pattern: /it'?s essential to/gi,
        description: 'English: "it\'s essential to"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-15',
        pattern: /in today'?s (world|society|age)/gi,
        description: 'English: "in today\'s world/society"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-16',
        pattern: /a testament to/gi,
        description: 'English: "a testament to"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-17',
        pattern: /navigating the (complexities|landscape|world)/gi,
        description: 'English: "navigating the complexities"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-18',
        pattern: /in the realm of/gi,
        description: 'English: "in the realm of"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-19',
        pattern: /a myriad of/gi,
        description: 'English: "a myriad of"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-20',
        pattern: /it'?s worth noting that/gi,
        description: 'English: "it\'s worth noting that"',
        category: 'filler',
        enabled: true,
    },
    {
        id: 'en-21',
        pattern: /leverag(e|ing)/gi,
        description: 'English: "leverage/leveraging"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-22',
        pattern: /holistic approach/gi,
        description: 'English: "holistic approach"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-23',
        pattern: /paradigm shift/gi,
        description: 'English: "paradigm shift"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-24',
        pattern: /synergy|synergistic/gi,
        description: 'English: "synergy"',
        category: 'phrase',
        enabled: true,
    },
    {
        id: 'en-25',
        pattern: /game[- ]?changer/gi,
        description: 'English: "game-changer"',
        category: 'phrase',
        enabled: true,
    },
]

// Zero-width и невидимые символы
export const invisibleCharacters: Record<string, string> = {
    '\u200B': 'Zero-width space',
    '\u200C': 'Zero-width non-joiner',
    '\u200D': 'Zero-width joiner',
    '\uFEFF': 'Byte order mark',
    '\u00A0': 'Non-breaking space',
    '\u2060': 'Word joiner',
    '\u180E': 'Mongolian vowel separator',
    '\u2028': 'Line separator',
    '\u2029': 'Paragraph separator',
    '\u202F': 'Narrow no-break space',
    '\u205F': 'Medium mathematical space',
    '\u3000': 'Ideographic space',
}

// ============================================
// НОРМАЛИЗАЦИЯ КАВЫЧЕК
// ============================================

// Замена типографских кавычек на обычные (для англ. стиля)
export const quoteToStraight: Record<string, string> = {
    '\u201C': '"', // Left double quotation mark " → "
    '\u201D': '"', // Right double quotation mark " → "
    '\u201E': '"', // Double low-9 quotation mark „ → "
    '\u00AB': '"', // Left-pointing double angle quotation mark « → "
    '\u00BB': '"', // Right-pointing double angle quotation mark » → "
    '\u2018': "'", // Left single quotation mark ' → '
    '\u2019': "'", // Right single quotation mark ' → '
    '\u201A': "'", // Single low-9 quotation mark ‚ → '
    '\u2039': "'", // Single left-pointing angle quotation mark ‹ → '
    '\u203A': "'", // Single right-pointing angle quotation mark › → '
}

// Замена обычных кавычек на типографские «ёлочки» (для русского стиля)
// Примечание: для правильной замены нужна функция с контекстом
export const quoteToTypographic = {
    openDouble: '«',  // Открывающая «
    closeDouble: '»', // Закрывающая »
    openSingle: '‹',  // Открывающая ‹
    closeSingle: '›', // Закрывающая ›
}

// Устаревший экспорт для обратной совместимости
export const quoteNormalization = quoteToStraight

// ============================================
// НОРМАЛИЗАЦИЯ ТИРЕ
// ============================================

// Типы тире:
// — (U+2014) Em dash (длинное тире)
// – (U+2013) En dash (среднее тире, "обычное")
// - (U+002D) Hyphen-minus (дефис)
// ‐ (U+2010) Hyphen (настоящий дефис)

export const dashNormalization = {
    // Длинное тире → среднее (обычное) тире
    emToEn: {
        '\u2014': '\u2013', // — → –
    },
    // Среднее тире → длинное тире
    enToEm: {
        '\u2013': '\u2014', // – → —
    },
    // Всё в дефис (не рекомендуется)
    toHyphen: {
        '\u2014': '-', // — → -
        '\u2013': '-', // – → -
    },
    // Дефис в среднее тире (для нормализации)
    hyphenToEn: {
        // Только если дефис окружён пробелами (это тире, не часть слова)
        pattern: / - /g,
        replacement: ' – ',
    },
}
