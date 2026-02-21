export interface OperationContext {
  operation: 'remove' | 'add' | 'normal';
  removedService?: string;     // For remove
}