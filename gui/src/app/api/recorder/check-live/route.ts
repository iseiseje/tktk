import { NextResponse } from 'next/server';
import { checkLiveStatus } from '@/lib/recorder-service';

export async function POST(req: Request) {
  try {
    const { target } = await req.json();
    if (!target) {
      return NextResponse.json({ success: false, error: 'Target (username/URL/room_id) is required' }, { status: 400 });
    }

    const result = await checkLiveStatus(target);
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
