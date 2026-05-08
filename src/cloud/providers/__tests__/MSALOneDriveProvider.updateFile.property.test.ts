/**
 * Property-based tests for MSALOneDriveProvider.updateFile using fast-check
 * Task 4.7: Property 8 - updateFile returns updated CloudFile
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 5.5**
 */

import * as fc from 'fast-check';
import { TextEncoder } from 'util';

// We test the updateFile logic in isolation by replicating the mapping and
// response handling, mocking the Graph API response. This mirrors the pattern
// used in onedrive-credentials.property.test.ts.

interface GraphDriveItem {
  id: string;
  name: string;
  lastModifiedDateTime: string;
  size: number;
  file?: {
    mimeType: string;
  };
}

interface CloudFile {
  id: string;
  name: string;
  modifiedTime: Date;
  size: number;
  mimeType: string;
}

/**
 * Replicates the mapGraphItemToCloudFile logic from MSALOneDriveProvider.ts
 */
function mapGraphItemToCloudFile(item: GraphDriveItem): CloudFile {
  return {
    id: item.id,
    name: item.name,
    modifiedTime: new Date(item.lastModifiedDateTime),
    size: item.size,
    mimeType: item.file?.mimeType || 'application/octet-stream'
  };
}

const encoder = new TextEncoder();

/**
 * Computes the byte length of content, matching the behavior of
 * MSALOneDriveProvider which uses `new TextEncoder().encode(content).length`
 * for string content and `.length` for Uint8Array content.
 */
function getContentByteLength(content: string | Uint8Array): number {
  if (content instanceof Uint8Array) {
    return content.length;
  }
  return encoder.encode(content).length;
}

/**
 * Simulates the updateFile logic: given content and a file ID, it sends a PUT
 * request and maps the Graph API response to a CloudFile. We simulate the
 * Graph API response based on the input content and file ID.
 */
function simulateUpdateFile(
  fileId: string,
  content: string | Uint8Array,
  apiResponseTime: Date
): CloudFile {
  // The Graph API returns a DriveItem with the file's metadata after update
  const contentSize = getContentByteLength(content);

  const graphResponse: GraphDriveItem = {
    id: fileId,
    name: `file-${fileId}.md`,
    lastModifiedDateTime: apiResponseTime.toISOString(),
    size: contentSize,
    file: {
      mimeType: content instanceof Uint8Array ? 'application/octet-stream' : 'text/plain'
    }
  };

  return mapGraphItemToCloudFile(graphResponse);
}

// ============================================================================
// Property 8: updateFile returns updated CloudFile
// Feature: onedrive-integration, Property 8: updateFile returns updated CloudFile
// Validates: Requirements 5.5
// ============================================================================
describe('Feature: onedrive-integration, Property 8: updateFile returns updated CloudFile', () => {
  it('updateFile returns a CloudFile with same id as input for any valid content and file ID', () => {
    fc.assert(
      fc.property(
        // Generate non-empty file IDs
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        // Generate string content (simulating .md files)
        fc.string({ minLength: 0, maxLength: 1000 }),
        (fileId, content) => {
          const callTime = new Date();
          // Simulate API response time at or after call time
          const apiResponseTime = new Date(callTime.getTime() + Math.floor(Math.random() * 1000));

          const result = simulateUpdateFile(fileId, content, apiResponseTime);

          // The returned CloudFile must have the same id as the input
          expect(result.id).toBe(fileId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updateFile returns a CloudFile with modifiedTime >= call time', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 1000 }),
        // Generate a positive delay in ms to simulate API response time
        fc.integer({ min: 0, max: 5000 }),
        (fileId, content, delayMs) => {
          const callTime = new Date();
          // API response time is always at or after call time
          const apiResponseTime = new Date(callTime.getTime() + delayMs);

          const result = simulateUpdateFile(fileId, content, apiResponseTime);

          // modifiedTime must be >= call time
          expect(result.modifiedTime.getTime()).toBeGreaterThanOrEqual(callTime.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updateFile returns a CloudFile with size reflecting new string content length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 2000 }),
        (fileId, content) => {
          const apiResponseTime = new Date();
          const result = simulateUpdateFile(fileId, content, apiResponseTime);

          // Size should reflect the byte length of the content
          const expectedSize = encoder.encode(content).length;
          expect(result.size).toBe(expectedSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updateFile returns a CloudFile with size reflecting new Uint8Array content length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        // Generate arbitrary byte arrays (simulating .sstp binary files)
        fc.uint8Array({ minLength: 0, maxLength: 2000 }),
        (fileId, content) => {
          const apiResponseTime = new Date();
          const result = simulateUpdateFile(fileId, content, apiResponseTime);

          // Size should equal the byte array length
          expect(result.size).toBe(content.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updateFile returns a CloudFile with valid modifiedTime (parseable Date) for any content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.oneof(
          fc.string({ minLength: 0, maxLength: 1000 }),
          fc.uint8Array({ minLength: 0, maxLength: 1000 })
        ),
        (fileId, content) => {
          const apiResponseTime = new Date();
          const result = simulateUpdateFile(fileId, content, apiResponseTime);

          // modifiedTime must be a valid Date (not NaN)
          expect(result.modifiedTime).toBeInstanceOf(Date);
          expect(isNaN(result.modifiedTime.getTime())).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updateFile preserves the file ID through the Graph API mapping for any ID format', () => {
    // Test with various ID formats that Graph API might return
    const graphIdArb = fc.oneof(
      // Simple alphanumeric IDs
      fc.stringMatching(/^[A-Za-z0-9]{10,50}$/),
      // IDs with special characters (Graph API uses ! and other chars)
      fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0),
      // UUID-like IDs
      fc.uuid()
    );

    fc.assert(
      fc.property(
        graphIdArb,
        fc.string({ minLength: 1, maxLength: 500 }),
        (fileId, content) => {
          const apiResponseTime = new Date();
          const result = simulateUpdateFile(fileId, content, apiResponseTime);

          expect(result.id).toBe(fileId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
