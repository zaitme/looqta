/**
 * Database Write Tests
 * PHASE 5: Testing, Validation & Metrics
 */

const dbService = require('../src/services/dbService');
const { validateRecord } = require('../src/utils/product-validation');

describe('Database Write Service', () => {
  test('should validate product record', () => {
    const validProduct = {
      product_name: 'Test Product',
      price: 99.99,
      url: 'https://example.com/product',
      site: 'amazon.sa',
      site_product_id: 'B08XXX',
      currency: 'SAR',
    };

    const validated = validateRecord(validProduct);
    
    expect(validated).toHaveProperty('product_id');
    expect(validated).toHaveProperty('product_name');
    expect(validated).toHaveProperty('price_amount');
    expect(validated.price_amount).toBeGreaterThan(0);
    expect(validated.is_valid).toBe(true);
  });

  test('should reject invalid product record', () => {
    const invalidProduct = {
      product_name: '', // Empty name
      price: -10, // Negative price
      url: 'invalid-url', // Invalid URL
      site: 'amazon.sa',
    };

    expect(() => validateRecord(invalidProduct)).toThrow();
  });

  test('should normalize product data', () => {
    const product = {
      product_name: '  Test   Product  ',
      price: '99.99 SAR',
      url: 'https://example.com/product',
      site: 'AMAZON.SA',
      site_product_id: 'B08XXX',
    };

    const validated = validateRecord(product);
    
    expect(validated.product_name).toBe('Test Product'); // Trimmed and normalized
    expect(validated.site).toBe('amazon.sa'); // Lowercased
    expect(validated.price_amount).toBe(99.99); // Parsed numeric
  });
});
