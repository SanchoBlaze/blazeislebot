const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

// Helper: get growth times for rarity
function getGrowthTimesForRarity(rarity) {
    const base = [5, 6, 7, 8];
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const rarityIndex = rarityOrder.indexOf(rarity);
    const extra = rarityIndex > 0 ? rarityIndex * 2 : 0;
    return base.map(min => min + extra);
}

// Helper: get crop image path
function getCropImagePath(cropType) {
    if (cropType === 'crop_weeds') {
        return path.join(__dirname, '../../assets/farming/farm_weeds_225.png');
    } else {
        return path.join(__dirname, `../../assets/farming/farm_${cropType}_225.png`);
    }
}
// Helper: calculate current stage
function getCurrentStage(plantedAt, originalStage, growthTimes) {
    if (!plantedAt || !growthTimes) return 0;
    const now = Date.now();
    let elapsed = now - plantedAt;
    let stage = 0;
    for (let i = 0; i < growthTimes.length; i++) {
        if (elapsed >= growthTimes[i] * 60 * 1000) {
            stage++;
            elapsed -= growthTimes[i] * 60 * 1000;
        } else {
            break;
        }
    }
    return Math.max(stage, originalStage);
}

// Harvest yield table
const harvestYields = {
  common: [3, 4, 5],
  uncommon: [2, 3, 4],
  rare: [1, 2, 3],
  epic: [1, 2],
  legendary: [1]
};

// Fertilisers yield boost chances (decreases as seed rarity goes up)
const fertiliserChances = {
  common: 0.8,    // 80% chance on common crops
  uncommon: 0.6,  // 60% chance on uncommon crops
  rare: 0.4,      // 40% chance on rare crops
  epic: 0.25,     // 25% chance on epic crops
  legendary: 0.15 // 15% chance on legendary crops
};

function getHarvestYield(rarity, fertiliser = null, client = null, guildId = null, cropType = null) {
  // Special handling for weeds
  if (cropType === 'crop_weeds') {
    return Math.floor(Math.random() * 3) + 1; // 1-3 weeds
  }
  
  const options = harvestYields[rarity] || [1];
  let baseYield = options[Math.floor(Math.random() * options.length)];
  
  // Apply fertiliser boost if available
  if (fertiliser && client && guildId) {
    const chance = fertiliserChances[rarity] || 0.1;
    if (Math.random() < chance) {
      // Get fertiliser item to determine boost amount
      const fertiliserItem = client.inventory.getItem(fertiliser, guildId);
      if (fertiliserItem && fertiliserItem.effect_value) {
        // effect_value is the percentage boost (e.g., 50 = 50% boost)
        const boostAmount = Math.max(1, Math.floor(baseYield * (fertiliserItem.effect_value / 100)));
        baseYield += boostAmount;
      }
    }
  }
  
  return baseYield;
}

// Helper: render farm plots to canvas
async function renderFarmPlots(farm, interaction, plotCoords, loadedSharedStages) {
    // Load base farm image
    const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
    const baseImage = await loadImage(basePath);
    const canvas = createCanvas(baseImage.width, baseImage.height); // Use base image size
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImage, 0, 0);
    
    for (let i = 0; i < 9; i++) {
        const plot = farm[i];
        if (!plot.crop) continue;
        
        const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
        const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
        const rarity = cropItem ? cropItem.rarity : 'common';
        
        // Special handling for weeds
        if (cropType === 'crop_weeds') {
            const img = await loadImage(getCropImagePath(cropType));
            ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            continue;
        }
        
        // Apply watering can boost
        let growthTimes = getGrowthTimesForRarity(rarity);
        const wateringBoost = interaction.client.inventory.getWateringBoost(interaction.user.id, interaction.guild.id);
        if (wateringBoost && wateringBoost !== 1) {
            growthTimes = growthTimes.map(t => t * wateringBoost);
        }
        
        const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
        
        // If stage advanced, update DB
        if (stage > (plot.stage || 0)) {
            interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
        }
        
        let img;
        if (stage < 4) {
            img = loadedSharedStages[stage];
        } else {
            const cropStageImagePath = getCropImagePath(cropType);
            img = await loadImage(cropStageImagePath);
        }
        
        // --- FERTILISER OVERLAY LOGIC ---
        let fertiliserImg = null;
        if (plot.fertiliser) {
            const fertType = plot.fertiliser.replace('fertiliser_', '');
            const fertPath = path.join(__dirname, `../../assets/farming/farm_fertiliser_${fertType}_225.png`);
            if (fs.existsSync(fertPath)) {
                fertiliserImg = await loadImage(fertPath);
            }
        }
        
        if (fertiliserImg) {
            if (stage === 0) {
                // Planted: fertiliser on top
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
                ctx.drawImage(fertiliserImg, plotCoords[i].x, plotCoords[i].y, 225, 225);
            } else {
                // Other stages: fertiliser below
                ctx.drawImage(fertiliserImg, plotCoords[i].x, plotCoords[i].y, 225, 225);
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
        } else {
            ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
        }
    }
    
    return canvas;
}

// Helper: get shared stage images
async function getSharedStageImages() {
    const sharedStageImages = [
        'farm_planted_225.png',      // stage 0
        'farm_sprout_225.png',       // stage 1
        'farm_growing_225.png',      // stage 2
        'farm_almost_grown_225.png'  // stage 3
    ];
    return await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
}

// Helper: get plot coordinates
function getPlotCoords() {
    return [
        { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
        { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
        { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
    ];
}

// Helper: build farm buttons
function buildFarmButtons(emptyPlots, readyToHarvest) {
    const buttonRow = new ActionRowBuilder();
    
    if (emptyPlots.length > 0) {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('farm_plant')
                .setLabel('🌱 Plant Seed')
                .setStyle(ButtonStyle.Success)
        );
    }
    
    if (readyToHarvest) {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('farm_harvest_all')
                .setLabel('🌾 Harvest All')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    buttonRow.addComponents(
        new ButtonBuilder()
            .setCustomId('farm_refresh')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary)
    );
    
    buttonRow.addComponents(
        new ButtonBuilder()
            .setCustomId('farm_share')
            .setLabel('📸 Share')
            .setStyle(ButtonStyle.Secondary)
    );
    
    return [buttonRow];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('farm')
        .setDescription('Farming system commands')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View your 3x3 farm plot and plant seeds')
        )
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Show details about what is planted in each plot, stage, and time left to grow')
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('Show your farming statistics')
        ),

    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return false;
        const sub = interaction.options.getSubcommand();
        if (sub === 'view') {
            await interaction.reply({
                content: '🌾 Generating your farm plot, please wait...',
                flags: MessageFlags.Ephemeral
            });
            try {
                // Check for weed growth on empty plots
                interaction.client.farming.checkForWeedGrowth(interaction.user.id, interaction.guild.id);
                
                // Get real farm data
                const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
                const plotCoords = getPlotCoords();
                const loadedSharedStages = await getSharedStageImages();
                const canvas = await renderFarmPlots(farm, interaction, plotCoords, loadedSharedStages);
                const buffer = canvas.toBuffer();
                const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🌾 Your Farm')
                    .setDescription('Your real farm plots and growth stages!')
                    .setImage('attachment://farm_preview.png')
                    .setFooter({ text: 'Ready for dynamic farming!' })
                    .setTimestamp();
                const emptyPlots = interaction.client.farming.getEmptyPlots(farm);
                const readyToHarvest = farm.some(plot => plot.crop && (plot.stage || 0) >= 4);
                const components = buildFarmButtons(emptyPlots, readyToHarvest);
                await interaction.editReply({ content: '', embeds: [embed], files: [attachment], components });
            } catch (error) {
                console.error('Error in farm command:', error);
                try {
                    await interaction.editReply({ content: 'There was an error displaying your farm image!', embeds: [], files: [], components: [] });
                } catch {}
            }
        } else if (sub === 'info') {
            // /farm info logic
            const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const now = Date.now();
            let infoLines = [];
            for (let i = 0; i < 9; i++) {
                const plot = farm[i];
                let line = `**Plot ${i + 1}:** `;
                if (!plot.crop) {
                    line += 'Empty';
                } else {
                    const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                    const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                    const rarity = cropItem ? cropItem.rarity : 'common';
                    
                    // Special handling for weeds
                    if (cropType === 'crop_weeds') {
                        line += `🌿 Weeds | Fully grown!`;
                    } else {
                        let growthTimes = getGrowthTimesForRarity(rarity);
                        const wateringBoost = interaction.client.inventory.getWateringBoost(interaction.user.id, interaction.guild.id);
                        if (wateringBoost && wateringBoost !== 1) {
                            growthTimes = growthTimes.map(t => t * wateringBoost);
                        }
                        const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
                        const totalStages = growthTimes.length + 1;
                        
                        // Calculate time left to next stage and to fully grown
                        let elapsed = now - plot.planted_at;
                        if (isNaN(elapsed) || elapsed < 0) elapsed = 0;
                        let timeToNextStage = 0;
                        let timeToFull = 0;
                        for (let s = 0; s < totalStages - 1; s++) {
                            const stageMs = growthTimes[s] * 60 * 1000;
                            if (s < stage) {
                                elapsed -= stageMs;
                            } else if (s === stage) {
                                timeToNextStage = Math.max(0, stageMs - elapsed);
                                timeToFull += timeToNextStage;
                            } else {
                                timeToFull += stageMs;
                            }
                        }
                        // Defensive: if timeToFull is NaN, set to 0
                        if (isNaN(timeToFull)) timeToFull = 0;
                        // Format times
                        function formatMs(ms) {
                            const min = Math.floor(ms / 60000);
                            const sec = Math.floor((ms % 60000) / 1000);
                            return `${min}m ${sec}s`;
                        }
                        const cropName = cropItem ? cropItem.name : cropType;
                        line += `${cropName} | Stage ${Math.min(stage + 1, totalStages)}/${totalStages}`;
                        
                        // Add fertiliser information
                        if (plot.fertiliser) {
                            const fertiliserItem = interaction.client.inventory.getItem(plot.fertiliser, interaction.guild.id);
                            const fertiliserName = fertiliserItem ? fertiliserItem.name : 'Fertilisers';
                            const fertiliserEmoji = fertiliserItem ? fertiliserItem.emoji : '💩';
                            line += ` | ${fertiliserEmoji} ${fertiliserName}`;
                        }
                        
                        if (stage < totalStages - 1) {
                            line += ` | Next: ${formatMs(timeToNextStage)}, Full: ${formatMs(timeToFull)}`;
                        } else {
                            line += ' | Fully grown!';
                        }
                    }
                }
                infoLines.push(line);
            }
            const bestCan = interaction.client.inventory.getBestWateringCan(interaction.user.id, interaction.guild.id);
            let wateringCanInfo = '';
            let wateringCanEmoji = null;
            let wateringCanThumbnail = null;
            if (bestCan) {
                const percent = Math.round((1 - bestCan.effect_value) * 100);
                wateringCanInfo = `\n💧 **Watering Can:** ${bestCan.emoji || '🪣'} ${bestCan.name} (${percent}% faster)`;
                wateringCanEmoji = bestCan.emoji || '🪣';
                wateringCanThumbnail = interaction.client.inventory.getEmojiUrl(wateringCanEmoji, interaction.client);
            }
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌾 Farm Info')
                .setDescription(infoLines.join('\n') + (wateringCanInfo ? wateringCanInfo : ''))
                .setFooter({ text: 'Shows what is planted, stage, and time left for each plot.' })
                .setTimestamp();
            if (wateringCanThumbnail) {
                embed.setThumbnail(wateringCanThumbnail);
            }
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else if (sub === 'stats') {
            const stats = interaction.client.farming.getFarmStats(interaction.user.id, interaction.guild.id);
            // Get per-item stats
            const allSeeds = interaction.client.farming.getFarmItemStats(interaction.user.id, interaction.guild.id, 'seed');
            const allCrops = interaction.client.farming.getFarmItemStats(interaction.user.id, interaction.guild.id, 'crop');
            const allFerts = interaction.client.farming.getFarmItemStats(interaction.user.id, interaction.guild.id, 'fertiliser');
            // Helper to get item name/emoji
            function getItemDisplay(itemId, type, variant = null) {
                // Remove prefix if present
                let baseId = itemId;
                if (type === 'seed' && itemId.startsWith('seeds_')) baseId = itemId.slice(6);
                if (type === 'crop' && itemId.startsWith('crop_')) baseId = itemId.slice(5);
                const lookupId = type === 'seed' ? `seeds_${baseId}` : (type === 'crop' ? `crop_${baseId}` : baseId);
                const item = interaction.client.inventory.getItem(lookupId, interaction.guild.id);
                if (!item) return itemId;
                let display = `${item.emoji || ''} ${item.name}`;
                if (variant && type === 'crop') {
                    const completeItem = interaction.client.inventory.getCompleteItem(lookupId, interaction.guild.id);
                    if (completeItem && completeItem.variants) {
                        const variantData = completeItem.variants.find(v => v.id === variant);
                        if (variantData) {
                            display = `${variantData.emoji || item.emoji || ''} ${variantData.name || item.name}`;
                        }
                    }
                }
                return display;
            }
            
            // Create detailed stats embed
            const embed = new EmbedBuilder()
                .setColor(0x32CD32)
                .setTitle('🌱 Your Complete Farming Statistics')
                .addFields(
                    { name: '📊 Overall Stats', value: 
                        `🌾 **Crops Harvested:** ${stats.crops_harvested}\n` +
                        `🌱 **Seeds Planted:** ${stats.seeds_planted}\n` +
                        `💩 **Fertilisers Used:** ${stats.fertilisers_used}`, inline: false }
                );
            
            // Add seeds section
            if (allSeeds.length > 0) {
                // Deduplicate by base seed id
                const seedMap = new Map();
                for (const s of allSeeds) {
                    const baseSeedId = s.item_id.startsWith('seeds_') ? s.item_id.slice(6) : s.item_id;
                    if (!seedMap.has(baseSeedId)) {
                        seedMap.set(baseSeedId, { ...s, count: s.count });
                    } else {
                        seedMap.get(baseSeedId).count += s.count;
                    }
                }
                const seedsText = Array.from(seedMap.values()).map(s => `• ${getItemDisplay(s.item_id, 'seed')}: ${s.count}`).join('\n');
                embed.addFields({ name: `🌱 Seeds Planted (${seedMap.size} types)`, value: seedsText, inline: false });
            } else {
                embed.addFields({ name: '🌱 Seeds Planted', value: 'No seeds planted yet!', inline: false });
            }
            
            // Add crops section
            if (allCrops.length > 0) {
                // Group and sum crops by item_id and variant
                const cropStatsMap = new Map();
                for (const c of allCrops) {
                    // Always use base crop id for grouping
                    const baseCropId = c.item_id.startsWith('crop_') ? c.item_id.slice(5) : c.item_id;
                    const key = `${baseCropId}__${c.variant || ''}`;
                    if (!cropStatsMap.has(key)) {
                        cropStatsMap.set(key, { ...c, item_id: baseCropId });
                    } else {
                        cropStatsMap.get(key).count += c.count;
                    }
                }
                // Build a map of cropId -> { hasVariants: bool, variants: Set, base: stat }
                const cropVariantMap = new Map();
                for (const c of cropStatsMap.values()) {
                    const cropId = c.item_id;
                    if (!cropVariantMap.has(cropId)) {
                        cropVariantMap.set(cropId, { hasVariants: false, variants: new Set(), base: null });
                    }
                    if (c.variant) {
                        cropVariantMap.get(cropId).hasVariants = true;
                        cropVariantMap.get(cropId).variants.add(`${c.variant}`);
                    } else {
                        cropVariantMap.get(cropId).base = c;
                    }
                }
                const cropsText = [];
                for (const [cropId, info] of cropVariantMap.entries()) {
                    const cropItem = interaction.client.inventory.getCompleteItem(`crop_${cropId}`, interaction.guild.id);
                    if (info.hasVariants) {
                        // Show only variants
                        for (const c of cropStatsMap.values()) {
                            if (c.item_id === cropId && c.variant) {
                                const cropName = cropItem ? interaction.client.inventory.getDisplayName(cropItem, c.variant) : c.item_id;
                                const cropEmoji = cropItem ? interaction.client.inventory.getDisplayEmoji(cropItem, c.variant) : '🌾';
                                cropsText.push(`• ${cropEmoji} ${cropName}: ${c.count}`);
                            }
                        }
                    } else if (info.base) {
                        // Show base crop (no variants)
                        const c = info.base;
                        const cropName = cropItem ? interaction.client.inventory.getDisplayName(cropItem, null) : c.item_id;
                        const cropEmoji = cropItem ? interaction.client.inventory.getDisplayEmoji(cropItem, null) : '🌾';
                        cropsText.push(`• ${cropEmoji} ${cropName}: ${c.count}`);
                    }
                }
                embed.addFields({ name: `🌾 Crops Harvested (${cropStatsMap.size} types)`, value: cropsText.join('\n'), inline: false });
            } else {
                embed.addFields({ name: '🌾 Crops Harvested', value: 'No crops harvested yet!', inline: false });
            }
            
            // Add fertilisers section
            if (allFerts.length > 0) {
                const fertsText = allFerts.map(f => `• ${getItemDisplay(f.item_id, 'fertiliser')}: ${f.count}`).join('\n');
                embed.addFields({ name: `💩 Fertilisers Used (${allFerts.length} types)`, value: fertsText, inline: false });
            } else {
                embed.addFields({ name: '💩 Fertilisers Used', value: 'No fertilisers used yet!', inline: false });
            }
            
            embed.setFooter({ text: 'Complete farming statistics - keep growing!' })
                .setTimestamp();
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }
    },

    // Button handler
    async handleButtonInteraction(interaction) {
        if (interaction.customId === 'farm_plant') {
            const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const emptyPlots = interaction.client.farming.getEmptyPlots(farm);
            const plotOptions = emptyPlots
                .filter(i => typeof i === 'number' && i >= 0 && i < 9)
                .map(i => ({ label: `Plot ${i + 1}`, value: String(i) }));
            if (plotOptions.length === 0) {
                await interaction.reply({
                    content: 'All your plots are full! Harvest a crop before planting more.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }
            // Get user's seeds from inventory
            const inventory = interaction.client.inventory.getUserInventory(interaction.user.id, interaction.guild.id);
            const seeds = inventory.filter(item => item.type === 'seed' && item.quantity > 0);
            const seedOptions = seeds.map(seed => ({
                label: seed.name,
                value: `seeds_${seed.id}`,
                emoji: seed.emoji || '🌱'
            }));
            if (seedOptions.length === 0) {
                await interaction.reply({
                    content: 'You have no seeds! Buy some from the shop before planting.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }
            // Fertiliser options (unique)
            const fertilisers = inventory.filter(item => item.type === 'fertiliser' && item.quantity > 0);
            const fertiliserOptions = [
                { label: 'No Fertilisers', value: 'none', emoji: '❌' }
            ];
            const seenFertIds = new Set();
            fertilisers.forEach(fertiliser => {
                if (!seenFertIds.has(fertiliser.id)) {
                    fertiliserOptions.push({
                        label: fertiliser.name,
                        value: fertiliser.id,
                        emoji: fertiliser.emoji || '💩'
                    });
                    seenFertIds.add(fertiliser.id);
                }
            });
            // Build all three dropdowns with unique custom_ids
            const seedMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_plant_seed')
                .setPlaceholder('Select a seed to plant')
                .addOptions(seedOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const plotMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_plant_plot')
                .setPlaceholder('Select a plot')
                .addOptions(plotOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const fertiliserMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_plant_fertiliser')
                .setPlaceholder('Select fertiliser') // Remove 'optional'
                .addOptions(fertiliserOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const selectRows = [
                new ActionRowBuilder().addComponents(seedMenu),
                new ActionRowBuilder().addComponents(plotMenu),
                new ActionRowBuilder().addComponents(fertiliserMenu)
            ];
            // Store a temporary selection state for the user
            if (!interaction.client._farmSelections) interaction.client._farmSelections = {};
            interaction.client._farmSelections[interaction.user.id] = {};
            await interaction.update({
                content: 'Select a seed, plot, and fertiliser (optional) to plant:',
                components: selectRows,
                embeds: [],
                files: [],
                attachments: []
            });
            return true;
        }
        if (interaction.customId === 'farm_harvest_all') {
            // Harvest all ready crops
            const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            let harvested = [];
            let totalHarvested = 0;
            for (let i = 0; i < farm.length; i++) {
                const plot = farm[i];
                if (plot.crop && (plot.stage || 0) >= 4) {
                    // Get crop item data (single lookup)
                    const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                    const seedItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id);
                    const cropItem = interaction.client.inventory.getCompleteItem(`crop_${cropType}`, interaction.guild.id);
                    const rarity = seedItem ? seedItem.rarity : 'common';
                    const yieldAmount = getHarvestYield(rarity, plot.fertiliser, interaction.client, interaction.guild.id, cropType);
                    // Add crop to inventory with optimized variant handling
                    let itemId;
                    let variantQuantities = null; // Always define
                    if (cropType === 'crop_weeds') {
                        itemId = 'crop_weeds';
                    } else {
                        itemId = `crop_${cropType}`;
                    }

                    if (cropType === 'crop_weeds') {
                        // Weeds don't have variants, add directly
                        await interaction.client.inventory.addItem(
                            interaction.user.id,
                            interaction.guild.id,
                            itemId,
                            yieldAmount
                        );
                        // Increment per-crop stat for weeds
                        if (interaction.client.farming.incrementFarmItemStat) {
                            interaction.client.farming.incrementFarmItemStat(interaction.user.id, interaction.guild.id, 'crop', itemId, yieldAmount);
                        }
                    } else if (cropItem && cropItem.variants && cropItem.variants.length > 0) {
                        // Defensive: ensure variants array is not empty
                        if (cropItem.variants.length === 0) {
                            console.warn(`[Harvest] No variants found for crop ${itemId}! Skipping harvest for this crop.`);
                            continue; // Skip this crop if no variants are defined
                        }
                        // Randomly select variants for the yield amount
                        variantQuantities = {};
                        for (let i = 0; i < yieldAmount; i++) {
                            const randomVariant = cropItem.variants[Math.floor(Math.random() * cropItem.variants.length)];
                            const variantId = randomVariant.id;
                            variantQuantities[variantId] = (variantQuantities[variantId] || 0) + 1;
                        }
                        
                        // Use optimized variant storage
                        await interaction.client.inventory.addItem(
                            interaction.user.id,
                            interaction.guild.id,
                            itemId,
                            yieldAmount,
                            null,
                            null,
                            null,
                            variantQuantities
                        );
                        // Increment per-variant crop stats
                        if (interaction.client.farming.incrementFarmItemStat) {
                            for (const [variantId, quantity] of Object.entries(variantQuantities)) {
                                interaction.client.farming.incrementFarmItemStat(interaction.user.id, interaction.guild.id, 'crop', itemId, quantity, variantId);
                            }
                        }
                    } else {
                        // No variants, use regular addItem
                        await interaction.client.inventory.addItem(
                            interaction.user.id,
                            interaction.guild.id,
                            itemId,
                            yieldAmount
                        );
                        // Increment per-crop stat (no variant)
                        if (interaction.client.farming.incrementFarmItemStat) {
                            interaction.client.farming.incrementFarmItemStat(interaction.user.id, interaction.guild.id, 'crop', itemId, yieldAmount);
                        }
                    }
                    // Clear the plot
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { crop: null, stage: 0, planted_at: null, fertiliser: null });
                    harvested.push({ 
                        crop: cropType, 
                        amount: yieldAmount, 
                        variant: null, // We don't track individual variants in harvested array
                        variantQuantities: variantQuantities,
                        fertiliser: plot.fertiliser 
                    });
                    totalHarvested += yieldAmount;
                }
            }
            if (harvested.length === 0) {
                await interaction.update({
                    content: 'No crops are ready to harvest!',
                    components: [],
                    embeds: [],
                    files: [],
                    attachments: []
                });
                return true;
            }
            // Increment farm leaderboard stats
            interaction.client.farming.incrementFarmHarvest(interaction.user.id, interaction.guild.id, totalHarvested);
            // Re-render farm after harvest
            const updatedFarm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const plotCoords = getPlotCoords();
            const loadedSharedStages = await getSharedStageImages();
            const canvas = await renderFarmPlots(updatedFarm, interaction, plotCoords, loadedSharedStages);
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
            // Build harvest message with emojis
            const harvestMessages = harvested.map(h => {
                // Get the crop item data to get the emoji and display name (single lookup)
                const cropItem = interaction.client.inventory.getCompleteItem(`crop_${h.crop}`, interaction.guild.id);
                let message = '';
                // Special case for weeds
                if (h.crop === 'crop_weeds') {
                    // Use getDisplayEmoji to fetch the correct emoji from config
                    const weedsEmoji = cropItem ? interaction.client.inventory.getDisplayEmoji(cropItem, null) : '🌿';
                    const weedsName = cropItem && cropItem.name ? cropItem.name : 'Weeds';
                    message = `**${h.amount}** ${weedsEmoji} ${weedsName}`;
                } else if (h.variantQuantities && Object.keys(h.variantQuantities).length > 0) {
                    // Display each variant separately
                    const variantMessages = [];
                    for (const [variantId, quantity] of Object.entries(h.variantQuantities)) {
                        const emoji = cropItem ? interaction.client.inventory.getDisplayEmoji(cropItem, variantId) : '🌾';
                        const cropName = cropItem ? interaction.client.inventory.getDisplayName(cropItem, variantId) : h.crop.charAt(0).toUpperCase() + h.crop.slice(1);
                        variantMessages.push(`**${quantity}** ${emoji} ${cropName}`);
                    }
                    message = variantMessages.join(', ');
                } else if (h.variant) {
                    // Single variant (if tracked)
                    const emoji = cropItem ? interaction.client.inventory.getDisplayEmoji(cropItem, h.variant) : '🌾';
                    const cropName = cropItem ? interaction.client.inventory.getDisplayName(cropItem, h.variant) : h.crop.charAt(0).toUpperCase() + h.crop.slice(1);
                    message = `**${h.amount}** ${emoji} ${cropName}`;
                } else {
                    // No variants - use default item display
                    const emoji = cropItem ? cropItem.emoji : '🌾';
                    const cropName = cropItem ? cropItem.name : h.crop.charAt(0).toUpperCase() + h.crop.slice(1);
                    message = `**${h.amount}** ${emoji} ${cropName}`;
                }
                // Add fertiliser indicator if used
                if (h.fertiliser) {
                    const fertiliserItem = interaction.client.inventory.getItem(h.fertiliser, interaction.guild.id);
                    const fertiliserEmoji = fertiliserItem ? fertiliserItem.emoji : '💩';
                    message += ` ${fertiliserEmoji}`;
                }
                return message;
            });

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌾 Your Farm')
                .setDescription(`You harvested: ${harvestMessages.join(', ')}!`)
                .setImage('attachment://farm_preview.png')
                .setFooter({ text: 'Your farm has been updated.' })
                .setTimestamp();
            // Rebuild components (plant/harvest/refresh/share buttons)
            const emptyPlots = interaction.client.farming.getEmptyPlots(updatedFarm);
            const readyToHarvest = updatedFarm.some(plot => plot.crop && (plot.stage || 0) >= 4);
            const components = buildFarmButtons(emptyPlots, readyToHarvest);
            await interaction.update({
                content: '',
                embeds: [embed],
                files: [attachment],
                components
            });
            return true;
        }
        if (interaction.customId === 'farm_refresh') {
            // Check for weed growth on empty plots
            interaction.client.farming.checkForWeedGrowth(interaction.user.id, interaction.guild.id);
            
            // Re-render farm
            const updatedFarm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const plotCoords = getPlotCoords();
            const loadedSharedStages = await getSharedStageImages();
            const canvas = await renderFarmPlots(updatedFarm, interaction, plotCoords, loadedSharedStages);
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌾 Your Farm')
                .setDescription('Your real farm plots and growth stages!')
                .setImage('attachment://farm_preview.png')
                .setFooter({ text: 'Ready for dynamic farming!' })
                .setTimestamp();
            // Rebuild components (plant/harvest/refresh/share buttons)
            const emptyPlots = interaction.client.farming.getEmptyPlots(updatedFarm);
            const readyToHarvest = updatedFarm.some(plot => plot.crop && (plot.stage || 0) >= 4);
            const components = buildFarmButtons(emptyPlots, readyToHarvest);
            await interaction.update({
                content: '',
                embeds: [embed],
                files: [attachment],
                components
            });
            return true;
        }
        if (interaction.customId === 'farm_share') {
            // Check for weed growth on empty plots
            interaction.client.farming.checkForWeedGrowth(interaction.user.id, interaction.guild.id);
            
            // Generate and share a snapshot of the farm to the channel (not ephemeral)
            const updatedFarm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const plotCoords = getPlotCoords();
            const loadedSharedStages = await getSharedStageImages();
            const canvas = await renderFarmPlots(updatedFarm, interaction, plotCoords, loadedSharedStages);
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'farm_snapshot.png' });
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌾 Farm Snapshot')
                .setDescription(`${interaction.user.username}'s farm!`)
                .setImage('attachment://farm_snapshot.png')
                .setTimestamp();
            await interaction.channel.send({
                content: `🌾 ${interaction.user} shared their farm!`,
                embeds: [embed],
                files: [attachment]
            });
            await interaction.update({});
            return true;
        }
        return false;
    },

    // Select menu handler
    async handleSelect(interaction) {
        try {
            console.log('[farm] handleSelect triggered:', interaction.customId);
            // Handle seed selection
            if (interaction.customId === 'farm_plant_seed') {
                console.log('[farm] farm_plant_seed handler called');
                if (!interaction.client._farmSelections) interaction.client._farmSelections = {};
                if (!interaction.client._farmSelections[interaction.user.id]) interaction.client._farmSelections[interaction.user.id] = {};
                interaction.client._farmSelections[interaction.user.id].seed = interaction.values[0];
                await interaction.deferUpdate();
                return true;
            }
            // Handle plot selection
            if (interaction.customId === 'farm_plant_plot') {
                console.log('[farm] farm_plant_plot handler called');
                if (!interaction.client._farmSelections) interaction.client._farmSelections = {};
                if (!interaction.client._farmSelections[interaction.user.id]) interaction.client._farmSelections[interaction.user.id] = {};
                interaction.client._farmSelections[interaction.user.id].plot = interaction.values[0];
                await interaction.deferUpdate();
                return true;
            }
            // Handle fertiliser selection and finalise planting
            if (interaction.customId === 'farm_plant_fertiliser') {
                console.log('[farm] farm_plant_fertiliser handler called');
                if (!interaction.client._farmSelections) interaction.client._farmSelections = {};
                if (!interaction.client._farmSelections[interaction.user.id]) interaction.client._farmSelections[interaction.user.id] = {};
                interaction.client._farmSelections[interaction.user.id].fertiliser = interaction.values[0];
                const selection = interaction.client._farmSelections[interaction.user.id];
                if (!selection.seed || !selection.plot) {
                    await interaction.reply({ content: 'Please select both a seed and a plot before planting.', flags: MessageFlags.Ephemeral });
                    return true;
                }
                const seedId = selection.seed.replace('seeds_', '');
                const plotIndex = parseInt(selection.plot, 10);
                let fertiliserId = null;
                if (selection.fertiliser && selection.fertiliser !== 'none') {
                    fertiliserId = selection.fertiliser;
                }
                // Remove seed from inventory
                await interaction.client.inventory.removeItem(interaction.user.id, interaction.guild.id, seedId, 1);
                // Remove fertiliser from inventory if selected
                if (fertiliserId) {
                    await interaction.client.inventory.removeItem(interaction.user.id, interaction.guild.id, fertiliserId, 1);
                }
                // Plant the seed with fertiliser
                await interaction.client.farming.plantSeed(interaction.user.id, interaction.guild.id, plotIndex, seedId, fertiliserId);
                // Increment farming stats
                interaction.client.farming.incrementSeedsPlanted(interaction.user.id, interaction.guild.id, 1);
                if (interaction.client.farming.incrementFarmItemStat) {
                    interaction.client.farming.incrementFarmItemStat(interaction.user.id, interaction.guild.id, 'seed', seedId, 1);
                }
                if (fertiliserId) {
                    interaction.client.farming.incrementFertilisersUsed(interaction.user.id, interaction.guild.id, 1);
                    if (interaction.client.farming.incrementFarmItemStat) {
                        interaction.client.farming.incrementFarmItemStat(interaction.user.id, interaction.guild.id, 'fertiliser', fertiliserId, 1);
                    }
                }

                // Check for random worm chance (15% chance)
                let wormFound = false;
                let wormAmount = 0;
                if (Math.random() < 0.15) {
                    wormFound = true;
                    wormAmount = Math.floor(Math.random() * 3) + 1; // 1-3 basic bait
                    await interaction.client.inventory.addItem(interaction.user.id, interaction.guild.id, 'bait_basic', wormAmount);
                }

                delete interaction.client._farmSelections[interaction.user.id];
                // Re-render farm after planting
                const updatedFarm2 = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
                const plotCoords = getPlotCoords();
                const loadedSharedStages = await getSharedStageImages();
                const canvas = await renderFarmPlots(updatedFarm2, interaction, plotCoords, loadedSharedStages);
                const buffer = canvas.toBuffer();
                const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🌾 Your Farm')
                    .setDescription(`Planted ${seedId.replace('_', ' ')} in Plot ${plotIndex + 1}!${fertiliserId ? ' Used fertiliser!' : ''}`)
                    .setImage('attachment://farm_preview.png')
                    .setFooter({ text: 'Your farm has been updated.' })
                    .setTimestamp();
                // Rebuild components (plant/harvest/refresh/share buttons)
                const emptyPlots = interaction.client.farming.getEmptyPlots(updatedFarm2);
                const readyToHarvest = updatedFarm2.some(plot => plot.crop && (plot.stage || 0) >= 4);
                const components = buildFarmButtons(emptyPlots, readyToHarvest);
                await interaction.update({
                    content: '',
                    embeds: [embed],
                    files: [attachment],
                    components,
                    flags: MessageFlags.Ephemeral
                });

                // Send worm message if found
                if (wormFound) {
                    const wormEmbed = new EmbedBuilder()
                        .setColor(0x8B4513) // Brown color for worms
                        .setTitle('🪱 You Found a Worm!')
                        .setDescription(`While digging in the soil, you discovered a wriggly worm! You've added **${wormAmount} Basic Bait** to your inventory.`)
                        .setThumbnail('attachment://worm_thumbnail.png')
                        .setFooter({ text: 'Worms are great for fishing!' })
                        .setTimestamp();

                    // Create worm thumbnail attachment
                    const wormPath = path.join(__dirname, '../../assets/farming/farm_worm_225.png');
                    const wormAttachment = new AttachmentBuilder(wormPath, { name: 'worm_thumbnail.png' });

                    await interaction.followUp({
                        embeds: [wormEmbed],
                        files: [wormAttachment],
                        flags: MessageFlags.Ephemeral
                    });
                }
                return true;
            }
        } catch (err) {
            console.error('[farm] Error in handleSelect:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred in the farming select menu.', flags: MessageFlags.Ephemeral });
            }
            return true;
        }
    },
};