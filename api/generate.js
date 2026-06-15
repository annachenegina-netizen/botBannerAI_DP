const Anthropic = require('@anthropic-ai/sdk');

const TEMPLATES = {
  'nahodki-1':        'Находки / подборка товаров (жёлтый, мужчина с цветными пакетами)',
  'nahodki-2':        'Находки / подарки / посылки (жёлтый, подарочные коробки)',
  'nahodki-3':        'Находки / шопинг (жёлтый, девушка с пакетами)',
  'nahodki-4':        'Находки / кешбэк / карта (жёлтый, девушка с картой и пакетами)',
  'nahodki-5':        'Находки / монеты / бонусы (оранжевый, монеты и сумка на ладони)',
  'nahodki-6':        'Находки / приложение / заказы (оранжевый, телефон с магазином)',
  'nahodki-7':        'Находки / товары DobroPost (оранжевый, кроссовки + телефон + сумка)',
  'nahodki-prazdnik': 'Находки праздничные / Новый год (оранжевый, ёлка + подарки)',
  'community-1':      'Комьюнити / общение / отзывы (жёлтый, мужчина с речевым пузырём)',
  'community-2':      'Комьюнити / диалог / обсуждение (оранжевый, двое с пузырями)',
  'community-3':      'Комьюнити / сообщество / мир (оранжевый, руки обнимают глобус)',
  'community-4':      'Комьюнити / рассылка / письмо (оранжевый, бумажный самолётик)',
  'gayd-1':           'Гайд / обучение / инструкция (оранжевый, тех-иллюстрация с иконками)',
  'prazdnik-1':       'Праздник / Хэллоуин / акция (оранжевый, игровые элементы + %)',
  'prazdnik-2':       'Праздник / торжество (оранжевый)',
  'prazdnik-3':       'Праздник / особый повод (оранжевый)',
  'novinka-1':        'Новинка / новая функция / обновление (тёмный, ноутбук + покупки)',
  'polezno-1':        'Полезно / лайфхак / как сэкономить (жёлтый, бейдж Полезно)',
  'akciya-1':         'Акция / быстрая доставка / спецпредложение (оранжевый, бегущий курьер)',
  'akciya-2':         'Акция / скидка / распродажа (оранжевый, ценник % + молния)',
  'akciya-3':         'Акция / шопинг / телефон (жёлтый, смартфоны с пакетами + %)',
  'stil-1':           'Стиль / мода / одежда (светлый фон, вешалка с вещами)',
};

function parseJson(raw) {
  let s = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

module.exports = async function handler(req, res) {
  // CORS для Vercel preview deployments
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY не настроен' });

  const { letterText, templateId: forcedTemplateId, maxTitleWords = 6, maxSubWords = 10 } = req.body || {};

  if (!letterText?.trim()) return res.status(400).json({ error: 'Нет текста письма' });

  try {
    const client = new Anthropic({ apiKey });

    let prompt;
    if (forcedTemplateId) {
      prompt = `Ты получаешь текст email-письма для интернет-магазина DobroPost.
Твоя задача — вытащить из него заголовок и подзаголовок для баннера.

Правила:
- Заголовок: максимум ${maxTitleWords} слов, точно из смысла письма, без выдумок
- Подзаголовок: максимум ${maxSubWords} слов, уточняет заголовок, без выдумок

Текст письма:
${letterText}

Верни ТОЛЬКО JSON без пояснений и markdown:
{"title": "...", "subtitle": "..."}`;
    } else {
      const templateList = Object.entries(TEMPLATES)
        .map(([id, desc]) => `- ${id}: ${desc}`)
        .join('\n');

      prompt = `Ты получаешь текст email-письма для интернет-магазина DobroPost.
Твоя задача — вытащить из него заголовок и подзаголовок для баннера, и выбрать подходящий шаблон.

Правила:
- Заголовок: максимум ${maxTitleWords} слов, точно из смысла письма, без выдумок
- Подзаголовок: максимум ${maxSubWords} слов, уточняет заголовок, без выдумок
- Выбери один шаблон из списка по смыслу письма

Доступные шаблоны:
${templateList}

Текст письма:
${letterText}

Верни ТОЛЬКО JSON без пояснений и markdown:
{"templateId": "...", "title": "...", "subtitle": "..."}`;
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = parseJson(message.content[0].text.trim());

    if (forcedTemplateId) result.templateId = forcedTemplateId;

    res.json(result);
  } catch (err) {
    console.error('[generate]', err.message);
    res.status(500).json({ error: err.message });
  }
};
