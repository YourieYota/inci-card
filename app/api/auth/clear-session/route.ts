import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Redirect on the address the browser used, not NEXTAUTH_URL (which may point to another host/port)
  const response = NextResponse.redirect(new URL('/login', request.url));

  // Clear all possible next-auth session cookies
  const cookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ];

  cookieNames.forEach((name) => {
    response.cookies.set(name, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
    });
  });

  return response;
}
