# Ревью ТЗ NET

Интерфейс как в Spec Check Pro: белый минимализм, ввод ТЗ, затем документ с цветными маркерами и рельс комментариев.

Аналитик вставляет текст или PDF. Решение проверяет ТЗ по **8 обязательным правилам** и ставит замечания **HIGH / MEDIUM / LOW**. Текст само не переписывает.

<<<<<<< HEAD
Модель: **Qwen**. Без ключа работают шаблон и эвристики.
=======
Модель: **Kimi на Groq** (бесплатный тариф). Если ключа нет, работают шаблон и эвристики — демо не падает.
>>>>>>> 12f39f8 (Default the LLM call to free Groq Kimi.)

## Запуск

```bash
npm install
npm run dev
```

http://127.0.0.1:43142

<<<<<<< HEAD
Qwen (необязательно):

```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-plus
```

## Экран
=======
Бесплатный ключ (карта не нужна): [console.groq.com/keys](https://console.groq.com/keys)

```bash
# .env.local
GROQ_API_KEY=gsk_...
```

По умолчанию вызывается `moonshotai/kimi-k2-instruct`. Qwen на том же Groq: `OPENAI_MODEL=qwen/qwen3-32b`.

Внутренний контур компании — те же переменные, другой `OPENAI_BASE_URL`.
>>>>>>> 12f39f8 (Default the LLM call to free Groq Kimi.)

- Слева: большое поле ввода, «Прикрепить файл», **«Обновить 8 обязательных правил»**, красная кнопка отправки.
- После проверки: предпросмотр документа с подсветкой и комментарии справа.
- Примеры под формой: поток GEO, источник MSCP, витрина устройств.

## Документы кейса

- [docs/BRIEF.md](docs/BRIEF.md)
- [docs/TEMPLATE.md](docs/TEMPLATE.md)
- [docs/CHECKLIST.md](docs/CHECKLIST.md)
- [docs/SAMPLE-FINDINGS.md](docs/SAMPLE-FINDINGS.md)
