import { describe, it, expect, beforeAll } from '@rstest/core';
import { generateApi } from 'swagger-typescript-api';

/**
 * Renders the DTO templates the way generate-client does (modular, custom
 * templates) and checks the generated class-validator decorators.
 */
async function renderDataContracts(
  schemas: Record<string, unknown>,
): Promise<string> {
  const { files } = await generateApi({
    spec: {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
      paths: {},
      components: { schemas },
    },
    output: false,
    modular: true,
    templates: __dirname,
    silent: true,
  });

  const dataContracts = files.find(
    (file) => file.fileName === 'data-contracts',
  );
  if (!dataContracts) {
    throw new Error('data-contracts was not generated');
  }
  return dataContracts.fileContent;
}

/**
 * The decorator and declaration lines of one property: properties are
 * separated by blank lines, the first one follows the class header.
 */
function propertyBlock(content: string, property: string): string {
  const lines = content.split('\n');
  const end = lines.findIndex((line) =>
    new RegExp(`^\\s+${property}\\??:`).test(line),
  );
  if (end === -1) {
    throw new Error(`Property "${property}" was not generated`);
  }
  let start = end;
  while (
    start > 0 &&
    lines[start - 1].trim() !== '' &&
    !lines[start - 1].startsWith('export class')
  ) {
    start--;
  }
  return lines.slice(start, end + 1).join('\n');
}

describe('interface-data-contract template', () => {
  let content: string;

  beforeAll(async () => {
    content = await renderDataContracts({
      Item: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      Sample: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          scores: { type: 'array', items: { type: 'integer' } },
          flags: { type: 'array', items: { type: 'boolean' } },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Item' },
          },
          nullableTags: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
          },
          name: { type: 'string' },
          count: { type: 'number' },
          active: { type: 'boolean' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
          item: { $ref: '#/components/schemas/Item' },
          labels: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          upload: { type: 'string', format: 'binary' },
        },
        required: ['tags', 'name'],
      },
    });
  });

  describe('Arrays', () => {
    it('should validate each item of a string array', () => {
      const block = propertyBlock(content, 'tags');
      expect(block).toContain('@IsArray()');
      expect(block).toContain('@IsString({ each: true })');
      expect(block).not.toContain('@IsString()');
    });

    it('should validate each item of number and boolean arrays', () => {
      expect(propertyBlock(content, 'scores')).toContain(
        '@IsNumber({}, { each: true })',
      );
      expect(propertyBlock(content, 'flags')).toContain(
        '@IsBoolean({ each: true })',
      );
    });

    it('should validate a nullable array as an array', () => {
      const block = propertyBlock(content, 'nullableTags');
      expect(block).toContain('@IsArray()');
      expect(block).toContain('@IsString({ each: true })');
    });

    it('should only check the array itself for arrays of objects', () => {
      const block = propertyBlock(content, 'items');
      expect(block).toContain('@IsArray()');
      expect(block).not.toContain('each: true');
    });
  });

  describe('Scalars', () => {
    it('should validate strings, numbers and booleans', () => {
      expect(propertyBlock(content, 'name')).toContain('@IsString()');
      expect(propertyBlock(content, 'count')).toContain('@IsNumber()');
      expect(propertyBlock(content, 'active')).toContain('@IsBoolean()');
    });

    it('should validate a string enum as a string', () => {
      expect(propertyBlock(content, 'status')).toContain('@IsString()');
    });
  });

  describe('Edge cases', () => {
    it('should not add a string validator to a map of strings', () => {
      expect(propertyBlock(content, 'labels')).not.toMatch(
        /@Is(String|Number|Boolean|Array)/,
      );
    });

    it('should not add a string validator to a binary (file) field', () => {
      expect(propertyBlock(content, 'upload')).not.toMatch(/@IsString/);
    });

    it('should not add validators to a nested object reference', () => {
      expect(propertyBlock(content, 'item')).not.toMatch(
        /@Is(String|Number|Boolean|Array)/,
      );
    });

    it('should render extra properties of an object as an index signature', async () => {
      const mixed = await renderDataContracts({
        Mixed: {
          type: 'object',
          properties: { id: { type: 'string' } },
          additionalProperties: { type: 'string' },
        },
      });

      expect(mixed).toContain('export class Mixed');
      expect(mixed).toMatch(/\[key: string\]: any;/);
    });
  });
});
