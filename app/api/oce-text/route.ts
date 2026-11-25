import { NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', claimsData.claims.sub)
    .maybeSingle();
  if (!profile?.active || (profile.role !== 'management' && profile.role !== 'production')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a PDF.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Upload the OCE report as a PDF.' }, { status: 400 });
    }
    if (file.size > 8_000_000) {
      return NextResponse.json({ error: 'That PDF is over 8 MB.' }, { status: 413 });
    }
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const extracted = await extractText(pdf, { mergePages: false });
    const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text ?? '']).map((page) => String(page));
    const blankPages = pages.flatMap((page, index) => (page.trim() ? [] : [index + 1]));
    return NextResponse.json({
      pages: pages.length,
      blankPages,
      text: pages.join('\n'),
    });
  } catch (error) {
    console.error('[oce-text] extract failed:', error);
    return NextResponse.json({ error: 'Could not read that PDF.' }, { status: 400 });
  }
}
