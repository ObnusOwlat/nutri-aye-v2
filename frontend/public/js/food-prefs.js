/**
 * food-prefs.js - "Ocultar importados": one choice shared by the Alimentos tab
 * and the food search of Crear receta. On by default: foods from other
 * countries (not found in Paraguay) do not show up. Remembered per browser.
 */

const FoodPrefs = (function() {
    const KEY = 'nutri-aye.hideImported';
    let hide = true;
    try { hide = localStorage.getItem(KEY) !== '0'; } catch { /* private window: default */ }

    const hideImported = () => hide;

    function setHideImported(value) {
        hide = !!value;
        try { localStorage.setItem(KEY, hide ? '1' : '0'); } catch { /* not remembered */ }
        UI.emit('foodPrefs:changed', { hideImported: hide });
    }

    // Query value for /api/ingredients (py=1 keeps only foods found in Paraguay)
    const py = () => (hide ? '1' : '');
    const allows = (food) => !hide || !!food.availablePy;

    return { hideImported, setHideImported, py, allows };
})();
