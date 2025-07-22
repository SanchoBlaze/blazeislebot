const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const farmingHelpers = require('../../modules/farmingHelpers');

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

// Helper: render farm plots to canvas (support 3x3, 4x4, 5x5, and 6x6)
async function renderFarmPlots(farm, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6) {
    // Load base farm image
    let basePath;
    if (is6x6) {
        basePath = path.join(__dirname, '../../assets/farming/farm_6x6.png');
    } else if (is5x5) {
        basePath = path.join(__dirname, '../../assets/farming/farm_5x5.png');
    } else if (is4x4) {
        basePath = path.join(__dirname, '../../assets/farming/farm_4x4.png');
    } else {
        basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
    }
    const baseImage = await loadImage(basePath);
    const canvas = createCanvas(baseImage.width, baseImage.height); // Use base image size
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImage, 0, 0);
    
    // Set plot size based on farm type
    let plotSize;
    if (is6x6) {
        plotSize = 117;
    } else if (is5x5) {
        plotSize = 140;
    } else if (is4x4) {
        plotSize = 170;
    } else {
        plotSize = 225;
    }
    
    for (let i = 0; i < farm.length; i++) {
        const plot = farm[i];
        if (!plot.crop) continue;
        
        const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
        const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
        const rarity = cropItem ? cropItem.rarity : 'common';
        
        // Special handling for weeds
        if (cropType === 'crop_weeds') {
            const img = await loadImage(farmingHelpers.getCropImagePath(cropType));
            ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
            continue;
        }
        
        // Apply watering can boost
        let growthTimes = farmingHelpers.getGrowthTimesForRarity(rarity);
        const wateringBoost = interaction.client.inventory.getWateringBoost(interaction.user.id, interaction.guild.id);
        if (wateringBoost && wateringBoost !== 1) {
            growthTimes = growthTimes.map(t => t * wateringBoost);
        }
        
        const stage = farmingHelpers.getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
        
        // If stage advanced, update DB
        if (stage > (plot.stage || 0)) {
            interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
        }
        
        let img;
        if (stage < 4) {
            img = loadedSharedStages[stage];
        } else {
            const cropStageImagePath = farmingHelpers.getCropImagePath(cropType);
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
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
                ctx.drawImage(fertiliserImg, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
            } else {
                // Other stages: fertiliser below
                ctx.drawImage(fertiliserImg, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
            }
        } else {
            ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
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

// Helper: get plot coordinates for 3x3, 4x4, 5x5, or 6x6
function getPlotCoords(is4x4, is5x5, is6x6) {
    if (is6x6) {
        return [
            { x: 115, y: 130 }, { x: 245, y: 130 }, { x: 380, y: 130 }, { x: 518, y: 130 }, { x: 654, y: 130 }, { x: 786, y: 130 },
            { x: 115, y: 266 }, { x: 245, y: 266 }, { x: 380, y: 266 }, { x: 518, y: 266 }, { x: 654, y: 266 }, { x: 786, y: 266 },
            { x: 115, y: 400 }, { x: 245, y: 400 }, { x: 380, y: 400 }, { x: 518, y: 400 }, { x: 654, y: 400 }, { x: 786, y: 400 },
            { x: 115, y: 532 }, { x: 245, y: 532 }, { x: 380, y: 532 }, { x: 518, y: 532 }, { x: 654, y: 532 }, { x: 786, y: 532 },
            { x: 115, y: 666 }, { x: 245, y: 666 }, { x: 380, y: 666 }, { x: 518, y: 666 }, { x: 654, y: 666 }, { x: 786, y: 666 },
            { x: 115, y: 800 }, { x: 245, y: 800 }, { x: 380, y: 800 }, { x: 518, y: 800 }, { x: 654, y: 800 }, { x: 786, y: 800 }
        ];
    } else if (is5x5) {
        return [
            { x: 138, y: 152 }, { x: 288, y: 152 }, { x: 437, y: 152 }, { x: 592, y: 152 }, { x: 747, y: 152 },
            { x: 138, y: 300 }, { x: 288, y: 300 }, { x: 437, y: 300 }, { x: 592, y: 300 }, { x: 747, y: 300 },
            { x: 138, y: 448 }, { x: 288, y: 448 }, { x: 437, y: 448 }, { x: 592, y: 448 }, { x: 747, y: 448 },
            { x: 138, y: 595 }, { x: 288, y: 595 }, { x: 437, y: 595 }, { x: 592, y: 595 }, { x: 747, y: 595 },
            { x: 138, y: 740 }, { x: 288, y: 740 }, { x: 437, y: 740 }, { x: 592, y: 740 }, { x: 747, y: 740 }
        ];
    } else if (is4x4) {
        return [
            { x: 127, y: 137 }, { x: 325, y: 137 }, { x: 528, y: 137 }, { x: 723, y: 137 },
            { x: 127, y: 315 }, { x: 325, y: 315 }, { x: 528, y: 315 }, { x: 723, y: 315 },
            { x: 127, y: 495 }, { x: 325, y: 495 }, { x: 528, y: 495 }, { x: 723, y: 495 },
            { x: 127, y: 695 }, { x: 325, y: 695 }, { x: 528, y: 695 }, { x: 723, y: 695 }
        ];
    } else {
        return [
            { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
            { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
            { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
        ];
    }
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

const activeSeedCollectors = {};
const activePlotCollectors = {};
const activeFertCollectors = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('farm')
        .setDescription('Farming system commands')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View your farm plot and plant seeds')
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
                await interaction.client.farming.checkForWeedGrowth(interaction.user.id, interaction.guild.id);
                
                // Get real farm data
                const farm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
                const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
                const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
                const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
                const plotCoords = farmingHelpers.getPlotCoords(is4x4, is5x5, is6x6);
                const loadedSharedStages = await farmingHelpers.getSharedStageImages();
                const canvas = await farmingHelpers.renderFarmPlots(farm, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6);
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
            const farm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
            const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
            const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
            const plotCoords = farmingHelpers.getPlotCoords(is4x4, is5x5, is6x6);
            const now = Date.now();
            let infoLines = [];
            for (let i = 0; i < farm.length; i++) {
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
                        let growthTimes = farmingHelpers.getGrowthTimesForRarity(rarity);
                        const wateringBoost = interaction.client.inventory.getWateringBoost(interaction.user.id, interaction.guild.id);
                        if (wateringBoost && wateringBoost !== 1) {
                            growthTimes = growthTimes.map(t => t * wateringBoost);
                        }
                        const stage = farmingHelpers.getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
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
            const farm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
            const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
            const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
            const emptyPlots = interaction.client.farming.getEmptyPlots(farm);
            const plotOptions = emptyPlots
                .filter(i => typeof i === 'number' && i >= 0 && i < (is6x6 ? 36 : is5x5 ? 25 : is4x4 ? 16 : 9))
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
            // Step 1: Seed selection (single select, paginated if >25)
            const maxOptions = 25;
            let seedPage = 0;
            function getSeedPageOptions(page) {
                const start = page * maxOptions;
                const end = start + maxOptions;
                return seedOptions.slice(start, end);
            }
            let currentSeedOptions = getSeedPageOptions(seedPage);
            const seedMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_plant_seed')
                .setPlaceholder('Select a seed to plant')
                .addOptions(currentSeedOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const prevSeedButton = new ButtonBuilder()
                .setCustomId('farm_plant_seed_prev')
                .setLabel('Previous Seeds')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(seedPage === 0);
            const nextSeedButton = new ButtonBuilder()
                .setCustomId('farm_plant_seed_next')
                .setLabel('Next Seeds')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(seedOptions.length <= maxOptions || (seedPage + 1) * maxOptions >= seedOptions.length);
            const seedRows = [
                new ActionRowBuilder().addComponents(seedMenu),
                new ActionRowBuilder().addComponents(prevSeedButton, nextSeedButton)
            ];
            await interaction.update({
                content: 'Select a seed to plant:',
                components: seedRows,
                embeds: [],
                files: [],
                attachments: [],
                flags: MessageFlags.Ephemeral
            });
            const seedFilter = i => i.user.id === interaction.user.id && (
                i.customId === 'farm_plant_seed' ||
                i.customId === 'farm_plant_seed_prev' ||
                i.customId === 'farm_plant_seed_next'
            );
            if (activeSeedCollectors[interaction.user.id]) {
                activeSeedCollectors[interaction.user.id].stop();
                delete activeSeedCollectors[interaction.user.id];
            }
            const seedCollector = interaction.channel.createMessageComponentCollector({ filter: seedFilter, time: 300000 });
            activeSeedCollectors[interaction.user.id] = seedCollector;
            seedCollector.on('end', () => {
                delete activeSeedCollectors[interaction.user.id];
            });
            let selectedSeed = null;
            seedCollector.on('collect', async i => {
                if (i.customId === 'farm_plant_seed_prev') {
                    seedPage = Math.max(0, seedPage - 1);
                    currentSeedOptions = getSeedPageOptions(seedPage);
                    const updatedSeedMenu = new StringSelectMenuBuilder()
                        .setCustomId('farm_plant_seed')
                        .setPlaceholder('Select a seed to plant')
                        .addOptions(currentSeedOptions)
                        .setMinValues(1)
                        .setMaxValues(1);
                    prevSeedButton.setDisabled(seedPage === 0);
                    nextSeedButton.setDisabled(seedOptions.length <= maxOptions || (seedPage + 1) * maxOptions >= seedOptions.length);
                    seedRows[0] = new ActionRowBuilder().addComponents(updatedSeedMenu);
                    seedRows[1] = new ActionRowBuilder().addComponents(prevSeedButton, nextSeedButton);
                    await i.update({
                        content: 'Select a seed to plant:',
                        components: seedRows
                    });
                    return;
                }
                if (i.customId === 'farm_plant_seed_next') {
                    const maxSeedPage = Math.floor((seedOptions.length - 1) / maxOptions);
                    seedPage = Math.min(maxSeedPage, seedPage + 1);
                    currentSeedOptions = getSeedPageOptions(seedPage);
                    const updatedSeedMenu = new StringSelectMenuBuilder()
                        .setCustomId('farm_plant_seed')
                        .setPlaceholder('Select a seed to plant')
                        .addOptions(currentSeedOptions)
                        .setMinValues(1)
                        .setMaxValues(1);
                    prevSeedButton.setDisabled(seedPage === 0);
                    nextSeedButton.setDisabled(seedOptions.length <= maxOptions || (seedPage + 1) * maxOptions >= seedOptions.length);
                    seedRows[0] = new ActionRowBuilder().addComponents(updatedSeedMenu);
                    seedRows[1] = new ActionRowBuilder().addComponents(prevSeedButton, nextSeedButton);
                    await i.update({
                        content: 'Select a seed to plant:',
                        components: seedRows
                    });
                    return;
                }
                if (i.customId === 'farm_plant_seed') {
                    selectedSeed = i.values[0];
                    seedCollector.stop();
                    // Step 2: Plot selection (multi-select, max = number of seeds of selected type)
                    const seedId = selectedSeed.replace('seeds_', '');
                    const seedItem = seeds.find(s => `seeds_${s.id}` === selectedSeed);
                    const maxPlots = Math.min(seedItem ? seedItem.quantity : 1, 25);
                    const emptyPlots = interaction.client.farming.getEmptyPlots(farm);
                    const plotOptions = emptyPlots.map(i => ({
                        label: `Plot ${i + 1}`,
                        value: String(i)
                    })).slice(0, 25); // Only show up to 25 plots at once
                    const plotMenu = new StringSelectMenuBuilder()
                        .setCustomId('farm_plant_plot_multi')
                        .setPlaceholder('Select plots to plant')
                        .addOptions(plotOptions)
                        .setMinValues(1)
                        .setMaxValues(maxPlots);
                    try {
                        await i.update({
                            content: `Select up to ${maxPlots} plots to plant your ${seedItem ? seedItem.name : seedId} seeds:`,
                            components: [new ActionRowBuilder().addComponents(plotMenu)],
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (err) {
                        if (err.code === 10062 || err.code === 40060) {
                            console.warn('Attempted to update an expired or already-responded interaction (plot select step).');
                        } else {
                            throw err;
                        }
                    }
                    // Step 3: Plot selection collector
                    const plotFilter = i2 => i2.user.id === interaction.user.id && i2.customId === 'farm_plant_plot_multi';
                    if (activePlotCollectors[interaction.user.id]) {
                        activePlotCollectors[interaction.user.id].stop();
                        delete activePlotCollectors[interaction.user.id];
                    }
                    const plotCollector = interaction.channel.createMessageComponentCollector({ filter: plotFilter, time: 300000 });
                    activePlotCollectors[interaction.user.id] = plotCollector;
                    plotCollector.on('end', () => {
                        delete activePlotCollectors[interaction.user.id];
                    });
                    plotCollector.on('collect', async i2 => {
                        const selectedPlots = i2.values.map(Number);
                        plotCollector.stop();
                        // Step 4: Fertiliser selection (single select, paginated if >25)
                        let fertPage = 0;
                        function getFertPageOptions(page) {
                            const start = page * maxOptions;
                            const end = start + maxOptions;
                            return fertiliserOptions.slice(start, end);
                        }
                        let currentFertOptions = getFertPageOptions(fertPage);
                        const fertMenu = new StringSelectMenuBuilder()
                            .setCustomId('farm_plant_fertiliser')
                            .setPlaceholder('Select fertiliser (optional)')
                            .addOptions(currentFertOptions)
                            .setMinValues(1)
                            .setMaxValues(1);
                        const prevFertButton = new ButtonBuilder()
                            .setCustomId('farm_plant_fert_prev')
                            .setLabel('Previous Fertilisers')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(fertPage === 0);
                        const nextFertButton = new ButtonBuilder()
                            .setCustomId('farm_plant_fert_next')
                            .setLabel('Next Fertilisers')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(fertiliserOptions.length <= maxOptions || (fertPage + 1) * maxOptions >= fertiliserOptions.length);
                        const fertRows = [
                            new ActionRowBuilder().addComponents(fertMenu),
                            new ActionRowBuilder().addComponents(prevFertButton, nextFertButton)
                        ];
                        try {
                            await i2.update({
                                content: 'Select a fertiliser (optional):',
                                components: fertRows,
                                flags: MessageFlags.Ephemeral
                            });
                        } catch (err) {
                            if (err.code === 10062 || err.code === 40060) {
                                console.warn('Attempted to update an expired or already-responded interaction (fertiliser select step).');
                            } else {
                                throw err;
                            }
                        }
                        // Step 5: Fertiliser selection collector
                        const fertFilter = i3 => i3.user.id === interaction.user.id && (
                            i3.customId === 'farm_plant_fertiliser' ||
                            i3.customId === 'farm_plant_fert_prev' ||
                            i3.customId === 'farm_plant_fert_next'
                        );
                        if (activeFertCollectors[interaction.user.id]) {
                            activeFertCollectors[interaction.user.id].stop();
                            delete activeFertCollectors[interaction.user.id];
                        }
                        const fertCollector = interaction.channel.createMessageComponentCollector({ filter: fertFilter, time: 300000 });
                        activeFertCollectors[interaction.user.id] = fertCollector;
                        fertCollector.on('end', () => {
                            delete activeFertCollectors[interaction.user.id];
                        });
                        let selectedFert = null;
                        fertCollector.on('collect', async i3 => {
                            if (i3.customId === 'farm_plant_fert_prev') {
                                fertPage = Math.max(0, fertPage - 1);
                                currentFertOptions = getFertPageOptions(fertPage);
                                const updatedFertMenu = new StringSelectMenuBuilder()
                                    .setCustomId('farm_plant_fertiliser')
                                    .setPlaceholder('Select fertiliser (optional)')
                                    .addOptions(currentFertOptions)
                                    .setMinValues(1)
                                    .setMaxValues(1);
                                prevFertButton.setDisabled(fertPage === 0);
                                nextFertButton.setDisabled(fertiliserOptions.length <= maxOptions || (fertPage + 1) * maxOptions >= fertiliserOptions.length);
                                fertRows[0] = new ActionRowBuilder().addComponents(updatedFertMenu);
                                fertRows[1] = new ActionRowBuilder().addComponents(prevFertButton, nextFertButton);
                                await i3.update({
                                    content: 'Select a fertiliser (optional):',
                                    components: fertRows
                                });
                                return;
                            }
                            if (i3.customId === 'farm_plant_fert_next') {
                                const maxFertPage = Math.floor((fertiliserOptions.length - 1) / maxOptions);
                                fertPage = Math.min(maxFertPage, fertPage + 1);
                                currentFertOptions = getFertPageOptions(fertPage);
                                const updatedFertMenu = new StringSelectMenuBuilder()
                                    .setCustomId('farm_plant_fertiliser')
                                    .setPlaceholder('Select fertiliser (optional)')
                                    .addOptions(currentFertOptions)
                                    .setMinValues(1)
                                    .setMaxValues(1);
                                prevFertButton.setDisabled(fertPage === 0);
                                nextFertButton.setDisabled(fertiliserOptions.length <= maxOptions || (fertPage + 1) * maxOptions >= fertiliserOptions.length);
                                fertRows[0] = new ActionRowBuilder().addComponents(updatedFertMenu);
                                fertRows[1] = new ActionRowBuilder().addComponents(prevFertButton, nextFertButton);
                                await i3.update({
                                    content: 'Select a fertiliser (optional):',
                                    components: fertRows
                                });
                                return;
                            }
                            if (i3.customId === 'farm_plant_fertiliser') {
                                selectedFert = i3.values[0] !== 'none' ? i3.values[0] : null;
                                fertCollector.stop();
                                // Step 6: Confirm and plant
                                // Remove seeds and plant in all selected plots
                                for (const plotIndex of selectedPlots) {
                                    await interaction.client.inventory.removeItem(interaction.user.id, interaction.guild.id, seedId, 1);
                                    await interaction.client.farming.plantSeed(interaction.user.id, interaction.guild.id, plotIndex, seedId, selectedFert);
                                }
                                const updatedFarm2 = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
                                const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
                                const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
                                const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
                                const plotCoords = farmingHelpers.getPlotCoords(is4x4, is5x5, is6x6);
                                const loadedSharedStages = await farmingHelpers.getSharedStageImages();
                                const canvas = await farmingHelpers.renderFarmPlots(updatedFarm2, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6);
                                const buffer = canvas.toBuffer();
                                const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
                                const embed = new EmbedBuilder()
                                    .setColor(0x00FF00)
                                    .setTitle('🌾 Your Farm')
                                    .setDescription(`Planted ${seedItem ? seedItem.name : seedId} in plots: ${selectedPlots.map(p => p + 1).join(', ')}${selectedFert ? ' with fertiliser' : ''}!`)
                                    .setImage('attachment://farm_preview.png')
                                    .setFooter({ text: 'Your farm has been updated.' })
                                    .setTimestamp();
                                const emptyPlots = interaction.client.farming.getEmptyPlots(updatedFarm2);
                                const readyToHarvest = updatedFarm2.some(plot => plot.crop && (plot.stage || 0) >= 4);
                                const components = buildFarmButtons(emptyPlots, readyToHarvest);
                                await i3.update({
                                    content: '',
                                    embeds: [embed],
                                    files: [attachment],
                                    components,
                                    flags: MessageFlags.Ephemeral
                                });
                                let wormFound = false;
                                let wormAmount = 0;
                                const luckBoost = interaction.client.inventory.getLuckBoost(interaction.user.id, interaction.guild.id);
                                const wormChance = 0.15 * luckBoost; // Base 15% chance, boosted by luck
                                if (Math.random() < wormChance) {
                                    wormFound = true;
                                    wormAmount = Math.floor(Math.random() * 3) + 1; // 1-3 basic bait
                                    await interaction.client.inventory.addItem(interaction.user.id, interaction.guild.id, 'bait_basic', wormAmount);
                                }
                                if (wormFound) {
                                    const wormEmbed = new EmbedBuilder()
                                        .setColor(0x8B4513)
                                        .setTitle('🪱 You Found a Worm!')
                                        .setDescription(`While digging in the soil, you discovered a wriggly worm! You've added **${wormAmount} Basic Bait** to your inventory.`)
                                        .setThumbnail('attachment://worm_thumbnail.png')
                                        .setFooter({ text: 'Worms are great for fishing!' })
                                        .setTimestamp();
                                    if (luckBoost > 1) {
                                        wormEmbed.addFields({
                                            name: '🍀 Luck Boost Active!',
                                            value: `Your worm discovery chance was boosted by ${Math.round((luckBoost - 1) * 100)}%!`,
                                            inline: false
                                        });
                                    }
                                    const wormPath = path.join(__dirname, '../../assets/farming/farm_worm_225.png');
                                    const wormAttachment = new AttachmentBuilder(wormPath, { name: 'worm_thumbnail.png' });
                                    await i3.followUp({
                                        embeds: [wormEmbed],
                                        files: [wormAttachment],
                                        flags: MessageFlags.Ephemeral
                                    });
                                }
                            }
                        });
                    });
                }
            });
            return true;
        }
        if (interaction.customId === 'farm_harvest_all') {
            // Harvest all ready crops
            const farm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
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
            const updatedFarm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
            const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
            const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
            const plotCoords = farmingHelpers.getPlotCoords(is4x4, is5x5, is6x6);
            const loadedSharedStages = await farmingHelpers.getSharedStageImages();
            const canvas = await farmingHelpers.renderFarmPlots(updatedFarm, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6);
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
            await interaction.client.farming.checkForWeedGrowth(interaction.user.id, interaction.guild.id);
            
            // Re-render farm
            const updatedFarm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
            const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
            const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
            const plotCoords = farmingHelpers.getPlotCoords(is4x4, is5x5, is6x6);
            const loadedSharedStages = await farmingHelpers.getSharedStageImages();
            const canvas = await farmingHelpers.renderFarmPlots(updatedFarm, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6);
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
            await interaction.client.farming.checkForWeedGrowth(interaction.user.id, interaction.guild.id);
            
            // Generate and share a snapshot of the farm to the channel (not ephemeral)
            const updatedFarm = await interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const is4x4 = interaction.client.inventory.hasUpgrade('farm_4x4', interaction.user.id, interaction.guild.id);
            const is5x5 = interaction.client.inventory.hasUpgrade('farm_5x5', interaction.user.id, interaction.guild.id);
            const is6x6 = interaction.client.inventory.hasUpgrade('farm_6x6', interaction.user.id, interaction.guild.id);
            const plotCoords = farmingHelpers.getPlotCoords(is4x4, is5x5, is6x6);
            const loadedSharedStages = await farmingHelpers.getSharedStageImages();
            const canvas = await farmingHelpers.renderFarmPlots(updatedFarm, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6);
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
           
        } catch (err) {
            console.error('[farm] Error in handleSelect:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred in the farming select menu.', flags: MessageFlags.Ephemeral });
            }
            return true;
        }
    },
};