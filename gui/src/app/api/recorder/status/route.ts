import { NextResponse } from 'next/server';
import { getSystemStats, getSessions } from '@/lib/recorder-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = getSystemStats();
    const sessions = getSessions();
    return NextResponse.json({
      success: true,
      stats,
      sessions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
