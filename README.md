# Ревью ТЗ NET

Интерфейс как в Spec Check Pro: белый минимализм, ввод ТЗ, затем документ с цветными маркерами и рельс комментариев.

Аналитик вставляет текст или PDF. Решение проверяет ТЗ по **8 обязательным правилам** и ставит замечания **HIGH / MEDIUM / LOW**. Текст сам не переписывает.

<<<<<<< HEAD
Модель: **Qwen 3.8 на Groq**, бесплатный тариф. Без ключа работают шаблон и эвристики.
=======
Модель: **Kimi на Groq** (бесплатный тариф). Если ключа нет, работают шаблон и эвристики — демо не падает.

PDF разбирается по координатам на странице: заголовки, списки и таблицы остаются таблицами, а не одной простынёй текста.
>>>>>>> 6683784 (Restore PDF structure in the document preview.)

## Запуск

```bash
npm install
npm run dev
```

http://127.0.0.1:43142

<<<<<<< HEAD
Ключ Groq (карта не нужна): [console.groq.com/keys](https://console.groq.com/keys)
=======
Бесплатный ключ (карта не нужна): [console.groq.com/keys](https://console.groq.com/keys)
>>>>>>> 6683784 (Restore PDF structure in the document preview.)

```bash
# .env.local
GROQ_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=qwen/qwen3.8-27b
```

Внутренний контур компании — те же переменные, другой `OPENAI_BASE_URL`.

## Экран

- Слева: большое поле ввода, «Прикрепить файл», **«Обновить 8 обязательных правил»**, красная кнопка отправки.
- После проверки: предпросмотр документа с подсветкой и комментарии справа.
- Примеры под формой: поток GEO, источник MSCP, витрина устройств.

## Документы кейса

- [docs/BRIEF.md](docs/BRIEF.md)
- [docs/TEMPLATE.md](docs/TEMPLATE.md)
- [docs/CHECKLIST.md](docs/CHECKLIST.md)
- [docs/SAMPLE-FINDINGS.md](docs/SAMPLE-FINDINGS.md)
