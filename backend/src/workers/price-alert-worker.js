/**
 * Price Alert Worker
 * Checks price alerts and sends notifications when target price is reached
 */
const db = require('../db/mysql');
const logger = require('../utils/logger');
const { generateProductId } = require('../utils/price-history');

/**
 * Check price alerts and send notifications
 */
async function checkPriceAlerts() {
  try {
    // Check database connection first
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.warn('Price alert worker: Database unavailable, skipping check', {
        error: dbError.message
      });
      return; // Exit gracefully if DB is unavailable
    }
    
    // Get all active alerts
    const [alerts] = await db.execute(
      `SELECT * FROM user_price_alerts WHERE is_active = TRUE`
    );
    
    if (alerts.length === 0) {
      logger.debug('No active price alerts to check');
      return;
    }
    
    logger.info('Checking price alerts', { alertCount: alerts.length });
    
    const notifications = [];
    
    for (const alert of alerts) {
      try {
        // Get latest price from price_history
        const [priceHistory] = await db.execute(
          `SELECT price, currency, scraped_at 
           FROM price_history 
           WHERE product_id = ? 
           ORDER BY scraped_at DESC 
           LIMIT 1`,
          [alert.product_id]
        );
        
        if (priceHistory.length === 0) {
          logger.debug('No price history found for alert', { 
            alertId: alert.id, 
            productId: alert.product_id 
          });
          continue;
        }
        
        const latestPrice = parseFloat(priceHistory[0].price);
        const targetPrice = parseFloat(alert.target_price);
        
        // Check if price dropped to or below target
        if (latestPrice <= targetPrice && !alert.notified_at) {
          notifications.push({
            alert,
            latestPrice,
            targetPrice,
            priceHistory: priceHistory[0]
          });
        }
      } catch (error) {
        logger.error('Error checking alert', {
          alertId: alert.id,
          error: error.message
        });
      }
    }
    
    // Send notifications
    for (const notification of notifications) {
      try {
        const { alert, latestPrice, targetPrice } = notification;
        
        // Update alert as notified
        await db.execute(
          `UPDATE user_price_alerts 
           SET notified_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [alert.id]
        );
        
        // TODO: Send email/push notification
        // For now, just log
        logger.info('Price alert triggered', {
          alertId: alert.id,
          userId: alert.user_id,
          productId: alert.product_id,
          targetPrice,
          latestPrice,
          notificationType: alert.notification_type
        });
        
        // In production, integrate with email service (SES, SendGrid, etc.)
        // and push notification service (FCM, OneSignal, etc.)
      } catch (error) {
        logger.error('Failed to send notification', {
          alertId: notification.alert.id,
          error: error.message
        });
      }
    }
    
    logger.info('Price alert check completed', {
      checked: alerts.length,
      triggered: notifications.length
    });
  } catch (error) {
    logger.error('Price alert worker failed', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Start price alert worker
 * Runs every 15 minutes
 */
let intervalId = null;

function start(intervalMinutes = 15) {
  if (intervalId) {
    logger.warn('Price alert worker already running');
    return;
  }
  
  logger.info('Starting price alert worker', { intervalMinutes });
  
  // Run immediately (async, don't block)
  checkPriceAlerts().catch(err => {
    // Error already logged in checkPriceAlerts, just prevent unhandled rejection
    logger.debug('Price alert worker initial check failed', { error: err.message });
  });
  
  // Then run on interval
  intervalId = setInterval(() => {
    checkPriceAlerts().catch(err => {
      // Error already logged in checkPriceAlerts, just prevent unhandled rejection
      logger.debug('Price alert worker interval check failed', { error: err.message });
    });
  }, intervalMinutes * 60 * 1000);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Price alert worker stopped');
  }
}

module.exports = {
  checkPriceAlerts,
  start,
  stop
};
