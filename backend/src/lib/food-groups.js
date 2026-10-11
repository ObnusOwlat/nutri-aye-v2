// Food subgroups ("origen") inside each category, and preparation forms.
// Keywords match word starts of the English USDA name (name_en) or the Spanish
// name, accents and case ignored; keywords of 4 letters or less match whole
// words only (plural included), so "pan" is not "panceta" and "sal" not "salsa". First matching subgroup wins;
// USDA food groups (source_category) decide when they are specific enough.
// Labels in Spanish live in src/labels.js (foodSubgroup, foodForm).

// [subgroup, { usda: [USDA food groups], en: [...], es: [...] }] per category
const SUBGROUPS = {
    protein: [
        ['beef', { es: ['bife de chorizo'] }],   // a beef cut, not a sausage
        ['shellfish', { en: ['crustaceans', 'mollusks', 'shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'squid', 'octopus', 'scallop'], es: ['camaron', 'langost', 'calamar', 'pulpo', 'ostra', 'mejillon', 'almeja', 'cangrejo', 'marisco'] }],
        ['fish', { usda: ['Finfish and Shellfish Products'], en: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'trout', 'halibut', 'haddock', 'sardine', 'anchov'], es: ['pescado', 'salmon', 'atun', 'bacalao', 'tilapia', 'trucha', 'halibut', 'eglefino', 'merluza', 'sardina', 'anchoa', 'surubi', 'pacu', 'dorado'] }],
        ['processed', { usda: ['Sausages and Luncheon Meats'], en: ['sausage', 'bologna', 'salami', 'frankfurter', 'ham,', 'bacon', 'jerky', 'luncheon', 'bockwurst', 'bratwurst', 'knackwurst', 'kielbasa', 'pepperoni', 'chorizo', 'pastrami', 'liverwurst', 'braunschweiger', 'mortadella', 'hot dog', 'cured'], es: ['chorizo', 'salchicha', 'jamon', 'panceta', 'prosciutto', 'salame', 'mortadela', 'fiambre', 'charque', 'chicharron'] }],
        ['poultry', { usda: ['Poultry Products'], en: ['chicken', 'turkey', 'duck', 'goose', 'quail', 'pheasant'], es: ['pollo', 'pavo', 'pato', 'codorniz', 'gallina'] }],
        ['pork', { usda: ['Pork Products'], en: ['pork'], es: ['cerdo', 'chancho', 'lechon'] }],
        ['lamb_game', { usda: ['Lamb, Veal, and Game Products'], en: ['lamb', 'veal', 'goat', 'bison', 'venison', 'game meat', 'rabbit'], es: ['cordero', 'ternera', 'cabrito', 'chivo', 'conejo', 'ciervo', 'jabali'] }],
        ['beef', { usda: ['Beef Products'], en: ['beef'], es: ['carne vacuna', 'carne molida', 'vacuno', 'res', 'bife', 'lomo', 'nalga', 'vacio', 'asado'] }],
        ['legumes', { usda: ['Legumes and Legume Products'], en: ['beans', 'lentils', 'chickpea', 'soy', 'tofu', 'peas, split'], es: ['poroto', 'lenteja', 'garbanzo', 'soja', 'tofu', 'arveja seca', 'hummus', 'hamburguesa vegetariana'] }]
    ],
    vegetables: [
        ['mushrooms', { en: ['mushroom'], es: ['hongo', 'champinon', 'shiitake', 'portobello'] }],
        ['cruciferous', { en: ['broccoli', 'cauliflower', 'cabbage', 'brussels', 'kohlrabi', 'bok choy', 'pak-choi'], es: ['brocoli', 'coliflor', 'repollo', 'repollito', 'colinabo'] }],
        ['leafy', { en: ['lettuce', 'spinach', 'chard', 'kale', 'arugula', 'cress', 'chicory', 'endive', 'collards', 'greens', 'watercress', 'celery', 'leaves', 'leafy tips', 'purslane', 'cornsalad', 'chrysanthemum'], es: ['lechuga', 'espinaca', 'acelga', 'kale', 'rucula', 'berro', 'achicoria', 'endibia', 'apio', 'radicheta'] }],
        ['roots_tubers', { en: ['potato', 'sweet potato', 'cassava', 'yam', 'taro', 'carrot', 'beet', 'radish', 'turnip', 'parsnip', 'celeriac', 'jicama', 'arrowhead', 'ginger root', 'yautia'], es: ['papa', 'batata', 'mandioca', 'yuca', 'name', 'zanahoria', 'remolacha', 'rabano', 'nabo', 'chirivia', 'raiz de jengibre', 'mbeju'] }],
        ['alliums', { en: ['onion', 'garlic', 'leek', 'shallot', 'scallion', 'chives'], es: ['cebolla', 'cebollita', 'ajo', 'puerro', 'echalote', 'ciboulette', 'verdeo'] }],
        ['fruit_vegetables', { en: ['tomato', 'pepper', 'eggplant', 'squash', 'zucchini', 'pumpkin', 'cucumber', 'okra', 'chayote', 'artichoke', 'asparagus'], es: ['tomate', 'morron', 'pimiento', 'locote', 'aji', 'chile', 'berenjena', 'zapallo', 'zapallito', 'calabaza', 'pepino', 'chayote', 'alcaucil', 'esparrago'] }],
        ['sprouts', { en: ['sprouted', 'sprouts'], es: ['brote', 'germinad'] }],
        ['pods_corn', { en: ['beans, snap', 'green beans', 'peas', 'lima beans', 'edamame', 'corn', 'soybeans, green', 'immature seeds', 'cowpeas', 'pigeonpeas'], es: ['chaucha', 'arveja', 'poroto verde', 'choclo', 'maiz dulce', 'granos de maiz', 'habas'] }]
    ],
    fruits: [
        ['juices', { en: ['juice', 'nectar'], es: ['jugo', 'nectar'] }],
        ['citrus', { en: ['orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'mandarin', 'pummelo', 'kumquat', 'clementine'], es: ['naranja', 'limon', 'lima', 'pomelo', 'mandarina'] }],
        ['berries', { en: ['strawberr', 'blueberr', 'raspberr', 'blackberr', 'cranberr', 'currant', 'gooseberr', 'grape', 'goji', 'boysenberr', 'elderberr', 'mulberr'], es: ['frutilla', 'arandano', 'frambuesa', 'mora', 'grosella', 'uva', 'pasa'] }],
        ['tropical', { en: ['banana', 'mango', 'pineapple', 'papaya', 'guava', 'passion', 'coconut', 'kiwi', 'lychee', 'avocado', 'plantain', 'dates', 'fig', 'jackfruit', 'sapote', 'soursop', 'longan', 'tamarind', 'rambutan', 'sapodilla', 'feijoa', 'persimmon', 'carambola', 'litchi', 'loquat', 'nance', 'naranjilla', 'acerola', 'cherimoya'], es: ['banana', 'mango', 'anana', 'mamon', 'papaya', 'guayaba', 'mburucuya', 'maracuya', 'coco', 'kiwi', 'palta', 'datil', 'higo', 'aratiku', 'pitanga'] }],
        ['pome_stone', { en: ['apple', 'pear', 'peach', 'plum', 'prune', 'cherr', 'apricot', 'nectarine', 'quince', 'pomegranate'], es: ['manzana', 'pera', 'durazno', 'ciruela', 'cereza', 'damasco', 'nectarina', 'membrillo', 'granada'] }],
        ['melons', { en: ['melon', 'watermelon', 'cantaloupe', 'honeydew'], es: ['melon', 'sandia'] }]
    ],
    carbs: [
        ['breakfast_cereals', { usda: ['Breakfast Cereals'], en: ['cereals ready-to-eat', 'granola'], es: ['cereal', 'granola', 'copos'] }],
        ['pasta', { en: ['pasta', 'noodles', 'spaghetti', 'macaroni'], es: ['pasta', 'fideo', 'tallarin', 'espagueti', 'macarron', 'noquis'] }],
        ['bread_bakery', { usda: ['Baked Products'], en: ['bread', 'roll', 'bagel', 'tortilla', 'cracker', 'muffin', 'biscuit', 'cookie', 'cake'], es: ['pan', 'bagel', 'tortilla', 'galleta', 'galletita', 'muffin', 'chipa', 'tapas para tacos', 'bizcocho'] }],
        ['grains_flours', { usda: ['Cereal Grains and Pasta'], en: ['rice', 'oats', 'quinoa', 'flour', 'wheat', 'barley', 'millet', 'buckwheat', 'bulgur', 'couscous', 'cornmeal', 'cornstarch'], es: ['arroz', 'avena', 'quinoa', 'harina', 'trigo', 'cebada', 'mijo', 'burgol', 'cuscus', 'almidon', 'polenta', 'germen'] }]
    ],
    fats: [
        ['nuts_seeds', { usda: ['Nut and Seed Products'], en: ['nuts', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'peanut', 'seeds', 'tahini'], es: ['almendra', 'nuez', 'nueces', 'pecan', 'caju', 'pistacho', 'avellana', 'macadamia', 'mani', 'semilla', 'pinon', 'tahini', 'chia', 'lino'] }],
        ['oils_fats', { usda: ['Fats and Oils'], en: ['oil', 'butter', 'margarine', 'lard', 'shortening', 'olive'], es: ['aceite', 'manteca', 'margarina', 'grasa', 'aceituna'] }]
    ],
    dairy: [
        ['eggs', { en: ['egg'], es: ['huevo', 'clara', 'yema'] }],
        ['cheese', { en: ['cheese'], es: ['queso', 'ricota', 'requeson'] }],
        ['yogurt', { en: ['yogurt', 'kefir'], es: ['yogur', 'kefir'] }],
        ['cream_butter', { en: ['cream', 'butter', 'half and half'], es: ['crema', 'manteca', 'mezcla de leche y crema'] }],
        ['milk', { en: ['milk'], es: ['leche'] }]
    ],
    mixed: [
        ['beverages', { usda: ['Beverages'], en: ['beverage', 'drink', 'coffee', 'tea', 'soda', 'beer', 'wine'], es: ['bebida', 'cafe', 'te', 'gaseosa', 'cerveza', 'vino', 'leche de almendra', 'leche de arroz', 'leche de coco', 'mate', 'terere'] }],
        ['sweets', { usda: ['Sweets'], en: ['candy', 'chocolate', 'sugar', 'syrup', 'jam', 'honey', 'ice cream'], es: ['dulce', 'chocolate', 'azucar', 'jarabe', 'mermelada', 'miel', 'helado', 'malvavisco', 'caramelo'] }],
        ['spices_condiments', { usda: ['Spices and Herbs'], en: ['spices', 'salt', 'pepper, black', 'vinegar', 'mustard', 'ketchup', 'mayonnaise'], es: ['sal', 'pimienta', 'canela', 'comino', 'oregano', 'romero', 'tomillo', 'albahaca', 'perejil', 'menta', 'salvia', 'paprika', 'nuez moscada', 'vinagre', 'mostaza', 'ketchup', 'mayonesa', 'aderezo', 'salsa', 'vainilla', 'cilantro', 'jengibre en polvo', 'ajo en polvo'] }],
        ['soups_sauces', { usda: ['Soups, Sauces, and Gravies'], en: ['soup', 'sauce', 'gravy', 'broth'], es: ['sopa', 'caldo'] }],
        ['snacks', { usda: ['Snacks'], en: ['snack', 'chips', 'popcorn', 'pretzel'], es: ['snack', 'nachos', 'pororo', 'pretzel', 'chips'] }],
        ['prepared', { usda: ['Fast Foods', 'Restaurant Foods', 'Meals, Entrees, and Side Dishes'], en: ['fast food', 'restaurant', 'pizza', 'burger', 'sandwich'], es: ['pizza', 'hamburguesa', 'sandwich', 'empanada', 'milanesa'] }],
        ['baby', { usda: ['Baby Foods'], en: ['babyfood', 'infant formula'], es: ['bebe', 'infantil'] }],
        ['native', { usda: ['American Indian/Alaska Native Foods'], en: [], es: [] }]
    ]
};

// Preparation form, by priority: "frozen, cooked" counts as cooked
const FORMS = [
    ['raw', { en: ['raw', 'fresh'], es: ['crudo', 'cruda', 'crudos', 'crudas', 'fresco', 'fresca'] }],
    ['cooked', { en: ['cooked', 'boiled', 'roasted', 'baked', 'fried', 'grilled', 'broiled', 'braised', 'stewed', 'steamed', 'microwaved', 'toasted', 'pan-fried', 'sauteed'], es: ['cocid', 'hervid', 'asad', 'horne', 'frit', 'grill', 'a la plancha', 'braseado', 'guisad', 'al vapor', 'tostad', 'salteado'] }],
    ['canned', { en: ['canned'], es: ['enlatad', 'en lata', 'en conserva'] }],
    ['frozen', { en: ['frozen'], es: ['congelad'] }],
    ['dried', { en: ['dried', 'dehydrated', 'powder'], es: ['seco', 'seca', 'secos', 'secas', 'deshidratad', 'en polvo', 'pasas'] }]
];

// Basic catalog (calories-in) foods came with wrong categories: by Spanish name.
// Exclusions first (an oil of salmon is a fat, a chicken broth is mixed).
const BASIC_CATEGORY_RULES = [
    ['protein', ['proteina de suero']],
    ['fruits', ['carne de coco', 'copos de coco']],
    ['mixed', ['caldo', 'salsa', 'aderezo', 'ketchup', 'mostaza', 'mayonesa', 'vinagre', 'leche de almendra', 'leche de arroz', 'leche de coco', 'helado', 'jarabe', 'chocolate', 'galletas de chips', 'malvavisco', 'cerveza', 'vino', 'azucar', 'mermelada', 'miel', 'sal', 'en polvo', 'seco', 'seca', 'extracto', 'goma guar', 'pico de gallo', 'nachos', 'pretzels', 'pororo', 'canela', 'comino', 'nuez moscada', 'paprika', 'pimienta', 'hummus', 'tahini']],
    ['fats', ['aceite', 'manteca de']],
    ['protein', ['carne', 'cerdo', 'pollo', 'pavo', 'pescado', 'salmon', 'atun', 'bacalao', 'tilapia', 'trucha', 'halibut', 'eglefino', 'camaron', 'calamar', 'langosta', 'ostra', 'jamon', 'panceta', 'prosciutto', 'chorizo', 'solomillo', 'charque', 'chicharron', 'tofu', 'lenteja', 'poroto', 'garbanzo', 'soja', 'hamburguesa vegetariana', 'proteina de suero']],
    ['carbs', ['arroz', 'avena', 'harina', 'pasta', 'fideo', 'quinoa', 'mijo', 'trigo', 'burgol', 'cuscus', 'almidon', 'pan', 'bagel', 'muffin', 'tortilla', 'tapas para tacos', 'galletas de arroz', 'galletas de trigo', 'galletas graham', 'galletitas']],
    ['fats', ['aceite', 'manteca de', 'almendra', 'nuez', 'nueces', 'avellana', 'castana', 'macadamia', 'pistacho', 'pinon', 'mani', 'semillas', 'aceituna']],
    ['fruits', ['anana', 'aratiku', 'arandano', 'banana', 'cereza', 'ciruela', 'damasco', 'durazno', 'datil', 'frambuesa', 'frutilla', 'granada', 'higo', 'kiwi', 'lima', 'limon', 'mamon', 'mango', 'manzana', 'melon', 'mora', 'nectarina', 'pasas', 'pera', 'pomelo', 'sandia', 'uva', 'carne de coco', 'copos de coco', 'jugo', 'palta']],
    ['vegetables', ['achicoria', 'ajo', 'alcaucil', 'apio', 'berenjena', 'brocoli', 'calabaza', 'cebolla', 'cebollita', 'chaucha', 'chile', 'ciboulette', 'coliflor', 'espinaca', 'esparrago', 'hongo', 'kale', 'lechuga', 'locote', 'nabo', 'papa', 'batata', 'pepino', 'pimiento', 'raiz de jengibre', 'repollo', 'repollito', 'rabano', 'rucula', 'tomate', 'zanahoria', 'zapallito', 'zapallo', 'verduras', 'arveja', 'maiz dulce', 'albahaca fresca', 'menta fresca', 'romero fresco', 'tomillo fresco']]
];

module.exports = { SUBGROUPS, FORMS, BASIC_CATEGORY_RULES };
