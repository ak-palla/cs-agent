/**
 * Utility functions for making requests to Mattermost through proxy routes
 * to avoid CORS issues when running on localhost
 */

export class MattermostProxy {
  /**
   * Make a GET request to Mattermost through the proxy
   */
  static async get(path: string, token?: string): Promise<Response> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(`/api/proxy/mattermost?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      headers,
    });
  }
  
  /**
   * Make a POST request to Mattermost through the proxy
   */
  static async post(path: string, body: any, token?: string): Promise<Response> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(`/api/proxy/mattermost?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }
  
  /**
   * Test HTTP connectivity through proxy
   */
  static async testConnectivity(): Promise<boolean> {
    try {
      const response = await MattermostProxy.get('/api/v4/system/ping');
      return response.ok;
    } catch (error) {
      console.error('Proxy connectivity test failed:', error);
      return false;
    }
  }
}

export default MattermostProxy;