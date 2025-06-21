module.exports = {
  apps : [{
    name: 'BlazeIsleBot',
    script: 'blazeislebot.js',
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}; 