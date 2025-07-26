import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip middleware for webhook routes completely
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/flock/webhook') || 
      pathname.startsWith('/webhook/') || 
      pathname === '/flock-webhook') {
    return NextResponse.next();
  }
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api routes - /api/* (API endpoints should not require auth)
     * - webhook routes - /webhook/* (webhook endpoints should not require auth)
     * - flock-webhook - /flock-webhook (alternative webhook endpoint)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|webhook/|flock-webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
