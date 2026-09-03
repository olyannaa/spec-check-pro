import type { ReviewDoc } from "./types";

export const doc1: ReviewDoc = {
  id: "tz1",
  title: "ТЗ 1. Описание потоков данных",
  keywords: [
    "поток",
    "потоков данных",
    "provider_geo",
    "геолокац",
    "topic_geo",
    "table_geo_raw",
    "flink",
  ],
  blocks: [
    { type: "h2", text: "Общие сведения" }, // 0
    {
      type: "p",
      text: "Модуль обеспечивает получение сведений о текущем и историческом местоположении абонентских устройств в реальном времени. Обработка основана на сигнальном трафике сетей радиодоступа (3G/4G), поступающем от платформы PROVIDER_GEO.",
    }, // 1
    { type: "h2", text: "Решаемая проблема" }, // 2
    {
      type: "p",
      text: "Замена устаревшей технологии геолокации абонентов по данным радиоинтерфейса. Цель — создание отечественного решения с потоковой обработкой и интеграцией в Data Lake.",
    }, // 3
    { type: "h2", text: "Продуктовые метрики" }, // 4
    { type: "li", text: "Задержка: < 1 мин" }, // 5
    { type: "li", text: "Пропускная способность: до 100 000 событий/сек" }, // 6
    { type: "li", text: "Точность локации: 3G — 50–500 м, 4G — 10–100 м" }, // 7
    { type: "h2", text: "Заказчики" }, // 8
    { type: "p", text: "BigData Unit X" }, // 9
    { type: "h2", text: "Нефункциональные требования" }, // 10
    { type: "li", text: "Инкрементная загрузка по часовым партициям" }, // 11
    { type: "li", text: "Географическое разбиение по регионам" }, // 12
    { type: "li", text: "Стриминг в реальном времени (задержка ≈ 0 сек)" }, // 13
    { type: "li", text: "Хранение: Kafka — 24 ч, RAW-слой — 30 дней" }, // 14
    { type: "h2", text: "Системы-источники" }, // 15
    {
      type: "li",
      text: "PROVIDER_GEO — мультивендорная платформа агрегации событий 3G/4G и MDT.",
    }, // 16
    { type: "h2", text: "Схема потоков данных" }, // 17
    {
      type: "p",
      text: "PROVIDER_GEO → Kafka (топики по регионам) → Apache Flink → RAW → DDS → ADDS → CDM",
    }, // 18
    { type: "li", text: "Мониторинг: LINK_DASHBOARD_GEO" }, // 19
    { type: "li", text: "Исходный код: LINK_GITLAB_PROJECT" }, // 20
    { type: "h2", text: "JIRA" }, // 21
    {
      type: "p",
      text: "PROJECT-XX123 — Описание потоковой обработки геоданных. LINK_JIRA_TASK",
    }, // 22
    { type: "h2", text: "Команда" }, // 23
    { type: "li", text: "USER_A — Product Owner" }, // 24
    { type: "li", text: "USER_B — Data Analyst" }, // 25
    { type: "li", text: "USER_C — Backend Developer" }, // 26
    { type: "h2", text: "Источники и приемники данных" }, // 27
    { type: "p", text: "PROVIDER_GEO → Kafka (24 часа хранения):" }, // 28
    {
      type: "table",
      head: ["Регион", "Топик 3G", "Топик 4G"],
      rows: [
        ["Центр", "TOPIC_GEO3G_CENTRAL", "TOPIC_GEO4G_CENTRAL"],
        ["Дальний Восток", "TOPIC_GEO3G_EAST", "TOPIC_GEO4G_EAST"],
        ["Северо-Запад", "TOPIC_GEO3G_NW", "TOPIC_GEO4G_NW"],
        ["Поволжье", "TOPIC_GEO3G_VOLGA", "TOPIC_GEO4G_VOLGA"],
        ["Сибирь", "TOPIC_GEO3G_SIB", "TOPIC_GEO4G_SIB"],
        ["Юг", "TOPIC_GEO3G_SOUTH", "TOPIC_GEO4G_SOUTH"],
        ["Урал", "TOPIC_GEO3G_URAL", "TOPIC_GEO4G_URAL"],
      ],
    }, // 29
    { type: "p", text: "Приемники:" }, // 30
    {
      type: "table",
      head: ["Слой", "Таблица", "Описание"],
      rows: [
        ["RAW", "TABLE_GEO_RAW_3G", "Данные по 3G (необработанные)"],
        ["RAW", "TABLE_GEO_RAW_4G", "Данные по 4G (необработанные)"],
        ["DDS", "TABLE_GEO_DDS_DETAILED", "Детальные события геолокации"],
        ["ADDS", "TABLE_GEO_ADDS_AGG", "Агрегированные события"],
        ["CDM", "TABLE_GEO_CDM_INTERVALS", "Геоинтервалы по абонентам"],
      ],
    }, // 31
    { type: "h2", text: "Структура данных" }, // 32
    { type: "p", text: "Таблица: TABLE_GEO_RAW_3G" }, // 33
    {
      type: "table",
      head: ["Поле", "Тип данных", "Описание"],
      rows: [
        ["FIELD_REGION", "string", "Регион"],
        ["FIELD_DATE_EVENT", "date", "Дата события"],
        ["FIELD_HOUR", "int", "Час события (партиция)"],
        ["FIELD_IMSI", "string", "IMSI"],
        ["FIELD_MSISDN", "string", "MSISDN"],
        ["FIELD_IMEI", "string", "IMEI"],
        ["FIELD_LAT", "double", "Широта геопозиции"],
        ["FIELD_LON", "double", "Долгота геопозиции"],
        ["FIELD_RADIUS", "int", "Радиус точности (метры)"],
        ["FIELD_CELL_START", "long", "ID начальной базовой станции"],
        ["FIELD_CELL_END", "long", "ID конечной БС"],
        ["FIELD_TIME_START", "long", "Время начала события"],
        ["FIELD_TIME_END", "long", "Время окончания события"],
        ["FIELD_LOC_ACCURACY", "int", "Точность локации (метры)"],
        ["FIELD_VENDOR", "string", "Вендор оборудования БС"],
      ],
    }, // 34
    { type: "p", text: "Таблица: TABLE_GEO_RAW_4G" }, // 35
    {
      type: "table",
      head: ["Поле", "Тип данных", "Описание"],
      rows: [
        ["FIELD_REGION", "string", "Регион"],
        ["FIELD_DATE_EVENT", "date", "Дата события"],
        ["FIELD_HOUR", "int", "Час события (партиция)"],
        ["FIELD_IMSI", "string", "IMSI"],
        ["FIELD_MSISDN", "string", "MSISDN"],
        ["FIELD_IMEI", "string", "IMEI"],
        ["FIELD_LAT", "double", "Широта геопозиции"],
        ["FIELD_LON", "double", "Долгота геопозиции"],
        ["FIELD_RADIUS", "int", "Радиус точности (метры)"],
        ["FIELD_CELL_START", "long", "ID начальной БС"],
        ["FIELD_CELL_END", "long", "ID конечной БС"],
        ["FIELD_TIME_START", "long", "Время начала события (Unix-время)"],
        ["FIELD_TIME_END", "long", "Время окончания события"],
        ["FIELD_SERVICE_TYPE", "int", "Тип формата связи (услуга)"],
      ],
    }, // 36
    { type: "h2", text: "Дополнительная информация" }, // 37
    { type: "p", text: "Документы:" }, // 38
    { type: "li", text: "«Описание протоколов сигнальных сообщений в 3G/4G»" }, // 39
    { type: "li", text: "«Форматы MDT и Measurement Trigger»" }, // 40
    {
      type: "p",
      text: "Алгоритмы: обработка хэндоверов, геоинтервалов, работа с RNC/eNodeB.",
    }, // 41
  ],
  comments: [
    {
      id: "d1c1",
      n: 1,
      severity: 3,
      place: "Стр. 1, «Продуктовые метрики» и «Нефункциональные требования»",
      quote: "«Задержка: < 1 мин» / «Стриминг в реальном времени (задержка ≈ 0 сек)»",
      fix: "Два требования к задержке противоречат друг другу. Указать единый SLA, точки начала и конца измерения, допустимый процент превышений и отдельно определить задержку Kafka, Flink и публикации в целевой слой.",
      anchors: [
        { block: 5, match: "Задержка: < 1 мин" },
        { block: 13, match: "задержка ≈ 0 сек" },
      ],
    },
    {
      id: "d1c2",
      n: 2,
      severity: 3,
      place: "Стр. 1–2, «Схема потоков данных» и «Источники и приемники данных»",
      quote: "«PROVIDER_GEO → Kafka (топики по регионам)»; далее приведены только названия топиков",
      fix: "Не указано расположение Kafka-кластера: контур, кластер, bootstrap servers/alias, способ аутентификации, consumer group и среда. По одному имени топика подключение и реализация потока невозможны.",
      anchors: [
        { block: 18, match: "Kafka (топики по регионам)" },
        { block: 28, match: "PROVIDER_GEO → Kafka (24 часа хранения)" },
      ],
    },
    {
      id: "d1c3",
      n: 3,
      severity: 3,
      place: "Стр. 1–2, «Схема потоков данных» / таблица «Приемники»",
      quote: "«Kafka → Apache Flink → RAW → DDS → ADDS → CDM»",
      fix: "Описана только цепочка слоев, но отсутствуют правила преобразования между ними. Добавить для каждого перехода вход, выход, ключи, фильтры, расчеты, условия записи и порядок обработки ошибок.",
      anchors: [{ block: 18, match: "Apache Flink → RAW → DDS → ADDS → CDM" }],
    },
    {
      id: "d1c4",
      n: 4,
      severity: 3,
      place: "Стр. 2, таблица «Приемники»",
      quote:
        "Перечислены TABLE_GEO_DDS_DETAILED, TABLE_GEO_ADDS_AGG и TABLE_GEO_CDM_INTERVALS",
      fix: "Для трех целевых таблиц нет структуры и логики расчета. Нельзя проверить, какие поля должны быть получены из RAW и как рассчитываются агрегаты и геоинтервалы.",
      anchors: [
        { block: 31, row: 2, col: 1, match: "TABLE_GEO_DDS_DETAILED" },
        { block: 31, row: 3, col: 1, match: "TABLE_GEO_ADDS_AGG" },
        { block: 31, row: 4, col: 1, match: "TABLE_GEO_CDM_INTERVALS" },
      ],
    },
    {
      id: "d1c5",
      n: 5,
      severity: 3,
      place: "Стр. 2–3, таблицы TABLE_GEO_RAW_3G и TABLE_GEO_RAW_4G",
      quote:
        "FIELD_TIME_START и FIELD_TIME_END имеют тип long; только для FIELD_TIME_START в 4G упомянуто Unix-время",
      fix: "Не определены единица Unix-времени (секунды/миллисекунды), часовой пояс, допустимый диапазон и единая семантика времени для 3G и 4G. Уточнить также, может ли TIME_END отсутствовать.",
      anchors: [
        { block: 34, row: 11, col: 0, match: "FIELD_TIME_START" },
        { block: 34, row: 12, col: 0, match: "FIELD_TIME_END" },
        { block: 36, row: 11, col: 2, match: "Время начала события (Unix-время)" },
      ],
    },
    {
      id: "d1c6",
      n: 6,
      severity: 3,
      place: "Стр. 2–3, «Структура данных»",
      quote: "В структурах отсутствует идентификатор события или составной уникальный ключ",
      fix: "Не описаны дедупликация, повторное чтение Kafka и идемпотентность. Указать ключ события, правило выбора дубликата и поведение при повторной обработке партиции.",
      anchors: [{ block: 32, match: "Структура данных" }],
    },
    {
      id: "d1c7",
      n: 7,
      severity: 3,
      place: "Стр. 1, «Общие сведения» и «Нефункциональные требования»",
      quote:
        "Заявлены «текущее и историческое местоположение», но глубина истории указана только для RAW: 30 дней",
      fix: "Не определено, сколько истории должно храниться в DDS/ADDS/CDM и за какой период должен быть доступен результат. Это влияет на партиционирование, объем и возможность восстановления истории.",
      anchors: [
        { block: 1, match: "текущем и историческом местоположении" },
        { block: 14, match: "RAW-слой — 30 дней" },
      ],
    },
    {
      id: "d1c8",
      n: 8,
      severity: 2,
      place: "Стр. 2, TABLE_GEO_RAW_3G",
      quote:
        "Одновременно присутствуют FIELD_RADIUS — «Радиус точности» и FIELD_LOC_ACCURACY — «Точность локации»",
      fix: "Не объяснено различие полей, единицы совпадают. Описать источник и смысл каждого показателя, правила приоритета и допустимость NULL.",
      anchors: [
        { block: 34, row: 8, col: 0, match: "FIELD_RADIUS" },
        { block: 34, row: 13, col: 0, match: "FIELD_LOC_ACCURACY" },
      ],
    },
    {
      id: "d1c9",
      n: 9,
      severity: 2,
      place: "Стр. 2–3, структуры 3G и 4G",
      quote:
        "В 3G есть FIELD_LOC_ACCURACY и FIELD_VENDOR, в 4G их нет; FIELD_SERVICE_TYPE есть только в 4G",
      fix: "Уточнить, является ли различие намеренным. Если далее требуется единая детальная таблица, описать маппинг отсутствующих полей и значения по умолчанию.",
      anchors: [
        { block: 34, row: 14, col: 0, match: "FIELD_VENDOR" },
        { block: 36, row: 13, col: 0, match: "FIELD_SERVICE_TYPE" },
      ],
    },
    {
      id: "d1c10",
      n: 10,
      severity: 2,
      place: "Стр. 1, «Продуктовые метрики»",
      quote: "«Пропускная способность: до 100 000 событий/сек»",
      fix: "Не указано, это суммарный или региональный поток, средняя или пиковая нагрузка, а также длительность пика. Добавить профиль нагрузки и критерий приемочного теста.",
      anchors: [{ block: 6, match: "до 100 000 событий/сек" }],
    },
    {
      id: "d1c11",
      n: 11,
      severity: 2,
      place: "Стр. 1–2, Kafka и RAW",
      quote: "«Kafka — 24 ч, RAW-слой — 30 дней»",
      fix: "Не определено поведение при отставании более 24 часов, повторной загрузке и недоступности RAW. Добавить правила replay, checkpoint и обработки сообщений, которые не удалось разобрать.",
      anchors: [{ block: 14, match: "Kafka — 24 ч" }],
    },
    {
      id: "d1c12",
      n: 12,
      severity: 2,
      place: "Стр. 2, таблица региональных топиков",
      quote: "Приведен закрытый список регионов без правила для неизвестного или нового региона",
      fix: "Добавить обработку неизвестного FIELD_REGION: отклонение, карантин или топик по умолчанию; определить владельца справочника регионов.",
      anchors: [{ block: 29, row: -1, col: 0, match: "Регион" }],
    },
    {
      id: "d1c13",
      n: 13,
      severity: 1,
      place: "Стр. 3, «Дополнительная информация»",
      quote: "Указаны названия документов и общая фраза «Алгоритмы: обработка хэндоверов…»",
      fix: "Добавить ссылки, версии и конкретные разделы документов. Сейчас невозможно понять, какая часть алгоритма вынесена во внешнее описание и какая версия является актуальной.",
      anchors: [
        {
          block: 41,
          match: "Алгоритмы: обработка хэндоверов, геоинтервалов, работа с RNC/eNodeB.",
        },
      ],
    },
  ],
};
