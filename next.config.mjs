/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [{
      hostname: 'lh3.googleusercontent.com'
    },
    { hostname: "xvctobddvxmvohicrenf.supabase.co" },
    // YouTube channel avatars and video thumbnails (Channel Doctor)
    { hostname: "yt3.ggpht.com" },
    { hostname: "yt3.googleusercontent.com" },
    { hostname: "i.ytimg.com" }
    ]
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
