import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/flock/auth
 * Validate Flock bot token and return user info
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

    console.log('🔍 Flock Auth Debug - Token info:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...',
      tokenSuffix: '...' + token.substring(token.length - 10),
      tokenPattern: token.match(/^[a-zA-Z0-9-_]+$/) ? 'alphanumeric-dash-underscore' : 'contains special chars'
    });

    // Updated list of Flock API base URLs based on current platform structure
    const possibleBaseUrls = [
      'https://api.flock.co/v1',            // Main API - confirmed working
      'https://dev.flock.co/api/v1',        // Developer API
    ];

    console.log('🔍 Testing', possibleBaseUrls.length, 'possible Flock API base URLs...');

    let response;
    let user;
    let lastError = '';
    let allErrors: string[] = [];

    // Updated endpoint list with correct Flock API endpoints
    const endpoints = [
      '/users.getInfo',        // Current user info
      '/users.list',           // User list
      '/groups.list',          // Groups/channels
      '/chat.list',            // Chat messages
    ];

    // Updated authentication methods for current Flock platform
    const authMethods = [
      { 'Authorization': `Bearer ${token}` },              // Standard Bearer token
      { 'X-Flock-Token': token },                         // Flock-specific header
      { 'X-Auth-Token': token },                          // Alternative auth header
      { 'token': token },                                 // Token parameter in header
      { 'X-API-Key': token },                             // API key header
      { 'Authorization': `Token ${token}` },              // Token prefix
      { 'Flock-Token': token },                           // Direct Flock token
    ];

    const totalAttempts = possibleBaseUrls.length * endpoints.length * authMethods.length;
    console.log('🔍 Testing', endpoints.length, 'endpoints with', authMethods.length, 'auth methods across', possibleBaseUrls.length, 'base URLs... (', totalAttempts, 'total attempts)');

    // Helper function to add delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Try each base URL sequentially
    for (const baseUrl of possibleBaseUrls) {
      console.log(`🌐 Testing base URL: ${baseUrl}`);
      
      for (const endpoint of endpoints) {
        for (const authMethod of authMethods) {
          const fullUrl = `${baseUrl}${endpoint}`;
          
          try {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'User-Agent': 'CS-Agent-Dashboard/1.0',
              'Accept': 'application/json',
            };
            
            // Add auth headers
            Object.entries(authMethod).forEach(([key, value]) => {
              if (value !== undefined) {
                headers[key] = String(value);
              }
            });

            response = await fetch(fullUrl, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            const responseText = await response.text();
            console.log(`📡 Response from ${fullUrl} (${Object.keys(authMethod)[0]}): ${response.status} ${response.statusText}`);
            
            // Log response headers for debugging
            const responseHeaders = Object.fromEntries(response.headers.entries());
            console.log('📋 Response headers:', responseHeaders);
            
            if (response.ok) {
              try {
                user = JSON.parse(responseText);
                console.log(`✅ SUCCESS with ${fullUrl} using ${Object.keys(authMethod)[0]}:`, user);
                // If we get a successful response, break out of all loops
                break;
              } catch (parseError) {
                console.log(`⚠️ Response was OK but failed to parse JSON:`, parseError);
                console.log('📄 Raw response:', responseText.substring(0, 500));
                allErrors.push(`${fullUrl} (${Object.keys(authMethod)[0]}): JSON parse error - ${parseError}`);
              }
            } else {
              const errorMsg = `${fullUrl} (${Object.keys(authMethod)[0]}): ${response.status} ${response.statusText}`;
              lastError = errorMsg;
              allErrors.push(errorMsg);
              console.warn(`❌ Failed:`, errorMsg);
              
              // Log response body for 4xx errors to understand the issue better
              if (response.status >= 400 && response.status < 500 && responseText) {
                console.log('📄 Error response body:', responseText.substring(0, 300));
              }
            }
            
            // Small delay to be respectful to the API
            await delay(100);
          } catch (error) {
            const errorMsg = `${fullUrl} (${Object.keys(authMethod)[0]}): Network/Fetch error - ${error}`;
            lastError = errorMsg;
            allErrors.push(errorMsg);
            console.warn(`🚫 Error:`, errorMsg);
          }
        }
        
        // If we found a successful response, break out
        if (response && response.ok && user) {
          break;
        }
      }
      
      // If we found a successful response, break out
      if (response && response.ok && user) {
        break;
      }
    }

    // If none of the endpoints worked, return detailed error information
    if (!response || !response.ok || !user) {
      console.error('🚨 All Flock auth endpoints failed. Errors summary:');
      allErrors.forEach((error, index) => {
        console.error(`   ${index + 1}. ${error}`);
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid token or failed to verify with Flock API', 
          details: `Tested ${totalAttempts} combinations. Last error: ${lastError}`,
          allErrors: allErrors.slice(-10), // Return last 10 errors for debugging
          debugInfo: {
            tokenLength: token.length,
            tokenPrefix: token.substring(0, 10) + '...',
            baseUrlsTested: possibleBaseUrls.length,
            endpointsTested: endpoints.length,
            authMethodsTested: authMethods.length,
            totalAttempts: totalAttempts,
            suggestions: [
              "1. Verify your token is a valid Flock API token from your Flock app",
              "2. Check if you have the correct permissions in your Flock workspace",
              "3. Ensure your Flock app is properly configured and published",
              "4. Visit dev.flock.com for current API documentation",
              "5. Consider that Flock may have updated their API structure",
              "6. Try the 'Try Demo Mode' button to test the interface"
            ]
          }
        },
        { status: 401 }
      );
    }

    console.log('✅ Authentication successful:', user);
    return NextResponse.json({
      success: true,
      user,
      accessToken: token
    });

  } catch (error) {
    console.error('💥 Error validating Flock token:', error);
    return NextResponse.json(
      { error: 'Failed to validate token', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 