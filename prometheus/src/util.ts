import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';
import { isPrometheusInstalled, KubernetesType } from './request';

export const PLUGIN_NAME = 'prometheus';

/**
 * ClusterData type represents the configuration data for a cluster.
 * @property {boolean} autoDetect - Whether to auto-detect Prometheus metrics.
 * @property {boolean} isMetricsEnabled - Whether metrics are enabled for the cluster.
 * @property {string} address - The address of the Prometheus service.
 * @property {string} defaultTimespan - The default timespan for metrics.
 * @property {string} defaultGraphResolution - The default graph resolution for metrics.
 */
type ClusterData = {
  autoDetect?: boolean;
  isMetricsEnabled?: boolean;
  address?: string;
  defaultTimespan?: string;
  defaultGraphResolution?: string;
};

/**
 * Conf type represents the configuration data for the prometheus plugin.
 * @property {[cluster: string]: ClusterData} - The configuration data for each cluster.
 */
type Conf = {
  [cluster: string]: ClusterData;
};

/**
 * getConfigStore returns the config store for the prometheus plugin.
 * @returns {ConfigStore<Conf>} The config store.
 */
export function getConfigStore(): ConfigStore<Conf> {
  return new ConfigStore<Conf>(PLUGIN_NAME);
}

/**
 * getClusterConfig returns the configuration for a specific cluster.
 * @param {string} cluster - The name of the cluster.
 * @returns {ClusterData | null} The configuration for the cluster, or null if not found.
 */
export function getClusterConfig(cluster: string): ClusterData | null {
  const configStore = getConfigStore();
  const conf = configStore.get();
  if (!cluster || !conf) {
    return null;
  }
  return conf[cluster] || null;
}

/**
 * enableMetrics enables metrics for a specific cluster.
 * @param {string} cluster - The name of the cluster.
 */
export function enableMetrics(cluster: string) {
  const store = getConfigStore();
  const config = store.get() || {};
  const clusterConfig = config[cluster] || { autoDetect: true };
  store.update({
    ...config,
    [cluster]: {
      ...clusterConfig,
      isMetricsEnabled: true,
    },
  });
}

/**
 * disableMetrics disables metrics for a specific cluster.
 * @param {string} cluster - The name of the cluster.
 */
export function disableMetrics(cluster: string) {
  const store = getConfigStore();
  const config = store.get() || {};
  const clusterConfig = config[cluster] || { autoDetect: true };
  store.update({
    ...config,
    [cluster]: {
      ...clusterConfig,
      isMetricsEnabled: false,
    },
  });
}

/**
 * isMetricsEnabled checks if metrics are enabled for a specific cluster.
 * @param {string} cluster - The name of the cluster.
 * @returns {boolean} True if metrics are enabled, false otherwise.
 */
export function isMetricsEnabled(cluster: string): boolean {
  const clusterData = getClusterConfig(cluster);
  return clusterData?.isMetricsEnabled ?? false;
}

/**
 * getPrometheusPrefix returns the prefix for the Prometheus metrics.
 * @param {string} cluster - The name of the cluster.
 * @returns {Promise<string | null>} The prefix for the Prometheus metrics, or null if not found.
 */
export async function getPrometheusPrefix(cluster: string): Promise<string | null> {
  // check if cluster has autoDetect enabled
  // if so return the prometheus pod address
  const clusterData = getClusterConfig(cluster);
  if (clusterData?.autoDetect) {
    const prometheusEndpoint = await isPrometheusInstalled();
    if (prometheusEndpoint.type === KubernetesType.none) {
      return null;
    }
    const prometheusPortStr = prometheusEndpoint.port ? `:${prometheusEndpoint.port}` : '';
    return `${prometheusEndpoint.namespace}/${prometheusEndpoint.type}/${prometheusEndpoint.name}${prometheusPortStr}`;
  }

  if (clusterData?.address) {
    const [namespace, service] = clusterData?.address.split('/');
    return `${namespace}/services/${service}`;
  }
  return null;
}

/**
 * getPrometheusInterval returns the default timespan for the Prometheus metrics.
 * @param {string} cluster - The name of the cluster.
 * @returns {string} The default timespan for the Prometheus metrics.
 */
export function getPrometheusInterval(cluster: string): string {
  const clusterData = getClusterConfig(cluster);
  return clusterData?.defaultTimespan ?? '24h';
}

/**
 * getPrometheusGraphResolution returns the default graph resolution for the Prometheus metrics.
 * @param {string} cluster - The name of the cluster.
 * @returns {string} The default graph resolution for the Prometheus metrics.
 */
export function getPrometheusGraphResolution(cluster: string): string {
  const clusterData = getClusterConfig(cluster);
  return clusterData?.defaultGraphResolution ?? 'medium';
}

export const ChartEnabledKinds = [
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'Job',
  'CronJob',
  'PersistentVolumeClaim',
];

/**
 * Creates a formatter function that formats timestamps based on the given interval.
 * The formatter maintains state to avoid rendering duplicate timestamps.
 *
 * @param {string} interval - The time interval to format for (e.g. '10m', '1h', '24h', 'week')
 * @returns {function(number): string} A formatter function that takes a timestamp and returns a formatted string
 *
 * @example
 * const formatter = createTickTimestampFormatter('24h');
 * formatter(1698321684); // Returns "10:30"
 * formatter(1698321744); // Returns "" (if same formatted time as previous)
 *
 * Formats:
 * - For intervals <= 48h: "HH:MM" (e.g. "14:30")
 * - For today/yesterday: "HH:00" (e.g. "14:00")
 * - For week/lastweek/7d/14d: "M/D" (e.g. "10/26")
 */
export function createTickTimestampFormatter(interval: string) {
  let prevRenderedTimestamp = null;

  return function (timestamp) {
    const date = new Date(timestamp * 1000);
    let format: string;

    // Determine format based on interval
    switch (interval) {
      case '10m':
      case '30m':
      case '1h':
      case '3h':
      case '6h':
      case '12h':
      case '24h':
      case '48h':
        format = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        break;
      case 'today':
      case 'yesterday':
        format = `${date.getHours()}:00`;
        break;
      case 'week':
      case 'lastweek':
      case '7d':
      case '14d':
        format = `${date.getMonth() + 1}/${date.getDate()}`;
        break;
      default:
        format = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // Check if the current timestamp is different from the previously rendered one
    const shouldRenderDate = format !== prevRenderedTimestamp;

    // Update the previous timestamp
    prevRenderedTimestamp = format;

    return shouldRenderDate ? format : '';
  };
}

/**
 * Processes raw Prometheus response data into a format suitable for charting.
 * @param {any} response - The raw response from Prometheus API containing time series data
 * @returns {Array<{timestamp: number, y: number}>} An array of data points with timestamps and values
 */
export function dataProcessor(response: any): { timestamp: number; y: number }[] {
  const data: { timestamp: number; y: number }[] = [];
  // convert the response to a JSON object
  response?.data?.result?.[0]?.values.forEach(element => {
    // convert value to a number
    data.push({ timestamp: element[0], y: Number(element[1]) });
  });
  return data;
}

/**
 * Formats a number of bytes into a human-readable string with appropriate units.
 * @param {number} bytes - The number of bytes to format
 * @returns {string} A formatted string with the bytes value and appropriate unit (B, KB, MB, GB, or TB)
 * @example
 * formatBytes(1024) // Returns "1.00KB"
 * formatBytes(1234567) // Returns "1.18MB"
 */
export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + units[i];
}

/**
 * Calculates the time range based on the given interval.
 * @param {string} interval - The time interval (e.g., '10m', '1h', '24h', 'week').
 * @returns {Object} An object containing the 'from' timestamp and 'to' timestamp in seconds.
 */
export function getTimeRange(interval: string): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400; // seconds in a day

  switch (interval) {
    case '10m':
      return { from: now - 600, to: now };
    case '30m':
      return { from: now - 1800, to: now };
    case '1h':
      return { from: now - 3600, to: now };
    case '3h':
      return { from: now - 10800, to: now };
    case '6h':
      return { from: now - 21600, to: now };
    case '12h':
      return { from: now - 43200, to: now };
    case '24h':
      return { from: now - day, to: now };
    case '48h':
      return { from: now - 2 * day, to: now };
    case 'today':
      return { from: now - (now % day), to: now };
    case 'yesterday':
      return { from: now - (now % day) - day, to: now - (now % day) };
    case 'week':
      return { from: now - 7 * day, to: now };
    case 'lastweek':
      return { from: now - 14 * day, to: now - 7 * day };
    case '7d':
      return { from: now - 7 * day, to: now };
    case '14d':
      return { from: now - 14 * day, to: now };
    default:
      return { from: now - 600, to: now }; // Default to 10 minutes
  }
}

/**
 * Calculates the step size based on a given graph resolution level and time range.
 * @param {string} graphResolution - The resolution level or fixed interval
 *        (e.g., 'low', 'medium', 'high', '10s', '1m', '1h').
 * @param {number} range - The total time range in milliseconds over which
 *        the graph is to be plotted.
 * @returns {number} The calculated step size in milliseconds.
 */
export function getStepSize(graphResolution: string, range: number) {
  const graphResolutionFactors: Record<string, number> = {
    low: 100,
    medium: 250,
    high: 750,
  };

  if (graphResolution in graphResolutionFactors) {
    const factor = graphResolutionFactors[graphResolution];
    return Math.max(Math.floor(range / factor / 1000) * 1000, 1000);
  }

  const fixedSteps: Record<string, number> = {
    '10s': 10000,
    '30s': 30000,
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '1h': 3600000,
  };

  if (graphResolution in fixedSteps) {
    return fixedSteps[graphResolution];
  }

  const fallbackFactor = graphResolutionFactors.medium; // Default to medium graph resolution
  return Math.max(Math.floor(range / fallbackFactor / 1000) * 1000, 1000);
}
