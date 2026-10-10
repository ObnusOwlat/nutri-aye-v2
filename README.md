# Meal Prep Planner

A local-first web application for meal planning, recipe management, and shopping list generation.

## Features

- **Weekly Meal Planner**: 7-day grid with 4 meals per day
- **Ingredient Management**: Add, edit, delete, and import/export ingredients via CSV
- **Recipe Builder**: Create recipes with live calorie calculation
- **Shopping List**: Auto-generate aggregated shopping lists from meal plans
- **Diet Goals**: Set daily calorie targets with visual tracking
- **Offline Support**: Works fully offline using localStorage
- **Optional Sync**: Backend sync for multi-device support (Node.js + SQLite)

## Quick Start

### Frontend Only (Recommended for Starters)

1. Open `frontend/index.html` in your browser
2. Start adding ingredients and recipes
3. Plan your meals for the week
4. Generate your shopping list

### With Backend (For Multi-Device Sync)

```bash
cd backend
npm install
npm start
```

Then open `frontend/index.html` and click "Sync" to backup your data.

## Project Structure

```
meal-prep-planner/
├── frontend/
│   ├── index.html              # Main HTML file
│   ├── css/
│   │   ├── main.css            # Base styles & variables
│   │   ├── components.css       # UI components
│   │   └── responsive.css      # Responsive breakpoints
│   ├── js/
│   │   ├── app.js              # Main entry & tab navigation
│   │   ├── state.js            # State management (localStorage)
│   │   ├── ui.js               # Modal, toast, print utilities
│   │   ├── ingredients.js     # Ingredient CRUD & CSV
│   │   ├── recipes.js          # Recipe builder
│   │   ├── planner.js          # Weekly planner grid
│   │   ├── shopping.js         # Shopping list generator
│   │   └── sync.js             # Backend sync layer
│   └── assets/
│       └── templates/
│           └── ingredients-template.csv
├── backend/
│   ├── server.js              # Express API server
│   ├── package.json
│   └── db/                     # SQLite database (auto-created)
└── README.md
```

## Data Storage

### localStorage Keys

| Key | Description |
|-----|-------------|
| `mp_ingredients_v1` | User's ingredients |
| `mp_dishes_v3` | User's recipes |
| `mp_week_v3` | Weekly meal plan |
| `mp_diet_v3` | Diet profile (goal, daily target) |

### Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/sync/push` | POST | Push local data to server |
| `/api/sync/pull` | GET | Pull server data |
| `/api/backup/export` | GET | Download full backup |
| `/api/backup/import` | POST | Restore from backup |

## Food Database (USDA FoodData Central)

The backend can load ~7,900 foods from USDA FoodData Central (Foundation Foods + SR Legacy, public domain / CC0) with their full nutrient profile (246 nutrients: macros, vitamins, minerals, fatty acids, amino acids, sterols...) and household portions.

```bash
# 1. Download the JSON files into foods-data/usda/ (not versioned)
mkdir -p foods-data/usda && cd foods-data/usda
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
unzip -o '*.zip' && cd ../..

# 2. Start the server once (creates the schema), then import
cd backend && node import-usda.js
```

Food and nutrient names are imported in Spanish (`name`), keeping the USDA original in `name_en`. Search matches both, ignoring accents ("limon" finds "Limón"). Re-running the import updates nutrient data and names, but keeps names you renamed and categories you changed.

### Spanish names (free, offline)

`foods-data/translations/usda-names-es.json` is versioned, so the import works without this step. To regenerate it (e.g. after a new USDA release or glossary edits):

```bash
python3 -m venv tools/.venv
tools/.venv/bin/pip install ctranslate2 sentencepiece
mkdir -p tools/models && curl -L -o /tmp/en_es.zip https://argos-net.com/v1/translate-en_es-1_0.argosmodel
unzip -o /tmp/en_es.zip -d tools/models          # -> tools/models/en_es/
tools/.venv/bin/python tools/translate-usda.py   # ~40 s, then re-run node import-usda.js
```

It uses `tools/glossary-usda-es.json` (~880 frequent USDA terms in Paraguayan/Rioplatense Spanish: porotos, batata, palta, cuts of meat) and an offline OPUS-MT model (Argos Translate) for the rest. Adjectives agree with the food's gender/number. Nutrient names are hand-translated in `foods-data/translations/nutrients-es.json`. USDA foods are served through the API and are not included in sync/backup unless a recipe uses them.

| Endpoint | Description |
|----------|-------------|
| `GET /api/ingredients?source=usda` | Filter by source (`usda`, `usda_foundation`, `usda_sr_legacy`, `calories_in`, `user`) |
| `GET /api/ingredients/:id` | Ingredient with `nutrients` (full profile per 100 g) and `portions` (grams per cup, piece...) |
| `GET /api/nutrients?group=vitamins` | Nutrient catalog and how many ingredients have each one |
| `GET /api/nutrients/:id/ingredients?category=vegetables&limit=20` | Ingredients richest in a nutrient |
| `GET /api/recipes/:id` | Recipe with `nutrients` (full totals for the recipe) |

## Demo Data

```bash
cd backend && node seed-demo.js           # 4 fictional patients (metrics, conditions) + 9 recipes from USDA foods
node seed-demo.js --remove                # delete it (all demo rows have ids starting with "demo-")
```

Then press **Sync** in the app to bring it into the browser.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + 1` | Go to Patients |
| `Alt + 2` | Go to Planner |
| `Alt + 3` | Go to Ingredients |
| `Alt + 4` | Go to Recipes |
| `Ctrl + S` | Create backup |
| `Ctrl + P` | Print |
| `Esc` | Close modal |

## CSV Import Format

```csv
name,kcalPer100g,category
Chicken Breast,165,protein
Brown Rice,111,carbs
Avocado,160,fats
Broccoli,34,vegetables
```

Categories: `protein`, `carbs`, `fats`, `vegetables`, `mixed`

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Development

### Run Backend with Auto-reload

```bash
cd backend
npm run dev
```

### Build for Production

Simply copy the `frontend` folder to your web server.

## License

MIT
