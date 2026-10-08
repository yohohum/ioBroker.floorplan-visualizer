# ioBroker.floorplan-visualizer

[![NPM version](https://img.shields.io/npm/v/iobroker.floorplan-visualizer.svg)](https://www.npmjs.com/package/iobroker.floorplan-visualizer)
[![Downloads](https://img.shields.io/npm/dm/iobroker.floorplan-visualizer.svg)](https://www.npmjs.com/package/iobroker.floorplan-visualizer)
[![License](https://img.shields.io/github/license/yohohum/ioBroker.floorplan-visualizer)](LICENSE)
[![Donation](https://img.shields.io/badge/donation-PayPal-blue.svg)](https://www.paypal.com/donate)

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