// Shared item category dropdowns and filter logic for shop, use, and sell commands

const categoryOptions = [
  {
    label: 'All Items',
    description: 'Show all items',
    value: 'all',
    emoji: '📦'
  },
  {
    label: 'Farming Items',
    description: 'Seeds, watering cans, and fertilisers',
    value: 'farming',
    emoji: '🌾'
  },
  {
    label: 'Seeds',
    description: 'Show only seeds',
    value: 'seed',
    emoji: '🌱'
  },
  {
    label: 'Watering Cans',
    description: 'Show only watering cans',
    value: 'watering_can',
    emoji: '🚿'
  },
  {
    label: 'Fertilisers',
    description: 'Show only fertilisers',
    value: 'fertiliser',
    emoji: '💩'
  },
  {
    label: 'Crops',
    description: 'Show only harvested crops',
    value: 'crop',
    emoji: '🌽'
  },
  {
    label: 'Farm Upgrades',
    description: 'Farm size upgrades and expansions',
    value: 'upgrade',
    emoji: '🏡'
  },
  {
    label: 'Fishing Items',
    description: 'Fishing rods, bait, and equipment',
    value: 'fishing',
    emoji: '🎣'
  },
  {
    label: 'Fishing Rods',
    description: 'Show only fishing rods',
    value: 'fishing_rod',
    emoji: '🎣'
  },
  {
    label: 'Consumables',
    description: 'Show only consumable items',
    value: 'consumable',
    emoji: '⚡'
  },
  {
    label: 'Mystery Boxes',
    description: 'Show only mystery boxes',
    value: 'mystery',
    emoji: '🎁'
  }
];

const fishOption = {
  label: 'Fish',
  description: 'Show only fish items',
  value: 'fish',
  emoji: '🐟'
};

function getDropdownOptions({ includeFish = false, includeUpgrades = false } = {}) {
  let opts = [...categoryOptions];
  
  // Remove upgrade category if not requested
  if (!includeUpgrades) {
    opts = opts.filter(opt => opt.value !== 'upgrade');
  }
  
  if (includeFish) {
    // Insert fish after fishing items
    const idx = opts.findIndex(opt => opt.value === 'fishing');
    opts.splice(idx + 1, 0, fishOption);
  }
  
  return opts;
}

function filterItemsByCategory(items, category) {
  if (category === 'all') return items;
  if (category === 'farming') {
    return items.filter(item =>
      item.type === 'seed' ||
      item.type === 'watering_can' ||
      item.type === 'fertiliser'
    );
  }
  if (category === 'fishing') {
    return items.filter(item =>
      item.type === 'fishing_rod' ||
      item.type === 'fishing_equipment' ||
      (item.type === 'consumable' && item.effect_type === 'fishing_boost')
    );
  }
  if (category === 'fish') {
    return items.filter(item => item.type === 'fish');
  }
  if (category === 'upgrade') {
    return items.filter(item => item.type === 'upgrade');
  }
  // All other categories filter by type
  return items.filter(item => item.type === category);
}

module.exports = {
  getDropdownOptions,
  filterItemsByCategory
}; 