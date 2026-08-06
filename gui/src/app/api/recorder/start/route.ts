import { NextResponse } from 'next/server';
import { startRecording } from '@/lib/recorder-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session = startRecording(body);
    return NextResponse.json({
      success: true,
      session,
      message: `Recording started for ${session.user} (Mode: ${session.mode})`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed starting recording session' },
      { status: 400 }
    );
  }
}
