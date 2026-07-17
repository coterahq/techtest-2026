# techtest-2026

## Prerequisites

- [Bun](https://bun.sh/) installed
- A Cotera API key for message categorization

## Setup

Install dependencies:

```bash
bun install
```

Create a `.env` file with your Cotera credentials:

```bash
COTERA_API_KEY=your_api_key_here
# Optional: override the default Coco invoke model
# COTERA_MODEL=azure-gpt-5.5
# Optional: override the local SQLite database path
# DB_PATH=app.db
```

## Run locally

Start the development server with hot reload:

```bash
bun run dev
```

The server prints its local URL, usually `http://localhost:3000`.

## Production run

Run the app in production mode:

```bash
bun run start
```

## Build

Create a production build in `dist/`:

```bash
bun run build
```
