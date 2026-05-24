/**
 * App connector catalog: the AI-app ecosystem surfaced in Settings > Apps.
 * Mirrors the original app's data/apps manifest set (id, name, category,
 * supported auth methods). Used by the Apps tab to render the connector
 * gallery and the connect flow.
 */

export type AuthMethod = "apiKey" | "oauth";

export interface AppConnector {
    id: string;
    name: string;
    category: string;
    auth: AuthMethod[];
}

export const APP_CATALOG: AppConnector[] = [
    // AI
    { id: "anthropic", name: "Anthropic", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "openai", name: "OpenAI", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "gemini", name: "Google AI (Gemini)", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "mistral", name: "Mistral AI", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "cohere", name: "Cohere", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "perplexity", name: "Perplexity", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "deepseek", name: "DeepSeek", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "hugging-face", name: "Hugging Face", category: "AI", auth: ["apiKey", "oauth"] },
    { id: "elevenlabs", name: "ElevenLabs", category: "AI", auth: ["apiKey"] },
    { id: "replicate", name: "Replicate", category: "AI", auth: ["apiKey", "oauth"] },
    // Google Workspace
    { id: "google-sheets", name: "Google Sheets", category: "Google Workspace", auth: ["oauth"] },
    { id: "google-docs", name: "Google Docs", category: "Google Workspace", auth: ["oauth"] },
    { id: "google-drive", name: "Google Drive", category: "Google Workspace", auth: ["oauth"] },
    { id: "google-slides", name: "Google Slides", category: "Google Workspace", auth: ["oauth"] },
    // Databases
    { id: "postgresql", name: "PostgreSQL", category: "Databases", auth: ["apiKey"] },
    { id: "mysql", name: "MySQL", category: "Databases", auth: ["apiKey"] },
    { id: "mongodb", name: "MongoDB", category: "Databases", auth: ["apiKey"] },
    { id: "redis", name: "Redis", category: "Databases", auth: ["apiKey"] },
    { id: "firebase", name: "Firebase", category: "Databases", auth: ["apiKey"] },
    // Project Management
    { id: "jira", name: "Jira", category: "Project Management", auth: ["oauth"] },
    { id: "linear", name: "Linear", category: "Project Management", auth: ["oauth", "apiKey"] },
    { id: "asana", name: "Asana", category: "Project Management", auth: ["oauth"] },
    // CRM & Sales
    { id: "salesforce", name: "Salesforce", category: "CRM & Sales", auth: ["oauth"] },
    { id: "hubspot", name: "HubSpot", category: "CRM & Sales", auth: ["oauth", "apiKey"] },
    { id: "intercom", name: "Intercom", category: "CRM & Sales", auth: ["oauth"] },
    // Developer
    { id: "github", name: "GitHub", category: "Developer", auth: ["oauth", "apiKey"] },
    { id: "gitlab", name: "GitLab", category: "Developer", auth: ["oauth", "apiKey"] },
    { id: "graphql", name: "GraphQL", category: "Developer", auth: ["apiKey"] },
    // Communication
    { id: "discord", name: "Discord", category: "Communication", auth: ["oauth"] },
    { id: "sendgrid", name: "SendGrid", category: "Communication", auth: ["apiKey"] },
    // Marketing & Analytics
    { id: "mailchimp", name: "Mailchimp", category: "Marketing", auth: ["apiKey", "oauth"] },
    { id: "google-analytics", name: "Google Analytics", category: "Analytics", auth: ["oauth"] },
    { id: "meta-ads", name: "Meta Ads", category: "Marketing", auth: ["oauth"] },
    // Productivity & Commerce
    { id: "notion", name: "Notion", category: "Productivity", auth: ["oauth", "apiKey"] },
    { id: "airtable", name: "Airtable", category: "Productivity", auth: ["apiKey"] },
    { id: "shopify", name: "Shopify", category: "Commerce & Finance", auth: ["oauth"] },
];

export const APP_CATEGORIES = [...new Set(APP_CATALOG.map((a) => a.category))];

/** Two-letter initials for a connector logo placeholder. */
export function appInitials(name: string): string {
    const words = name.split(" ").filter(Boolean);
    return words.slice(0, 2).map((w) => (w[0] ?? "").toUpperCase()).join("");
}
