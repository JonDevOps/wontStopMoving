/**
 * Optional free Socrata app token (SODA_APP_TOKEN) for the government open
 * data APIs (data.transportation.gov and state portals). Without it,
 * requests are anonymous and rate-limited per server IP.
 */
export const sodaHeaders = (): Record<string, string> => (process.env.SODA_APP_TOKEN ? { 'X-App-Token': process.env.SODA_APP_TOKEN } : {});
