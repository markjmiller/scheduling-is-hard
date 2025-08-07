import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { validator } from "hono/validator";
import type { components } from "../../types/api";

function isValidId(value: string): boolean {
  return value.match(/^[0-9a-fA-F]{8}$/g) !== null;
}

declare module "hono" {
  interface ContextVariableMap {
    // plan: DurableObjectStub<DOClassExample>;
  }
}

const app = new Hono<{ Bindings: Cloudflare.Env }>();
app.use(prettyJSON());
app.notFound((c) => c.json({ message: "Not Found", ok: false }, 404));
app.get("/", async (c) =>
  c.env.ASSETS.fetch("https://assets.local/index.html"),
);
app.get("/docs", async (c) =>
  c.env.ASSETS.fetch("https://assets.local/docs/openapi.html"),
);

const api = new Hono<{ Bindings: Cloudflare.Env }>();

app.route("/api", api);

// export { DOClassExample };
export default app;
