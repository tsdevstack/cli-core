import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockComposeDown, mockComposeUp, mockLogger } = rs.hoisted(() => ({
  mockComposeDown: rs.fn(),
  mockComposeUp: rs.fn(),
  mockLogger: {
    info: rs.fn(),
  },
}));

rs.mock('./compose-down', () => ({
  composeDown: mockComposeDown,
}));
rs.mock('./compose-up', () => ({
  composeUp: mockComposeUp,
}));
rs.mock('../../logger', () => ({
  logger: mockLogger,
}));

import { recreateAllContainers } from './recreate-all-containers';

describe('recreateAllContainers', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should call composeDown then composeUp with rootDir', () => {
    recreateAllContainers('/project');

    expect(mockComposeDown).toHaveBeenCalledWith('/project');
    expect(mockComposeUp).toHaveBeenCalledWith('/project');
  });

  it('should call composeDown before composeUp', () => {
    const callOrder: string[] = [];
    mockComposeDown.mockImplementation(() => callOrder.push('down'));
    mockComposeUp.mockImplementation(() => callOrder.push('up'));

    recreateAllContainers('/project');

    expect(callOrder).toEqual(['down', 'up']);
  });

  it('should default rootDir to process.cwd()', () => {
    recreateAllContainers();

    expect(mockComposeDown).toHaveBeenCalledWith(process.cwd());
    expect(mockComposeUp).toHaveBeenCalledWith(process.cwd());
  });
});
