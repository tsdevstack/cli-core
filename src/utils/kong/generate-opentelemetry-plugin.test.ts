import { describe, it, expect } from '@rstest/core';
import { generateOpenTelemetryPlugin } from './generate-opentelemetry-plugin';

describe('generateOpenTelemetryPlugin', () => {
  describe('Standard use cases', () => {
    it("should send Kong's spans to the endpoint at the environment's rate", () => {
      expect(
        generateOpenTelemetryPlugin({
          tracesEndpoint: 'http://localhost:4318/v1/traces',
          sampleRate: 0.25,
        }),
      ).toEqual({
        name: 'opentelemetry',
        config: {
          traces_endpoint: 'http://localhost:4318/v1/traces',
          sampling_rate: 0.25,
          resource_attributes: { 'service.name': 'kong' },
          propagation: {
            extract: ['w3c'],
            inject: ['w3c'],
            default_format: 'w3c',
          },
        },
      });
    });
  });

  describe('Edge cases', () => {
    it('should keep a rate of 0', () => {
      expect(
        generateOpenTelemetryPlugin({
          tracesEndpoint: 'http://jaeger:4318/v1/traces',
          sampleRate: 0,
        }).config.sampling_rate,
      ).toBe(0);
    });
  });
});
