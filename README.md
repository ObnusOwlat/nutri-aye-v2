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
