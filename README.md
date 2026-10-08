# ioBroker.floorplan-visualizer

[![NPM version](https://img.shields.io/npm/v/iobroker.floorplan-visualizer.svg)](https://www.npmjs.com/package/iobroker.floorplan-visualizer)
[![Downloads](https://img.shields.io/npm/dm/iobroker.floorplan-visualizer.svg)](https://www.npmjs.com/package/iobroker.floorplan-visualizer)
[![License](https://img.shields.io/github/license/yohohum/ioBroker.floorplan-visualizer)](LICENSE)

**Interactive floor plan visualization adapter for ioBroker**

---

**Language / Язык:** [🇬🇧 English](#english) | [🇷🇺 Русский](#русский)

---

<a name="english"></a>
# 🇬🇧 English

## 📖 Description

**Floor Plan Visualizer** is an ioBroker adapter for creating interactive floor plans of smart homes. It allows you to place device icons on a floor plan image, bind them to ioBroker states, and control devices or view sensor values in real time.

The adapter provides a visual editor for designing floor plans and a separate presentation mode for embedding in dashboards (Jarvis, vis, etc.).

## ✨ Features

### 🏠 Multi-floor structure
- Unlimited number of floors with unique plan images
- Logical layers for organizing devices (lighting, climate, security, etc.)
- Custom icons for each floor and layer (Emoji, MFD, or uploaded file)

### 🎯 Three object types
1. **Switch** — control devices on click (on/off)
2. **Indicator** — read-only state display
3. **Value** — numeric values with alarm thresholds (min/max)

### 🎨 Visual customization
- **Icon sources**: Emoji, ioBroker MFD icons, disk upload
- **Per-state styling** — different background, icon, and border colors for active/inactive/alarm states
- **Multi-value sensors** — display multiple values on a single icon
- **Fonts** — full customization of value and name fonts (family, weight, size, color, background, position)
- **Prefixes and postfixes** — add units of measurement or other symbols to values

### 🔒 Switch lock
- Protection against accidental clicks
- First click unlocks (shows 🔒 icon)
- Second click within 10 seconds performs action and restores lock
- If second click not performed — lock automatically restores after 10 seconds

### 📐 Editing tools
- **Drag & Drop** — move objects with mouse
- **Arrow keys** — precise movement of selected objects (0.2% without Shift, 1% with Shift)
- **Multi-selection** — select multiple objects with Shift+click
- **Alignment panel** — appears when 2+ objects selected:
  - Align to left/right/top/bottom edge
  - Align to center (horizontal/vertical)
  - Distribute objects with equal spacing
- **Guides** — drag horizontal/vertical guides from plan edges
  - Objects snap to guides when nearby (edge, center, or opposite edge)
  - Double-click guide to delete
  - **Right-click guide** — context menu with "Delete guide" and "Delete all guides"
  - Guides auto-delete when dragged to edge (<1%)

### 🖼️ Scaling modes
1. **By height** — plan occupies 88% of window height, backdrop has 3% padding from window edges
2. **By width** — plan occupies 88% of window width, backdrop has 3% padding from window edges
3. **No scaling** — plan at original size, backdrop = plan + 3% padding on each side

### 💾 Templates
- Save object settings as template
- Apply template to other objects
- Quick creation of similar devices

### 🌐 Presentation mode
- Separate URL for embedding in dashboards (Jarvis, vis, etc.)
- Support for `?floor=<id>` parameter to display specific floor
- Real-time data updates (polling every 2 seconds)
- Automatic configuration change detection

### 🎛️ Button panel settings
- **Position** — top/bottom/left/right
- **Alignment** — center/left/right
- **Orientation** — horizontal/vertical
- **Dimensions** — height, length, gap between buttons, corner radius
- **Button icon** — Emoji, MFD, or file with position choice (left/right)
- **Styles** — separate settings for active and inactive buttons (background, border, font, color)
- **Text alignment** — left/center/right

## 🚀 Installation

1. In ioBroker admin, go to **Adapters** → **Install from URL**
2. Enter: `https://github.com/yohohum/ioBroker.floorplan-visualizer`
3. After installation, configure ports in adapter settings:
   - **Editor port** (default 8083)
   - **Presentation port** (default 8084)
   - **IP address** (0.0.0.0 = all interfaces)
4. Open editor: `http://<your-ip>:8083/editor.html`

### MFD Icons
To use the MFD icon set, install the `icons-mfd-png` adapter in ioBroker. The adapter will automatically detect icons and make them available in the editor.

## 📖 Usage

### Editor (`http://<ip>:8083/editor.html`)

#### Top panel
- **⚙ Settings** — global plan and button panel settings
- **Floor tabs** — switch between floors, sort with ↑↓ buttons
- **🖼️ Floor icon** — assign icon to floor
- **👁 Preview** — open presentation in new window

#### Floor workspace
- **Floor name** — editable field with save button 💾
- **🖼️ Plan** — upload floor plan image
- **Layer chips** — select/sort layers
  - **✏️** — rename layer
  - **🖼️** — assign icon to layer
  - **↑↓** — move layer
  - **×** — delete layer
- **+ Object** — add new device to current layer

#### Object editor (double-click or right-click → Edit)
- **Name** — displayed object name
- **Type** — switch/indicator/value
- **Layer** — choose layer for placement
- **🔒 Lock** — protection against accidental clicks (switches only)
- **Templates** — apply/save templates
- **ioBroker state** — bind to state (with object tree selection)
- **Alarm min/max** — thresholds for numeric values
- **Extra states** — additional states for multi-value sensors
- **Icon** — size, opacity, icon selection for each state
- **Colors** — background, icon color, border for each state
- **Value font** — value display settings
- **Name font** — name display settings

#### Plan tools
- **Click** — select object
- **Shift+click** — multi-selection
- **Drag** — move object
- **Double-click** — edit object
- **Right-click** — context menu (edit/copy/delete)
- **Drag from edge** — create guide
- **Double-click guide** — delete guide
- **Right-click guide** — context menu (delete guide / delete all guides)

#### Alignment panel
Appears automatically when 2+ objects selected:
- ⫷ Align left
- ⫿ Align center horizontal
- ⫸ Align right
- ⫠ Align top
- ⫾ Align center vertical
- ⫟ Align bottom
- ⋯ Distribute horizontal
- ⋮ Distribute vertical

### Presentation (`http://<ip>:8084/` or `?floor=<id>`)

Clean view for embedding in dashboards:
- Floor and layer buttons styled per settings
- Click switches to toggle devices
- Values update in real time
- Lock feature works as in editor
- Scaling mode applied automatically

## 🔧 Configuration

### Adapter settings
| Parameter | Default | Description |
|-----------|---------|-------------|
| Editor port | 8083 | Port for visual editor |
| Presentation port | 8084 | Port for presentation mode |
| IP address | 0.0.0.0 | Network interface to bind |

### Configuration structure
```json
{
  "planBg": "#2a2f36",
  "scaleMode": "height",
  "floors": [
    {
      "id": "floor_1",
      "name": "First Floor",
      "image": "/uploads/floor_1.png",
      "icon": {"kind": "emoji", "value": "🏠"},
      "layers": [
        {
          "id": "layer_1",
          "name": "Lighting",
          "icon": {"kind": "mfd", "value": "light"},
          "devices": [
            {
              "id": "dev_1",
              "name": "Living Room Light",
              "objType": "switch",
              "stateIds": ["javascript.0.light.living"],
              "x": 50,
              "y": 50,
              "locked": false,
              "icon": {},
              "valueFont": {},
              "nameFont": {}
            }
          ]
        }
      ]
    }
  ],
  "guides": [
    {"id": "guide_1", "type": "h", "position": 50},
    {"id": "guide_2", "type": "v", "position": 30}
  ],
  "templates": [
    {"name": "Switch", "data": {}}
  ],
  "floorBar": {},
  "layerBar": {}
}
```

## 🏗️ Architecture

- **Backend**: Node.js + Express + ioBroker adapter-core
- **Frontend**: Vanilla JavaScript (no frameworks, no build step)
- **Storage**: ioBroker states (JSON config) + file system (uploads)
- **Communication**: HTTP REST API + polling (2s for states, 1s for config)
- **Scaling**: Dynamic size calculation via JavaScript considering window and image dimensions

## 📄 License

MIT License

MFD icons are licensed under CC BY-SA 3.0.

## 🤖 Development

This adapter was developed with AI assistance (Qwen 3.7).

## 🐛 Known limitations

- Maximum uploaded image size: 10 MB
- Supported image formats: PNG, JPG, SVG
- Optimized for modern browsers (Chrome, Firefox, Edge, Safari)

## 📝 Changelog

### 15.2.0 (2026-10-08)
- ✨ Per-floor guides (each floor has its own guides)
- ✨ Floor slug/identifier field for URLs (`?floor=floor_<slug>`)
- 🐛 Fixed flicker when switching layers and floors
- 🐛 Delete all guides now operates within current floor only
- ✨ Automatic migration of global guides to first floor

### 15.1.0 (2026-10-08)
- ✨ Context menu for guides (right-click)
- ✨ "Delete guide" and "Delete all guides" actions
- 🐛 Blocked default browser context menu on plan area

### 15.0.0 — Stable release
- ✨ Three scaling modes (by height, by width, no scaling)
- ✨ Backdrop with precise 3% padding from window edges
- ✨ Floor/layer buttons inside backdrop with configurable positioning
- ✨ Switch lock with automatic restoration
- ✨ Guides with object snapping
- ✨ Multi-selection and alignment
- ✨ Object templates
- ✨ Full button panel customization
- 🐛 Fixed flicker when changing lock state
- 🐛 Fixed object positioning when changing scale

### 14.0.0
- ✨ Floor and layer icons
- ✨ Layer renaming
- ✨ Rooms and functions in ioBroker object tree

### 13.0.0
- ✨ Guides
- ✨ Arrow key movement
- ✨ Object alignment

### 12.0.0
- ✨ Universal icon picker
- ✨ Panel button settings

### 1.0.0 — 11.0.0
- Initial versions with basic features

---

<a name="русский"></a>
# 🇷🇺 Русский

## 📖 Описание

**Floor Plan Visualizer** — адаптер ioBroker для создания интерактивных планов этажей умного дома. Позволяет размещать иконки устройств на изображении плана, привязывать их к состояниям ioBroker и управлять устройствами или просматривать показания датчиков в реальном времени.

Адаптер предоставляет визуальный редактор для проектирования планов этажей и отдельный режим презентации для встраивания в дашборды (Jarvis, vis и др.).

## ✨ Возможности

### 🏠 Многослойная структура
- Неограниченное количество этажей с уникальными изображениями планов
- Логические слои для организации устройств (освещение, климат, безопасность и т.д.)
- Пользовательские иконки для каждого этажа и слоя (Emoji, MFD или загруженный файл)

### 🎯 Три типа объектов
1. **Переключатель** — управление устройствами по клику (вкл/выкл)
2. **Индикатор** — отображение состояния только для чтения
3. **Значение** — числовые значения с порогами тревоги (мин/макс)

### 🎨 Визуальная настройка
- **Источники иконок**: Emoji, MFD-иконки ioBroker, загрузка с диска
- **Стилизация по состояниям** — разные цвета фона, иконки и рамки для активных/неактивных/тревожных состояний
- **Многозначные датчики** — отображение нескольких значений на одной иконке
- **Шрифты** — полная настройка шрифтов значений и названий (семейство, начертание, размер, цвет, фон, позиция)
- **Префиксы и постфиксы** — добавление единиц измерения или других символов к значениям

### 🔒 Блокировка переключателей
- Защита от случайных нажатий
- Первый клик снимает блокировку (появляется иконка 🔒)
- Второй клик в течение 10 секунд выполняет действие и восстанавливает блокировку
- Если второй клик не выполнен — блокировка автоматически восстанавливается через 10 секунд

### 📐 Инструменты редактирования
- **Drag & Drop** — перемещение объектов мышью
- **Клавиши стрелок** — точное перемещение выделенных объектов (0.2% без Shift, 1% с Shift)
- **Множественное выделение** — выделение нескольких объектов с помощью Shift+клик
- **Панель выравнивания** — появляется при выделении 2+ объектов:
  - Выравнивание по левому/правому/верхнему/нижнему краю
  - Выравнивание по центру (горизонтально/вертикально)
  - Распределение объектов с равными промежутками
- **Направляющие** — вытягивание горизонтальных/вертикальных направляющих от краёв плана
  - Объекты примагничиваются к направляющим при приближении (край, центр или противоположный край)
  - Двойной клик по направляющей — удаление
  - **Правый клик по направляющей** — контекстное меню с пунктами "Удалить направляющую" и "Удалить все направляющие"
  - Направляющие удаляются автоматически, если подведены к краю (<1%)

### 🖼️ Режимы масштабирования
1. **По высоте** — план занимает 88% высоты окна, подложка отступает от границ на 3% размера плана
2. **По ширине** — план занимает 88% ширины окна, подложка отступает от границ на 3% размера плана
3. **Без масштабирования** — план в исходном размере, подложка = план + 3% отступа с каждой стороны

### 💾 Шаблоны
- Сохранение настроек объекта как шаблон
- Применение шаблона к другим объектам
- Быстрое создание однотипных устройств

### 🌐 Режим презентации
- Отдельный URL для встраивания в дашборды (Jarvis, vis и др.)
- Поддержка параметра `?floor=<id>` для отображения конкретного этажа
- Обновление данных в реальном времени (опрос каждые 2 секунды)
- Автоматическое обнаружение изменений конфигурации

### 🎛️ Настройки панелей кнопок
- **Позиция** — сверху/снизу/слева/справа
- **Выравнивание** — по центру/слева/справа
- **Ориентация** — горизонтальная/вертикальная
- **Размеры** — высота, длина, отступ между кнопками, радиус скругления
- **Иконка кнопки** — Emoji, MFD или файл с выбором позиции (слева/справа)
- **Стили** — отдельные настройки для активной и неактивной кнопки (фон, рамка, шрифт, цвет)
- **Выравнивание текста** — слева/по центру/справа

## 🚀 Установка

1. В админке ioBroker перейдите в **Адаптеры** → **Установить из URL**
2. Введите: `https://github.com/yohohum/ioBroker.floorplan-visualizer`
3. После установки настройте порты в настройках адаптера:
   - **Порт редактора** (по умолчанию 8083)
   - **Порт презентации** (по умолчанию 8084)
   - **IP адрес** (0.0.0.0 = все интерфейсы)
4. Откройте редактор: `http://<ваш-ip>:8083/editor.html`

### MFD-иконки
Для использования набора иконок MFD установите адаптер `icons-mfd-png` в ioBroker. Адаптер автоматически обнаружит иконки и сделает их доступными в редакторе.

## 📖 Использование

### Редактор (`http://<ip>:8083/editor.html`)

#### Верхняя панель
- **⚙ Настройки** — глобальные настройки плана и панелей кнопок
- **Вкладки этажей** — переключение между этажами, сортировка кнопками ↑↓
- **🖼️ Иконка этажа** — назначение иконки этажу
- **👁 Просмотр** — открыть презентацию в новом окне

#### Рабочая область этажа
- **Название этажа** — редактируемое поле с кнопкой сохранения 💾
- **🖼️ План** — загрузка изображения плана этажа
- **Чипы слоёв** — выбор/сортировка слоёв
  - **✏️** — переименование слоя
  - **🖼️** — назначение иконки слою
  - **↑↓** — перемещение слоя
  - **×** — удаление слоя
- **+ Объект** — добавление нового устройства в текущий слой

#### Редактор объекта (двойной клик или ПКМ → Редактировать)
- **Название** — отображаемое имя объекта
- **Тип** — переключатель/индикатор/значение
- **Слой** — выбор слоя для размещения
- **🔒 Блокировка** — защита от случайных нажатий (только для переключателей)
- **Шаблоны** — применение/сохранение шаблонов
- **Состояние ioBroker** — привязка к состоянию (с выбором из дерева объектов)
- **Тревога мин/макс** — пороги для числовых значений
- **Доп. состояния** — дополнительные состояния для многозначных датчиков
- **Иконка** — размер, прозрачность, выбор иконки для каждого состояния
- **Цвета** — фон, цвет иконки, рамка для каждого состояния
- **Шрифт значения** — настройки отображения значений
- **Шрифт названия** — настройки отображения имени

#### Инструменты на плане
- **Клик** — выделение объекта
- **Shift+клик** — множественное выделение
- **Перетаскивание** — перемещение объекта
- **Двойной клик** — редактирование объекта
- **ПКМ** — контекстное меню (редактировать/копировать/удалить)
- **Вытягивание от края** — создание направляющей
- **Двойной клик по направляющей** — удаление направляющей
- **ПКМ по направляющей** — контекстное меню (удалить направляющую / удалить все направляющие)

#### Панель выравнивания
Появляется автоматически при выделении 2+ объектов:
- ⫷ По левому краю
- ⫿ По центру горизонтально
- ⫸ По правому краю
- ⫠ По верхнему краю
- ⫾ По центру вертикально
- ⫟ По нижнему краю
- ⋯ Распределить горизонтально
- ⋮ Распределить вертикально

### Презентация (`http://<ip>:8084/` или `?floor=<id>`)

Чистый вид для встраивания в дашборды:
- Кнопки этажей и слоёв стилизуются по настройкам
- Клик по переключателю меняет состояние
- Значения обновляются в реальном времени
- Блокировка работает как в редакторе
- Режим масштабирования применяется автоматически

## 🔧 Конфигурация

### Настройки адаптера
| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| Порт редактора | 8083 | Порт для визуального редактора |
| Порт презентации | 8084 | Порт для режима презентации |
| IP адрес | 0.0.0.0 | Сетевой интерфейс для привязки |

### Структура конфигурации
```json
{
  "planBg": "#2a2f36",
  "scaleMode": "height",
  "floors": [
    {
      "id": "floor_1",
      "name": "Первый этаж",
      "image": "/uploads/floor_1.png",
      "icon": {"kind": "emoji", "value": "🏠"},
      "layers": [
        {
          "id": "layer_1",
          "name": "Освещение",
          "icon": {"kind": "mfd", "value": "light"},
          "devices": [
            {
              "id": "dev_1",
              "name": "Свет в гостиной",
              "objType": "switch",
              "stateIds": ["javascript.0.light.living"],
              "x": 50,
              "y": 50,
              "locked": false,
              "icon": {},
              "valueFont": {},
              "nameFont": {}
            }
          ]
        }
      ]
    }
  ],
  "guides": [
    {"id": "guide_1", "type": "h", "position": 50},
    {"id": "guide_2", "type": "v", "position": 30}
  ],
  "templates": [
    {"name": "Выключатель", "data": {}}
  ],
  "floorBar": {},
  "layerBar": {}
}
```

## 🏗️ Архитектура

- **Backend**: Node.js + Express + ioBroker adapter-core
- **Frontend**: Vanilla JavaScript (без фреймворков и сборки)
- **Хранилище**: ioBroker states (JSON конфигурация) + файловая система (загрузки)
- **Коммуникация**: HTTP REST API + polling (2 сек для состояний, 1 сек для конфигурации)
- **Масштабирование**: Динамический расчёт размеров через JavaScript с учётом размеров окна и изображения

## 📄 Лицензия

MIT License

Иконки MFD лицензированы под CC BY-SA 3.0.

## 🤖 Разработка

Этот адаптер разработан с помощью ИИ (Qwen 3.7).

## 🐛 Известные ограничения

- Максимальный размер загружаемого изображения: 10 МБ
- Поддерживаемые форматы изображений: PNG, JPG, SVG
- Оптимизировано для современных браузеров (Chrome, Firefox, Edge, Safari)

## 📝 История изменений

### 15.2.0 (2026-10-08)
- ✨ Направляющие уникальны для каждого этажа
- ✨ Поле "Идентификатор" этажа для ссылок (`?floor=floor_<идентификатор>`)
- 🐛 Устранено мигание при переключении слоёв и этажей
- 🐛 Удаление всех направляющих теперь действует только в рамках текущего этажа
- ✨ Автоматическая миграция глобальных направляющих в первый этаж

### 15.1.0 (2026-10-08)
- ✨ Контекстное меню для направляющих (правый клик)
- ✨ Пункты "Удалить направляющую" и "Удалить все направляющие"
- 🐛 Заблокировано стандартное контекстное меню браузера на области плана

### 15.0.0 — Стабильный релиз
- ✨ Три режима масштабирования (по высоте, по ширине, без масштабирования)
- ✨ Подложка с точными отступами 3% от границ окна
- ✨ Кнопки этажей/слоёв внутри подложки с настраиваемым позиционированием
- ✨ Блокировка переключателей с автоматическим восстановлением
- ✨ Направляющие с привязкой объектов
- ✨ Множественное выделение и выравнивание
- ✨ Шаблоны объектов
- ✨ Полная настройка панелей кнопок
- 🐛 Исправлено моргание при изменении блокировки
- 🐛 Исправлено позиционирование объектов при смене масштаба

### 14.0.0
- ✨ Иконки этажей и слоёв
- ✨ Редактирование названий слоёв
- ✨ Комнаты и функции в дереве объектов

### 13.0.0
- ✨ Направляющие
- ✨ Перемещение стрелками
- ✨ Выравнивание объектов

### 12.0.0
- ✨ Универсальный пикер иконок
- ✨ Настройка кнопок панелей

### 1.0.0 — 11.0.0
- Начальные версии с базовыми функциями