/**
 * Location Helper
 * Fetches IP address and geolocation information
 *
 * @module services/instance-tracker/helpers/location
 */
const logger = require('../../../utils/logger');

// Geolocation service endpoints (in priority order)
const LOCATION_SERVICES = [
  'https://ipapi.co/json/',
  'https://ip-api.com/json/',
  'https://ipinfo.io/json',
];

const REQUEST_TIMEOUT_MS = 10000;
const USER_AGENT = 'AszuneAIBot/1.10.0';

/**
 * Get IP address and geolocation
 * @returns {Promise<Object>} Location information
 */
async function getLocationInfo() {
  // Allow environment-based override for known deployments
  const envLocation = process.env.BOT_LOCATION;
  if (envLocation) {
    return createLocationFromEnv(envLocation);
  }

  for (const service of LOCATION_SERVICES) {
    const result = await fetchFromService(service);
    if (result) {
      return result;
    }
  }

  return createLocalFallback();
}

/**
 * Create location from environment variable
 * Format: "City, Country" or just "Location Name"
 * @param {string} envLocation
 * @returns {Object}
 */
function createLocationFromEnv(envLocation) {
  const parts = envLocation.split(',').map(p => p.trim());
  return {
    ip: 'configured',
    city: parts[0] || 'Unknown',
    region: null,
    country: parts[1] || null,
    countryCode: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    asn: null,
    source: 'environment',
  };
}

/**
 * Create fallback location using hostname
 * @returns {Object}
 */
function createLocalFallback() {
  const os = require('os');
  const hostname = os.hostname() || 'Local';
  
  return {
    ip: 'local',
    city: hostname,
    region: null,
    country: 'Local Network',
    countryCode: 'LAN',
    latitude: null,
    longitude: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    isp: null,
    asn: null,
    source: 'hostname',
  };
}

/**
 * Fetch location data from a single service
 * @param {string} serviceUrl
 * @returns {Promise<Object|null>}
 */
async function fetchFromService(serviceUrl) {
  try {
    const response = await fetchWithTimeout(serviceUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return normalizeLocationData(data, serviceUrl);
  } catch (error) {
    logger.debug('Location service failed', { service: serviceUrl, error: error.message });
    return null;
  }
}

/**
 * Fetch with timeout
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normalize location data from different providers
 * @param {Object} data - Raw response data
 * @param {string} service - Service URL
 * @returns {Object} Normalized location data
 */
function normalizeLocationData(data, service) {
  if (service.includes('ipapi.co')) {
    return normalizeIpApiCo(data);
  }

  if (service.includes('ip-api.com')) {
    return normalizeIpApiCom(data);
  }

  if (service.includes('ipinfo.io')) {
    return normalizeIpInfo(data);
  }

  return { ip: data.ip || 'unknown', location: 'unknown' };
}

/**
 * Normalize data from ipapi.co
 * @param {Object} data
 * @returns {Object}
 */
function normalizeIpApiCo(data) {
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country_name,
    countryCode: data.country_code,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    isp: data.org,
    asn: data.asn,
  };
}

/**
 * Normalize data from ip-api.com
 * @param {Object} data
 * @returns {Object}
 */
function normalizeIpApiCom(data) {
  return {
    ip: data.query,
    city: data.city,
    region: data.regionName,
    country: data.country,
    countryCode: data.countryCode,
    latitude: data.lat,
    longitude: data.lon,
    timezone: data.timezone,
    isp: data.isp,
    asn: data.as,
  };
}

/**
 * Normalize data from ipinfo.io
 * @param {Object} data
 * @returns {Object}
 */
function normalizeIpInfo(data) {
  const [lat, lon] = parseCoordinates(data.loc);

  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country,
    countryCode: data.country,
    latitude: lat,
    longitude: lon,
    timezone: data.timezone,
    isp: data.org,
    asn: data.org,
  };
}

/**
 * Parse coordinate string "lat,lon"
 * @param {string} loc
 * @returns {Array<number|null>}
 */
function parseCoordinates(loc) {
  if (!loc) {
    return [null, null];
  }

  const parts = loc.split(',');
  if (parts.length !== 2) {
    return [null, null];
  }

  return [parseFloat(parts[0]) || null, parseFloat(parts[1]) || null];
}

/**
 * Create unknown location response
 * @returns {Object}
 */
function createUnknownLocation() {
  return {
    ip: 'unknown',
    city: null,
    region: null,
    country: null,
    countryCode: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    asn: null,
  };
}

module.exports = {
  getLocationInfo,
  normalizeLocationData,
  createUnknownLocation,
};
