export default async (req: Request) => {
  return new Response(JSON.stringify({ ok: true, message: 'function deployed' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
