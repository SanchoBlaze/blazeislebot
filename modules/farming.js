const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/farming.sqlite');

class Farming {
  constructor(client) {
    this.client = client;
    this.setupFarmingTable();
    this.setupFarmStatsTable();
  }

  setupFarmingTable() {
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS farms (
        user TEXT NOT NULL,
        guild TEXT NOT NULL,
        plot INTEGER NOT NULL,
        crop TEXT,
        stage INTEGER DEFAULT 0,
        planted_at INTEGER,
        fertiliser TEXT,
        PRIMARY KEY (user, guild, plot)
      );
    `).run();
    
    // Add fertiliser column to existing tables if it doesn't exist
    try {
      sql.prepare('SELECT fertiliser FROM farms LIMIT 1').get();
    } catch (error) {
      if (error.message.includes('no such column')) {
        console.log('Adding fertiliser column to existing farms table...');
        sql.prepare('ALTER TABLE farms ADD COLUMN fertiliser TEXT').run();
      }
    }
  }

  setupFarmStatsTable() {
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS farm_stats (
        user TEXT NOT NULL,
        guild TEXT NOT NULL,
        crops_harvested INTEGER DEFAULT 0,
        seeds_planted INTEGER DEFAULT 0,
        fertilisers_used INTEGER DEFAULT 0,
        PRIMARY KEY (user, guild)
      );
    `).run();
    // New: Per-item stats
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS farm_stats_items (
        user TEXT NOT NULL,
        guild TEXT NOT NULL,
        type TEXT NOT NULL, -- 'seed', 'crop', 'fertiliser'
        item_id TEXT NOT NULL,
        variant TEXT DEFAULT NULL,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (user, guild, type, item_id, variant)
      );
    `).run();
    
    // Migration: Add variant column to existing farm_stats_items table if it doesn't exist
    try {
      sql.prepare('SELECT variant FROM farm_stats_items LIMIT 1').get();
    } catch (error) {
      if (error.message.includes('no such column')) {
        console.log('[Farming] Adding variant column to existing farm_stats_items table...');
        sql.prepare('ALTER TABLE farm_stats_items ADD COLUMN variant TEXT DEFAULT NULL').run();
        // Update primary key to include variant
        sql.prepare('DROP TABLE farm_stats_items').run();
        sql.prepare(`
          CREATE TABLE farm_stats_items (
            user TEXT NOT NULL,
            guild TEXT NOT NULL,
            type TEXT NOT NULL, -- 'seed', 'crop', 'fertiliser'
            item_id TEXT NOT NULL,
            variant TEXT DEFAULT NULL,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (user, guild, type, item_id, variant)
          );
        `).run();
      }
    }

    // Migration: Add missing columns if they don't exist
    const columns = sql.prepare("PRAGMA table_info(farm_stats);").all().map(col => col.name);
    if (!columns.includes('seeds_planted')) {
        sql.prepare('ALTER TABLE farm_stats ADD COLUMN seeds_planted INTEGER DEFAULT 0;').run();
    }
    if (!columns.includes('fertilisers_used')) {
        sql.prepare('ALTER TABLE farm_stats ADD COLUMN fertilisers_used INTEGER DEFAULT 0;').run();
    }
    // Add similar checks for any other columns you add in the future
  }

  // Increment crops harvested for a user
  incrementFarmHarvest(user, guild, amount) {
    sql.prepare(`
      INSERT INTO farm_stats (user, guild, crops_harvested)
      VALUES (?, ?, ?)
      ON CONFLICT(user, guild) DO UPDATE SET crops_harvested = crops_harvested + ?
    `).run(user, guild, amount, amount);
  }

  // Increment seeds planted for a user
  incrementSeedsPlanted(user, guild, amount = 1) {
    sql.prepare(`
      INSERT INTO farm_stats (user, guild, seeds_planted)
      VALUES (?, ?, ?)
      ON CONFLICT(user, guild) DO UPDATE SET seeds_planted = seeds_planted + ?
    `).run(user, guild, amount, amount);
  }

  // Increment fertilisers used for a user
  incrementFertilisersUsed(user, guild, amount = 1) {
    sql.prepare(`
      INSERT INTO farm_stats (user, guild, fertilisers_used)
      VALUES (?, ?, ?)
      ON CONFLICT(user, guild) DO UPDATE SET fertilisers_used = fertilisers_used + ?
    `).run(user, guild, amount, amount);
  }

  // Get all per-item stats for a user and type
  getFarmItemStats(user, guild, type) {
    return sql.prepare(`
      SELECT item_id, variant, count FROM farm_stats_items WHERE user = ? AND guild = ? AND type = ? ORDER BY count DESC
    `).all(user, guild, type);
  }

  // Get all farm stats for a user
  getFarmStats(user, guild) {
    return sql.prepare('SELECT * FROM farm_stats WHERE user = ? AND guild = ?').get(user, guild) || {
      user,
      guild,
      crops_harvested: 0,
      seeds_planted: 0,
      fertilisers_used: 0
    };
  }

  // Get farm leaderboard (top N by crops harvested)
  getFarmLeaderboard(guild, limit = 10) {
    return sql.prepare(`
      SELECT user, crops_harvested FROM farm_stats WHERE guild = ? ORDER BY crops_harvested DESC LIMIT ?
    `).all(guild, limit);
  }

  // Get seeds planted leaderboard
  getSeedsPlantedLeaderboard(guild, limit = 10) {
    return sql.prepare(`
      SELECT user, seeds_planted FROM farm_stats WHERE guild = ? ORDER BY seeds_planted DESC LIMIT ?
    `).all(guild, limit);
  }

  // Get fertilisers used leaderboard
  getFertilisersUsedLeaderboard(guild, limit = 10) {
    return sql.prepare(`
      SELECT user, fertilisers_used FROM farm_stats WHERE guild = ? ORDER BY fertilisers_used DESC LIMIT ?
    `).all(guild, limit);
  }

  // Helper: check if user owns the 4x4 farm upgrade
  async has4x4Upgrade(user, guild) {
    if (!this.client || !this.client.inventory) return false;
    return !!(await this.client.inventory.getItemCount(user, guild, 'farm_upgrade_4x4'));
  }

  // Get the farm state for a user (array of 9 or 16 plots)
  async getFarm(user, guild) {
    const hasUpgrade = await this.has4x4Upgrade(user, guild);
    const plotCount = hasUpgrade ? 16 : 9;
    const rows = sql.prepare('SELECT * FROM farms WHERE user = ? AND guild = ?').all(user, guild);
    // Fill missing plots with empty
    const farm = Array(plotCount).fill(null).map((_, i) => {
      const row = rows.find(r => r.plot === i);
      return row ? {
        crop: row.crop,
        stage: row.stage,
        planted_at: row.planted_at,
        fertiliser: row.fertiliser
      } : { crop: null, stage: 0, planted_at: null, fertiliser: null };
    });
    return farm;
  }

  // Plant a seed in a plot
  plantSeed(user, guild, plot, crop, fertiliser = null) {
    const now = Date.now();
    sql.prepare(`
      INSERT INTO farms (user, guild, plot, crop, stage, planted_at, fertiliser)
      VALUES (?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(user, guild, plot) DO UPDATE SET crop=excluded.crop, stage=0, planted_at=excluded.planted_at, fertiliser=excluded.fertiliser
    `).run(user, guild, plot, crop, now, fertiliser);
  }

  // Update a plot (e.g., for growth/harvest)
  updatePlot(user, guild, plot, data) {
    const fields = [];
    const values = [];
    for (const key in data) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
    values.push(user, guild, plot);
    sql.prepare(`UPDATE farms SET ${fields.join(', ')} WHERE user = ? AND guild = ? AND plot = ?`).run(...values);
  }

  // Get empty plot indices
  getEmptyPlots(farm) {
    return farm.map((p, i) => (p.crop ? null : i)).filter(i => i !== null);
  }

  // Check for weed growth on empty plots (5% chance per empty plot), only once per hour
  async checkForWeedGrowth(user, guild) {
    // Ensure weed_growth_checks table exists
    sql.prepare(`CREATE TABLE IF NOT EXISTS weed_growth_checks (
      user TEXT NOT NULL,
      guild TEXT NOT NULL,
      last_check INTEGER,
      PRIMARY KEY (user, guild)
    );`).run();

    // Get last check time
    const row = sql.prepare('SELECT last_check FROM weed_growth_checks WHERE user = ? AND guild = ?').get(user, guild);
    const now = Date.now();
    if (row && now - row.last_check < 60 * 60 * 1000) {
      // Less than 1 hour since last check, skip
      return;
    }
    // Update last check time
    sql.prepare('INSERT INTO weed_growth_checks (user, guild, last_check) VALUES (?, ?, ?) ON CONFLICT(user, guild) DO UPDATE SET last_check = ?')
      .run(user, guild, now, now);

    const farm = await this.getFarm(user, guild);
    const emptyPlots = this.getEmptyPlots(farm);
    const weedChance = 0.05; // 5% chance per empty plot
    for (const plotIndex of emptyPlots) {
      if (Math.random() < weedChance) {
        this.plantSeed(user, guild, plotIndex, 'crop_weeds');
        this.updatePlot(user, guild, plotIndex, { stage: 4 });
      }
    }
  }

  // Increment per-item farm stats
  incrementFarmItemStat(user, guild, type, itemId, amount = 1, variant = null) {
    sql.prepare(`
      INSERT INTO farm_stats_items (user, guild, type, item_id, variant, count)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user, guild, type, item_id, variant) DO UPDATE SET count = count + ?
    `).run(user, guild, type, itemId, variant, amount, amount);
  }
}

module.exports = Farming; 