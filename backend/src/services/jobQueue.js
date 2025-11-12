/**
 * Job Queue Service - BullMQ implementation
 * PHASE 1: Asynchronous Background Processing
 * 
 * Uses Redis-backed BullMQ for persistent, scalable job processing
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis connection for BullMQ
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || '192.168.8.74',
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  maxRetriesPerRequest: null,
});

// Create queues
const scrapeQueue = new Queue('scrapeQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
});

// Job processors registry
const processors = new Map();

/**
 * Register a processor for a job type
 * @param {string} jobType - Job type ('USER_TRIGGERED_SCRAPE', 'DELTA_REFRESH')
 * @param {Function} processor - Async function to process the job
 */
function registerProcessor(jobType, processor) {
  processors.set(jobType, processor);
  logger.info('Job processor registered', { jobType });
}

/**
 * Add a job to the queue
 * @param {string} jobType - Job type
 * @param {Object} data - Job data
 * @param {Object} options - Options (priority, delay, attempts)
 * @returns {Promise<string>} Job ID
 */
async function addJob(jobType, data, options = {}) {
  try {
    const job = await scrapeQueue.add(jobType, data, {
      priority: options.priority || 0, // Higher = more priority
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      ...options,
    });
    
    logger.debug('Job added to queue', {
      jobId: job.id,
      jobType,
      priority: options.priority || 0,
    });
    
    return job.id;
  } catch (error) {
    logger.error('Failed to add job to queue', {
      jobType,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get queue stats
 * @returns {Promise<Object>} Queue statistics
 */
async function getStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      scrapeQueue.getWaitingCount(),
      scrapeQueue.getActiveCount(),
      scrapeQueue.getCompletedCount(),
      scrapeQueue.getFailedCount(),
      scrapeQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
      registeredTypes: Array.from(processors.keys()),
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
      registeredTypes: [],
    };
  }
}

/**
 * Create worker to process jobs
 * @param {Object} options - Worker options (concurrency, etc.)
 * @returns {Worker} BullMQ worker instance
 */
function createWorker(options = {}) {
  const concurrency = options.concurrency || 3; // Max 3 concurrent jobs per site
  
  const worker = new Worker(
    'scrapeQueue',
    async (job) => {
      const { name: jobType, data } = job;
      const processor = processors.get(jobType);
      
      if (!processor) {
        throw new Error(`No processor found for job type: ${jobType}`);
      }
      
      logger.info('Processing job', {
        jobId: job.id,
        jobType,
        attempt: job.attemptsMade + 1,
      });
      
      const startTime = Date.now();
      try {
        const result = await processor(data, job);
        const duration = Date.now() - startTime;
        
        logger.info('Job completed', {
          jobId: job.id,
          jobType,
          duration: `${duration}ms`,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Job processing failed', {
          jobId: job.id,
          jobType,
          attempt: job.attemptsMade + 1,
          duration: `${duration}ms`,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency,
      limiter: {
        max: concurrency,
        duration: 1000, // Per second
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Worker: Job completed', {
      jobId: job.id,
      jobType: job.name,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Worker: Job failed', {
      jobId: job?.id,
      jobType: job?.name,
      error: err.message,
    });
  });

  return worker;
}

module.exports = {
  add: addJob,
  registerProcessor,
  getStats,
  createWorker,
  queue: scrapeQueue,
  processors,
};
