// Deploy with Supabase CLI: supabase functions deploy trigger-collect
// Secrets: GITHUB_DISPATCH_TOKEN, OWNER_USER_ID, SUPABASE_URL, SUPABASE_ANON_KEY
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://aptness96-lgtm.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, "Method not allowed");
  const bearer = req.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) return reply(401, "로그인이 필요합니다.");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const owner = Deno.env.get("OWNER_USER_ID");
  const githubToken = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  if (!supabaseUrl || !publicKey || !owner || !githubToken) return reply(503, "서버 설정이 완료되지 않았습니다.");
  try {
    const client = createClient(supabaseUrl, publicKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(bearer.slice(7));
    if (error || !data.user) return reply(401, "로그인 세션이 유효하지 않습니다.");
    if (data.user.id !== owner) return reply(403, "관리자만 수집을 실행할 수 있습니다.");

    const gh = await fetch(
      "https://api.github.com/repos/aptness96-lgtm/rescene-private/actions/workflows/collect-notices.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "rescene-private-trigger",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );
    if (gh.status !== 204) {
      console.error("GitHub workflow dispatch failed", gh.status);
      return reply(502, "수집 실행 요청에 실패했습니다. GitHub 토큰 권한을 확인해 주세요.");
    }
    return reply(202, "수집 작업을 요청했어요. GitHub Actions에서 실행되며 완료 후 승인 대기함에 표시됩니다.");
  } catch (error) {
    console.error("Trigger failure", error instanceof Error ? error.name : "unknown");
    return reply(500, "수집 실행 중 오류가 발생했습니다.");
  }
});
