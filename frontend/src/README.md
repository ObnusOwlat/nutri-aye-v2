# Meal Prep Planner - Source Structure

This directory contains the modernized, modular JavaScript/TypeScript source code.

## Directory Structure

```
src/
├── types/              # TypeScript type definitions
│   ├── enums.ts       # Enum constants
│   ├── models.ts      # Data models/interfaces
│   └── index.ts       # Barrel export
│
├── events/            # Event system
│   ├── EventEmitter.ts
│   └── index.ts
│
├── storage/           # localStorage abstraction
│   ├── keys.ts       # Storage key constants
│   ├── storage.ts    # Storage implementation
│   └── index.ts
│
├── stores/            # Domain state stores
│   ├── ingredients-store.ts
│   ├── recipes-store.ts
│   ├── week-plan-store.ts
│   ├── diet-store.ts
│   ├── patients-store.ts
│   └── index.ts
│
├── state.ts           # Main orchestrator (backward compatible)
│
└── __tests__/        # Test suite
    ├── events.test.ts
    ├── types.test.ts
    ├── utils.test.ts
    ├── diet-store.test.ts
    ├── patients-store.test.ts
    ├── setup.ts
    └── index.ts
```

## Architecture

### Event-Driven Design

Modules communicate via an event system (`events/`). This decouples components and allows for reactive updates.

```typescript
import { events, EventNames } from './events';

// Subscribe to events
events.subscribe(EventNames.INGREDIENTS_UPDATED, (ingredients) => {
    console.log('Ingredients updated:', ingredients.length);
});

// Emit events
events.emit(EventNames.INGREDIENTS_UPDATED, myIngredients);
```

### Domain Stores

Each domain has its own store with clear responsibilities:

| Store | Responsibility |
|-------|-----------------|
| `ingredients-store` | Ingredient CRUD, import/export |
| `recipes-store` | Recipe CRUD, nutrition calculation |
| `week-plan-store` | Meal planning, daily calories |
| `diet-store` | Diet profiles, templates |
| `patients-store` | Patient management, metrics, conditions |

### Storage Layer

All persistence goes through the `storage` module which handles:
- Debounced saves (100ms)
- Error handling (quota exceeded)
- Type-safe loading

## Running the Application

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Build for production
npm run build
```

## Testing

Tests use Vitest with jsdom environment. Run:

```bash
npm test           # Run all tests
npm run test:ui    # Interactive UI
npm run test:coverage  # With coverage report
```

## Migration from Legacy Code

The original `state.js` (1410 lines) has been split into focused modules:

| Original | New |
|----------|-----|
| `state.js` events | `events/EventEmitter.ts` |
| `state.js` storage | `storage/` |
| `state.js` ingredients | `stores/ingredients-store.ts` |
| `state.js` recipes | `stores/recipes-store.ts` |
| `state.js` week plans | `stores/week-plan-store.ts` |
| `state.js` diet | `stores/diet-store.ts` |
| `state.js` patients | `stores/patients-store.ts` |

The `state.ts` orchestrator maintains backward compatibility with the original API.
