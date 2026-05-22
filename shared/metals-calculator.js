/* shared/metals-calculator.js
   Universal Metals Ingots & Nuggets Calculator
   
   Provides functions to accurately calculate adjusted ingot amounts by accounting
   for nugget-to-ingot conversion ratios across all frontend pages.
   
   Formula: adjusted_ingots = ingots_shown - (nuggets / nugget_ratio)
   
Example (Copper):
     - Backend shows: 791.45 ingots, 6989 nuggets
     - Calculation: 791.45 - (6989 / 20) = 791.45 - 349.45 = 442 ingots
     - Display: "442 Copper Ingots, 6989 Copper Nuggets"
*/

(function () {
  'use strict';

  // Nugget-to-ingot ratios
  // Default: 20 nuggets = 1 ingot
  // Meteoric Iron: 2 nuggets = 1 ingot
  const NUGGET_RATIO_MAP = {
    'Meteoric Iron': 2
  };

  const DEFAULT_NUGGET_RATIO = 20;

  /**
   * Get the nugget-to-ingot ratio for a given metal type
   * @param {string} metalType - e.g. "Silver", "Meteoric Iron"
   * @returns {number} nuggets per ingot
   */
  function getNuggetRatio(metalType) {
    const type = String(metalType || '').trim();
    return NUGGET_RATIO_MAP[type] || DEFAULT_NUGGET_RATIO;
  }

  /**
   * Derive nugget item name from ingot item name
   * e.g. "Silver Ingot" ? "Silver Nuggets"
   * Special case: "Steel Ingot" ? null (no nuggets for steel)
   *
   * @param {string} ingotItemName - e.g. "Silver Ingot", "Steel Ingot"
   * @returns {string|null} nugget item name, or null if none exists
   */
  function getNuggetItemName(ingotItemName) {
    const name = String(ingotItemName || '').trim();
    if (name.includes('Steel')) return null; // Steel has no nuggets
    if (!name.includes('Ingot')) return null; // Not an ingot item
    return name.replace(' Ingot', '') + ' Nuggets';
  }

  /**
   * Calculate adjusted (ungapped) ingot count
   * Formula: adjusted_ingots = ingots_shown - (nuggets / nugget_ratio)
   *
   * The backend stores ingots WITH nugget padding included. This function
   * removes that padding to show the true ingot count.
   *
   * @param {number} ingotCount - displayed ingot count (includes nugget padding)
   * @param {number} nuggetCount - actual nugget count
   * @param {string} metalType - metal name for ratio lookup
 * @returns {number} adjusted ingot count (true ingots without nugget padding)
   */
  function calculateAdjustedIngots(ingotCount, nuggetCount, metalType) {
    const ingots = Number(ingotCount) || 0;
    const nuggets = Number(nuggetCount) || 0;
    const ratio = getNuggetRatio(metalType);

    // Soft landing: if no nuggets or invalid ratio, return ingots as-is
 if (nuggets <= 0) return ingots;
    if (ratio <= 0) return ingots;

    // Calculate adjustment: nuggets / ratio gives us the ingot-equivalent to subtract
    const adjustment = nuggets / ratio;

    // Subtract adjustment and prevent negative values
    return Math.max(0, ingots - adjustment);
  }

  /**
   * Find a metal item in a catalog by name
   * Handles both "Silver Ingot" and "Silver Nuggets" lookups
   * Case-insensitive matching
   *
   * @param {Array} catalog - array of { name, buyEach, sellEach, ... }
   * @param {string} itemName - item name to search for
   * @returns {Object|null} catalog item, or null if not found
   */
  function findCatalogItem(catalog, itemName) {
    const name = String(itemName || '').trim();
    if (!name) return null;

    const lower = name.toLowerCase();
    return (catalog || []).find(item =>
      String(item.name || '').trim().toLowerCase() === lower
    ) || null;
  }

  /**
   * Get ingot and nugget items for a metal type from catalog
   * Returns both ingot and nugget catalog entries (or null if missing)
   * Useful for soft landing: if nugget item doesn't exist, system still works
   *
   * @param {Array} catalog - catalog items
   * @param {string} metalType - e.g. "Silver"
   * @returns {Object} { ingotItem: {...}|null, nuggetItem: {...}|null, nuggetItemName: string|null }
 */
  function getMetalItems(catalog, metalType) {
    const metal = String(metalType || '').trim();
    const ingotName = metal + ' Ingot';
    const nuggetName = getNuggetItemName(ingotName); // null for Steel

    return {
      ingotItem: findCatalogItem(catalog, ingotName),
      nuggetItem: nuggetName ? findCatalogItem(catalog, nuggetName) : null,
      nuggetItemName: nuggetName
    };
  }

  /**
   * Extract metal type name from ingot or nugget item name
   * e.g. "Silver Ingot" ? "Silver", "Silver Nuggets" ? "Silver"
   * Useful for identifying which metal we're dealing with
   *
   * @param {string} itemName - e.g. "Silver Ingot" or "Silver Nuggets"
   * @returns {string|null} metal type, or null if unrecognized
   */
  function getMetalTypeFromItemName(itemName) {
    const name = String(itemName || '').trim();
    if (name.includes(' Ingot')) return name.replace(' Ingot', '');
    if (name.includes(' Nuggets')) return name.replace(' Nuggets', '');
    return null;
  }

  /**
   * Determine if an item is a nugget item (not an ingot)
   * Useful for distinguishing between ingot and nugget quantities
   *
   * @param {string} itemName - item name to check
   * @returns {boolean} true if this is a nugget item
   */
  function isNuggetItem(itemName) {
    const name = String(itemName || '').trim();
    return name.includes(' Nuggets');
  }

  /**
   * Determine if an item is an ingot item
   * Useful for identifying which items need adjustment
   *
   * @param {string} itemName - item name to check
   * @returns {boolean} true if this is an ingot item
   */
  function isIngotItem(itemName) {
    const name = String(itemName || '').trim();
    return name.includes(' Ingot');
  }

  // ============================================================
  // Public API
  // ============================================================

  window.MetalsCalculator = {
    // Core calculation
    getNuggetRatio,
  calculateAdjustedIngots,

  // Metal naming & lookup
    getNuggetItemName,
    getMetalTypeFromItemName,
    findCatalogItem,
    getMetalItems,

    // Item type detection
    isNuggetItem,
    isIngotItem,

    // Constants for reference
    DEFAULT_NUGGET_RATIO,
    NUGGET_RATIO_MAP
  };

  // Debug: log initialization
  if (typeof console !== 'undefined' && console.log) {
    console.log('[MetalsCalculator] Initialized. API available at window.MetalsCalculator');
  }
})();
