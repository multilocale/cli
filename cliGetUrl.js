/* Copyright 2013 - 2024 Waiterio LLC */

// Build-time replacement for the monorepo URL resolver. The published CLI
// only ever needs this product's own public URLs, so the full internal
// domain/port registry never enters the npm bundle. Overrides:
// MULTILOCALE_API_URL and MULTILOCALE_APP_URL.
export default function getUrl({ service } = {}) {
  if (service === 'api') {
    return process.env.MULTILOCALE_API_URL || 'https://api.multilocale.com'
  }
  if (service === 'app') {
    return process.env.MULTILOCALE_APP_URL || 'https://app.multilocale.com'
  }
  return 'https://www.multilocale.com'
}
