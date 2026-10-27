import type { NextRequest } from 'next/server';
import { body, BoardError, checkOrigin, database, failure, field, voter, voteToken } from '@/lib/server';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const data = await body(request);
    const ideaId = field(data, 'idea_id', 36, 36);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ideaId)) throw new BoardError(400, 'Invalid idea.');
    const voterId = (await voter(true))!;
    await database('votes', {method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({id:voteToken(ideaId, voterId),idea_id:ideaId,voter_id:voterId})}, voterId);
    return Response.json({ok:true}, {status:201});
  } catch (error) { return failure(error); }
}
