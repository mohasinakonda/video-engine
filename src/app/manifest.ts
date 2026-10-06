import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rendoza AI - AI Video Studio',
    short_name: 'Rendoza AI',
    description: 'Turn your scripts into cinematic AI videos with voiceovers, subtitles, and scenes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#E05A30',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
