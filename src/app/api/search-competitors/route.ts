import { NextResponse } from 'next/server';
import { searchYouTubeMarket } from '@/lib/youtube-search';
import { TEXT_LIMITS } from '@/lib/input-limits';
import { requireUser } from '@/lib/youtube/route-auth';

export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  try {
    const { query = '', youtubeApiKey } = await req.json();
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }
    if (cleanQuery.length > TEXT_LIMITS.searchQuery) {
      return NextResponse.json(
        { error: `Search query must be ${TEXT_LIMITS.searchQuery} characters or fewer.` },
        { status: 400 }
      );
    }

    const { videos, status } = await searchYouTubeMarket(cleanQuery, {
      apiKey: typeof youtubeApiKey === 'string' ? youtubeApiKey : null,
      userId: auth.user.id,
    });

    return NextResponse.json({ query: cleanQuery, competitorVideos: videos, searchStatus: status });
  } catch (error) {
    console.error('API /api/search-competitors error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Failed to search competitors' }, { status: 500 });
  }
}
