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
        PRIMARY KEY (user, guild, plot)
      );
    `).run();
  }

  setupFarmStatsTable() {
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS farm_stats (
        user TEXT NOT NULL,
        guild TEXT NOT NULL,
        crops_harvested INTEGER DEFAULT 0,
        PRIMARY KEY (user, guild)
      );
    `).run();
  }

  // Increment crops harvested for a user
  incrementFarmHarvest(user, guild, amount) {
    sql.prepare(`
      INSERT INTO farm_stats (user, guild, crops_harvested)
      VALUES (?, ?, ?)
      ON CONFLICT(user, guild) DO UPDATE SET crops_harvested = crops_harvested + ?
    `).run(user, guild, amount, amount);
  }

  // Get farm leaderboard (top N by crops harvested)
  getFarmLeaderboard(guild, limit = 10) {
    return sql.prepare(`
      SELECT user, crops_harvested FROM farm_stats WHERE guild = ? ORDER BY crops_harvested DESC LIMIT ?
    `).all(guild, limit);
  }

  // Get the farm state for a user (array of 9 plots)
  getFarm(user, guild) {
    const rows = sql.prepare('SELECT * FROM farms WHERE user = ? AND guild = ?').all(user, guild);
    // Fill missing plots with empty
    const farm = Array(9).fill(null).map((_, i) => {
      const row = rows.find(r => r.plot === i);
      return row ? {
        crop: row.crop,
        stage: row.stage,
        planted_at: row.planted_at
      } : { crop: null, stage: 0, planted_at: null };
    });
    return farm;
  }

  // Plant a seed in a plot
  plantSeed(user, guild, plot, crop) {
    const now = Date.now();
    sql.prepare(`
      INSERT INTO farms (user, guild, plot, crop, stage, planted_at)
      VALUES (?, ?, ?, ?, 0, ?)
      ON CONFLICT(user, guild, plot) DO UPDATE SET crop=excluded.crop, stage=0, planted_at=excluded.planted_at
    `).run(user, guild, plot, crop, now);
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
}

module.exports = Farming; 