/**
 * Cron / scheduled job placeholder using node-schedule
 */
const schedule = require('node-schedule');
const logger = require('../utils/logger');

function start(){
  // runs every hour as placeholder
  schedule.scheduleJob('0 * * * *', () => {
    logger.info('Cron: hourly job placeholder - would re-scan popular queries');
  });
  logger.info('Cron scheduler started');
}

module.exports = { start };
