/** Modular feature catalog. Dependencies must be enabled before a feature can turn on. */
export const FEATURES = [
  {
    id: "board",
    name: "Project board",
    description: "Kanban and backlog for product work.",
    category: "work",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "tickets",
    name: "Ticket system",
    description: "Support tickets linked to teams, chat, and knowledge.",
    category: "support",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "knowledge",
    name: "Knowledge base",
    description: "Help articles that tickets and chat can suggest and insert into replies.",
    category: "support",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "chat",
    name: "Live chat",
    description: "Visitor chat that routes to an agent or opens a ticket.",
    category: "support",
    defaultOn: true,
    dependsOn: ["tickets"],
  },
  {
    id: "discord",
    name: "Discord",
    description: "Turn channel suggestions into tickets and edit Discord replies as outcomes change.",
    category: "support",
    defaultOn: true,
    dependsOn: ["tickets"],
  },
  {
    id: "teams",
    name: "Teams & hierarchy",
    description: "Teams under the organization with managers and members.",
    category: "org",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "roles",
    name: "Roles & permissions",
    description: "Role matrix for owners, admins, agents, and members.",
    category: "org",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "invites",
    name: "Invitations",
    description: "Invite people by email into the workspace.",
    category: "org",
    defaultOn: true,
    dependsOn: ["email"],
  },
  {
    id: "email",
    name: "Email",
    description: "Transactional email for invites, tickets, and chat handoff.",
    category: "platform",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Push Harbor events to external URLs.",
    category: "platform",
    defaultOn: true,
    dependsOn: [],
  },
  {
    id: "api",
    name: "REST API",
    description: "Programmatic access with an in-app explorer.",
    category: "platform",
    defaultOn: true,
    dependsOn: [],
  },
];

export function defaultFeatureState() {
  return Object.fromEntries(
    FEATURES.map((feature) => [
      feature.id,
      {
        enabled: feature.defaultOn,
        config: defaultConfig(feature.id),
      },
    ]),
  );
}

function defaultConfig(id) {
  switch (id) {
    case "chat":
      return {
        mode: "hybrid",
        offlineCreatesTicket: true,
        businessHoursOnly: false,
        suggestKnowledge: true,
        greeting: "Hi — Harbor support here. Ask anything or wait for an agent.",
      };
    case "email":
      return {
        fromName: "Harbor",
        fromAddress: "noreply@harbor.local",
        replyTo: "support@harbor.local",
      };
    case "webhooks":
      return {
        retryFailed: true,
        signingSecret: "whsec_demo_harbor",
      };
    case "api":
      return {
        basePath: "/api/v1",
        requireToken: true,
      };
    case "tickets":
      return {
        defaultPriority: "medium",
        linkKnowledge: true,
        suggestKnowledgeInReplies: true,
      };
    case "knowledge":
      return {
        categories: ["Account", "Organization", "Support", "Product"],
      };
    case "board":
      return {
        showBacklog: true,
        allowDrag: true,
      };
    case "discord":
      return {
        serverName: "Harbor Community",
        suggestionsChannel: "#suggestions",
        botName: "Harbor Bot",
        autoReply: true,
        editOnOutcome: true,
      };
    default:
      return {};
  }
}

export const PERMISSIONS = [
  { id: "manage_members", label: "Create & edit members", group: "People" },
  { id: "suspend_members", label: "Suspend / reactivate members", group: "People" },
  { id: "manage_invites", label: "Send invitations", group: "People" },
  { id: "manage_teams", label: "Manage teams", group: "People" },
  { id: "manage_roles", label: "Manage roles & permissions", group: "People" },
  { id: "view_tickets", label: "View tickets", group: "Support" },
  { id: "manage_tickets", label: "Create & edit tickets", group: "Support" },
  { id: "reply_tickets", label: "Reply on tickets", group: "Support" },
  { id: "assign_tickets", label: "Assign tickets", group: "Support" },
  { id: "view_kb", label: "View knowledge base", group: "Support" },
  { id: "manage_kb", label: "Create & edit knowledge articles", group: "Support" },
  { id: "view_chat", label: "View live chat", group: "Support" },
  { id: "manage_chat", label: "Start / route chats", group: "Support" },
  { id: "reply_chat", label: "Reply as agent in chat", group: "Support" },
  { id: "view_discord", label: "View Discord module", group: "Support" },
  { id: "manage_discord", label: "Manage Discord suggestions", group: "Support" },
  { id: "view_board", label: "View board", group: "Work" },
  { id: "manage_board", label: "Edit board issues", group: "Work" },
  { id: "view_email", label: "View email outbox", group: "Platform" },
  { id: "send_email", label: "Compose & send email", group: "Platform" },
  { id: "manage_email", label: "Configure email settings", group: "Platform" },
  { id: "view_webhooks", label: "View webhooks", group: "Platform" },
  { id: "manage_webhooks", label: "Manage webhooks", group: "Platform" },
  { id: "view_api", label: "Use REST API explorer", group: "Platform" },
  { id: "manage_features", label: "Toggle modules", group: "Platform" },
];

export function canEnable(featureId, state) {
  const feature = FEATURES.find((item) => item.id === featureId);
  if (!feature) return { ok: false, error: "Unknown feature." };
  const missing = feature.dependsOn.filter((dep) => !state[dep]?.enabled);
  if (missing.length) {
    return {
      ok: false,
      error: `Turn on ${missing.join(", ")} first.`,
    };
  }
  return { ok: true };
}

export function dependentsOf(featureId) {
  return FEATURES.filter((feature) => feature.dependsOn.includes(featureId)).map((feature) => feature.id);
}
