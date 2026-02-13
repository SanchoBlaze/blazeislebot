'use strict';

const config = require('config');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { Colours } = require('../../modules/colours');

const API_BASE = 'https://whatpulse.org/api/v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const teamCache = new Map(); // slug -> { data, timestamp }

function formatNumber(n) {
    if (n == null || Number.isNaN(n)) return '0';
    return Math.floor(Number(n)).toLocaleString();
}

function formatBytes(mb) {
    if (mb == null || Number.isNaN(mb)) return '0 B';
    const n = Number(mb);
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} TB`;
    if (n >= 1024) return `${(n / 1024).toFixed(2)} GB`;
    return `${n.toFixed(2)} MB`;
}

/** Build field value: main stat + optional rank line (with green marker). */
function fieldWithRank(mainText, rank) {
    if (rank != null && rank !== '' && !Number.isNaN(Number(rank))) {
        return `${mainText}\n🟢 Rank #${formatNumber(rank)}`;
    }
    return mainText;
}

function formatUptime(seconds) {
    if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '0d';
    let d = Math.floor(Number(seconds) / 86400);
    const y = Math.floor(d / 365.25);
    d -= Math.floor(y * 365.25);
    const w = Math.floor(d / 7);
    d -= w * 7;
    const parts = [];
    if (y > 0) parts.push(`${y}y`);
    if (w > 0) parts.push(`${w}w`);
    if (d > 0 || parts.length === 0) parts.push(`${d}d`);
    return parts.join(' ');
}

async function fetchTeam(apiKey, teamSlug) {
    const url = `${API_BASE}/teams/${encodeURIComponent(teamSlug)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
        const err = new Error(`WhatPulse API: ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whatpulse')
        .setDescription('Show this server\'s WhatPulse team stats'),
    guildOnly: true,
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const settings = interaction.client.settings.get(guildId);
        const teamSlug = (settings.whatpulse_team_slug || '').trim();

        if (!teamSlug) {
            return interaction.reply({
                content: 'No WhatPulse team configured for this server. Admins can set it with `/config set`.',
                flags: MessageFlags.Ephemeral
            });
        }

        let apiKey;
        try {
            apiKey = config.get('WhatPulse.apiKey');
        } catch (e) {
            apiKey = '';
        }
        if (!apiKey || typeof apiKey !== 'string') {
            return interaction.reply({
                content: 'WhatPulse API is not configured.',
                flags: MessageFlags.Ephemeral
            });
        }

        let payload;
        const cached = teamCache.get(teamSlug);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
            payload = cached.data;
        } else {
            try {
                payload = await fetchTeam(apiKey, teamSlug);
                teamCache.set(teamSlug, { data: payload, timestamp: Date.now() });
            } catch (err) {
                const status = err.status;
                if (status === 401) {
                    return interaction.reply({ content: 'Invalid WhatPulse API key.', flags: MessageFlags.Ephemeral });
                }
                if (status === 404) {
                    return interaction.reply({ content: 'WhatPulse team not found.', flags: MessageFlags.Ephemeral });
                }
                if (status === 429) {
                    return interaction.reply({ content: 'WhatPulse rate limit exceeded. Try again later.', flags: MessageFlags.Ephemeral });
                }
                return interaction.reply({
                    content: `Could not fetch WhatPulse data: ${err.message || 'Network error'}.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        const team = payload.team;
        if (!team || !team.totals) {
            return interaction.reply({
                content: 'Invalid response from WhatPulse.',
                flags: MessageFlags.Ephemeral
            });
        }

        const t = team.totals;
        const ranks = team.ranks || {};
        // API uses short names in ranks: download, upload, uptime, distance (no _mb / _seconds / _miles)
        const r = {
            keys: ranks.keys ?? team.rank_keys,
            clicks: ranks.clicks ?? team.rank_clicks,
            scrolls: ranks.scrolls ?? team.rank_scrolls,
            distance_miles: ranks.distance ?? ranks.distance_miles ?? team.rank_distance_miles,
            download_mb: ranks.download ?? ranks.download_mb ?? team.rank_download_mb,
            upload_mb: ranks.upload ?? ranks.upload_mb ?? team.rank_upload_mb,
            uptime_seconds: ranks.uptime ?? ranks.uptime_seconds ?? team.rank_uptime_seconds,
            members_count: ranks.members_count ?? team.rank_members_count
        };
        const slug = team.slug || teamSlug;
        const teamName = team.name || teamSlug;
        const teamUrl = `https://whatpulse.org/team/${slug}`;

        const embed = new EmbedBuilder()
            .setColor(Colours.BLUE)
            .setTitle(`${teamName} – WhatPulse`)
            .setURL(teamUrl)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: 'Keys', value: fieldWithRank(formatNumber(t.keys), r.keys), inline: true },
                { name: 'Clicks', value: fieldWithRank(formatNumber(t.clicks), r.clicks), inline: true },
                { name: 'Scrolls', value: fieldWithRank(formatNumber(t.scrolls), r.scrolls), inline: true },
                { name: 'Distance', value: fieldWithRank(`${Number(t.distance_miles ?? 0).toFixed(2)} mi`, r.distance_miles), inline: true },
                { name: 'Download', value: fieldWithRank(formatBytes(t.download_mb), r.download_mb), inline: true },
                { name: 'Upload', value: fieldWithRank(formatBytes(t.upload_mb), r.upload_mb), inline: true },
                { name: 'Uptime', value: fieldWithRank(formatUptime(t.uptime_seconds), r.uptime_seconds), inline: true },
                { name: 'Members', value: fieldWithRank(formatNumber(t.members_count), r.members_count), inline: true }
            )
            .setFooter({
                text: `Data from WhatPulse • Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
