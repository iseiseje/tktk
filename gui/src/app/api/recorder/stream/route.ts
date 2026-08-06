import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/recorder-service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      return new NextResponse('Filename query parameter missing', { status: 400 });
    }

    const settings = getSettings();
    const safeName = path.basename(fileName);
    const filePath = path.join(settings.outputDir, safeName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // MIME type based on extension
    const ext = path.extname(safeName).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.mkv') contentType = 'video/x-matroska';
    else if (ext === '.flv') contentType = 'video/x-flv';
    else if (ext === '.ts') contentType = 'video/mp2t';
    else if (ext === '.avi') contentType = 'video/x-msvideo';
    else if (ext === '.mov') contentType = 'video/quicktime';

    const range = req.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      const headers = new Headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
      });

      return new NextResponse(stream as any, {
        status: 206,
        headers,
      });
    } else {
      const stream = fs.createReadStream(filePath);
      const headers = new Headers({
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      return new NextResponse(stream as any, {
        status: 200,
        headers,
      });
    }
  } catch (err: any) {
    return new NextResponse(`Error streaming file: ${err.message}`, { status: 500 });
  }
}
