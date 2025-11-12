/**
 * Simple In-Memory Job Queue
 * Implements background job processing for SWR pattern
 * 
 * Note: For production, consider upgrading to BullMQ with Redis backend
 */

const logger = require('./logger');

class SimpleJobQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrency = 2; // Max concurrent jobs
    this.activeJobs = 0;
    this.processors = new Map(); // Map of job type -> processor function
  }

  /**
   * Register a processor for a job type
   * @param {string} jobType - Job type ('refresh_product', 'refresh_search')
   * @param {Function} processor - Async function to process the job
   */
  registerProcessor(jobType, processor) {
    this.processors.set(jobType, processor);
    logger.info('Job processor registered', { jobType });
  }

  /**
   * Add a job to the queue
   * @param {string} jobType - Job type
   * @param {Object} data - Job data
   * @param {Object} options - Options (priority, delay)
   */
  add(jobType, data, options = {}) {
    const job = {
      id: `${jobType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: jobType,
      data,
      priority: options.priority || 0, // Higher = more priority
      createdAt: new Date(),
      delay: options.delay || 0
    };

    // Insert based on priority
    if (this.queue.length === 0 || job.priority <= this.queue[this.queue.length - 1].priority) {
      this.queue.push(job);
    } else {
      const insertIndex = this.queue.findIndex(j => j.priority < job.priority);
      this.queue.splice(insertIndex === -1 ? this.queue.length : insertIndex, 0, job);
    }

    logger.debug('Job added to queue', {
      jobId: job.id,
      jobType,
      queueLength: this.queue.length
    });

    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }

    return job.id;
  }

  /**
   * Process jobs from the queue
   */
  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrency) {
      const job = this.queue.shift();

      // Check delay
      if (job.delay > 0) {
        const delayMs = job.delay - (Date.now() - job.createdAt.getTime());
        if (delayMs > 0) {
          // Put back at front of queue
          this.queue.unshift(job);
          await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 1000)));
          continue;
        }
      }

      // Process job
      this.activeJobs++;
      this.processJob(job).finally(() => {
        this.activeJobs--;
      });
    }

    this.processing = false;

    // If queue still has items, schedule next processing
    if (this.queue.length > 0) {
      setImmediate(() => this.process());
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const processor = this.processors.get(job.type);
    if (!processor) {
      logger.warn('No processor found for job type', { jobType: job.type, jobId: job.id });
      return;
    }

    try {
      logger.debug('Processing job', { jobId: job.id, jobType: job.type });
      await processor(job.data);
      logger.debug('Job completed', { jobId: job.id, jobType: job.type });
    } catch (error) {
      logger.error('Job processing failed', {
        jobId: job.id,
        jobType: job.type,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs,
      maxConcurrency: this.maxConcurrency,
      registeredTypes: Array.from(this.processors.keys())
    };
  }
}

// Singleton instance
const jobQueue = new SimpleJobQueue();

module.exports = jobQueue;
