const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// Helper: get growth times for rarity
function getGrowthTimesForRarity(rarity) {
    const base = [5, 6, 7, 8];
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const rarityIndex = rarityOrder.indexOf(rarity);
    const extra = rarityIndex > 0 ? rarityIndex * 2 : 0;
    return base.map(min => min + extra);
}

// Helper: get crop image path
function getCropImagePath(cropType) {
    if (cropType === 'crop_weeds') {
        return path.join(__dirname, '../assets/farming/farm_weeds_225.png');
    } else {
        return path.join(__dirname, `../assets/farming/farm_${cropType}_225.png`);
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

// Helper: render farm plots to canvas (support 3x3, 4x4, 5x5, and 6x6)
async function renderFarmPlots(farm, interaction, plotCoords, loadedSharedStages, is4x4, is5x5, is6x6) {
    // Load base farm image
    let basePath;
    if (is6x6) {
        basePath = path.join(__dirname, '../assets/farming/farm_6x6.png');
    } else if (is5x5) {
        basePath = path.join(__dirname, '../assets/farming/farm_5x5.png');
    } else if (is4x4) {
        basePath = path.join(__dirname, '../assets/farming/farm_4x4.png');
    } else {
        basePath = path.join(__dirname, '../assets/farming/farm_3x3.png');
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
            const img = await loadImage(getCropImagePath(cropType));
            ctx.drawImage(img, plotCoords[i].x, plotCoords[i].y, plotSize, plotSize);
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
            const fertPath = path.join(__dirname, `../assets/farming/farm_fertiliser_${fertType}_225.png`);
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
    return await Promise.all(sharedStageImages.map(img => loadImage(path.join(__dirname, '../assets/farming', img))));
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

module.exports = {
    getPlotCoords,
    getSharedStageImages,
    getCropImagePath,
    renderFarmPlots,
    getGrowthTimesForRarity,
    getCurrentStage
}; 