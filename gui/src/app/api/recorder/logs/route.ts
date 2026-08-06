import { NextResponse } from 'next/server';
import { getSessions } from '@/lib/recorder-service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    const sessions = getSessions();
    if (sessionId) {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        sessionId,
        status: session.status,
        logs: session.logs,
      });
    }

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        user: s.user,
        status: s.status,
        logCount: s.logs.length,
        latestLog: s.logs[s.logs.length - 1] || '',
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
