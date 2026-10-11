// Spanish labels for every stored value (values stay in English in the database
// and the API). Single source for the backend messages and the frontend
// (GET /api/labels). A test checks that every allowed value has a label.

const LABELS = {
    mealCategory: { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', afternoon_snack: 'Merienda', snack: 'Colación' },
    mealType: {
        breakfast: 'Desayuno', morning_snack: 'Media mañana', lunch: 'Almuerzo',
        afternoon_snack: 'Merienda', snack: 'Colación', dinner: 'Cena'
    },
    day: {
        monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
        friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
    },
    ingredientCategory: {
        protein: 'Proteínas', carbs: 'Carbohidratos', fats: 'Grasas', vegetables: 'Verduras',
        fruits: 'Frutas', dairy: 'Lácteos', mixed: 'Mixtos'
    },
    unit: { gram: 'gramos', milliliter: 'mililitros', ounce: 'onzas', cup: 'tazas', tablespoon: 'cucharadas', teaspoon: 'cucharaditas' },
    gender: { male: 'Masculino', female: 'Femenino', other: 'Otro' },
    patientStatus: { active: 'Activo', inactive: 'Inactivo', archived: 'Archivado' },
    activityLevel: { sedentary: 'Sedentario', light: 'Ligera', moderate: 'Moderada', active: 'Activa', very_active: 'Muy activa' },
    conditionType: { condition: 'Condición médica', allergy: 'Alergia', intolerance: 'Intolerancia', medication: 'Medicación' },
    severity: { mild: 'Leve', moderate: 'Moderada', severe: 'Grave' },
    dietGoal: { maintenance: 'Mantenimiento', deficit: 'Déficit', bulking: 'Aumento de masa', performance: 'Rendimiento' },
    planStatus: { active: 'Activo', completed: 'Completado', cancelled: 'Cancelado' },
    bmiCategory: { underweight: 'Bajo peso', normal: 'Normal', overweight: 'Sobrepeso', obese: 'Obesidad' },
    role: { admin: 'Administrador/a', nutricionista: 'Nutricionista', recepcion: 'Recepción' },
    invoiceStatus: { UNPAID: 'Pendiente', PAID: 'Pagada', OVERDUE: 'Vencida', CANCELLED: 'Anulada' },
    quoteStatus: { DRAFT: 'Borrador', SENT: 'Enviado', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado', EXPIRED: 'Vencido' },
    itemType: { SERVICE: 'Servicio', PRODUCT: 'Producto' },
    paymentType: { BANK_TRANSFER: 'Transferencia', CASH: 'Efectivo', CARD: 'Tarjeta', OTHER: 'Otro' },
    clientType: { INDIVIDUAL: 'Persona', COMPANY: 'Empresa' },
    // Per-100 g nutrient columns, by API key without "Per100g"
    nutrient: {
        kcal: 'Calorías', protein: 'Proteínas', carbs: 'Carbohidratos', fat: 'Grasas', saturatedFat: 'Grasas saturadas',
        polyunsaturatedFat: 'Grasas poliinsaturadas', monounsaturatedFat: 'Grasas monoinsaturadas', sugar: 'Azúcares',
        fiber: 'Fibra', cholesterol: 'Colesterol', sodium: 'Sodio', vitaminA: 'Vitamina A', vitaminB1: 'Vitamina B1',
        vitaminB2: 'Vitamina B2', vitaminB3: 'Vitamina B3', vitaminB5: 'Vitamina B5', vitaminB6: 'Vitamina B6',
        vitaminB9: 'Vitamina B9 (folato)', vitaminB12: 'Vitamina B12', vitaminC: 'Vitamina C', vitaminD: 'Vitamina D',
        vitaminE: 'Vitamina E', vitaminK: 'Vitamina K', magnesium: 'Magnesio', calcium: 'Calcio', phosphorus: 'Fósforo',
        potassium: 'Potasio', iron: 'Hierro', selenium: 'Selenio', zinc: 'Zinc', manganese: 'Manganeso', copper: 'Cobre'
    },
    nutrientGroup: {
        energy: 'Energía', proximates: 'Composición general', carbohydrates: 'Carbohidratos', lipids: 'Grasas',
        vitamins: 'Vitaminas', minerals: 'Minerales', amino_acids: 'Aminoácidos', sterols: 'Esteroles',
        organic_acids: 'Ácidos orgánicos', other: 'Otros'
    },
    source: {
        user: 'Propio', calories_in: 'Catálogo básico', usda_foundation: 'USDA Foundation', usda_sr_legacy: 'USDA SR Legacy'
    }
};

// API field names -> Spanish, for validation messages
const FIELDS = {
    name: 'nombre', firstName: 'nombre', lastName: 'apellido', email: 'email', phone: 'teléfono',
    dateOfBirth: 'fecha de nacimiento', gender: 'sexo', status: 'estado', notes: 'notas', photo: 'foto',
    'address.street': 'dirección', 'address.city': 'ciudad', 'address.zipCode': 'código postal',
    'emergencyContact.name': 'contacto de emergencia', 'emergencyContact.phone': 'teléfono de emergencia',
    'emergencyContact.relation': 'parentesco', physicalActivity: 'actividad física',
    'physicalActivity.level': 'nivel de actividad', 'physicalActivity.frequency': 'frecuencia',
    'physicalActivity.duration': 'duración', 'physicalActivity.caloriesBurned': 'calorías quemadas',
    category: 'categoría', unit: 'unidad', ingredients: 'alimentos', ingredientId: 'alimento', grams: 'gramos',
    instructions: 'preparación', date: 'fecha', weight: 'peso', height: 'talla', bmi: 'IMC', bodyFat: '% de grasa',
    muscleMass: 'masa muscular', waist: 'cintura', chest: 'pecho', hips: 'cadera', cadera: 'cadera',
    ciaAbdominal: 'circunferencia abdominal', ciaBrazo: 'circunferencia de brazo', ciaPierna: 'circunferencia de pierna',
    activityLevel: 'nivel de actividad', type: 'tipo', severity: 'severidad', description: 'descripción',
    dietaryNotes: 'notas dietarias', medications: 'medicación', dietGoal: 'objetivo', goal: 'objetivo',
    dailyTarget: 'calorías diarias', startDate: 'fecha de inicio', endDate: 'fecha de fin', weekPlan: 'semana',
    adherence: 'adherencia', energyLevel: 'energía', sleepQuality: 'calidad del sueño', mood: 'ánimo', symptoms: 'síntomas',
    patientId: 'paciente', templateId: 'plantilla', meals: 'comidas', day: 'día', mealType: 'comida', recipeId: 'receta',
    clientId: 'cliente', discount: 'descuento', items: 'ítems', quantity: 'cantidad', unitPrice: 'precio unitario',
    dueDate: 'vencimiento', validUntil: 'válido hasta', paidAt: 'fecha de pago', country: 'país', currency: 'moneda',
    vatId: 'RUC', website: 'sitio web', address: 'dirección', city: 'ciudad', isDefault: 'predeterminado',
    password: 'contraseña', currentPassword: 'contraseña actual', newPassword: 'contraseña nueva', role: 'rol',
    orgName: 'nombre del consultorio', orgId: 'consultorio', mealDistribution: 'distribución de comidas',
    fontFamily: 'tipografía', padding: 'margen', primaryColor: 'color principal', secondaryColor: 'color secundario',
    includeLogo: 'logo', logoB64: 'logo'
};

// "items.0.unitPrice" -> "ítems (fila 1): precio unitario"; "kcalPer100g" -> "kcal por 100 g"
function fieldLabel(path) {
    if (!path) return 'datos';
    const parts = String(path).split('.');
    const rows = parts.filter(p => /^\d+$/.test(p)).map(p => Number(p) + 1);
    const key = parts.filter(p => !/^\d+$/.test(p)).join('.');
    const per100 = /^(.+)Per100g$/.exec(key);
    const nutrient = per100 && LABELS.nutrient[per100[1]];
    const label = FIELDS[key] || FIELDS[parts[parts.length - 1]] || (nutrient ? `${nutrient[0].toLowerCase()}${nutrient.slice(1)} por 100 g` : key);
    const parent = parts.length > 1 && rows.length ? FIELDS[parts[0]] || parts[0] : null;
    return parent ? `${parent} (fila ${rows.join(', ')}): ${label}` : label;
}

module.exports = { LABELS, FIELDS, fieldLabel };
