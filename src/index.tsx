import { serve } from "bun";
import { categorizeMessage } from "./coteraClient";
import { insertIdeas, insertMessage, insertTodos, listIdeas, listMessages, listTodos } from "./db";
import index from "./index.html";

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function createMessage(req: Request) {
  const body = await readJson(req);
  const content = isObject(body) && typeof body.content === "string" ? body.content.trim() : "";

  if (!content) return errorResponse("Message content is required.");

  const createdAt = new Date().toISOString();
  const categorization = await categorizeMessage(content);
  const messageId = insertMessage({
    createdAt,
    content,
    category: categorization.category,
    coteraRaw: categorization.coteraRaw,
  });

  insertTodos(messageId, createdAt, categorization.todos);
  insertIdeas(messageId, createdAt, categorization.ideas);

  return Response.json(
    {
      id: messageId,
      created_at: createdAt,
      content,
      category: categorization.category,
      todos: categorization.todos,
      ideas: categorization.ideas,
    },
    { status: 201 },
  );
}

async function handleApi(req: Request, pathname: string) {
  if (pathname === "/api/messages") {
    if (req.method === "GET") return Response.json(listMessages());
    if (req.method === "POST") return await createMessage(req);
  }

  if (pathname === "/api/todos" && req.method === "GET") return Response.json(listTodos());
  if (pathname === "/api/ideas" && req.method === "GET") return Response.json(listIdeas());

  return errorResponse("Not found.", 404);
}

const server = serve({
  routes: {
    "/api/*": async req => {
      const url = new URL(req.url);
      return await handleApi(req, url.pathname);
    },
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
