# Emoji Switching System

This system allows you to easily switch between different Discord bot emoji configurations without modifying code or generating files.

## How It Works

The system automatically uses different emoji sets based on your bot's environment configuration:

- **Production Bot**: When `"live": true` in `config/default.json`
- **Test Bot**: When `"live": false` in `config/default.json`

## Setup

### 1. Update Your Emoji IDs

Edit `config/emoji-configs.json` and replace the placeholder emoji IDs with your actual Discord emoji IDs:

```json
{
    "test_bot": {
        "fishing_rod_basic": "<:fishing_rod_basic:YOUR_ACTUAL_EMOJI_ID>",
        "fishing_rod_steel": "🪝",
        "fishing_rod_golden": "🪙",
        "fishing_rod_crystal": "💠",
        "fishing_rod_legendary": "🏆"
    },
    "production_bot": {
        "fishing_rod_basic": "<:fishing_rod_basic:YOUR_PRODUCTION_EMOJI_ID>",
        "fishing_rod_steel": "🪝",
        "fishing_rod_golden": "🪙",
        "fishing_rod_crystal": "💠",
        "fishing_rod_legendary": "🏆"
    }
}
```

### 2. Switch Between Bots

To switch between your test bot and production bot, simply change the `"live"` setting in `config/default.json`:

**For Test Bot:**
```json
"Enviroment": {
    "live": false
}
```

**For Production Bot:**
```json
"Enviroment": {
    "live": true
}
```

### 3. Restart Your Bot

After changing the configuration, restart your bot and run `/economy-admin populate-defaults` to apply the new emoji configuration.

## How to Get Discord Emoji IDs

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on your custom emoji and select "Copy ID"
3. Use the format: `<:emoji_name:emoji_id>`

## Adding New Items with Custom Emojis

1. Add the item to `data/default-items.json` with a placeholder emoji (like `"🪝"`)
2. Add the custom emoji ID to `config/emoji-configs.json` using the item's ID as the key
3. The system will automatically use the custom emoji when available

## Example

If you have a new item with ID `"magic_sword"`:

**In `data/default-items.json`:**
```json
{
    "id": "magic_sword",
    "name": "Magic Sword",
    "emoji": "⚔️"
}
```

**In `config/emoji-configs.json`:**
```json
{
    "test_bot": {
        "magic_sword": "<:magic_sword:123456789>"
    },
    "production_bot": {
        "magic_sword": "<:magic_sword:987654321>"
    }
}
```

The system will automatically use the custom emoji when available, falling back to the default emoji if not found in the config.

## Emoji Display in Interactive UIs

- The interactive shop, sell, and use commands always show the correct emoji for each item, including custom emojis, thanks to the emoji config system.
- When you use an item that gives a reward (like a scratch card or mystery box), the reward item's emoji is shown as the thumbnail in the result embed. 