/**
 * Scraper Agent Tests
 * PHASE 5: Testing, Validation & Metrics
 */

const scraperAgent = require('../src/agents/scraperAgent');
const jobQueue = require('../src/services/jobQueue');

describe('Scraper Agent', () => {
  test('should register processors', () => {
    const mockProcessor = jest.fn();
    
    jobQueue.registerProcessor('TEST_JOB', mockProcessor);
    
    expect(jobQueue.processors.has('TEST_JOB')).toBe(true);
  });

  test('should add job to queue', async () => {
    const jobId = await jobQueue.add('TEST_JOB', { test: 'data' }, { priority: 1 });
    
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  test('should get queue stats', async () => {
    const stats = await jobQueue.getStats();
    
    expect(stats).toHaveProperty('waiting');
    expect(stats).toHaveProperty('active');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('registeredTypes');
    expect(Array.isArray(stats.registeredTypes)).toBe(true);
  });
});
