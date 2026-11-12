import { NextResponse } from 'next/server';
import { errorResponse, HttpError, requireRole } from '@/lib/server/auth';
import { loadDictionaryPdf, loadManifest } from '@/lib/server/registry-store';

/** The DOT's Company Census data dictionary (PDF), as of the latest census file import. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const [pdf, manifest] = await Promise.all([loadDictionaryPdf(), loadManifest()]);
    if (!pdf) throw new HttpError(404, 'The data dictionary hasn’t been downloaded yet.');
    const name = (manifest?.dictionary?.name || 'MCMIS_Company_Census_Data_Dictionary.pdf').replace(/[^\w.() -]+/g, '_');
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
