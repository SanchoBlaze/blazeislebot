# Economy System Documentation

## Overview

The Blaze Isle Bot now includes a comprehensive economy system that allows users to earn, spend, and manage virtual currency within Discord servers. The system features a dual-currency system with wallet and bank accounts, daily rewards, work opportunities, and a shop system.

## Features

### 💰 Currency System
- **Wallet**: Immediate spending money
- **Bank**: Safe storage for savings
- **Net Worth**: Total value (wallet + bank)
- **Transaction History**: Complete record of all transactions

### 🎯 Earning Methods
1. **Daily Rewards**: 100 coins every 24 hours (`/daily`)
2. **Work**: 10-50 coins every hour (`/work`)
3. **Chat Activity**: 1 coin per message (automatic)
4. **Admin Rewards**: Server administrators can give coins

### 🏦 Banking System
- **Deposit**: Move coins from wallet to bank (`/deposit`)
- **Withdraw**: Move coins from bank to wallet (`/withdraw`)
- **Transfer**: Send coins to other users (`/transfer`)

### 📊 Information & Statistics
- **Balance Check**: View your or others' balances (`/balance`)
- **Leaderboard**: See richest users (`/economy-leaderboard`)
- **Transaction History**: View recent transactions (`/history`)
- **Server Statistics**: Economy overview for admins (`/economy-admin stats`)

### 🛒 Shop System
- **Role Purchases**: Buy special server roles
- **Custom Roles**: Create personalized colored roles
- **XP Boosts**: Temporary experience multipliers
- **Interactive Buttons**: Quick purchase options

## Commands

### User Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/balance` | Check balance | `/balance [user]` |
| `/daily` | Claim daily reward | `/daily` |
| `/work` | Work for coins | `/work` |
| `/deposit` | Deposit to bank | `/deposit <amount>` |
| `/withdraw` | Withdraw from bank | `/withdraw <amount>` |
| `/transfer` | Send coins to user | `/transfer <user> <amount>` |
| `/economy-leaderboard` | Show richest users | `/economy-leaderboard [limit]` |
| `/history` | Show transactions | `/history [user] [limit]` |
| `/shop` | View shop | `/shop` |
| `/economy-help` | Get help | `/economy-help` |

### Admin Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/economy-admin add` | Add coins to user | `/economy-admin add <user> <amount>` |
| `/economy-admin remove` | Remove coins from user | `/economy-admin remove <user> <amount>` |
| `/economy-admin set` | Set user's balance | `/economy-admin set <user> <amount>` |
| `/economy-admin stats` | Show server stats | `/economy-admin stats` |

## Database Structure

### Economy Table
```sql
CREATE TABLE economy (
    id TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    guild TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    last_daily TEXT,
    last_work TEXT,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT NOT NULL,
    guild TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    target_user TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Cooldowns & Limits

- **Daily Reward**: 24 hours
- **Work**: 1 hour
- **Transfer**: No cooldown (limited by balance)
- **Deposit/Withdraw**: No cooldown (limited by available funds)

## Economy Balance

The system is designed to maintain a healthy economy:

- **Daily Reward**: 100 coins (4,200 coins per week)
- **Work**: 10-50 coins per hour (70-350 coins per week)
- **Chat Activity**: 1 coin per message
- **Total Weekly Potential**: ~4,270-4,550 coins for active users

## Security Features

- **Negative Balance Prevention**: Users cannot go below 0 coins
- **Transaction Logging**: All transactions are recorded with timestamps
- **Admin Permissions**: Only administrators can modify user balances
- **Data Validation**: All inputs are validated before processing

## Integration with Existing Systems

The economy system integrates seamlessly with the existing bot features:

- **Loyalty System**: Works alongside the XP/leveling system
- **Guild Settings**: Uses the same configuration system
- **Database**: Follows the same SQLite pattern as other modules
- **Error Handling**: Consistent with bot-wide error handling

## Future Enhancements

Planned features for future updates:

1. **Gambling Games**: Dice, slots, blackjack
2. **Investment System**: Interest on bank deposits
3. **Auction House**: User-to-user item trading
4. **Custom Shop Items**: Server-specific rewards
5. **Economy Events**: Special earning opportunities
6. **Tax System**: Server revenue generation
7. **Multiplier Events**: Temporary earning boosts

## Configuration

The economy system requires no additional configuration beyond the standard bot setup. All features are enabled by default and work automatically when users join the server.

## Troubleshooting

### Common Issues

1. **"User not found"**: User will be automatically created on first command
2. **"Insufficient funds"**: Check balance with `/balance`
3. **"Cooldown active"**: Wait for the specified time before trying again
4. **Database errors**: Check file permissions in the `db/` directory

### Admin Tools

Use `/economy-admin stats` to monitor the economy health and `/economy-admin add` to help users who encounter issues.

## Support

For issues or questions about the economy system:

1. Check this documentation
2. Use `/economy-help` in Discord
3. Contact server administrators
4. Review transaction history for discrepancies

---

*Economy System v1.0 - Blaze Isle Bot* 