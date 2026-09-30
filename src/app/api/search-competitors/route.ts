import { NextResponse } from 'next/server';
import { searchYouTubeMarket } from '@/lib/youtube-search';

export async function POST(req: Request) {
  try {
    const { query = '', youtubeApiKey } = await req.json();
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const envKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || youtubeApiKey;
    const competitorVideos = await searchYouTubeMarket(cleanQuery, envKey);

    return NextResponse.json({
      query: cleanQuery,
      competitorVideos,
    });
  } catch (error: any) {
    console.error('API /api/search-competitors error:', error);
    return NextResponse.json({ error: error.message || 'Failed to search competitors' }, { status: 500 });
  }
}
