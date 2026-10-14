import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // If Supabase is not configured: allow only in local development. In any other
  // environment fail closed, otherwise a missing env var would disable all auth.
  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV !== 'production') {
      return supabaseResponse;
    }
    const { pathname } = request.nextUrl;
    const isPublicPage =
      !pathname.startsWith('/api/') &&
      !pathname.startsWith('/admin') &&
      !['/dashboard', '/project', '/storyboard', '/voice-studio', '/youtube-kit-studio', '/export', '/settings'].some(
        (p) => pathname.startsWith(p)
      );
    if (isPublicPage) return supabaseResponse;
    return pathname.startsWith('/api/')
      ? NextResponse.json({ success: false, error: 'Service unavailable.' }, { status: 503 })
      : new NextResponse('Service unavailable', { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Important: getUser() validates authentication against the Supabase Auth server securely
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Categorize routes
  // Allow public GET for plans so pricing page can display them without admin login
  const isPublicAdminApi = pathname === '/api/admin/plan' && request.method === 'GET';
  const isAdminRoute =
    !isPublicAdminApi && (pathname.startsWith('/admin') || pathname.startsWith('/api/admin'));
  // Allow-list: every /api route requires a signed-in user unless listed here.
  // (New routes are therefore protected by default.)
  const PUBLIC_API_PREFIXES = [
    '/api/models',
    '/api/styles',
    '/api/voice/models',
    '/api/voice/voices',
  ];
  const isPublicApiRoute =
    isPublicAdminApi ||
    (request.method === 'GET' && PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')));
  const isProtectedApiRoute =
    pathname.startsWith('/api/') && !pathname.startsWith('/api/admin') && !isPublicApiRoute;
  const isUserPrivateRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/project') ||
    pathname.startsWith('/storyboard') ||
    pathname.startsWith('/voice-studio') ||
    pathname.startsWith('/youtube-kit-studio') ||
    pathname.startsWith('/export') ||
    pathname.startsWith('/settings');

  // Helper to carry over proxied cookies on redirect
  const createRedirectResponse = (url: URL) => {
    const redirectRes = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value, c);
    });
    return redirectRes;
  };

  // 1. Unauthenticated user trying to access private, admin, or protected API routes
  if (!user && (isUserPrivateRoute || isAdminRoute || isProtectedApiRoute)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return createRedirectResponse(url);
  }

  // 2. Admin Route Protection: Check role in Supabase profiles
  if (isAdminRoute) {
    let isAdmin = false;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      isAdmin = profile?.role === 'admin';
    }

    if (!isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Not found' },
          { status: 404 }
        );
      }
      // Completely hide the admin page by serving the 404 Not Found page
      return NextResponse.rewrite(new URL('/', request.url),);
    }
  }

  // 3. Logged-in user visiting /login -> redirect to /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return createRedirectResponse(url);
  }

  return supabaseResponse;
}
