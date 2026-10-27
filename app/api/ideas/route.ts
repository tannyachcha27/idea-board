import type { NextRequest } from 'next/server';
import { body, checkOrigin, database, failure, field, voter, voteToken } from '@/lib/server';
import type { Idea } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const offset = Math.max(0, Math.min(100000, Number(params.get('offset')) || 0));
    const order = params.get('sort') === 'new' ? 'created_at.desc,id.asc' : 'vote_count.desc,created_at.desc,id.asc';
    const ideas: Idea[] = await database(`idea_board?select=*&order=${order}&limit=21&offset=${offset}`);
    const hasMore = ideas.length > 20;
    const page = ideas.slice(0, 20);
    const id = await voter();
    let voted = new Set<string>();
    if (id && page.length) {
      const tokens = page.map(i => voteToken(i.id, id));
      const rows: {idea_id: string}[] = await database(`votes?select=idea_id&id=in.(${tokens.join(',')})`);
      voted = new Set(rows.map(row => row.idea_id));
    }
    return Response.json({ ideas: page.map(i => ({...i, voted: voted.has(i.id)})), hasMore }, {headers: {'Cache-Control':'private, no-store'}});
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const data = await body(request);
    const idea = {title: field(data, 'title', 3, 100), description: field(data, 'description', 10, 1000), author_nickname: field(data, 'author_nickname', 2, 30)};
    await database('ideas', {method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify(idea)}, await voter(true));
    return Response.json({ok:true}, {status:201});
  } catch (error) { return failure(error); }
}
