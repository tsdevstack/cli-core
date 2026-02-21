/**
 * Write Prometheus and Grafana configuration files
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeYamlFile } from '../../fs';
import type { FrameworkConfig } from '../../config';

/**
 * Write Prometheus configuration
 */
function writePrometheusConfig(rootDir: string, config: FrameworkConfig): void {
  const prometheusDir = path.join(rootDir, 'prometheus');

  // Create directory if it doesn't exist
  if (!fs.existsSync(prometheusDir)) {
    fs.mkdirSync(prometheusDir, { recursive: true });
  }

  // Build scrape targets from services
  const scrapeConfigs = [
    {
      job_name: 'prometheus',
      static_configs: [{ targets: ['localhost:9090'] }],
    },
  ];

  // Add each NestJS service as a scrape target
  for (const service of config.services) {
    if (service.type === 'nestjs') {
      const port = service.port || 3000;
      scrapeConfigs.push({
        job_name: service.name,
        static_configs: [{ targets: [`host.docker.internal:${port}`] }],
      });
    }
  }

  const prometheusConfig = {
    global: {
      scrape_interval: '15s',
      evaluation_interval: '15s',
    },
    scrape_configs: scrapeConfigs,
  };

  writeYamlFile(path.join(prometheusDir, 'prometheus.yml'), prometheusConfig);
}

/**
 * Write Grafana provisioning configuration
 */
function writeGrafanaConfigs(rootDir: string): void {
  const grafanaDir = path.join(rootDir, 'grafana');
  const provisioningDir = path.join(grafanaDir, 'provisioning');
  const datasourcesDir = path.join(provisioningDir, 'datasources');
  const dashboardsProvisioningDir = path.join(provisioningDir, 'dashboards');
  const dashboardsDir = path.join(grafanaDir, 'dashboards');

  // Create directories
  for (const dir of [datasourcesDir, dashboardsProvisioningDir, dashboardsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Write datasource config
  const datasourceConfig = {
    apiVersion: 1,
    datasources: [
      {
        name: 'Prometheus',
        type: 'prometheus',
        access: 'proxy',
        url: 'http://prometheus:9090',
        isDefault: true,
        editable: false,
      },
    ],
  };
  writeYamlFile(path.join(datasourcesDir, 'prometheus.yml'), datasourceConfig);

  // Write dashboard provisioning config
  const dashboardProvisioningConfig = {
    apiVersion: 1,
    providers: [
      {
        name: 'default',
        orgId: 1,
        folder: '',
        type: 'file',
        disableDeletion: false,
        editable: true,
        options: {
          path: '/var/lib/grafana/dashboards',
        },
      },
    ],
  };
  writeYamlFile(
    path.join(dashboardsProvisioningDir, 'dashboard.yml'),
    dashboardProvisioningConfig
  );

  // Write services dashboard
  const servicesDashboard = createServicesDashboard();
  fs.writeFileSync(
    path.join(dashboardsDir, 'services.json'),
    JSON.stringify(servicesDashboard, null, 2)
  );
}

/**
 * Create a basic services dashboard
 */
function createServicesDashboard(): object {
  return {
    annotations: { list: [] },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    id: null,
    links: [],
    panels: [
      {
        datasource: { type: 'prometheus', uid: 'prometheus' },
        fieldConfig: {
          defaults: {
            color: { mode: 'palette-classic' },
            custom: {
              axisBorderShow: false,
              axisCenteredZero: false,
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 10,
              gradientMode: 'none',
              lineWidth: 1,
              pointSize: 5,
              showPoints: 'auto',
              spanNulls: false,
              stacking: { group: 'A', mode: 'none' },
            },
            mappings: [],
            thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
            unit: 's',
          },
          overrides: [],
        },
        gridPos: { h: 8, w: 12, x: 0, y: 0 },
        id: 1,
        options: {
          legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true },
          tooltip: { mode: 'single', sort: 'none' },
        },
        title: 'HTTP Request Duration (p95)',
        type: 'timeseries',
        targets: [
          {
            datasource: { type: 'prometheus', uid: 'prometheus' },
            expr: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))',
            legendFormat: '{{job}}',
            refId: 'A',
          },
        ],
      },
      {
        datasource: { type: 'prometheus', uid: 'prometheus' },
        fieldConfig: {
          defaults: {
            color: { mode: 'palette-classic' },
            custom: {
              axisBorderShow: false,
              axisCenteredZero: false,
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 10,
              gradientMode: 'none',
              lineWidth: 1,
              pointSize: 5,
              showPoints: 'auto',
              spanNulls: false,
              stacking: { group: 'A', mode: 'none' },
            },
            mappings: [],
            thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
            unit: 'reqps',
          },
          overrides: [],
        },
        gridPos: { h: 8, w: 12, x: 12, y: 0 },
        id: 2,
        options: {
          legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true },
          tooltip: { mode: 'single', sort: 'none' },
        },
        title: 'Request Rate',
        type: 'timeseries',
        targets: [
          {
            datasource: { type: 'prometheus', uid: 'prometheus' },
            expr: 'sum(rate(http_requests_total[5m])) by (job)',
            legendFormat: '{{job}}',
            refId: 'A',
          },
        ],
      },
      {
        datasource: { type: 'prometheus', uid: 'prometheus' },
        fieldConfig: {
          defaults: {
            color: { mode: 'palette-classic' },
            custom: {
              axisBorderShow: false,
              axisCenteredZero: false,
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 10,
              gradientMode: 'none',
              lineWidth: 1,
              pointSize: 5,
              showPoints: 'auto',
              spanNulls: false,
              stacking: { group: 'A', mode: 'none' },
            },
            mappings: [],
            thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
            unit: 'bytes',
          },
          overrides: [],
        },
        gridPos: { h: 8, w: 12, x: 0, y: 8 },
        id: 3,
        options: {
          legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true },
          tooltip: { mode: 'single', sort: 'none' },
        },
        title: 'Memory Usage',
        type: 'timeseries',
        targets: [
          {
            datasource: { type: 'prometheus', uid: 'prometheus' },
            expr: 'process_resident_memory_bytes',
            legendFormat: '{{job}}',
            refId: 'A',
          },
        ],
      },
      {
        datasource: { type: 'prometheus', uid: 'prometheus' },
        fieldConfig: {
          defaults: {
            color: { mode: 'palette-classic' },
            custom: {
              axisBorderShow: false,
              axisCenteredZero: false,
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 10,
              gradientMode: 'none',
              lineWidth: 1,
              pointSize: 5,
              showPoints: 'auto',
              spanNulls: false,
              stacking: { group: 'A', mode: 'none' },
            },
            mappings: [],
            thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
            unit: 'percent',
          },
          overrides: [],
        },
        gridPos: { h: 8, w: 12, x: 12, y: 8 },
        id: 4,
        options: {
          legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true },
          tooltip: { mode: 'single', sort: 'none' },
        },
        title: 'Error Rate',
        type: 'timeseries',
        targets: [
          {
            datasource: { type: 'prometheus', uid: 'prometheus' },
            expr: 'sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (job) / sum(rate(http_requests_total[5m])) by (job) * 100',
            legendFormat: '{{job}}',
            refId: 'A',
          },
        ],
      },
    ],
    refresh: '5s',
    schemaVersion: 39,
    tags: ['services'],
    templating: { list: [] },
    time: { from: 'now-1h', to: 'now' },
    timepicker: {},
    timezone: 'browser',
    title: 'Services Dashboard',
    uid: 'services-dashboard',
    version: 1,
    weekStart: '',
  };
}

/**
 * Write all monitoring configuration files
 */
export function writeMonitoringConfigs(
  rootDir: string,
  config: FrameworkConfig
): void {
  writePrometheusConfig(rootDir, config);
  writeGrafanaConfigs(rootDir);
}