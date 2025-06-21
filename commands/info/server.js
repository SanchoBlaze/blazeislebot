const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ChannelType } = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Displays detailed information about this server.'),
    async execute(interaction) {
        const { guild } = interaction;

        // Fetch all members to ensure accurate counts
        await guild.members.fetch();
        const owner = await guild.fetchOwner();

        // Channel counts
        const channels = guild.channels.cache;
        const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
        const categoryChannels = channels.filter(c => c.type === ChannelType.GuildCategory).size;
        const stageChannels = channels.filter(c => c.type === ChannelType.GuildStageVoice).size;

        // Member counts
        const totalMembers = guild.memberCount;
        const humanMembers = guild.members.cache.filter(member => !member.user.bot).size;
        const botMembers = totalMembers - humanMembers;

        // Verification Level
        const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Very High',
        };

        const embed = new EmbedBuilder()
            .setColor(Colours.BLUE)
            .setTitle(`Server Info: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Owner', value: owner.user.tag, inline: true },
                { name: 'Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: 'Verification Level', value: verificationLevels[guild.verificationLevel], inline: true },
                
                { name: '\u200B', value: '\u200B' }, // Spacer

                { name: `👥 Members (${totalMembers})`, value: `**Humans:** ${humanMembers}\n**Bots:** ${botMembers}`, inline: true },
                { name: `📁 Channels (${channels.size})`, value: `**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Stages:** ${stageChannels}\n**Categories:** ${categoryChannels}`, inline: true },
                { name: `💎 Boosts`, value: `**Tier:** ${guild.premiumTier}\n**Count:** ${guild.premiumSubscriptionCount}`, inline: true },

                { name: '\u200B', value: '\u200B' }, // Spacer
                
                { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
                { name: 'Owner ID', value: `\`${guild.ownerId}\``, inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

        await interaction.reply({ embeds: [embed] });
    },
};