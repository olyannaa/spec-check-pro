import type { Finding, Rule } from "./types";
import {
  findLine,
  hasAny,
  parseDocument,
  snippet,
  type ParsedDoc,
} from "./parse";

function finding(
  partial: Omit<Finding, "id"> & { id?: string },
  i: number,
): Finding {
  return {
    id: partial.id ?? `h-${i}`,
    ...partial,
  };
}

export function runHeuristics(text: string, rules: Rule[]): Finding[] {
  const doc = parseDocument(text);
  const out: Finding[] = [];
  const push = (item: Omit<Finding, "id">) => {
    out.push(finding(item, out.length + 1));
  };

  if (ruleMeta(rules, "1")) checkSerialization(doc, rules, push);
  if (ruleMeta(rules, "2")) checkCatalog(doc, rules, push);
  if (ruleMeta(rules, "3")) checkNullable(doc, rules, push);
  if (ruleMeta(rules, "4")) checkFilters(doc, rules, push);
  if (ruleMeta(rules, "5")) checkTemplate(doc, rules, push);
  if (ruleMeta(rules, "6")) checkKafkaCluster(doc, rules, push);
  if (ruleMeta(rules, "7")) checkHdfs(doc, rules, push);
  if (ruleMeta(rules, "8")) checkDictionaries(doc, rules, push);
  checkCustomRules(doc, rules, push);
  checkContradictions(doc, push);
  checkFieldLogic(doc, push);

  return out;
}

function ruleMeta(rules: Rule[], id: string) {
  return rules.find((r) => r.id === id);
}

function checkSerialization(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "1");
  const ok = hasAny(doc.body, [
    "сериализ",
    "avro",
    "parquet",
    "protobuf",
    "json schema",
    "orc-формат",
    "orc-формат",
    "csv, сжатые",
    "gzip",
  ]);
  const mentionsFormat = hasAny(doc.body, ["orc", "csv", "json", "avro"]);
  if (!ok || !hasAny(doc.body, ["сериализ"])) {
    if (!mentionsFormat || !hasAny(doc.body, ["сериализ", "схема"])) {
      push({
        severity: "high",
        ruleId: "1",
        role: "developer",
        section: "Источники данных / Приёмники",
        quote:
          findLine(doc.body, /приемник|приёмник|топик|kafka/i) ??
          "раздел сериализации отсутствует",
        why: `${rule?.title ?? "Сериализация"}: в ТЗ нет модели входа и выхода (формат + схема + тип ser/de). Упоминания CSV/ORC без схемы недостаточно — разработчик не поймёт контракт топика.`,
        ask: rule?.askIfMissing ?? "Указать формат, схему и тип сериализации для источника и приёмника.",
      });
    }
  }
}

function checkCatalog(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "2");
  const hasCatalog = hasAny(doc.body, [
    "data catalog",
    "дата-каталог",
    "дата каталог",
    "datacatalog",
    "ссылка на каталог",
  ]);
  const placeholder = hasAny(doc.body, ["link_", "ссылка"]);
  if (!hasCatalog) {
    push({
      severity: "high",
      ruleId: "2",
      role: "template",
      section: "Data Catalog",
      quote: placeholder
        ? snippet(findLine(doc.body, /link_|gitlab|jira/i) ?? "ссылки-заглушки без каталога")
        : "раздел отсутствует",
      why: "Нет прямой ссылки на Data Catalog. Имя системы-источника не заменяет привязку к каталогу — это обязательный пункт.",
      ask: rule?.askIfMissing ?? "Добавить ссылку на Data Catalog по каждому источнику.",
    });
  }
}

function checkNullable(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "3");
  const hasFields = hasAny(doc.body, ["поле", "field_", "тип данных", "атрибут"]);
  const hasNull = hasAny(doc.body, ["not null", "nullable"]);
  if (hasFields && !hasNull) {
    const quote =
      findLine(doc.body, /FIELD_|Поле\s+Тип/i) ??
      findLine(doc.body, /string|bigint|timestamp/i) ??
      "таблица полей без признака обязательности";
    push({
      severity: "high",
      ruleId: "3",
      role: "developer",
      section: "Структура данных",
      quote: snippet(quote),
      why: "Поля перечислены, но ни у одного нет NOT NULL / NULLABLE. Для витрины это обязательное требование: без него разработка не знает, что делать с пустыми значениями.",
      ask: rule?.askIfMissing ?? "Проставить NOT NULL или NULLABLE у каждого поля.",
    });
  }
}

function checkFilters(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "4");
  const hasFilter = hasAny(doc.body, ["фильтр", "отсек", "учитываются только", "where "]);
  const na = hasAny(doc.body, ["не применимо"]);
  if (!hasFilter && !na) {
    push({
      severity: "high",
      ruleId: "4",
      role: "qa",
      section: "Алгоритм обработки потока",
      quote: "раздел фильтрации отсутствует, «не применимо» не указано",
      why: "Типовые фильтры не описаны. Пустой раздел нельзя трактовать как «фильтров нет» — шаблон требует явной формулировки.",
      ask: rule?.askIfMissing ?? "Описать фильтры или написать «не применимо».",
    });
  } else if (hasFilter && hasAny(doc.body, ["текущего времени", "текущ"])) {
    const line = findLine(doc.body, /текущ/i);
    if (line && !hasAny(line + doc.body, ["таймзон", "часовой пояс", "utc", "мск"])) {
      push({
        severity: "medium",
        ruleId: "4",
        role: "developer",
        section: "Фильтрация данных",
        quote: snippet(line),
        why: "Фильтр завязан на «текущее время», но не сказано, в какой таймзоне считается «сейчас» на стороне обработки.",
        ask: "Зафиксировать таймзону и часы отсечения (например UTC или локаль региона).",
      });
    }
  }
}

function checkTemplate(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "5");
  if (!hasAny(doc.body, ["обогащен"]) && !hasAny(doc.body, ["не применимо"])) {
    push({
      severity: "medium",
      ruleId: "5",
      role: "template",
      section: "Обогащение данных",
      quote: "раздел отсутствует",
      why: "Шаг обогащения не описан и нет пометки «не применимо». Шаблон требует сохранить раздел.",
      ask: rule?.askIfMissing ?? "Описать обогащение или написать «не применимо».",
    });
  }

  if (!hasAny(doc.body, ["ddl"])) {
    push({
      severity: "low",
      ruleId: "5",
      role: "template",
      section: "DDL",
      quote: "раздел отсутствует",
      why: "В шаблоне есть раздел DDL. Без схемы таблицы приёмника разработчик будет восстанавливать её из текстового маппинга.",
      ask: "Добавить DDL таблицы приёмника или явно «не применимо».",
    });
  }

  if (!hasAny(doc.body, ["пример данных", "10 строк"])) {
    push({
      severity: "low",
      ruleId: "5",
      role: "qa",
      section: "Пример данных",
      quote: "раздел отсутствует",
      why: "Нет 10 строк примера. По шаблону пример обязателен, чтобы сверить типы и неочевидные значения.",
      ask: "Вставить 10 строк примера из таблицы.",
    });
  }

  if (!hasAny(doc.body, ["ключ", "партиц"])) {
    push({
      severity: "medium",
      ruleId: "5",
      role: "developer",
      section: "Формирование ключа (Kafka) / партиции (HDFS)",
      quote: hasAny(doc.body, ["field_hour", "час"])
        ? snippet(findLine(doc.body, /час|партиц/i) ?? "час упомянут, ключ Kafka нет")
        : "раздел отсутствует",
      why: "Не описано, чем ключуется топик Kafka и как партиционируется HDFS. Часовая партиция RAW не заменяет ключ топика.",
      ask: "Указать ключ Kafka и поле партиции HDFS.",
    });
  }
}

function checkKafkaCluster(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "6");
  const hasTopic = hasAny(doc.body, ["topic_", "топик", "kafka"]);
  const hasClusterName =
    hasAny(doc.body, ["кластер kafka", "kafka cluster", "имя кластера"]) ||
    (/кластер:\s*(?!cluster\b)[a-z0-9_-]{3,}/i.test(doc.body) &&
      !hasAny(doc.body, ["кластер: cluster", "кластер:cluster"]));
  const placeholderCluster = hasAny(doc.body, ["кластер: cluster", "cluster: cluster"]);

  if ((hasTopic || hasAny(doc.body, ["кластер"])) && (!hasClusterName || placeholderCluster)) {
    const quote =
      findLine(doc.body, /кластер/i) ??
      findLine(doc.body, /TOPIC_/i) ??
      "топики без кластера";
    push({
      severity: "high",
      ruleId: "6",
      role: "developer",
      section: "Приёмники данных",
      quote: snippet(quote),
      why: "Указаны топики или заглушка CLUSTER, но нет имени кластера Kafka. Это обязательный инфраструктурный параметр: без него поток нельзя завести.",
      ask: rule?.askIfMissing ?? "Назвать кластер Kafka для источника и приёмника.",
    });
  }
}

function checkHdfs(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "7");
  const mentionsFiles = hasAny(doc.body, ["hdfs", "sftp", "папка", "файлов"]);
  const hasPath = hasAny(doc.body, ["hdfs://", "/user/", "/data/", "полный путь"]);
  const folderPlaceholder = hasAny(doc.body, ["папка"]);
  if ((mentionsFiles || folderPlaceholder) && (!hasPath || folderPlaceholder)) {
    const quote =
      findLine(doc.body, /Папка|HDFS|SFTP/i) ?? "файловое хранение без пути";
    push({
      severity: "high",
      ruleId: "7",
      role: "developer",
      section: "Хранение данных",
      quote: snippet(quote),
      why: "Файловое хранение упомянуто, но нет полного пути HDFS и формата. «Папка» для разработки недостаточна.",
      ask: rule?.askIfMissing ?? "Указать полный путь HDFS и формат (ORC/CSV/Parquet).",
    });
  }
}

function checkDictionaries(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  const rule = ruleMeta(rules, "8");
  const isMart = hasAny(doc.body, ["витрин", "агрегат", "cdm", "count(distinct"]);
  const hasDict = hasAny(doc.body, ["справочник", "_ref", "dictionary"]);
  if (isMart && !hasDict) {
    push({
      severity: "high",
      ruleId: "8",
      role: "developer",
      section: "Источники данных",
      quote: "перечень справочников отсутствует",
      why: "Документ похож на витрину, но справочники не перечислены. Для витрины это обязательный раздел.",
      ask: rule?.askIfMissing ?? "Перечислить справочники и ключ джойна.",
    });
  }
  if (isMart && hasDict && !hasAny(doc.body, ["не найден", "нет записи", "left join", "inner join", "если tac"])) {
    const quote = findLine(doc.body, /справочник|_REF/i) ?? "справочники названы без правила джойна";
    push({
      severity: "medium",
      ruleId: "8",
      role: "qa",
      section: "Алгоритм расчёта",
      quote: snippet(quote),
      why: "Справочники названы, но не сказано, какой тип джойна и что делать, если запись не найдена (пустой вендор, неизвестный регион, дроп абонента).",
      ask: "Описать тип соединения и поведение при отсутствии ключа в справочнике.",
    });
  }
}

function checkContradictions(
  doc: ParsedDoc,
  push: (f: Omit<Finding, "id">) => void,
) {
  if (hasAny(doc.body, ["инкремент"]) && hasAny(doc.body, ["полная перезагрузка", "без upsert"])) {
    const incrementLine = findLine(doc.body, /инкремент/i);
    const reloadLine = findLine(doc.body, /полная перезагрузка|upsert/i);
    push({
      severity: "high",
      role: "developer",
      section: "Способ загрузки / Обновление",
      quote: snippet(
        [incrementLine, reloadLine].filter(Boolean).join(" ↔ "),
      ),
      sourceQuotes: [incrementLine, reloadLine].filter((line): line is string => Boolean(line)),
      why: "В одном ТЗ одновременно «инкремент» и «только полная перезагрузка месяца без upsert». Разработчик не поймёт, как обновлять партицию.",
      ask: "Оставить один способ загрузки: инкремент или полная перезагрузка месяца, и описать окно пересчёта.",
    });
  }

  if (hasAny(doc.body, ["< 1 мин"]) && hasAny(doc.body, ["0 сек", "≈ 0"])) {
    const latencyLine = findLine(doc.body, /задержк/i);
    const zeroLine = findLine(doc.body, /0 сек/i);
    push({
      severity: "medium",
      role: "qa",
      section: "Нефункциональные требования",
      quote: snippet(
        [latencyLine, zeroLine].filter(Boolean).join(" ↔ "),
      ),
      sourceQuotes: [latencyLine, zeroLine].filter((line): line is string => Boolean(line)),
      why: "Задержка «< 1 мин» противоречит стримингу «≈ 0 сек». SLA приёмки будет спорным.",
      ask: "Зафиксировать одну целевую задержку и где она измеряется (Kafka / Flink / RAW).",
    });
  }

  if (hasAny(doc.body, ["field_users_cnt = count"]) && hasAny(doc.body, ["группировка по"])) {
    const line = findLine(doc.body, /FIELD_USERS_CNT/);
    if (line && /группировка[\s\S]{0,120}FIELD_USERS_CNT/i.test(doc.body.replace(/\n/g, " "))) {
      push({
        severity: "high",
        role: "developer",
        section: "Шаг 4. Агрегация",
        quote: snippet(line),
        sourceQuotes: ["FIELD_USERS_CNT = count(distinct FIELD_IMSI)"],
        why: "Метрика FIELD_USERS_CNT указана в группировке. Это поле расчёта, а не измерение — запрос будет неверным.",
        ask: "Убрать FIELD_USERS_CNT из GROUP BY, оставить region и vendor.",
      });
    }
  }
}

function checkFieldLogic(
  doc: ParsedDoc,
  push: (f: Omit<Finding, "id">) => void,
) {
  if (hasAny(doc.body, ["из этих полей"]) && !hasAny(doc.body, ["из полей field_"])) {
    const line = findLine(doc.body, /из этих полей/i);
    if (line) {
      push({
        severity: "high",
        role: "developer",
        section: "Преобразования на потоке",
        quote: snippet(line),
        why: "Написано «из этих полей удаляются лидирующие нули», но список полей не приведён. Разработчик не знает, какие атрибуты чистить.",
        ask: "Перечислить поля, с которых снимаются лидирующие нули.",
      });
    }
  }

  if (hasAny(doc.body, ["radioaccesstechnology", "cell_id", "lac"]) && hasAny(doc.body, ["15 полей"])) {
    push({
      severity: "medium",
      role: "qa",
      section: "FAQ / Структура данных",
      quote: snippet(
        findLine(doc.body, /radioAccessTechnology|CELL_ID|LAC/i) ??
          "FAQ ссылается на поля вне таблицы",
      ),
      why: "FAQ опирается на radioAccessTechnology, CELL_ID, LAC, которых нет в описанной таблице из 15 полей. Логику нельзя реализовать по текущей структуре.",
      ask: "Либо добавить поля в структуру, либо убрать на них ссылки из FAQ.",
    });
  }

  if (hasAny(doc.body, ["unix"]) && hasAny(doc.body, ["field_time_start"]) && hasAny(doc.body, ["field_time_end"])) {
    const start = findLine(doc.body, /FIELD_TIME_START/);
    const end = findLine(doc.body, /FIELD_TIME_END/);
    if (start && end && /unix/i.test(start) && !/unix/i.test(end)) {
      push({
        severity: "medium",
        role: "developer",
        section: "Структура данных",
        quote: snippet(`${start} / ${end}`),
        sourceQuotes: [start, end],
        why: "Для начала события указано Unix-время, для окончания — нет. Единицы TIME_END останутся спорными (unix vs timestamp vs мс).",
        ask: "Одинаково описать единицы FIELD_TIME_START и FIELD_TIME_END.",
      });
    }
  }

  if (hasAny(doc.body, ["substring(imei"]) && !hasAny(doc.body, ["imei пуст", "если imei", "не найден tac"])) {
    push({
      severity: "medium",
      role: "developer",
      section: "Определение вендора",
      quote: snippet(findLine(doc.body, /substring\(imei/i) ?? "tac = substring(imei, 1, 8)"),
      why: "Вендор берётся из IMEI, но не описаны пустой IMEI, короткая строка и отсутствие tac в справочнике.",
      ask: "Что писать в FIELD_VENDOR_NAME, если IMEI пустой или tac не найден?",
    });
  }

  if (hasAny(doc.body, ["шаг 5"]) && /шаг 5\.[\s\S]{0,80}(требования|$)/i.test(doc.body.replace(/\n/g, " "))) {
    push({
      severity: "medium",
      role: "template",
      section: "Шаг 5. Запись в CDM",
      quote: "Шаг 5. Запись в CDM",
      why: "Шаг записи в CDM объявлен и не заполнен: нет условий overwrite, партиции и проверки дублей.",
      ask: "Описать, как именно пишем месяц в CDM и что происходит при повторном прогоне.",
    });
  }
}

const STOP_WORDS = new Set([
  "должен",
  "должна",
  "должно",
  "должны",
  "если",
  "или",
  "для",
  "при",
  "этот",
  "этого",
  "также",
  "быть",
  "есть",
  "нет",
  "что",
  "как",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "каждый",
  "каждого",
  "явно",
  "указан",
  "указать",
  "описание",
  "должно",
  "наличие",
]);

function lookForTokens(lookFor: string): string[] {
  return lookFor
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter((w) => w.length >= 5 && !STOP_WORDS.has(w))
    .slice(0, 8);
}

function checkCustomRules(
  doc: ParsedDoc,
  rules: Rule[],
  push: (f: Omit<Finding, "id">) => void,
) {
  for (const rule of rules) {
    if (/^[1-8]$/.test(rule.id)) continue;
    const title = rule.title.trim();
    const lookFor = rule.lookFor.trim();
    if (!title && !lookFor) continue;
    const tokens = lookForTokens(lookFor || title);
    const covered =
      tokens.length === 0 ? false : hasAny(doc.body, tokens);
    if (covered) continue;
    push({
      severity: "medium",
      ruleId: rule.id,
      role: "template",
      section: title || "Дополнительное правило",
      quote: "раздел отсутствует",
      why: `${title || "Дополнительное правило"}: в ТЗ не видно того, что требует правило${lookFor ? ` («${snippet(lookFor, 140)}»)` : ""}.`,
      ask: rule.askIfMissing.trim() || "Дополнить ТЗ по этому правилу.",
    });
  }
}
