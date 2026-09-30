import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.POLLINATIONS_API_KEY || '';
  const configured = Boolean(key && key.trim());
  const trimmed = key.trim();
  const maskedKey = configured
    ? trimmed.length > 10
      ? `${trimmed.slice(0, 7)}••••${trimmed.slice(-4)}`
      : '••••••••'
    : '';

  return NextResponse.json({
    configured,
    maskedKey,
  });
}
