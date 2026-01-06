export interface TryOnProvider {
  submitTryOn(params: {
    actorImageUrl: string;
    garmentImageUrl: string;
    options?: Record<string, any>;
  }): Promise<{
    jobId?: string;
    resultUrl?: string;
    isAsync?: boolean;
  }>;

  getTryOnStatus(params: {
    jobId: string;
  }): Promise<{
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    resultUrl?: string;
    error?: string;
  }>;
}

export interface TryOnResult {
  jobId?: string;
  resultUrl?: string;
  isAsync: boolean;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

