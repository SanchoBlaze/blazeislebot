const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// Helper: get growth times for rarity
function getGrowthTimesForRarity(rarity) {
    const base = [5, 6, 7, 8];
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const rarityIndex = rarityOrder.indexOf(rarity);
    const extra = rarityIndex > 0 ? rarityIndex * 2 : 0;
    return base.map(min => min + extra);
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
function getHarvestYield(rarity) {
  const options = harvestYields[rarity] || [1];
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('farm')
        .setDescription('View your 3x3 farm plot and plant seeds'),

    // Only handle slash commands here!
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return false;
        await interaction.reply({
            content: '🌾 Generating your farm plot, please wait...',
            flags: MessageFlags.Ephemeral
        });
        try {
            // Get real farm data
            const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');

            const baseImage = await loadImage(basePath);
            const plotCoords = [
                { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
                { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
                { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
            ];
            const canvas = createCanvas(baseImage.width, baseImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImage, 0, 0);
            // Preload shared images for stages 0-3
            const sharedStageImages = [
                'farm_planted_225.png',      // stage 0
                'farm_sprout_225.png',       // stage 1
                'farm_growing_225.png',      // stage 2
                'farm_almost_grown_225.png'  // stage 3
            ];
            const loadedSharedStages = await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
            for (let i = 0; i < 9; i++) {
                const plot = farm[i];
                if (!plot.crop) continue; // Don't draw a stage image for empty plots
                // Get crop item data
                const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop; // e.g., 'wheat' or 'corn'
                const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                const rarity = cropItem ? cropItem.rarity : 'common';
                const growthTimes = getGrowthTimesForRarity(rarity);
                const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
                // If stage advanced, update DB
                if (stage > (plot.stage || 0)) {
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
                }
                let img;
                if (stage < 4) {
                    img = loadedSharedStages[stage];
                } else {
                    // Final stage: use crop-specific image
                    const cropStageImagePath = path.join(__dirname, `../../assets/farming/farm_${cropType}_225.png`);
                    img = await loadImage(cropStageImagePath);
                }
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
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
            // Add Plant, Harvest, Refresh, and Share buttons in a single row
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
            const components = [buttonRow];
            await interaction.editReply({ content: '', embeds: [embed], files: [attachment], components });
        } catch (error) {
            console.error('Error in farm command:', error);
            try {
                await interaction.editReply({ content: 'There was an error displaying your farm image!', embeds: [], files: [], components: [] });
            } catch {}
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
                    ephemeral: true
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
                    ephemeral: true
                });
                return true;
            }
            const seedMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_seed_select')
                .setPlaceholder('Select a seed to plant')
                .addOptions(seedOptions);
            const plotMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_plot_select')
                .setPlaceholder('Select a plot')
                .addOptions(plotOptions);
            const selectRows = [
                new ActionRowBuilder().addComponents(seedMenu),
                new ActionRowBuilder().addComponents(plotMenu)
            ];
            await interaction.update({
                content: 'Choose a seed and an empty plot to plant:',
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
                    // Get crop item data
                    const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                    const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                    const rarity = cropItem ? cropItem.rarity : 'common';
                    const yieldAmount = getHarvestYield(rarity);
                    // Add crop to inventory (not seeds, but the crop itself)
                    let variant = null;
                    if (cropItem && cropItem.variants && cropItem.variants.length > 0) {
                        const randomVariant = cropItem.variants[Math.floor(Math.random() * cropItem.variants.length)];
                        variant = randomVariant.id;
                    }
                    await interaction.client.inventory.addItem(
                        interaction.user.id,
                        interaction.guild.id,
                        `crop_${cropType}`,
                        yieldAmount,
                        undefined,
                        undefined,
                        variant // pass variant as the last argument
                    );
                    // Clear the plot
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { crop: null, stage: 0, planted_at: null });
                    harvested.push({ crop: cropType, amount: yieldAmount, variant: variant });
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
            const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
            const sharedStageImages = [
                'farm_planted_225.png',
                'farm_sprout_225.png',
                'farm_growing_225.png',
                'farm_almost_grown_225.png'
            ];
            const loadedSharedStages = await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
            const baseImage = await loadImage(basePath);
            const plotCoords = [
                { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
                { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
                { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
            ];
            const canvas = createCanvas(baseImage.width, baseImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImage, 0, 0);
            for (let i = 0; i < 9; i++) {
                const plot = updatedFarm[i];
                if (!plot.crop) continue;
                const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                const rarity = cropItem ? cropItem.rarity : 'common';
                const growthTimes = getGrowthTimesForRarity(rarity);
                const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
                if (stage > (plot.stage || 0)) {
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
                }
                let img;
                if (stage < 4) {
                    img = loadedSharedStages[stage];
                } else {
                    const cropStageImagePath = path.join(__dirname, `../../assets/farming/farm_${cropType}_225.png`);
                    img = await loadImage(cropStageImagePath);
                }
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
            // Build harvest message with emojis
            const harvestMessages = harvested.map(h => {
                // Get the crop item data to get the emoji and display name
                const cropItem = interaction.client.inventory.getItem(`crop_${h.crop}`, interaction.guild.id);
                const emoji = cropItem ? interaction.client.inventory.getDisplayEmoji(cropItem, h.variant) : '🌾';
                const cropName = cropItem ? interaction.client.inventory.getDisplayName(cropItem, h.variant) : h.crop.charAt(0).toUpperCase() + h.crop.slice(1);
                return `**${h.amount}** ${emoji} ${cropName}`;
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
            // Add Plant, Harvest, Refresh, and Share buttons in a single row
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
            const components = [buttonRow];
            await interaction.update({
                content: '',
                embeds: [embed],
                files: [attachment],
                components
            });
            return true;
        }
        if (interaction.customId === 'farm_refresh') {
            // Re-render farm
            const updatedFarm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
            const sharedStageImages = [
                'farm_planted_225.png',
                'farm_sprout_225.png',
                'farm_growing_225.png',
                'farm_almost_grown_225.png'
            ];
            const loadedSharedStages = await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
            const baseImage = await loadImage(basePath);
            const plotCoords = [
                { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
                { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
                { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
            ];
            const canvas = createCanvas(baseImage.width, baseImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImage, 0, 0);
            for (let i = 0; i < 9; i++) {
                const plot = updatedFarm[i];
                if (!plot.crop) continue;
                const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                const rarity = cropItem ? cropItem.rarity : 'common';
                const growthTimes = getGrowthTimesForRarity(rarity);
                const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
                if (stage > (plot.stage || 0)) {
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
                }
                let img;
                if (stage < 4) {
                    img = loadedSharedStages[stage];
                } else {
                    const cropStageImagePath = path.join(__dirname, `../../assets/farming/farm_${cropType}_225.png`);
                    img = await loadImage(cropStageImagePath);
                }
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
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
            const components = [buttonRow];
            await interaction.update({
                content: '',
                embeds: [embed],
                files: [attachment],
                components
            });
            return true;
        }
        if (interaction.customId === 'farm_share') {
            // Generate and share a snapshot of the farm to the channel (not ephemeral)
            const updatedFarm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
            const sharedStageImages = [
                'farm_planted_225.png',
                'farm_sprout_225.png',
                'farm_growing_225.png',
                'farm_almost_grown_225.png'
            ];
            const loadedSharedStages = await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
            const baseImage = await loadImage(basePath);
            const plotCoords = [
                { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
                { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
                { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
            ];
            const canvas = createCanvas(baseImage.width, baseImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImage, 0, 0);
            for (let i = 0; i < 9; i++) {
                const plot = updatedFarm[i];
                if (!plot.crop) continue;
                const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                const rarity = cropItem ? cropItem.rarity : 'common';
                const growthTimes = getGrowthTimesForRarity(rarity);
                const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
                if (stage > (plot.stage || 0)) {
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
                }
                let img;
                if (stage < 4) {
                    img = loadedSharedStages[stage];
                } else {
                    const cropStageImagePath = path.join(__dirname, `../../assets/farming/farm_${cropType}_225.png`);
                    img = await loadImage(cropStageImagePath);
                }
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
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
        // Handle seed selection
        if (interaction.customId === 'farm_seed_select') {
            const selectedSeed = interaction.values[0];
            if (!interaction.client._farmSelections) interaction.client._farmSelections = {};
            interaction.client._farmSelections[interaction.user.id] = { seed: selectedSeed };
            // Rebuild the select menus with the selected seed as default
            const inventory = interaction.client.inventory.getUserInventory(interaction.user.id, interaction.guild.id);
            const seeds = inventory.filter(item => item.type === 'seed' && item.quantity > 0);
            const seedOptions = seeds.map(seed => ({
                label: seed.name,
                value: `seeds_${seed.id}`,
                emoji: seed.emoji || '🌱',
                default: `seeds_${seed.id}` === selectedSeed
            }));
            const seedMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_seed_select')
                .setPlaceholder('Select a seed to plant')
                .addOptions(seedOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const emptyPlots = interaction.client.farming.getEmptyPlots(farm);
            const plotOptions = emptyPlots
                .filter(i => typeof i === 'number' && i >= 0 && i < 9)
                .map(i => ({ label: `Plot ${i + 1}`, value: String(i) }));
            const plotMenu = new StringSelectMenuBuilder()
                .setCustomId('farm_plot_select')
                .setPlaceholder('Select a plot')
                .addOptions(plotOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const selectRows = [
                new ActionRowBuilder().addComponents(seedMenu),
                new ActionRowBuilder().addComponents(plotMenu)
            ];
            await interaction.update({
                content: `Selected seed: ${seedOptions.find(opt => opt.value === selectedSeed)?.label || ''}. Now select a plot to plant your seed.`,
                components: selectRows
            });
            return true;
        }
        // Handle plot selection
        if (interaction.customId === 'farm_plot_select') {
            if (!interaction.client._farmSelections || !interaction.client._farmSelections[interaction.user.id] || !interaction.client._farmSelections[interaction.user.id].seed) {
                await interaction.update({ content: 'Please select a seed first.', components: [] });
                return true;
            }
            const selectedPlot = interaction.values[0];
            const selectedSeed = interaction.client._farmSelections[interaction.user.id].seed;
            const seedId = selectedSeed.replace('seeds_', '');
            await interaction.client.inventory.removeItem(interaction.user.id, interaction.guild.id, seedId, 1);
            await interaction.client.farming.plantSeed(interaction.user.id, interaction.guild.id, parseInt(selectedPlot, 10), seedId);
            delete interaction.client._farmSelections[interaction.user.id];
            // Re-render farm after planting
            const updatedFarm2 = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
            const sharedStageImages = [
                'farm_planted_225.png',
                'farm_sprout_225.png',
                'farm_growing_225.png',
                'farm_almost_grown_225.png'
            ];
            const loadedSharedStages = await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
            const baseImage = await loadImage(basePath);
            const plotCoords = [
                { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
                { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
                { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
            ];
            const canvas = createCanvas(baseImage.width, baseImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImage, 0, 0);
            for (let i = 0; i < 9; i++) {
                const plot = updatedFarm2[i];
                if (!plot.crop) continue;
                const cropType = plot.crop.startsWith('seeds_') ? plot.crop.replace('seeds_', '') : plot.crop;
                const cropItem = interaction.client.inventory.getItem(`seeds_${cropType}`, interaction.guild.id) || interaction.client.inventory.getItem(cropType, interaction.guild.id);
                const rarity = cropItem ? cropItem.rarity : 'common';
                const growthTimes = getGrowthTimesForRarity(rarity);
                const stage = getCurrentStage(plot.planted_at, plot.stage || 0, growthTimes);
                if (stage > (plot.stage || 0)) {
                    interaction.client.farming.updatePlot(interaction.user.id, interaction.guild.id, i, { stage });
                }
                let img;
                if (stage < 4) {
                    img = loadedSharedStages[stage];
                } else {
                    const cropStageImagePath = path.join(__dirname, `../../assets/farming/farm_${cropType}_225.png`);
                    img = await loadImage(cropStageImagePath);
                }
                ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌾 Your Farm')
                .setDescription(`Planted ${seedId.replace('_', ' ')} in Plot ${parseInt(selectedPlot, 10) + 1}!`)
                .setImage('attachment://farm_preview.png')
                .setFooter({ text: 'Your farm has been updated.' })
                .setTimestamp();
            // Rebuild components (plant/harvest/refresh/share buttons)
            const emptyPlots = interaction.client.farming.getEmptyPlots(updatedFarm2);
            const readyToHarvest = updatedFarm2.some(plot => plot.crop && (plot.stage || 0) >= 4);
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
            const components = [buttonRow];
            await interaction.update({
                content: '',
                embeds: [embed],
                files: [attachment],
                components
            });
            return true;
        }
        // Legacy single-menu handler fallback
        if (interaction.customId === 'farm_plant_select') {
            const selected = interaction.values;
            const seed = selected.find(v => v.startsWith('seed:'));
            const plot = selected.find(v => v.startsWith('plot:'));
            if (!seed || !plot) {
                await interaction.reply({ content: 'Please select both a seed and a plot.', ephemeral: true });
                return true;
            }
            const seedName = seed.split(':')[1];
            const plotIndex = parseInt(plot.split(':')[1], 10);
            // Plant the seed in the database
            await interaction.client.farming.plantSeed(interaction.user.id, interaction.guild.id, plotIndex, seedName.replace('seeds_', ''));
            // Get updated farm
            const farm = interaction.client.farming.getFarm(interaction.user.id, interaction.guild.id);
            // Render updated farm image
            const basePath = path.join(__dirname, '../../assets/farming/farm_3x3.png');
            const stageImages = [
                'farm_planted_225.png',
                'farm_sprout_225.png',
                'farm_growing_225.png',
                'farm_almost_grown_225.png',
                'farm_wheat_225.png'
            ];
            const loadedStages = await Promise.all(stageImages.map(img => loadImage(path.join(__dirname, '../../assets/farming', img))));
            const baseImage = await loadImage(basePath);
            const plotCoords = [
                { x: 147, y: 154 }, { x: 400, y: 154 }, { x: 656, y: 154 },
                { x: 147, y: 400 }, { x: 400, y: 400 }, { x: 656, y: 400 },
                { x: 147, y: 650 }, { x: 400, y: 650 }, { x: 656, y: 650 }
            ];
            const canvas = createCanvas(baseImage.width, baseImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(baseImage, 0, 0);
            for (let i = 0; i < 9; i++) {
                const plot = farm[i];
                if (!plot.crop) continue; // Don't draw a stage image for empty plots
                const stage = plot.stage || 0;
                ctx.drawImage(loadedStages[stage], plotCoords[i].x, plotCoords[i].y, 225, 225);
            }
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'farm_preview.png' });
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌾 Your Farm')
                .setDescription(`Planted ${seedName.replace('seeds_', '').replace('_', ' ')} in Plot ${plotIndex + 1}!`)
                .setImage('attachment://farm_preview.png')
                .setFooter({ text: 'Your farm has been updated.' })
                .setTimestamp();
            await interaction.reply({
                content: `You planted ${seedName.replace('seeds_', '').replace('_', ' ')} in Plot ${plotIndex + 1}!`,
                embeds: [embed],
                files: [attachment],
                ephemeral: true
            });
            return true;
        }
        return false;
    },
}; 