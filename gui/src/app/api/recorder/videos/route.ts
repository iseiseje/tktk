import { NextResponse } from 'next/server';
import { getRecordedVideos, deleteVideo } from '@/lib/recorder-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const videos = getRecordedVideos();
    return NextResponse.json({
      success: true,
      videos,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { filename } = await req.json();
    if (!filename) {
      return NextResponse.json({ success: false, error: 'Filename is required' }, { status: 400 });
    }

    const deleted = deleteVideo(filename);
    if (deleted) {
      return NextResponse.json({ success: true, message: `File ${filename} deleted.` });
    } else {
      return NextResponse.json({ success: false, error: `Failed to delete ${filename} or file not found` }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
