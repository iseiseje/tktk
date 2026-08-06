import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/recorder-service';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const settings = updateSettings(body);
    return NextResponse.json({
      success: true,
      settings,
      message: 'Settings updated successfully!',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
