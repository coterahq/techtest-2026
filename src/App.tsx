import { useEffect, useState, type FormEvent } from "react";
import "./index.css";

type Category = "idea" | "todo";
type Route = "home" | "todos" | "ideas";

interface MessageRow {
  id: number;
  created_at: string;
  content: string;
  category: Category;
}

interface CreatedMessage extends MessageRow {
  todos: string[];
  ideas: string[];
}

interface TodoRow {
  id: number;
  message_id: number;
  created_at: string;
  text: string;
  status: "pending" | "done";
}

function routeFromPathname(pathname: string): Route {
  if (pathname === "/todos") return "todos";
  if (pathname === "/ideas") return "ideas";
  return "home";
}

function pathForRoute(route: Route) {
  if (route === "todos") return "/todos";
  if (route === "ideas") return "/ideas";
  return "/";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function categoryClasses(category: Category) {
  return category === "todo"
    ? "border-amber-200 bg-amber-100 text-amber-900"
    : "border-sky-200 bg-sky-100 text-sky-900";
}

function NavButton({ current, route, onNavigate, children }: {
  current: Route;
  route: Route;
  onNavigate: (route: Route) => void;
  children: string;
}) {
  const active = current === route;

  return (
    <button
      type="button"
      onClick={() => onNavigate(route)}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function HomePage() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/messages");
        if (!response.ok) throw new Error("Could not load messages.");
        const data = await response.json() as MessageRow[];
        if (!cancelled) setMessages(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      const data = await response.json() as CreatedMessage | { error?: string };
      if (!response.ok) throw new Error("error" in data && data.error ? data.error : "Could not save message.");

      setMessages(previous => [data as CreatedMessage, ...previous]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Capture a thought</h1>
          <p className="mt-2 text-sm text-slate-600">
            Drop stream-of-consciousness notes here. The server classifies them as ideas or todos and extracts the useful bits.
          </p>
        </div>

        <form onSubmit={submitMessage} className="flex flex-col gap-3">
          <textarea
            value={content}
            onChange={event => setContent(event.target.value)}
            rows={6}
            placeholder="Type whatever is on your mind..."
            className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 p-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-200"
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Stored locally in SQLite. Cotera runs server-side.</p>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Saving..." : "Save message"}
            </button>
          </div>
        </form>

        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Message log</h2>
            <p className="text-sm text-slate-500">Newest messages first.</p>
          </div>
          <span className="text-sm text-slate-500">{messages.length} total</span>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map(message => (
              <li key={message.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <time className="text-sm text-slate-500" dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                  <span className={["rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide", categoryClasses(message.category)].join(" ")}>{message.category}</span>
                </div>
                <p className="whitespace-pre-wrap leading-7 text-slate-800">{message.content}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function TodosPage() {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTodos() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/todos");
        if (!response.ok) throw new Error("Could not load todos.");
        const data = await response.json() as TodoRow[];
        if (!cancelled) setTodos(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load todos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTodos();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Todos</h1>
        <p className="mt-2 text-sm text-slate-600">Action items extracted from captured messages.</p>
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">Loading todos...</p>
      ) : todos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">No todos extracted yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {todos.map(todo => (
            <li key={todo.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">{todo.status}</span>
                <time className="text-sm text-slate-500" dateTime={todo.created_at}>{formatDate(todo.created_at)}</time>
              </div>
              <p className="text-slate-800">{todo.text}</p>
              <p className="mt-3 text-xs text-slate-400">From message #{todo.message_id}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IdeasPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ideas</h1>
        <p className="mt-2 text-sm text-slate-600">A simple skeleton for captured concepts and brainstorms.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Captured</p>
          <p className="mt-2 text-sm text-slate-600">Coming soon</p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next</p>
          <p className="mt-2 text-sm text-slate-600">Tags and grouping</p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Later</p>
          <p className="mt-2 text-sm text-slate-600">Idea detail pages</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">Ideas view is a placeholder for now.</p>
        <p className="mt-2 text-sm text-slate-500">Captured ideas will appear here once the page is fleshed out.</p>
      </div>
    </section>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPathname(window.location.pathname));

  useEffect(() => {
    function syncRoute() {
      setRoute(routeFromPathname(window.location.pathname));
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  function navigate(nextRoute: Route) {
    const path = pathForRoute(nextRoute);
    window.history.pushState(null, "", path);
    setRoute(nextRoute);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => navigate("home")} className="text-left">
            <p className="text-lg font-semibold tracking-tight text-slate-950">techtest-2026</p>
            <p className="text-sm text-slate-500">Stream log</p>
          </button>
          <nav className="flex gap-2">
            <NavButton current={route} route="home" onNavigate={navigate}>Home</NavButton>
            <NavButton current={route} route="todos" onNavigate={navigate}>Todos</NavButton>
            <NavButton current={route} route="ideas" onNavigate={navigate}>Ideas</NavButton>
          </nav>
        </div>
      </header>

      <main className="px-4 py-8 sm:py-12">
        {route === "home" && <HomePage />}
        {route === "todos" && <TodosPage />}
        {route === "ideas" && <IdeasPage />}
      </main>
    </div>
  );
}

export default App;
