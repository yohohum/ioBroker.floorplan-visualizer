# ioBroker.floorplan-visualizer

[![NPM version](https://img.shields.io/npm/v/iobroker.floorplan-visualizer.svg)](https://www.npmjs.com/package/iobroker.floorplan-visualizer)
[![Downloads](https://img.shields.io/npm/dm/iobroker.floorplan-visualizer.svg)](https://www.npmjs.com/package/iobroker.floorplan-visualizer)

**Interactive floor plan visualization adapter for ioBroker**

---

## 📖 Description / Описание

**English:**  
Floor Plan Visualizer is an ioBroker adapter for creating interactive floor plans of smart homes. It allows you to place device icons on a floor plan image, bind them to ioBroker states, and control devices or view sensor values in real time.

**Русский:**  
Floor Plan Visualizer — адаптер ioBroker для создания интерактивных планов этажей умного дома. Позволяет размещать иконки устройств на изображении плана, привязывать их к состояниям ioBroker и управлять устройствами или просматривать показания датчиков в реальном времени.

---

## ✨ Features / Возможности

### English
- **Multi-floor support** — create any number of floors with unique images
- **Layers** — organize devices into logical layers (lighting, sensors, security, etc.)
- **Three object types**:
  - **Switch** — toggle device state on click
  - **Indicator** — read-only display of state
  - **Value** — numeric state with thresholds (min/max alerts)
- **Icon sources**: Emoji, MFD icons (ioBroker), custom images from disk
- **Per-state styling** — different colors for active/inactive/alert states
- **Multi-value sensors** — display multiple state values on a single icon
- **Visual editor** — drag & drop placement, alignment tools, guides
- **Templates** — save and reuse device configurations
- **Lock feature** — prevent accidental toggles with confirmation click
- **Live data** — real-time state updates via polling
- **Unique URLs** — embed specific floors in external interfaces

### Русский
- **Множество этажей** — создание любого количества этажей с уникальными изображениями
- **Слои** — организация устройств по логическим слоям (освещение, датчики, безопасность и т.д.)
- **Три типа объектов**:
  - **Переключатель** — изменение состояния устройства по клику
  - **Индикатор** — отображение состояния только для чтения
  - **Значение** — числовое состояние с порогами (тревога мин/макс)
- **Источники иконок**: Emoji, MFD-иконки (ioBroker), свои изображения с диска
- **Стилизация по состояниям** — разные цвета для активных/неактивных/тревожных состояний
- **Многозначные датчики** — отображение нескольких значений на одной иконке
- **Визуальный редактор** — размещение перетаскиванием, инструменты выравнивания, направляющие
- **Шаблоны** — сохранение и повторное использование конфигураций устройств
- **Блокировка** — защита от случайных переключений двойным кликом
- **Живые данные** — обновление состояний в реальном времени через опрос
- **Уникальные URL** — встраивание конкретных этажей во внешние интерфейсы

---

## 🚀 Installation / Установка

### English
1. In ioBroker admin, go to **Adapters** → **Install from URL**
2. Enter: `https://github.com/yohohum/ioBroker.floorplan-visualizer`
3. After installation, configure ports in adapter settings
4. Open the editor at `http://<your-ip>:8083/editor.html`

### Русский
1. В админке ioBroker перейдите в **Адаптеры** → **Установить из URL**
2. Введите: `https://github.com/yohohum/ioBroker.floorplan-visualizer`
3. После установки настройте порты в настройках адаптера
4. Откройте редактор по адресу `http://<ваш-ip>:8083/editor.html`

---

## 📖 Usage / Использование

### English

#### Editor (`http://<ip>:8083/editor.html`)
The main interface for creating and configuring floor plans.

**Top bar:**
- **⚙ Settings** — global plan settings, button panels styling
- **Floor tabs** — switch between floors, reorder with ↑↓ buttons
- **👁 Preview** — open presentation view in new window

**Floor workspace:**
- **Floor name** — editable, save with 💾
- **🖼️ Plan** — upload floor plan image
- **Layer chips** — select/reorder layers, ✏️ to rename, 🖼️ to set icon
- **+ Object** — add new device to current layer

**Object editor (double-click or right-click → Edit):**
- Name, type, ioBroker state binding
- Icon selection (Emoji / MFD / File)
- Per-state colors (background, icon, border)
- Value and name fonts with position control
- Templates — save current settings or apply saved template

**Alignment panel (appears when 2+ objects selected with Shift):**
- Align to left/center/right/top/middle/bottom
- Distribute horizontally/vertically

**Guides:**
- Drag from plan edges to create horizontal/vertical guides
- Objects snap to guides when moved nearby
- Double-click guide to delete

**Keyboard:**
- Arrow keys — move selected objects (1px step)
- Shift + Arrow — move faster (5px step)

#### Presentation (`http://<ip>:8084/` or `?floor=<id>`)
Clean view for embedding in dashboards (Jarvis, vis, etc.).
- Floor and layer buttons styled per settings
- Click switches to toggle devices
- Values update in real time
- Lock feature: first click unlocks (shows lock icon), second click within 10s performs action

### Русский

#### Редактор (`http://<ip>:8083/editor.html`)
Основной интерфейс для создания и настройки планов этажей.

**Верхняя панель:**
- **⚙ Настройки** — глобальные настройки плана, стилизация панелей кнопок
- **Вкладки этажей** — переключение между этажами, сортировка кнопками ↑↓
- **👁 Просмотр** — открыть презентацию в новом окне

**Рабочая область этажа:**
- **Название этажа** — редактируемое, сохранить 💾
- **🖼️ План** — загрузить изображение плана
- **Чипы слоёв** — выбор/сортировка слоёв, ✏️ для переименования, 🖼️ для иконки
- **+ Объект** — добавить новое устройство в текущий слой

**Редактор объекта (двойной клик или ПКМ → Редактировать):**
- Название, тип, привязка к состоянию ioBroker
- Выбор иконки (Emoji / MFD / Файл)
- Цвета по состояниям (фон, иконка, рамка)
- Шрифты значения и названия с управлением позицией
- Шаблоны — сохранить текущие настройки или применить сохранённый шаблон

**Панель выравнивания (появляется при выделении 2+ объектов с Shift):**
- Выравнивание по левому/центру/правому/верхнему/среднему/нижнему краю
- Распределение по горизонтали/вертикали

**Направляющие:**
- Вытяните от края плана для создания горизонтальной/вертикальной направляющей
- Объекты примагничиваются к направляющим при приближении
- Двойной клик по направляющей — удаление

**Клавиатура:**
- Стрелки — перемещение выделенных объектов (шаг 1px)
- Shift + стрелки — быстрое перемещение (шаг 5px)

#### Презентация (`http://<ip>:8084/` или `?floor=<id>`)
Чистый вид для встраивания в дашборды (Jarvis, vis и т.д.).
- Кнопки этажей и слоёв стилизуются по настройкам
- Клик по переключателю меняет состояние
- Значения обновляются в реальном времени
- Блокировка: первый клик разблокирует (показывает замочек), второй клик в течение 10 сек выполняет действие

---

## 🔧 Configuration / Настройка

### Adapter Settings / Настройки адаптера
| Parameter | Default | Description |
|-----------|---------|-------------|
| Editor port | 8083 | Port for the visual editor |
| Presentation port | 8084 | Port for the presentation view |
| Bind IP | 0.0.0.0 | Network interface to bind |

### MFD Icons / MFD-иконки
Install `icons-mfd-png` adapter in ioBroker to use MFD icon set. The adapter automatically detects and serves icons from ioBroker's file storage.

Установите адаптер `icons-mfd-png` в ioBroker для использования набора иконок MFD. Адаптер автоматически обнаруживает и раздаёт иконки из файлового хранилища ioBroker.

---

## 🏗️ Architecture / Архитектура

- **Backend**: Node.js + Express + ioBroker adapter-core
- **Frontend**: Vanilla JavaScript, no build step
- **Storage**: ioBroker states (JSON config) + file system (uploads)
- **Communication**: HTTP REST API + polling (2s for states, 5s for config)

---

## 📄 License / Лицензия

MIT License

Icons from MFD set are licensed under CC BY-SA 3.0.

---

## 🤖 Development / Разработка

This adapter was developed with AI assistance (Qwen 3.7).

Этот адаптер разработан с помощью ИИ (Qwen 3.7).

---

## 🐛 Issues / Проблемы

Report issues at: https://github.com/yohohum/ioBroker.floorplan-visualizer/issues

---

## 📝 Changelog / История изменений

### 14.0.0 (2026-10-07)
- ✨ Lock feature for switches
- 🐛 Fix guides snap for left/top edges
- 🎨 MD3 layout spacing
- 📖 README with full documentation
- 🔧 Fix admin buttons duplication

### 13.0.0
- ✨ Guides with snap
- ✨ Arrow keys movement
- ✨ Multi-selection and alignment

### 12.0.0
- ✨ Floor/layer icons
- ✨ Rooms/functions in object tree
- ✨ Layer rename

### 11.0.0
- ✨ Icon picker with tabs
- ✨ Bar button icons

### 10.0.0
- ✨ Templates
- ✨ Bar settings (size, position, colors)
- ✨ Plan background

### 9.0.0
- ✨ Floor/layer ordering
- ✨ Preview button
- ✨ Value/name font settings

### 8.0.0
- ✨ Three icon states for Value type
- ✨ Custom icon upload
- ✨ Live data in editor

### 7.0.0
- ✨ Context menu (edit/copy/delete)
- ✨ Drag & drop placement

### 1.0.0 — 6.0.0
- Initial versions with basic features