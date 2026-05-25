/**
 * App connector catalog: the AI-app ecosystem surfaced in Settings > Apps.
 * Mirrors the original app's data/apps manifest set (id, name, category,
 * supported auth methods, a short description, install status, and a brand
 * color for the logo tile). Used by the Apps tab to render the connector
 * gallery and the connect flow.
 */

export type AuthMethod = "apiKey" | "oauth";

/** Install/availability state for a connector, matching the original app. */
export type AppStatus = "active" | "coming_soon" | "scheduled";

export interface AppConnector {
    id: string;
    name: string;
    category: string;
    auth: AuthMethod[];
    /** One-line summary shown on the connector card. */
    description: string;
    /** Whether the connector is installable now, soon, or scheduled. */
    status: AppStatus;
    /** Brand-ish hex used as the logo tile background. */
    color: string;
    /**
     * For AI providers: defaults used to create a real AI-model Connection when
     * you connect with an API key (base URL + provider + model + endpoints).
     */
    ai?: AiDefaults;
}

/** Endpoint template (no id — ids are assigned when the connection is created). */
export interface AiEndpointTemplate {
    label: string;
    method: string;
    path: string;
    mapPath?: string;
    description?: string;
}

export interface AiDefaults {
    baseUrl: string;
    provider: string;
    model: string;
    endpoints: AiEndpointTemplate[];
}

// OpenAI-compatible providers (OpenAI, DeepSeek, Mistral, …) — /v1/* paths.
const OPENAI_ENDPOINTS: AiEndpointTemplate[] = [
    { label: "Chat completions", method: "POST", path: "/v1/chat/completions", mapPath: "$.choices[0].message.content", description: "OpenAI-compatible chat completion." },
    { label: "Models", method: "GET", path: "/v1/models", mapPath: "$.data", description: "List available models." },
];
// Gemini's OpenAI-compatible surface (base URL already ends in /v1beta/openai).
const GEMINI_ENDPOINTS: AiEndpointTemplate[] = [
    { label: "Chat completions", method: "POST", path: "/chat/completions", mapPath: "$.choices[0].message.content", description: "OpenAI-compatible chat completion." },
    { label: "Models", method: "GET", path: "/models", mapPath: "$.data", description: "List available models." },
];
const ANTHROPIC_ENDPOINTS: AiEndpointTemplate[] = [
    { label: "Messages", method: "POST", path: "/v1/messages", mapPath: "$.content[0].text", description: "Anthropic Messages API." },
];

export const APP_CATALOG: AppConnector[] = [
    // AI
    { id: "anthropic", name: "Anthropic", category: "AI", auth: ["apiKey", "oauth"], description: "Claude AI models for text generation, analysis, and code.", status: "active", color: "#D97757", ai: { baseUrl: "https://api.anthropic.com", provider: "anthropic", model: "claude-3-5-sonnet-20241022", endpoints: ANTHROPIC_ENDPOINTS } },
    { id: "openai", name: "OpenAI", category: "AI", auth: ["apiKey", "oauth"], description: "GPT models for chat, completions, embeddings, and vision.", status: "active", color: "#10A37F", ai: { baseUrl: "https://api.openai.com", provider: "openai", model: "gpt-4o-mini", endpoints: OPENAI_ENDPOINTS } },
    { id: "gemini", name: "Google AI (Gemini)", category: "AI", auth: ["apiKey", "oauth"], description: "Gemini multimodal models for text, images, and reasoning.", status: "active", color: "#4285F4", ai: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", provider: "openai", model: "gemini-2.0-flash", endpoints: GEMINI_ENDPOINTS } },
    { id: "mistral", name: "Mistral AI", category: "AI", auth: ["apiKey", "oauth"], description: "Open-weight and frontier models for fast, efficient inference.", status: "active", color: "#FF7000", ai: { baseUrl: "https://api.mistral.ai", provider: "openai", model: "mistral-small-latest", endpoints: OPENAI_ENDPOINTS } },
    { id: "cohere", name: "Cohere", category: "AI", auth: ["apiKey", "oauth"], description: "Command models and embeddings tuned for enterprise RAG.", status: "coming_soon", color: "#39594D" },
    { id: "perplexity", name: "Perplexity", category: "AI", auth: ["apiKey", "oauth"], description: "Answer engine with live web grounding and citations.", status: "coming_soon", color: "#1FB8CD" },
    { id: "deepseek", name: "DeepSeek", category: "AI", auth: ["apiKey", "oauth"], description: "Reasoning and code models with strong price-performance.", status: "active", color: "#4D6BFE", ai: { baseUrl: "https://api.deepseek.com", provider: "deepseek", model: "deepseek-chat", endpoints: OPENAI_ENDPOINTS } },
    { id: "hugging-face", name: "Hugging Face", category: "AI", auth: ["apiKey", "oauth"], description: "Inference endpoints across thousands of open models.", status: "scheduled", color: "#FFD21E" },
    { id: "elevenlabs", name: "ElevenLabs", category: "AI", auth: ["apiKey"], description: "Lifelike text-to-speech and voice synthesis.", status: "coming_soon", color: "#000000" },
    { id: "replicate", name: "Replicate", category: "AI", auth: ["apiKey", "oauth"], description: "Run and fine-tune open ML models via a hosted API.", status: "scheduled", color: "#000000" },
    // Google Workspace
    { id: "google-sheets", name: "Google Sheets", category: "Google Workspace", auth: ["oauth"], description: "Read and write spreadsheet data as a live data source.", status: "active", color: "#0F9D58" },
    { id: "google-docs", name: "Google Docs", category: "Google Workspace", auth: ["oauth"], description: "Pull document content and collaborate programmatically.", status: "coming_soon", color: "#4285F4" },
    { id: "google-drive", name: "Google Drive", category: "Google Workspace", auth: ["oauth"], description: "Browse, fetch, and sync files from your Drive.", status: "coming_soon", color: "#FBBC05" },
    { id: "google-slides", name: "Google Slides", category: "Google Workspace", auth: ["oauth"], description: "Generate and update presentation decks.", status: "scheduled", color: "#F4B400" },
    // Databases
    { id: "postgresql", name: "PostgreSQL", category: "Databases", auth: ["apiKey"], description: "Query a Postgres database as a dashboard data source.", status: "active", color: "#336791" },
    { id: "mysql", name: "MySQL", category: "Databases", auth: ["apiKey"], description: "Connect a MySQL database for live metrics and tables.", status: "coming_soon", color: "#00758F" },
    { id: "mongodb", name: "MongoDB", category: "Databases", auth: ["apiKey"], description: "Query collections from a MongoDB cluster.", status: "coming_soon", color: "#47A248" },
    { id: "redis", name: "Redis", category: "Databases", auth: ["apiKey"], description: "Read keys and streams from a Redis instance.", status: "scheduled", color: "#DC382D" },
    { id: "firebase", name: "Firebase", category: "Databases", auth: ["apiKey"], description: "Realtime Database and Firestore as a data source.", status: "coming_soon", color: "#FFCA28" },
    // Project Management
    { id: "jira", name: "Jira", category: "Project Management", auth: ["oauth"], description: "Track issues, sprints, and project metrics.", status: "coming_soon", color: "#0052CC" },
    { id: "linear", name: "Linear", category: "Project Management", auth: ["oauth", "apiKey"], description: "Sync issues, cycles, and team velocity.", status: "active", color: "#5E6AD2" },
    { id: "asana", name: "Asana", category: "Project Management", auth: ["oauth"], description: "Pull tasks, projects, and workload data.", status: "scheduled", color: "#F06A6A" },
    // CRM & Sales
    { id: "salesforce", name: "Salesforce", category: "CRM & Sales", auth: ["oauth"], description: "Sync accounts, opportunities, and pipeline data.", status: "coming_soon", color: "#00A1E0" },
    { id: "hubspot", name: "HubSpot", category: "CRM & Sales", auth: ["oauth", "apiKey"], description: "Contacts, deals, and marketing analytics.", status: "coming_soon", color: "#FF7A59" },
    { id: "intercom", name: "Intercom", category: "CRM & Sales", auth: ["oauth"], description: "Conversations, customers, and support metrics.", status: "scheduled", color: "#1F8DED" },
    // Developer
    { id: "github", name: "GitHub", category: "Developer", auth: ["oauth", "apiKey"], description: "Repos, issues, pull requests, and CI activity.", status: "active", color: "#181717" },
    { id: "gitlab", name: "GitLab", category: "Developer", auth: ["oauth", "apiKey"], description: "Projects, merge requests, and pipeline status.", status: "coming_soon", color: "#FC6D26" },
    { id: "graphql", name: "GraphQL", category: "Developer", auth: ["apiKey"], description: "Query any GraphQL endpoint as a data source.", status: "active", color: "#E10098" },
    // Communication
    { id: "discord", name: "Discord", category: "Communication", auth: ["oauth"], description: "Read channels and post messages to your servers.", status: "coming_soon", color: "#5865F2" },
    { id: "sendgrid", name: "SendGrid", category: "Communication", auth: ["apiKey"], description: "Send transactional email and track delivery stats.", status: "scheduled", color: "#1A82E2" },
    // Marketing & Analytics
    { id: "mailchimp", name: "Mailchimp", category: "Marketing", auth: ["apiKey", "oauth"], description: "Campaign performance, audiences, and automations.", status: "coming_soon", color: "#FFE01B" },
    { id: "google-analytics", name: "Google Analytics", category: "Analytics", auth: ["oauth"], description: "Traffic, conversions, and engagement metrics (GA4).", status: "active", color: "#E37400" },
    { id: "meta-ads", name: "Meta Ads", category: "Marketing", auth: ["oauth"], description: "Ad spend, reach, and ROAS across Facebook and Instagram.", status: "coming_soon", color: "#0866FF" },
    // Productivity & Commerce
    { id: "notion", name: "Notion", category: "Productivity", auth: ["oauth", "apiKey"], description: "Databases and pages as structured data sources.", status: "active", color: "#000000" },
    { id: "airtable", name: "Airtable", category: "Productivity", auth: ["apiKey"], description: "Bases and tables as a flexible data backend.", status: "coming_soon", color: "#18BFFF" },
    { id: "shopify", name: "Shopify", category: "Commerce & Finance", auth: ["oauth"], description: "Orders, products, and storefront sales analytics.", status: "coming_soon", color: "#95BF47" },
];

export const APP_CATEGORIES = [...new Set(APP_CATALOG.map((a) => a.category))];

/** Two-letter initials for a connector logo placeholder. */
export function appInitials(name: string): string {
    const words = name.split(" ").filter(Boolean);
    return words.slice(0, 2).map((w) => (w[0] ?? "").toUpperCase()).join("");
}
