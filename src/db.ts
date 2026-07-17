import { Database } from "bun:sqlite";

export type Category = "idea" | "todo";
export type TodoStatus = "pending" | "done";

export interface MessageRow {
  id: number;
  created_at: string;
  content: string;
  category: Category;
}

export interface TodoRow {
  id: number;
  message_id: number;
  created_at: string;
  text: string;
  status: TodoStatus;
}

export interface IdeaRow {
  id: number;
  message_id: number;
  created_at: string;
  summary: string;
  tags: string | null;
}

const db = new Database(process.env.DB_PATH ?? "app.db");
db.run("PRAGMA foreign_keys = ON");

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('idea', 'todo')),
    cotera_raw TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    tags TEXT
  )
`);

const insertMessageStatement = db.prepare(`
  INSERT INTO messages (created_at, content, category, cotera_raw)
  VALUES ($created_at, $content, $category, $cotera_raw)
`);

const insertTodoStatement = db.prepare(`
  INSERT INTO todos (message_id, created_at, text)
  VALUES ($message_id, $created_at, $text)
`);

const insertIdeaStatement = db.prepare(`
  INSERT INTO ideas (message_id, created_at, summary, tags)
  VALUES ($message_id, $created_at, $summary, $tags)
`);

const listMessagesStatement = db.query(`
  SELECT id, created_at, content, category
  FROM messages
  ORDER BY datetime(created_at) DESC, id DESC
`);

const listTodosStatement = db.query(`
  SELECT id, message_id, created_at, text, status
  FROM todos
  ORDER BY datetime(created_at) DESC, id DESC
`);

const listIdeasStatement = db.query(`
  SELECT id, message_id, created_at, summary, tags
  FROM ideas
  ORDER BY datetime(created_at) DESC, id DESC
`);

export function insertMessage(input: {
  createdAt: string;
  content: string;
  category: Category;
  coteraRaw: unknown;
}): number {
  const result = insertMessageStatement.run({
    $created_at: input.createdAt,
    $content: input.content,
    $category: input.category,
    $cotera_raw: JSON.stringify(input.coteraRaw ?? null),
  });

  return Number(result.lastInsertRowid);
}

export function insertTodos(messageId: number, createdAt: string, todos: string[]) {
  const insertTodosTransaction = db.transaction((items: string[]) => {
    for (const text of items) {
      insertTodoStatement.run({
        $message_id: messageId,
        $created_at: createdAt,
        $text: text,
      });
    }
  });

  insertTodosTransaction(todos);
}

export function insertIdeas(messageId: number, createdAt: string, ideas: string[]) {
  const insertIdeasTransaction = db.transaction((items: string[]) => {
    for (const summary of items) {
      insertIdeaStatement.run({
        $message_id: messageId,
        $created_at: createdAt,
        $summary: summary,
        $tags: null,
      });
    }
  });

  insertIdeasTransaction(ideas);
}

export function listMessages(): MessageRow[] {
  return listMessagesStatement.all() as MessageRow[];
}

export function listTodos(): TodoRow[] {
  return listTodosStatement.all() as TodoRow[];
}

export function listIdeas(): IdeaRow[] {
  return listIdeasStatement.all() as IdeaRow[];
}
