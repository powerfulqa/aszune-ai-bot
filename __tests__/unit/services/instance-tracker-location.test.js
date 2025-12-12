/**
 * Tests for Instance Tracker Location Helper
 *
 * @jest-environment node
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

const {
  getLocationInfo,
  normalizeLocationData,
  createUnknownLocation,
} = require('../../../src/services/instance-tracker/helpers/location');

describe('location helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('getLocationInfo', () => {
    it('should return location from ipapi.co', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ip: '1.2.3.4',
            city: 'London',
            region: 'England',
            country_name: 'United Kingdom',
            country_code: 'GB',
            latitude: 51.5,
            longitude: -0.12,
            timezone: 'Europe/London',
            org: 'ISP Ltd',
            asn: 'AS12345',
          }),
      });

      const result = await getLocationInfo();

      expect(result.ip).toBe('1.2.3.4');
      expect(result.city).toBe('London');
      expect(result.country).toBe('United Kingdom');
      expect(result.countryCode).toBe('GB');
      expect(result.latitude).toBe(51.5);
      expect(result.timezone).toBe('Europe/London');
    });

    it('should fallback to ip-api.com if ipapi.co fails', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            query: '5.6.7.8',
            city: 'Manchester',
            regionName: 'Greater Manchester',
            country: 'United Kingdom',
            countryCode: 'GB',
            lat: 53.4,
            lon: -2.2,
            timezone: 'Europe/London',
            isp: 'ISP Corp',
            as: 'AS54321',
          }),
      });

      const result = await getLocationInfo();

      expect(result.ip).toBe('5.6.7.8');
      expect(result.city).toBe('Manchester');
      expect(result.region).toBe('Greater Manchester');
    });

    it('should fallback to ipinfo.io if others fail', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ip: '9.10.11.12',
              city: 'Birmingham',
              region: 'West Midlands',
              country: 'GB',
              loc: '52.48,-1.89',
              timezone: 'Europe/London',
              org: 'AS12345 ISP',
            }),
        });

      const result = await getLocationInfo();

      expect(result.ip).toBe('9.10.11.12');
      expect(result.city).toBe('Birmingham');
      expect(result.latitude).toBe(52.48);
      expect(result.longitude).toBe(-1.89);
    });

    it('should return local fallback location if all services fail', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false });

      const result = await getLocationInfo();

      expect(result.ip).toBe('local');
      expect(result.source).toBe('hostname');
      expect(result.country).toBe('Local Network');
    });

    it('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await getLocationInfo();

      expect(result.ip).toBe('local');
      expect(result.source).toBe('hostname');
    });

    it('should handle timeout errors', async () => {
      global.fetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });

      const result = await getLocationInfo();

      expect(result.ip).toBe('local');
      expect(result.source).toBe('hostname');
    });
  });

  describe('normalizeLocationData', () => {
    it('should normalize ipapi.co data', () => {
      const data = {
        ip: '1.2.3.4',
        city: 'London',
        region: 'England',
        country_name: 'United Kingdom',
        country_code: 'GB',
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
        org: 'ISP Ltd',
        asn: 'AS12345',
      };

      const result = normalizeLocationData(data, 'https://ipapi.co/json/');

      expect(result.ip).toBe('1.2.3.4');
      expect(result.country).toBe('United Kingdom');
      expect(result.countryCode).toBe('GB');
    });

    it('should normalize ip-api.com data', () => {
      const data = {
        query: '5.6.7.8',
        city: 'Manchester',
        regionName: 'Greater Manchester',
        country: 'United Kingdom',
        countryCode: 'GB',
        lat: 53.4,
        lon: -2.2,
        timezone: 'Europe/London',
        isp: 'ISP Corp',
        as: 'AS54321',
      };

      const result = normalizeLocationData(data, 'https://ip-api.com/json/');

      expect(result.ip).toBe('5.6.7.8');
      expect(result.latitude).toBe(53.4);
      expect(result.longitude).toBe(-2.2);
    });

    it('should normalize ipinfo.io data', () => {
      const data = {
        ip: '9.10.11.12',
        city: 'Birmingham',
        region: 'West Midlands',
        country: 'GB',
        loc: '52.48,-1.89',
        timezone: 'Europe/London',
        org: 'AS12345 ISP',
      };

      const result = normalizeLocationData(data, 'https://ipinfo.io/json');

      expect(result.ip).toBe('9.10.11.12');
      expect(result.latitude).toBe(52.48);
      expect(result.longitude).toBe(-1.89);
    });

    it('should handle missing loc in ipinfo.io data', () => {
      const data = {
        ip: '1.1.1.1',
        city: 'Test',
      };

      const result = normalizeLocationData(data, 'https://ipinfo.io/json');

      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
    });

    it('should handle unknown service', () => {
      const data = { ip: '1.2.3.4' };

      const result = normalizeLocationData(data, 'https://unknown.service.com/');

      expect(result.ip).toBe('1.2.3.4');
      expect(result.location).toBe('unknown');
    });
  });

  describe('createUnknownLocation', () => {
    it('should return object with unknown/null values', () => {
      const result = createUnknownLocation();

      expect(result.ip).toBe('unknown');
      expect(result.city).toBeNull();
      expect(result.region).toBeNull();
      expect(result.country).toBeNull();
      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
    });
  });
});
