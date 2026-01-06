import { TryOnProvider } from './types';

/**
 * FASHN AI provider for virtual try-on
 * Documentation: https://docs.fashn.ai
 * 
 * FASHN AI API structure (from official docs):
 * - POST /v1/run with model_name and inputs
 * - Uses Bearer token authentication
 * - Base URL: https://api.fashn.ai/v1/
 */
export class FashnProvider implements TryOnProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.fashn.ai/v1';

  constructor() {
    const apiKey = process.env.FASHN_API_KEY;
    if (!apiKey) {
      console.error('FASHN_API_KEY not found in environment variables');
      throw new Error('FASHN_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
    console.log('FashnProvider initialized with API key:', apiKey.substring(0, 10) + '...');
  }

  async submitTryOn(params: {
    actorImageUrl: string;
    garmentImageUrl: string;
    options?: Record<string, any>;
  }): Promise<{
    jobId?: string;
    resultUrl?: string;
    isAsync?: boolean;
  }> {
    try {
      // FASHN API uses /v1/run endpoint with model_name and inputs
      const response = await fetch(`${this.baseUrl}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: 'tryon-v1.6',
          inputs: {
            model_image: params.actorImageUrl,
            garment_image: params.garmentImageUrl,
            ...params.options,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText || response.statusText };
        }
        console.error('FASHN API submitTryOn error response:', {
          status: response.status,
          statusText: response.statusText,
          error: error,
          errorText: errorText,
          url: `${this.baseUrl}/run`,
        });
        throw new Error(`FASHN API error (${response.status}): ${error.message || error.detail || errorText || response.statusText}`);
      }

      const data = await response.json();

      // FASHN API /v1/run endpoint response structure
      // Check if result is immediately available (synchronous)
      if (data.output) {
        const output = Array.isArray(data.output) ? data.output[0] : data.output;
        if (output && typeof output === 'string' && output.startsWith('http')) {
          return {
            resultUrl: output,
            isAsync: false,
          };
        }
      }

      // If there's a job ID for async processing
      if (data.id || data.job_id || data.prediction_id) {
        return {
          jobId: data.id || data.job_id || data.prediction_id,
          isAsync: true,
        };
      }

      // If output is directly in the response
      if (data.result || data.image_url) {
        return {
          resultUrl: data.result || data.image_url,
          isAsync: false,
        };
      }

      // Fallback: assume async and return any ID found
      return {
        jobId: data.id || data.uuid || 'unknown',
        isAsync: true,
      };
    } catch (error: any) {
      console.error('FASHN API submitTryOn error:', error);
      console.error('Request URL:', `${this.baseUrl}/run`);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.status,
      });
      throw error;
    }
  }

  async getTryOnStatus(params: {
    jobId: string;
  }): Promise<{
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    resultUrl?: string;
    error?: string;
  }> {
    try {
      // FASHN status endpoint - may need to be adjusted based on actual API
      // Try common patterns: /status/{id}, /predictions/{id}, /jobs/{id}
      const response = await fetch(`${this.baseUrl}/status/${params.jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText || response.statusText };
        }
        console.error('FASHN API getTryOnStatus error response:', {
          status: response.status,
          statusText: response.statusText,
          error: error,
          errorText: errorText,
          url: `${this.baseUrl}/status/${params.jobId}`,
        });
        throw new Error(`FASHN API error (${response.status}): ${error.message || error.detail || errorText || response.statusText}`);
      }

      const data = await response.json();

      // Map Replicate/FASHN status to our status
      // Replicate statuses: starting, processing, succeeded, failed, canceled
      let status: 'queued' | 'running' | 'succeeded' | 'failed';
      
      if (data.status === 'succeeded') {
        status = 'succeeded';
      } else if (data.status === 'failed' || data.status === 'canceled') {
        status = 'failed';
      } else if (data.status === 'processing' || data.status === 'running') {
        status = 'running';
      } else {
        // starting, queued, etc.
        status = 'queued';
      }

      // Extract result URL from output
      // Replicate returns output as an array of URLs or a single URL
      let resultUrl: string | undefined;
      if (data.output) {
        if (Array.isArray(data.output) && data.output.length > 0) {
          resultUrl = data.output[0];
        } else if (typeof data.output === 'string') {
          resultUrl = data.output;
        } else if (data.output.url) {
          resultUrl = data.output.url;
        }
      }

      // Extract error message if failed
      let error: string | undefined;
      if (status === 'failed') {
        if (data.error) {
          error = typeof data.error === 'string' ? data.error : data.error.message || 'Try-on generation failed';
        } else {
          error = 'Try-on generation failed';
        }
      }

      return {
        status,
        resultUrl,
        error,
      };
    } catch (error: any) {
      console.error('FASHN API status error:', error);
      return {
        status: 'failed',
        error: error.message || 'Failed to get try-on status',
      };
    }
  }
}

