# Deliz — бронирование столов (прототип)

Приложение бронирования столов винотеки Deliz. Без сборки, бесплатно: фронтенд на Vercel,
данные в Google Sheets «Deliz · Rezervacije» через Apps Script (`backend/`, контракт — `docs/API.md`).
Вернуть демо-режим (localStorage): `DATA_ADAPTER = 'demo'` в `shared/data/index.js`.

Дизайн повторяет сайт винной карты Deliz (папка `референс/`, в git не входит): чёрный фон `#0D0D0D`,
кремовый `#FEFFE8`, белый акцент, бордовый `#8C2233`, засечки Bookmania → Bookman Old Style → Georgia,
Inter для интерфейса и цифр. Токены — `shared/ui/tokens.css`, логотип — `shared/ui/deliz-logo.png`.
Две темы — тёмная (как сайт) и светлая (тёплая «бумага», тот же бордовый). По умолчанию «Системная»:
следует настройке устройства. Персонал переключает в «Nastavitve → Videz» или кнопкой ☾/☀ в меню,
гость — значком рядом с языками; выбор запоминается отдельно для персонала и для гостей.
Для встраивания: `data-theme="light|dark|system"` в `embed.js`; для ссылки — `?theme=light`.
Чтобы подключить настоящий Bookmania, добавьте лицензированный @font-face/Adobe Fonts в `<head>` страниц.

- **`/staff/`** — приложение персонала (iPad, PWA, словенский). Вход: Gleb или Franc, PIN проверяет сервер
  (изначально `1234`, сменить: `setPin('gleb', '4821')` в Apps Script).
- **`/guest/`** — форма для гостей (SL / EN / DE / IT).
- **`/guest/embed.js`** — сниппет для WordPress, пример: `/guest/embed-demo.html`.
- **`/`** — стартовая страница со ссылками на оба.

## Структура

```
shared/config.js            столы, комбинации, часы работы, закрытые дни — ВСЁ про заведение здесь
shared/availability.js      чистые функции доступности (используются везде + тесты)
shared/data/index.js        ← DATA_ADAPTER = 'demo' | 'appsscript'  (переключение одной строкой)
shared/data/demo-adapter.js localStorage + демо-брони на 2 недели (seed.js)
shared/data/appsscript-adapter.js  клиент Apps Script (вход по PIN → токен на 30 дней)
backend/Code.gs, Config.gs  сервер Apps Script (копия; рабочая версия — в проекте «Deliz Rezervacije API»)
shared/data/outbox.js       офлайн-очередь («ni poslano»)
staff/                      приложение персонала, manifest, service worker, иконки
guest/                      форма гостя, переводы, embed.js
tests/                      юнит-тесты (node --test)
```

## Локально

```bash
npm test          # юнит-тесты (Node 18+), зависимостей нет
npm start         # http://localhost:5173  (python3 http.server)
```

## Деплой (Vercel)

Продакшн: **https://deliz-rezervacije.vercel.app/** — проект `deliz-rezervacije` на Vercel,
framework «Other», без сборки, корень репозитория отдаётся как есть. Настройки — `vercel.json`
(заголовки для service worker и манифеста, `/guest/` разрешено встраивать в iframe на любом домене),
`.vercelignore` исключает `референс/`.

Каждый `git push` в `main` автоматически деплоится в продакшн (Vercel ↔ GitHub). Вручную:

```bash
npx vercel --prod
```

Бэкенд — Apps Script, URL в `shared/data/index.js`. Запросы идут POST с `Content-Type: text/plain`,
поэтому CORS работает с любого домена, прокси не нужен.

После изменения файлов приложения увеличьте `CACHE` в `staff/sw.js` (`deliz-staff-v2` …),
чтобы установленные на iPad копии быстрее подхватили новую версию.

### WordPress

Блок «Custom HTML»:

```html
<div id="deliz-booking"></div>
<script src="https://deliz-rezervacije.vercel.app/guest/embed.js" data-lang="sl" async></script>
```

Прямая ссылка на форму: https://deliz-rezervacije.vercel.app/guest/

## Установка на iPad

Safari → открыть **https://deliz-rezervacije.vercel.app/staff/** → **Поделиться → На экран «Домой»**.
Откроется без адресной строки, с иконкой Deliz. Вход: Gleb или Franc + PIN.

## Ограничения демо-режима (`DATA_ADAPTER = 'demo'`)

- **Данные живут в localStorage одного браузера.** Заявка из формы гостя появляется во вкладке
  «Zahteve» только на том же устройстве и в том же браузере. Для показа на двух устройствах
  используйте кнопку **«Testna zahteva»** во вкладке «Zahteve» — она имитирует входящую заявку
  со звуком.
- На iPhone/iPad приложение, добавленное на экран «Домой», имеет **отдельное** хранилище от Safari:
  для демонстрации «гость → персонал» откройте обе страницы во вкладках Safari.
- Форма, встроенная iframe-ом на чужой домен (WordPress), в демо пишет в отдельное хранилище
  (браузеры изолируют сторонние iframe). С `AppsScriptAdapter` этой проблемы нет.
- Звук новой заявки браузер разрешает только после первого касания (ввод PIN это обеспечивает).
- «Нет сети» можно показать переключателем **Simuliraj brez povezave** в настройках.
- PIN проверяется в браузере — только для демо.

## Допущения (сверить с PLAN-reservations.md, раздел 0.1)

Файл плана в папке не нашёлся, поэтому в `shared/config.js` стоят предположения:
6 столов внутри и 4 на террасе (2/2/4/4), набор разрешённых комбинаций,
часы: вт–чт 16–23, пт 16–24, сб 12–24, вс 12–20, понедельник закрыт; онлайн до 8 гостей,
на 30 дней вперёд; бронь занимает стол на весь день; «Niso prišli» и «Preklic» освобождают стол.

## Схема зала

Внутренняя часть нарисована по фото из Google Maps (2021–2026): вход с Vodnikov trg — снизу слева,
сразу за дверью бочка (стол 4, 2 места), в центре длинный высокий стол с барными стульями
(столы 1 + 2, по 4 места, вместе 8), у задней стены справа — барная стойка с витриной (Šank · vitrina),
стол 5 у левой стены, 6 (дегустационный, 6 мест) и 3 у правой. Вход и стойка задаются в
`VENUE.fixtures` (`kind: 'bar' | 'door'`), на схеме они не кликабельны.
**Количество мест и наличие террасы — оценка, сверить с Glebом и Francем.**

Фавикон — только эмблема (лист + завитки) на чёрном: `favicon.ico` (16/32/48) в корне,
`staff/icons/favicon-32.png`, `staff/icons/favicon.png` (48). Иконки для экрана «Домой» не менялись.
