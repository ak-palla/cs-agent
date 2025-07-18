import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/flock/test-token
 * Comprehensive token testing endpoint to diagnose authentication issues
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    console.log('Testing token format:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + '...',
      tokenPattern: token.match(/^[a-zA-Z0-9-_]+$/) ? 'alphanumeric' : 'contains special chars'
    });

    // Updated list of Flock API base URLs based on current platform structure
    const baseUrls = [
      'https://api.flock.co/v1',            // Main API - confirmed working
      'https://dev.flock.co/api/v1',        // Developer API
    ];

    // Test endpoints
    const endpoints = [
      '/users.getInfo',
      '/users.list',
      '/groups.list',
      '/chat.list'
    ];

    // Authentication methods to test
    const authMethods = [
      { name: 'Bearer Token', headers: { 'Authorization': `Bearer ${token}` } },
      { name: 'X-Flock-Token', headers: { 'X-Flock-Token': token } },
      { name: 'X-Auth-Token', headers: { 'X-Auth-Token': token } },
      { name: 'Token Header', headers: { 'token': token } },
      { name: 'X-API-Key', headers: { 'X-API-Key': token } },
      { name: 'Token Prefix', headers: { 'Authorization': `Token ${token}` } },
    ];

    const results = [];
    let successCount = 0;
    let totalTests = 0;

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        for (const authMethod of authMethods) {
          totalTests++;
          const fullUrl = `${baseUrl}${endpoint}`;
          
          try {
            const headers = {
              'Content-Type': 'application/json',
              'User-Agent': 'CS-Agent-Dashboard/1.0',
              'Accept': 'application/json',
              ...authMethod.headers
            };

            const response = await fetch(fullUrl, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(8000) // 8 second timeout
            });

            const responseText = await response.text();
            let parsedResponse = null;
            
            try {
              parsedResponse = JSON.parse(responseText);
            } catch (parseError) {
              // Response is not JSON, that's okay
            }

            const result = {
              baseUrl,
              endpoint,
              authMethod: authMethod.name,
              fullUrl,
              status: response.status,
              statusText: response.statusText,
              success: response.ok,
              headers: Object.fromEntries(response.headers.entries()),
              bodyPreview: responseText.substring(0, 200),
              isJson: parsedResponse !== null,
              responseSize: responseText.length
            };

            if (response.ok) {
              successCount++;
              result.data = parsedResponse || responseText.substring(0, 100);
            }

            results.push(result);

            console.log(`Test ${totalTests}: ${fullUrl} (${authMethod.name}) -> ${response.status}`);
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 50));
            
          } catch (error) {
            results.push({
              baseUrl,
              endpoint,
              authMethod: authMethod.name,
              fullUrl,
              error: error instanceof Error ? error.message : String(error),
              success: false
            });
          }
        }
      }
    }

    // Analyze results
    const analysis = {
      totalTests,
      successCount,
      successRate: (successCount / totalTests * 100).toFixed(2) + '%',
      workingEndpoints: results.filter(r => r.success),
      commonErrors: {},
      suggestions: []
    };

    // Count common error patterns
    results.filter(r => !r.success).forEach(result => {
      const key = result.status ? `${result.status} ${result.statusText}` : 'Network Error';
      analysis.commonErrors[key] = (analysis.commonErrors[key] || 0) + 1;
    });

    // Generate suggestions based on results
    if (successCount === 0) {
      analysis.suggestions.push('No successful authentication found - token may be invalid or expired');
      analysis.suggestions.push('Check if your Flock app is properly configured in your workspace');
      analysis.suggestions.push('Verify the token is from the Flock team messaging platform (not FLock.io)');
    }

    if (Object.keys(analysis.commonErrors).includes('404 Not Found')) {
      analysis.suggestions.push('Many 404 errors suggest API endpoints may have changed');
      analysis.suggestions.push('Check dev.flock.com for updated API documentation');
    }

    if (Object.keys(analysis.commonErrors).includes('401 Unauthorized')) {
      analysis.suggestions.push('401 errors indicate authentication format issues');
      analysis.suggestions.push('Verify your token has the correct permissions');
    }

    return NextResponse.json({
      success: true,
      tokenInfo: {
        length: token.length,
        prefix: token.substring(0, 10) + '...',
        pattern: token.match(/^[a-zA-Z0-9-_]+$/) ? 'alphanumeric' : 'contains special chars'
      },
      analysis,
      results: results.slice(0, 20), // Limit results to prevent overwhelming response
      fullResultsCount: results.length
    });

  } catch (error) {
    console.error('Error testing token:', error);
    return NextResponse.json(
      { error: 'Failed to test token', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}