# API для AppsScriptAdapter

> Реализация — `backend/Code.gs` + `backend/Config.gs` (копия столов/часов из `shared/config.js`).
> Развёрнуто в проекте Apps Script «Deliz Rezervacije API», привязанном к таблице «Deliz · Rezervacije».

Один веб-эндпоинт Apps Script (`doPost`), развёрнутый как «Web app: Execute as me, Access: Anyone».
Клиент шлёт `POST` с `Content-Type: text/plain` (без CORS preflight), тело — JSON:

```json
{ "action": "listReservations", "token": "…", "from": "2026-10-21", "to": "2026-11-30" }
```

Ответ всегда `{"ok": true, "result": …}` или `{"ok": false, "error": "текст"}`.

## Хранилище — Google Sheets

| Лист         | Колонки |
|--------------|---------|
| `Reservations` | id, date, time, guests, name, phone, note, tables (через запятую), wholeVenue, status, source, requestId, createdBy, createdAt, updatedBy, updatedAt |
| `Requests`     | id, date, time, guests, name, phone, email, note, lang, consent, status, createdAt, handledBy, handledAt, reservationId |
| `Settings`     | key, value (`terraceOpen` → TRUE/FALSE) |
| `Staff`        | id, name, pinHash |

Конфигурация столов/часов остаётся в `shared/config.js`; серверу нужна её копия для проверки
доступности (те же правила, что в `shared/availability.js` — файл можно вставить в Apps Script почти без изменений).

## Действия

| action | Кто | Параметры | Результат |
|---|---|---|---|
| `login` | персонал | staffId, pin | `{ token }` (действует 30 дней, хранится в `PropertiesService`) |
| `listReservations` | персонал | from, to | `Reservation[]` |
| `saveReservation` | персонал | reservation (id задаёт клиент — повторная отправка из офлайн-очереди идемпотентна) | `Reservation` |
| `setStatus` | персонал | id, status, by | `Reservation` |
| `listRequests` | персонал | — | `GuestRequest[]` |
| `confirmRequest` | персонал | id, tables[], by | `{ request, reservation }` |
| `rejectRequest` | персонал | id, by | `GuestRequest` |
| `getSettings` / `saveSettings` | персонал | settings | `Settings` |
| `publicAvailability` | **публично** | guests, from, days | `string[]` дат |
| `createRequest` | **публично** | request | `GuestRequest` (без внутренних полей) |

Серверные проверки: `saveReservation` и `confirmRequest` повторно проверяют, что столы свободны
(`LockService` от гонок двух iPad); `createRequest` проверяет `consent === true`, лимит размера
группы, простую защиту от спама (honeypot-поле + ограничение частоты по телефону).

Модели данных — см. комментарий в `shared/data/index.js`.

## Обслуживание

- **PIN:** в редакторе Apps Script выбрать функцию `setPin`, но проще выполнить в консоли проекта
  `setPin('gleb', '4821')`. Изначально у Gleb и Franc PIN `1234`.
- **Уведомления:** Project Settings → Script properties: `STAFF_EMAIL` (по умолчанию — владелец скрипта),
  `TELEGRAM_TOKEN` + `TELEGRAM_CHAT` для Telegram-бота.
- **Изменили столы/часы в `shared/config.js`** → обновить строку `const VENUE = …` в скрипте
  и сделать «Развертывание → Управление → Изменить → Новая версия» (URL не меняется).
- Все ячейки таблицы хранятся как текст (формат `@`), даты — `YYYY-MM-DD`, столы — через запятую.
