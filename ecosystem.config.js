module.exports = {
  apps : [{
    name: 'BlazeIsleBot',
    script: 'blazeislebot.js',
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'development',
      NODE_APP_INSTANCE: ''
    },
    env_production: {
      NODE_ENV: 'production',
      NODE_APP_INSTANCE: ''
    }
  }]
}; 