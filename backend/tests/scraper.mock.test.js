// Basic puppeteer smoke test (will run headless and may be slow)
const amazon = require('../src/scrapers/amazon');

jest.setTimeout(30000);

test('amazon scraper returns sample results or empty array on failure', async () => {
  const r = await amazon.search('test product');
  expect(Array.isArray(r)).toBe(true);
});
