// Test script to load environment variables manually
require('dotenv').config({ path: '.env.local' });

console.log('After dotenv load:');
console.log('NEXT_PUBLIC_TRELLO_API_KEY:', process.env.NEXT_PUBLIC_TRELLO_API_KEY);
console.log('TRELLO_API_SECRET:', process.env.TRELLO_API_SECRET ? '***' : 'undefined');
console.log('NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI:', process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI);