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

  // If Supabase is not configured, bypass authentication check
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
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
  const isProtectedApiRoute =
    pathname.startsWith('/api/generate-packaging') ||
    pathname.startsWith('/api/breakdown-script') ||
    pathname.startsWith('/api/enhance-thumbnail-prompt') ||
    pathname.startsWith('/api/search-competitors') ||
    pathname.startsWith('/api/transcribe-audio');
  const isUserPrivateRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/project') ||
    pathname.startsWith('/storyboard') ||
    pathname.startsWith('/voice-studio') ||
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
