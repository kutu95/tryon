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
      // FASHN API status endpoint - based on app.fashn.ai/api/requests pattern
      // Try /requests/{id} first, then fallback to /status/{id}
      let response: Response;
      let data: any;
      
      // Try /requests/{id} endpoint first
      response = await fetch(`https://api.fashn.ai/v1/requests/${params.jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If /requests/{id} fails, try /status/{id}
        console.log(`[FASHN] /requests/${params.jobId} returned ${response.status}, trying /status/${params.jobId}`);
        response = await fetch(`${this.baseUrl}/status/${params.jobId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
      }

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
          jobId: params.jobId,
        });
        throw new Error(`FASHN API error (${response.status}): ${error.message || error.detail || errorText || response.statusText}`);
      }

      data = await response.json();
      console.log('[FASHN] Status response:', JSON.stringify(data, null, 2));

      // Map FASHN status to our status
      let status: 'queued' | 'running' | 'succeeded' | 'failed';
      
      if (data.status === 'succeeded' || data.status === 'completed' || data.status === 'done') {
        status = 'succeeded';
      } else if (data.status === 'failed' || data.status === 'error' || data.status === 'canceled') {
        status = 'failed';
      } else if (data.status === 'processing' || data.status === 'running' || data.status === 'in_progress') {
        status = 'running';
      } else {
        // starting, queued, pending, etc.
        status = 'queued';
      }

      // Extract result URL from response
      // FASHN results are typically at: https://cdn.fashn.ai/{id}/output_0.png
      let resultUrl: string | undefined;
      
      // Check various possible fields for the result URL
      if (data.output) {
        if (Array.isArray(data.output) && data.output.length > 0) {
          resultUrl = data.output[0];
        } else if (typeof data.output === 'string') {
          resultUrl = data.output;
        } else if (data.output.url) {
          resultUrl = data.output.url;
        }
      }
      
      // If no output found, construct URL from job ID (FASHN pattern: cdn.fashn.ai/{id}/output_0.png)
      if (!resultUrl && status === 'succeeded' && params.jobId) {
        // Try constructing the URL based on FASHN's CDN pattern
        resultUrl = `https://cdn.fashn.ai/${params.jobId}/output_0.png`;
        console.log('[FASHN] Constructed result URL from job ID:', resultUrl);
      }
      
      // Also check other possible fields
      if (!resultUrl) {
        if (data.result_url) resultUrl = data.result_url;
        else if (data.image_url) resultUrl = data.image_url;
        else if (data.url) resultUrl = data.url;
        else if (data.result) resultUrl = data.result;
      }

      console.log('[FASHN] Extracted result URL:', resultUrl);

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
      console.error('Error stack:', error.stack);
      return {
        status: 'failed',
        error: error.message || 'Failed to get try-on status',
      };
    }
  }
}

