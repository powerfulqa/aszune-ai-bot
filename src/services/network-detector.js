const logger = require('../utils/logger');
const { exec } = require('child_process');
const { promisify } = require('util');
const dns = require('dns').promises;

const execPromise = promisify(exec);

/**
 * Network detection service - handles DNS, gateway, DHCP detection
 * Extracted to reduce WebDashboardService complexity
 */
class NetworkDetector {
  /**
   * Detect gateway IP and reachability
   */
  static async detectGateway() {
    try {
      const command = this._getGatewayCommand();
      if (!command) return { gatewayIp: 'Not detected', reachable: false };

      const { stdout } = await execPromise(command, { timeout: 5000 });
      const gateway = stdout.trim().split('\n')[0]?.trim();

      if (gateway && gateway.match(/^(\d+\.){3}\d+$/)) {
        return { gatewayIp: gateway, reachable: true };
      }
    } catch (error) {
      logger.debug(`Failed to detect gateway: ${error.message}`);
    }

    return { gatewayIp: 'Not detected', reachable: false };
  }

  /**
   * Detect DNS servers based on platform
   */
  static async detectDnsServers() {
    try {
      return process.platform === 'win32'
        ? await this._detectDnsWindows()
        : await this._detectDnsLinux();
    } catch (error) {
      logger.warn(`Failed to detect DNS servers: ${error.message}`);
      return ['8.8.8.8'];
    }
  }

  /**
   * Detect DHCP or Static IP assignment
   */
  static async detectDhcpOrStatic() {
    try {
      return process.platform === 'win32'
        ? await this._detectDhcpWindows()
        : await this._detectDhcpLinux();
    } catch (error) {
      logger.warn(`Failed to detect DHCP/Static: ${error.message}`);
      return 'Unknown';
    }
  }

  /**
   * Get network connectivity status
   */
  static async getNetworkStatus() {
    const checks = {
      dns: false,
      gateway: false,
      internet: false,
      gatewayIp: null,
      dnsServers: [],
      ipAssignment: 'Unknown',
    };

    // Detect gateway
    const gatewayResult = await this.detectGateway();
    checks.gatewayIp = gatewayResult.gatewayIp;
    checks.gateway = gatewayResult.reachable;

    // Detect DNS servers
    checks.dnsServers = await this.detectDnsServers();
    logger.info(`DNS servers detected: ${checks.dnsServers.join(', ')}`);

    // Detect DHCP vs Static
    checks.ipAssignment = await this.detectDhcpOrStatic();
    logger.info(`IP assignment detected: ${checks.ipAssignment}`);

    // Test DNS resolution
    for (const dnsServer of checks.dnsServers) {
      if (await this._testDns(dnsServer)) {
        checks.dns = true;
        break;
      }
    }

    // Test internet connectivity
    if (await this._testInternet()) {
      checks.internet = true;
    }

    return {
      connected: checks.internet || checks.dns,
      internetReachable: checks.internet,
      dnsReachable: checks.dns,
      gatewayReachable: checks.gateway,
      gatewayIp: checks.gatewayIp,
      dnsServers: checks.dnsServers,
      ipAssignment: checks.ipAssignment,
    };
  }

  // ========== PRIVATE HELPERS ==========

  static _getGatewayCommand() {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      return "ip route | grep default | awk '{print $3}' | head -1";
    }
    if (process.platform === 'win32') {
      return 'route print | findstr /R "0.0.0.0.*0.0.0.0" | findstr /V "255.255.255.255"';
    }
    return null;
  }

  static async _detectDnsWindows() {
    const { stdout } = await execPromise('ipconfig /all', { timeout: 5000 });
    const dnsServers = [];

    stdout.split('\n').forEach((line, idx, lines) => {
      if (line.includes('DNS Servers')) {
        const match = line.match(/:\s*(\d+\.\d+\.\d+\.\d+)/);
        if (match) dnsServers.push(match[1]);
      } else if (line.trim().match(/^\d+\.\d+\.\d+\.\d+$/) && dnsServers.length > 0) {
        dnsServers.push(line.trim());
      }
    });

    logger.debug(
      `Detected ${dnsServers.length} DNS servers on Windows: ${dnsServers.join(', ')}`
    );
    return dnsServers.length > 0 ? dnsServers : ['8.8.8.8'];
  }

  static async _detectDnsLinux() {
    const { stdout } = await execPromise('cat /etc/resolv.conf', { timeout: 5000 });
    const dnsServers = stdout
      .split('\n')
      .filter((line) => line.trim().startsWith('nameserver'))
      .map((line) => line.split(/\s+/)[1])
      .filter((ip) => ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/));

    logger.debug(
      `Detected ${dnsServers.length} DNS servers from /etc/resolv.conf: ${dnsServers.join(', ')}`
    );
    return dnsServers.length > 0 ? dnsServers : ['8.8.8.8'];
  }

  static async _detectDhcpWindows() {
    const { stdout } = await execPromise('ipconfig /all', { timeout: 5000 });
    const dhcpEnabled = stdout.includes('DHCP Enabled') && stdout.match(/DHCP Enabled[.\s:]*Yes/i);
    const result = dhcpEnabled ? 'DHCP' : 'Static';
    logger.debug(`Detected IP assignment on Windows: ${result}`);
    return result;
  }

  static async _detectDhcpLinux() {
    // Try DietPi config first
    const dietPiResult = await this._checkDietPiConfig();
    if (dietPiResult) return dietPiResult;

    // Try /etc/network/interfaces
    const interfacesResult = await this._checkNetworkInterfaces();
    if (interfacesResult) return interfacesResult;

    // Try NetworkManager
    const nmResult = await this._checkNetworkManager();
    if (nmResult) return nmResult;

    // Try systemd-networkd
    const systemdResult = await this._checkSystemdNetworkd();
    if (systemdResult) return systemdResult;

    await this._checkDhclientProcess();
    logger.debug('Could not definitively detect IP assignment method from config files');
    return 'Unknown';
  }

  static async _checkDietPiConfig() {
    try {
      const { stdout } = await execPromise(
        'cat /boot/dietpi.txt 2>/dev/null | grep -E "^AUTO_SETUP_NET_USESTATIC"',
        { timeout: 2000 }
      );
      if (stdout.includes('AUTO_SETUP_NET_USESTATIC=1')) {
        logger.debug('Detected IP assignment from DietPi config: Static');
        return 'Static';
      }
      if (stdout.includes('AUTO_SETUP_NET_USESTATIC=0')) {
        logger.debug('Detected IP assignment from DietPi config: DHCP');
        return 'DHCP';
      }
    } catch (dietpiError) {
      logger.debug(`DietPi config check failed: ${dietpiError.message}`);
    }
    return null;
  }

  static async _checkNetworkInterfaces() {
    try {
      const { stdout } = await execPromise('cat /etc/network/interfaces 2>/dev/null', {
        timeout: 2000,
      });
      if (
        stdout.includes('iface eth0 inet static') ||
        stdout.includes('iface wlan0 inet static')
      ) {
        logger.debug('Detected IP assignment from /etc/network/interfaces: Static');
        return 'Static';
      }
      if (
        stdout.includes('iface eth0 inet dhcp') ||
        stdout.includes('iface wlan0 inet dhcp')
      ) {
        logger.debug('Detected IP assignment from /etc/network/interfaces: DHCP');
        return 'DHCP';
      }
    } catch {
      // interfaces file not found
    }
    return null;
  }

  static async _checkNetworkManager() {
    try {
      const { stdout } = await execPromise(
        'nmcli -t -f DEVICE,IP4.METHOD dev show 2>/dev/null | grep -v lo',
        { timeout: 3000 }
      );
      if (stdout.includes('manual')) {
        logger.debug('Detected IP assignment via NetworkManager: Static');
        return 'Static';
      }
      if (stdout.includes('auto') || stdout.includes('dhcp')) {
        logger.debug('Detected IP assignment via NetworkManager: DHCP');
        return 'DHCP';
      }
    } catch {
      // NetworkManager not available
    }
    return null;
  }

  static async _checkSystemdNetworkd() {
    try {
      const { stdout } = await execPromise(
        'networkctl status 2>/dev/null | grep -E "Address|DHCP"',
        { timeout: 2000 }
      );
      if (stdout.includes('DHCP4: yes') || stdout.includes('DHCP6: yes')) {
        logger.debug('Detected IP assignment via systemd-networkd: DHCP');
        return 'DHCP';
      }
      if (stdout.includes('DHCP4: no') && stdout.includes('DHCP6: no')) {
        logger.debug('Detected IP assignment via systemd-networkd: Static');
        return 'Static';
      }
    } catch {
      // systemd-networkd not available
    }
    return null;
  }

  static async _checkDhclientProcess() {
    try {
      await execPromise('pgrep dhclient', { timeout: 2000 });
      logger.debug('Detected dhclient process running (may indicate DHCP)');
    } catch {
      // No dhclient process
    }
  }

  static async _testDns(dnsServer) {
    try {
      const pingCmd =
        process.platform === 'win32' ? `ping -n 1 ${dnsServer}` : `ping -c 1 ${dnsServer}`;
      await execPromise(pingCmd, { timeout: 3000 });
      try {
        await dns.resolve4('google.com');
        return true;
      } catch {
        logger.debug('DNS resolution failed despite reachable DNS server');
        return false;
      }
    } catch (error) {
      logger.debug(`DNS server ${dnsServer} not reachable`);
      return false;
    }
  }

  static async _testInternet() {
    try {
      const pingCmd =
        process.platform === 'win32' ? 'ping -n 1 8.8.8.8' : 'ping -c 1 8.8.8.8';
      await execPromise(pingCmd, { timeout: 5000 });
      return true;
    } catch (error) {
      logger.debug('Internet ping failed');
      return false;
    }
  }
}

module.exports = NetworkDetector;
