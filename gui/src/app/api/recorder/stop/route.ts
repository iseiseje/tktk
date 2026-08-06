import { NextResponse } from 'next/server';
import { stopRecording } from '@/lib/recorder-service';

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });
    }

    const stopped = stopRecording(sessionId);
    return NextResponse.json({
      success: true,
      stopped,
      message: stopped ? `Session ${sessionId} stopped.` : `Session ${sessionId} was not active or already finished.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
