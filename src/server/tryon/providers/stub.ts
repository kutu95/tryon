import { TryOnProvider } from './types';

/**
 * Stub provider that immediately returns a result.
 * For MVP, it returns the actor image as a placeholder.
 * In production, this would be replaced with a real provider.
 */
export class StubProvider implements TryOnProvider {
  async submitTryOn(params: {
    actorImageUrl: string;
    garmentImageUrl: string;
    options?: Record<string, any>;
  }): Promise<{
    jobId?: string;
    resultUrl?: string;
    isAsync?: boolean;
  }> {
    // Stub provider immediately returns the actor image as the result
    // This allows the app to work end-to-end without a real provider
    return {
      resultUrl: params.actorImageUrl,
      isAsync: false,
    };
  }

  async getTryOnStatus(params: {
    jobId: string;
  }): Promise<{
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    resultUrl?: string;
    error?: string;
  }> {
    // Stub provider doesn't use async jobs, but we implement this for interface compliance
    return {
      status: 'succeeded',
    };
  }
}

