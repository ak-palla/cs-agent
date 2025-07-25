// Test Next.js environment loading
export default function handler(req, res) {
  res.status(200).json({
    NEXT_PUBLIC_TRELLO_API_KEY: process.env.NEXT_PUBLIC_TRELLO_API_KEY,
    TRELLO_API_SECRET: process.env.TRELLO_API_SECRET ? '***' : 'undefined',
    NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI,
  });
}