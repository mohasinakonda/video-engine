import { NextResponse } from 'next/server';
import {
  getChannelDoctorSettings,
  saveChannelDoctorSettings,
  settingsUpdateSchema,
  validateDeepInfraModel,
} from '@/lib/youtube/settings';
import { requireAdmin } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/** GET /api/admin/channel-doctor — current settings (admins only). */
export async function GET() {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  return NextResponse.json({ settings: await getChannelDoctorSettings() });
}

/** PUT /api/admin/channel-doctor — validate (including every model on DeepInfra) and save. */
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;

  const parsed = settingsUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `${issue.path.join('.') || 'settings'}: ${issue.message}` }, { status: 400 });
  }

  const checks = await Promise.all([
    ...parsed.data.textModels.map((id) => validateDeepInfraModel(id, 'text')),
    ...parsed.data.visionModels.map((id) => validateDeepInfraModel(id, 'vision')),
    ...parsed.data.discover.embeddingModels.map((id) => validateDeepInfraModel(id, 'embedding')),
  ]);
  const modelErrors = checks.filter((message): message is string => Boolean(message));
  if (modelErrors.length > 0) {
    return NextResponse.json({ error: modelErrors.join(' ') }, { status: 400 });
  }

  try {
    return NextResponse.json({ settings: await saveChannelDoctorSettings(parsed.data) });
  } catch (err) {
    console.error('[admin/channel-doctor] save failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
