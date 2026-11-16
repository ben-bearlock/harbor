import { FEATURES, PERMISSIONS, canEnable, defaultFeatureState, dependentsOf } from "./features.js";
import { createServices } from "./services.js";

const ROLES = [
  {
    id: "owner",
    name: "Owner",
    level: 100,
    permissions: ["*"],
  },
  {
    id: "admin",
    name: "Admin",
    level: 80,
    permissions: PERMISSIONS.map((item) => item.id),
  },
  {
    id: "agent",
    name: "Agent",
    level: 50,
    permissions: [
      "view_tickets",
      "manage_tickets",
      "reply_tickets",
      "assign_tickets",
      "view_kb",
      "manage_kb",
      "view_chat",
      "manage_chat",
      "reply_chat",
      "view_discord",
      "manage_discord",
      "view_board",
      "view_email",
      "send_email",
    ],
  },
  {
    id: "member",
    name: "Member",
    level: 20,
    permissions: ["view_tickets", "view_kb", "view_board", "view_chat", "view_email"],
  },
  {
    id: "viewer",
    name: "Viewer",
    level: 10,
    permissions: ["view_kb", "view_board"],
  },
];

function migrateRolePermissions(roles) {
  return roles.map((role) => {
    if (role.permissions?.includes("*")) return role;
    const defaults = ROLES.find((item) => item.id === role.id);
    const perms = new Set(role.permissions || []);
    if (defaults) {
      for (const permission of defaults.permissions) perms.add(permission);
    }
    if (perms.has("manage_tickets")) {
      perms.add("view_tickets");
      perms.add("reply_tickets");
      perms.add("assign_tickets");
    }
    if (perms.has("manage_chat")) {
      perms.add("view_chat");
      perms.add("reply_chat");
    }
    if (perms.has("manage_kb")) perms.add("view_kb");
    if (perms.has("manage_discord")) perms.add("view_discord");
    if (perms.has("manage_board")) perms.add("view_board");
    if (perms.has("manage_email") || perms.has("send_email")) perms.add("view_email");
    if (perms.has("manage_webhooks")) perms.add("view_webhooks");
    if (perms.has("manage_members")) {
      perms.add("suspend_members");
      perms.add("manage_invites");
    }
    return { ...role, permissions: [...perms] };
  });
}

export const TICKET_STATUSES = [
  { id: "open", label: "Open" },
  { id: "under_review", label: "Under review" },
  { id: "in_progress", label: "In progress" },
  { id: "pending", label: "Pending" },
  { id: "solved", label: "Solved" },
  { id: "rejected", label: "Rejected" },
  { id: "closed", label: "Closed" },
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
}

function now() {
  return new Date().toISOString();
}

function seedBoard() {
  return [
    {
      id: "web",
      key: "WEB",
      name: "Harbor Web",
      color: "#1f8a70",
      issues: [
        {
          id: "WEB-12",
          title: "Ship modular feature flags for support suites",
          description: "Every Harbor module should be toggleable per workspace.",
          status: "in_progress",
          type: "story",
          priority: "high",
          assignee: "you",
          points: 5,
        },
        {
          id: "WEB-13",
          title: "Ticket drawer should suggest KB articles",
          description: "When knowledge is enabled, surface matching articles.",
          status: "todo",
          type: "bug",
          priority: "urgent",
          assignee: "jonah",
          points: 2,
        },
        {
          id: "WEB-14",
          title: "Live chat handoff to available agents",
          status: "review",
          type: "story",
          priority: "medium",
          assignee: "amina",
          points: 3,
        },
        {
          id: "WEB-15",
          title: "Document REST invite endpoint",
          status: "done",
          type: "task",
          priority: "low",
          assignee: "priya",
          points: 1,
        },
      ],
    },
  ];
}

const STORAGE_KEY = "harbor.platform.v3";

function blankState() {
  return {
    onboarded: false,
    workspace: null,
    currentUserId: "you",
    apiToken: "hbr_demo_token_harbor",
    features: defaultFeatureState(),
    roles: structuredClone(ROLES),
    people: [],
    teams: [],
    invites: [],
    tickets: [],
    articles: [],
    chatSessions: [],
    chatMessages: {},
    agentsOnline: ["amina", "luca"],
    projects: seedBoard(),
    webhooks: [],
    webhookDeliveries: [],
    emails: [],
    apiLog: [],
    activity: [],
    discordMessages: [],
  };
}

function normalizeTicket(ticket) {
  return {
    description: "",
    comments: [],
    discordMessageId: null,
    outcome: "",
    updatedAt: ticket.createdAt || now(),
    ...ticket,
    comments: ticket.comments || [],
  };
}

function loadState() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("harbor.platform.v2") ||
      localStorage.getItem("harbor.platform.v1");
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    const features = { ...defaultFeatureState(), ...parsed.features };
    for (const [id, value] of Object.entries(defaultFeatureState())) {
      features[id] = {
        enabled: parsed.features?.[id]?.enabled ?? value.enabled,
        config: { ...value.config, ...(parsed.features?.[id]?.config || {}) },
      };
    }
    return {
      ...blankState(),
      ...parsed,
      roles: migrateRolePermissions(parsed.roles?.length ? parsed.roles : structuredClone(ROLES)),
      features,
      tickets: (parsed.tickets || []).map(normalizeTicket),
      discordMessages: parsed.discordMessages || [],
    };
  } catch {
    return blankState();
  }
}

export function createPlatform() {
  let state = loadState();

  const listeners = new Set();

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        onboarded: state.onboarded,
        workspace: state.workspace,
        currentUserId: state.currentUserId,
        apiToken: state.apiToken,
        features: state.features,
        people: state.people,
        teams: state.teams,
        invites: state.invites,
        tickets: state.tickets,
        articles: state.articles,
        chatSessions: state.chatSessions,
        chatMessages: state.chatMessages,
        agentsOnline: state.agentsOnline,
        projects: state.projects,
        webhooks: state.webhooks,
        webhookDeliveries: state.webhookDeliveries,
        emails: state.emails,
        apiLog: state.apiLog,
        activity: state.activity,
        roles: state.roles,
        discordMessages: state.discordMessages,
      }),
    );
  }

  function notify() {
    persist();
    for (const listener of listeners) listener(getPublic());
  }

  function setState(mutator) {
    mutator(state);
    notify();
  }

  function pushActivity(text) {
    state.activity.unshift({ id: `act_${Date.now()}`, text, at: now() });
    state.activity = state.activity.slice(0, 30);
  }

  const services = createServices(
    () => ({ ...state, actions: apiActions }),
    setState,
  );

  const apiActions = {
    createTicket(input = {}) {
      return createTicket(input);
    },
    updateTicket(id, patch = {}) {
      return updateTicket(id, patch);
    },
    invite(input = {}) {
      return invitePerson(input);
    },
    createMember(input = {}) {
      return createMember(input);
    },
    updateMember(id, patch = {}) {
      return updateMember(id, patch);
    },
    createTeam(input = {}) {
      return createTeam(input);
    },
    ingestDiscordSuggestion(input = {}) {
      return ingestDiscordSuggestion(input);
    },
  };

  function person(id) {
    return state.people.find((item) => item.id === id) || null;
  }

  function enabled(featureId) {
    return Boolean(state.features[featureId]?.enabled);
  }

  function currentUser() {
    return person(state.currentUserId);
  }

  function can(permission) {
    const user = currentUser();
    if (!user || user.status === "suspended") return false;
    const role = state.roles.find((item) => item.id === user.role);
    if (!role) return false;
    return role.permissions.includes("*") || role.permissions.includes(permission);
  }

  function canAny(...permissions) {
    return permissions.some((permission) => can(permission));
  }

  function requirePerm(permission) {
    if (!can(permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
  }

  function registerWorkspace({ mode, name, yourName, email }) {
    const cleanName = name.trim();
    const cleanYou = yourName.trim() || "You";
    if (!cleanName) return { ok: false, error: "Workspace name is required." };
    if (!email?.includes("@")) return { ok: false, error: "Use a valid email." };

    const isOrg = mode === "organization";
    state.workspace = {
      type: isOrg ? "organization" : "personal",
      name: cleanName,
      slug: slugify(cleanName),
      createdAt: now(),
    };

    state.people = [
      {
        id: "you",
        name: cleanYou,
        email,
        role: "owner",
        teamIds: isOrg ? ["leadership"] : ["solo"],
        status: "active",
        initials: cleanYou.slice(0, 2).toUpperCase(),
        hue: 168,
        agent: false,
      },
      {
        id: "amina",
        name: "Amina Vos",
        email: "amina@harbor.local",
        role: "admin",
        teamIds: isOrg ? ["support", "leadership"] : ["solo"],
        status: "active",
        initials: "AV",
        hue: 210,
        agent: true,
      },
      {
        id: "jonah",
        name: "Jonah Berg",
        email: "jonah@harbor.local",
        role: "member",
        teamIds: isOrg ? ["product"] : ["solo"],
        status: "active",
        initials: "JB",
        hue: 28,
        agent: false,
      },
      {
        id: "priya",
        name: "Priya Shah",
        email: "priya@harbor.local",
        role: "agent",
        teamIds: isOrg ? ["support"] : ["solo"],
        status: "active",
        initials: "PS",
        hue: 320,
        agent: true,
      },
      {
        id: "luca",
        name: "Luca Ferrer",
        email: "luca@harbor.local",
        role: "agent",
        teamIds: isOrg ? ["support"] : ["solo"],
        status: "active",
        initials: "LF",
        hue: 140,
        agent: true,
      },
    ];

    state.teams = isOrg
      ? [
          { id: "leadership", name: "Leadership", parentId: null, managerId: "you", memberIds: ["you", "amina"] },
          { id: "support", name: "Support", parentId: "leadership", managerId: "amina", memberIds: ["amina", "priya", "luca"] },
          { id: "product", name: "Product", parentId: "leadership", managerId: "jonah", memberIds: ["jonah", "you"] },
        ]
      : [{ id: "solo", name: "Personal", parentId: null, managerId: "you", memberIds: ["you", "amina", "jonah", "priya", "luca"] }];

    state.articles = [
      {
        id: "kb_1",
        title: "Reset your Harbor password",
        category: "Account",
        body: "Open Settings → Security → Reset password. Invited org members use the invite email link first.",
        tags: ["password", "login", "account"],
      },
      {
        id: "kb_2",
        title: "Invite teammates to an organization",
        category: "Organization",
        body: "Admins can invite by email. Invites respect the Email module and create webhook events.",
        tags: ["invite", "organization", "email"],
      },
      {
        id: "kb_3",
        title: "When chat becomes a ticket",
        category: "Support",
        body: "If no agent is available and offlineCreatesTicket is on, Harbor opens a ticket and emails the team.",
        tags: ["chat", "ticket", "support"],
      },
    ];

    state.tickets = [
      normalizeTicket({
        id: "T-101",
        subject: "Cannot invite a contractor to Product",
        description: "Invite form rejects external domains for the Product team.",
        status: "open",
        priority: "high",
        teamId: isOrg ? "support" : "solo",
        requester: "client@example.com",
        assigneeId: "priya",
        articleIds: ["kb_2"],
        source: "email",
        createdAt: now(),
      }),
      normalizeTicket({
        id: "T-102",
        subject: "Chat dropped while waiting for an agent",
        description: "Visitor lost the chat session after three minutes in queue.",
        status: "pending",
        priority: "medium",
        teamId: isOrg ? "support" : "solo",
        requester: "visitor@example.com",
        assigneeId: "luca",
        articleIds: ["kb_3"],
        source: "chat",
        createdAt: now(),
      }),
    ];
    state.discordMessages = [];

    state.webhooks = [
      {
        id: "wh_1",
        name: "Ops stream",
        url: "https://example.com/hooks/harbor",
        events: ["ticket.created", "invite.sent", "chat.escalated", "email.sent"],
        enabled: true,
      },
    ];

    state.invites = [];
    state.chatSessions = [];
    state.chatMessages = {};
    state.emails = [];
    state.apiLog = [];
    state.webhookDeliveries = [];
    state.onboarded = true;

    if (enabled("email")) {
      services.sendEmail({
        to: email,
        subject: `Welcome to ${cleanName}`,
        body: `Your ${isOrg ? "organization" : "personal"} Harbor workspace is ready.`,
        template: "welcome",
      });
    }

    services.emit("workspace.created", { name: cleanName, type: state.workspace.type });
    pushActivity(`Registered ${isOrg ? "organization" : "personal"} workspace “${cleanName}”`);
    notify();
    return { ok: true };
  }

  function setFeature(featureId, enabledFlag) {
    if (!state.features[featureId]) return { ok: false, error: "Unknown feature." };
    if (enabledFlag) {
      const gate = canEnable(featureId, state.features);
      if (!gate.ok) return gate;
      state.features[featureId].enabled = true;
      pushActivity(`Enabled ${featureId}`);
      notify();
      return { ok: true };
    }

    for (const dependent of dependentsOf(featureId)) {
      if (state.features[dependent]?.enabled) {
        state.features[dependent].enabled = false;
        pushActivity(`Disabled ${dependent} because ${featureId} turned off`);
      }
    }
    state.features[featureId].enabled = false;
    pushActivity(`Disabled ${featureId}`);
    notify();
    return { ok: true };
  }

  function updateFeatureConfig(featureId, patch) {
    if (!state.features[featureId]) return { ok: false, error: "Unknown feature." };
    state.features[featureId].config = { ...state.features[featureId].config, ...patch };
    notify();
    return { ok: true };
  }

  function invitePerson({ email, role = "member", teamId }) {
    if (!enabled("invites")) return { ok: false, error: "Invitations module is off." };
    if (!canAny("manage_invites", "manage_members")) {
      return { ok: false, error: "Missing permission: manage_invites" };
    }
    const clean = String(email || "").trim().toLowerCase();
    if (!clean.includes("@")) return { ok: false, error: "Enter a valid email." };
    if (state.people.some((item) => item.email === clean) || state.invites.some((item) => item.email === clean)) {
      return { ok: false, error: "That person is already here or invited." };
    }
    const invite = {
      id: `inv_${Date.now()}`,
      email: clean,
      role,
      teamId: teamId || state.teams[0]?.id,
      status: "pending",
      sentAt: now(),
    };
    state.invites.unshift(invite);

    if (enabled("email")) {
      services.sendEmail({
        to: clean,
        subject: `Join ${state.workspace.name} on Harbor`,
        body: `You were invited as ${role}. Open Harbor to accept.`,
        template: "invite",
      });
    }

    services.emit("invite.sent", invite);
    pushActivity(`Invited ${clean} as ${role}`);
    notify();
    return { ok: true, invite };
  }

  function discordReplyText(ticket) {
    const outcome = ticket.outcome ? `\nOutcome: ${ticket.outcome}` : "";
    const lines = {
      open: `🎫 Ticket **${ticket.id}** was created and is **under review**.`,
      under_review: `🎫 Ticket **${ticket.id}** was created and is **under review**. We'll edit this message when there's an outcome.`,
      in_progress: `🔧 Ticket **${ticket.id}** is now **in progress**.`,
      pending: `⏳ Ticket **${ticket.id}** is **pending** more information.`,
      solved: `✅ Ticket **${ticket.id}** was **accepted / resolved**.${outcome}`,
      rejected: `❌ Ticket **${ticket.id}** was **not accepted**.${outcome}`,
      closed: `🔒 Ticket **${ticket.id}** is **closed**.${outcome}`,
    };
    return lines[ticket.status] || lines.under_review;
  }

  function syncDiscordForTicket(ticket, { initial = false } = {}) {
    if (!enabled("discord")) return;
    if (!initial && !state.features.discord.config.editOnOutcome) return;
    if (!ticket.discordMessageId) return;
    const message = state.discordMessages.find(
      (item) => item.id === ticket.discordMessageId || item.ticketId === ticket.id,
    );
    if (!message) return;
    const next = discordReplyText(ticket);
    if (next === message.botReply) return;
    message.edits.unshift({
      at: now(),
      status: ticket.status,
      previous: message.botReply,
      next,
    });
    message.botReply = next;
    message.updatedAt = now();
    services.emit("discord.edited", {
      messageId: message.id,
      ticketId: ticket.id,
      status: ticket.status,
      botReply: next,
    });
    pushActivity(`Discord reply updated for ${ticket.id} → ${ticket.status}`);
  }

  function createTicket(input = {}) {
    if (!enabled("tickets")) throw new Error("Tickets module is off.");
    if (!canAny("manage_tickets", "reply_tickets") && input.source === "manual") {
      throw new Error("Missing permission: manage_tickets");
    }
    const subject = String(input.subject || "").trim();
    if (!subject) throw new Error("Subject is required.");

    const articleIds = enabled("knowledge") && state.features.tickets.config.linkKnowledge
      ? suggestArticles(`${subject} ${input.description || ""}`).slice(0, 2).map((item) => item.id)
      : [];

    const nextId = state.tickets.reduce((max, item) => {
      const num = Number(String(item.id).replace(/\D/g, ""));
      return Number.isFinite(num) ? Math.max(max, num) : max;
    }, 100);
    const ticket = normalizeTicket({
      id: `T-${nextId + 1}`,
      subject,
      description: String(input.description || "").trim(),
      status: input.status || "open",
      priority: input.priority || state.features.tickets.config.defaultPriority || "medium",
      teamId: input.teamId || state.teams.find((team) => team.id === "support")?.id || state.teams[0].id,
      requester: input.requester || "visitor@example.com",
      assigneeId: input.assigneeId || state.people.find((item) => item.agent)?.id || "you",
      articleIds,
      source: input.source || "manual",
      discordMessageId: input.discordMessageId || null,
      outcome: input.outcome || "",
      comments: [],
      createdAt: now(),
      updatedAt: now(),
    });
    state.tickets.unshift(ticket);
    services.emit("ticket.created", ticket);

    if (enabled("discord") && ticket.source === "discord" && state.features.discord.config.autoReply) {
      const messageId = ticket.discordMessageId || `dmsg_${Date.now()}`;
      ticket.discordMessageId = messageId;
      state.discordMessages.unshift({
        id: messageId,
        channel: input.channel || state.features.discord.config.suggestionsChannel,
        author: ticket.requester,
        suggestion: ticket.description || ticket.subject,
        ticketId: ticket.id,
        botReply: discordReplyText(ticket),
        edits: [],
        updatedAt: now(),
      });
      services.emit("discord.replied", { messageId, ticketId: ticket.id });
    }

    if (enabled("email")) {
      services.sendEmail({
        to: state.features.email.config.replyTo,
        subject: `[${ticket.id}] ${ticket.subject}`,
        body: `New ticket from ${ticket.requester} via ${ticket.source}.`,
        template: "ticket_created",
      });
    }

    pushActivity(`Ticket ${ticket.id} created`);
    notify();
    return ticket;
  }

  function updateTicket(id, patch = {}) {
    if (!canAny("manage_tickets", "assign_tickets", "reply_tickets")) {
      return { ok: false, error: "Missing permission to edit tickets." };
    }
    const ticket = state.tickets.find((item) => item.id === id);
    if (!ticket) return { ok: false, error: "Ticket not found." };
    const next = { ...patch };
    if (typeof next.articleIds === "string") {
      next.articleIds = next.articleIds ? next.articleIds.split(",").map((item) => item.trim()).filter(Boolean) : [];
    }
    if (next.assigneeId && next.assigneeId !== ticket.assigneeId && !canAny("assign_tickets", "manage_tickets")) {
      return { ok: false, error: "Missing permission: assign_tickets" };
    }
    Object.assign(ticket, next, { updatedAt: now() });
    services.emit("ticket.updated", ticket);
    if (ticket.discordMessageId) syncDiscordForTicket(ticket);
    pushActivity(`Ticket ${ticket.id} updated`);
    notify();
    return { ok: true, ticket };
  }

  function addTicketComment(id, text, { publicReply = false, articleId = null } = {}) {
    if (!canAny("manage_tickets", "reply_tickets")) {
      return { ok: false, error: "Missing permission: reply_tickets" };
    }
    const ticket = state.tickets.find((item) => item.id === id);
    if (!ticket) return { ok: false, error: "Ticket not found." };
    let clean = String(text || "").trim();
    if (articleId && enabled("knowledge")) {
      const article = state.articles.find((item) => item.id === articleId);
      if (article) {
        clean = clean
          ? `${clean}\n\n— From knowledge base: ${article.title}\n${article.body}`
          : `— From knowledge base: ${article.title}\n${article.body}`;
        if (!ticket.articleIds.includes(article.id)) ticket.articleIds.push(article.id);
      }
    }
    if (!clean) return { ok: false, error: "Reply cannot be empty." };
    ticket.comments.push({
      id: `c_${Date.now()}`,
      authorId: state.currentUserId,
      text: clean,
      public: Boolean(publicReply),
      articleId: articleId || null,
      at: now(),
    });
    ticket.updatedAt = now();
    if (publicReply && enabled("email") && canAny("send_email", "manage_email", "reply_tickets")) {
      services.sendEmail({
        to: ticket.requester.includes("@") ? ticket.requester : state.features.email.config.replyTo,
        subject: `Re: [${ticket.id}] ${ticket.subject}`,
        body: clean,
        template: "ticket_reply",
      });
    }
    notify();
    return { ok: true, ticket };
  }

  function linkTicketArticle(ticketId, articleId, linked = true) {
    if (!canAny("manage_tickets", "reply_tickets")) {
      return { ok: false, error: "Missing permission to link articles." };
    }
    const ticket = state.tickets.find((item) => item.id === ticketId);
    const article = state.articles.find((item) => item.id === articleId);
    if (!ticket || !article) return { ok: false, error: "Ticket or article not found." };
    if (linked && !ticket.articleIds.includes(articleId)) ticket.articleIds.push(articleId);
    if (!linked) ticket.articleIds = ticket.articleIds.filter((id) => id !== articleId);
    ticket.updatedAt = now();
    notify();
    return { ok: true, ticket };
  }

  function createArticle({ title, category = "Support", body = "", tags = [] }) {
    if (!enabled("knowledge")) return { ok: false, error: "Knowledge module is off." };
    if (!can("manage_kb")) return { ok: false, error: "Missing permission: manage_kb" };
    const cleanTitle = String(title || "").trim();
    const cleanBody = String(body || "").trim();
    if (!cleanTitle || !cleanBody) return { ok: false, error: "Title and body are required." };
    const article = {
      id: `kb_${Date.now()}`,
      title: cleanTitle,
      category: String(category || "Support").trim() || "Support",
      body: cleanBody,
      tags: Array.isArray(tags)
        ? tags
        : String(tags)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
      updatedAt: now(),
    };
    state.articles.unshift(article);
    pushActivity(`Knowledge article “${article.title}” created`);
    notify();
    return { ok: true, article };
  }

  function updateArticle(id, patch = {}) {
    if (!can("manage_kb")) return { ok: false, error: "Missing permission: manage_kb" };
    const article = state.articles.find((item) => item.id === id);
    if (!article) return { ok: false, error: "Article not found." };
    if (patch.title) article.title = String(patch.title).trim() || article.title;
    if (patch.category) article.category = String(patch.category).trim() || article.category;
    if (patch.body != null) article.body = String(patch.body).trim();
    if (patch.tags != null) {
      article.tags = Array.isArray(patch.tags)
        ? patch.tags
        : String(patch.tags)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
    }
    article.updatedAt = now();
    pushActivity(`Knowledge article “${article.title}” updated`);
    notify();
    return { ok: true, article };
  }

  function deleteArticle(id) {
    if (!can("manage_kb")) return { ok: false, error: "Missing permission: manage_kb" };
    const index = state.articles.findIndex((item) => item.id === id);
    if (index === -1) return { ok: false, error: "Article not found." };
    const [removed] = state.articles.splice(index, 1);
    for (const ticket of state.tickets) {
      ticket.articleIds = ticket.articleIds.filter((articleId) => articleId !== id);
    }
    pushActivity(`Knowledge article “${removed.title}” deleted`);
    notify();
    return { ok: true };
  }

  function composeEmail({ to, subject, body, template = "manual" }) {
    if (!enabled("email")) return { ok: false, error: "Email module is off." };
    if (!canAny("send_email", "manage_email")) {
      return { ok: false, error: "Missing permission: send_email" };
    }
    const cleanTo = String(to || "").trim();
    const cleanSubject = String(subject || "").trim();
    const cleanBody = String(body || "").trim();
    if (!cleanTo.includes("@") || !cleanSubject || !cleanBody) {
      return { ok: false, error: "To, subject, and body are required." };
    }
    const result = services.sendEmail({
      to: cleanTo,
      subject: cleanSubject,
      body: cleanBody,
      template,
    });
    if (result.ok) pushActivity(`Email sent to ${cleanTo}`);
    return result;
  }

  function ingestDiscordSuggestion({ author, content, channel }) {
    if (!enabled("discord")) return { ok: false, error: "Discord module is off." };
    const clean = String(content || "").trim();
    const who = String(author || "").trim() || "discord-user";
    if (!clean) return { ok: false, error: "Suggestion text is required." };
    try {
      const ticket = createTicket({
        subject: clean.length > 72 ? `${clean.slice(0, 72)}…` : clean,
        description: clean,
        requester: who.startsWith("@") ? who : `@${who}`,
        source: "discord",
        status: "under_review",
        channel: channel || state.features.discord.config.suggestionsChannel,
        discordMessageId: `dmsg_${Date.now()}`,
      });
      return { ok: true, ticket, message: state.discordMessages.find((item) => item.ticketId === ticket.id) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function createTeam({ name, parentId = null, managerId = "you", memberIds = [] }) {
    if (!enabled("teams")) return { ok: false, error: "Teams module is off." };
    if (!can("manage_teams")) return { ok: false, error: "Missing permission: manage_teams" };
    const clean = String(name || "").trim();
    if (!clean) return { ok: false, error: "Team name is required." };
    if (state.teams.some((team) => team.name.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: "A team with that name already exists." };
    }
    const id = slugify(clean) || `team_${Date.now()}`;
    const members = [...new Set([managerId, ...memberIds].filter(Boolean))];
    const team = {
      id,
      name: clean,
      parentId: parentId || null,
      managerId,
      memberIds: members,
    };
    state.teams.push(team);
    for (const personId of members) {
      const member = person(personId);
      if (member && !member.teamIds.includes(id)) member.teamIds.push(id);
    }
    pushActivity(`Team “${clean}” created`);
    notify();
    return { ok: true, team };
  }

  function updateTeam(id, patch = {}) {
    if (!can("manage_teams")) return { ok: false, error: "Missing permission: manage_teams" };
    const team = state.teams.find((item) => item.id === id);
    if (!team) return { ok: false, error: "Team not found." };
    if (patch.name) team.name = String(patch.name).trim() || team.name;
    if ("parentId" in patch) team.parentId = patch.parentId || null;
    if (patch.managerId) team.managerId = patch.managerId;
    if (Array.isArray(patch.memberIds)) {
      team.memberIds = [...new Set(patch.memberIds)];
      if (!team.memberIds.includes(team.managerId)) team.memberIds.unshift(team.managerId);
    }
    notify();
    return { ok: true, team };
  }

  function setPersonRole(personId, roleId) {
    if (!can("manage_members") && !can("manage_roles")) {
      return { ok: false, error: "Missing permission to change roles." };
    }
    const member = person(personId);
    const role = state.roles.find((item) => item.id === roleId);
    if (!member) return { ok: false, error: "Person not found." };
    if (!role) return { ok: false, error: "Role not found." };
    if (member.status === "suspended" && roleId) {
      // allow role edit while suspended
    }
    if (member.role === "owner" && roleId !== "owner") {
      const owners = state.people.filter((item) => item.role === "owner" && item.status === "active");
      if (owners.length < 2) return { ok: false, error: "Keep at least one active owner." };
    }
    member.role = roleId;
    member.agent = roleId === "agent" || roleId === "admin" || roleId === "owner";
    pushActivity(`${member.name} is now ${role.name}`);
    notify();
    return { ok: true };
  }

  function createMember({ name, email, role = "member", teamIds = [] }) {
    if (!can("manage_members")) return { ok: false, error: "Missing permission: manage_members" };
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanName) return { ok: false, error: "Name is required." };
    if (!cleanEmail.includes("@")) return { ok: false, error: "Valid email is required." };
    if (state.people.some((item) => item.email === cleanEmail)) {
      return { ok: false, error: "A member with that email already exists." };
    }
    if (!state.roles.some((item) => item.id === role)) return { ok: false, error: "Unknown role." };
    const id = slugify(cleanName) || `user_${Date.now()}`;
    const uniqueId = state.people.some((item) => item.id === id) ? `${id}_${Date.now().toString(36)}` : id;
    const teams = teamIds.length ? teamIds : [state.teams[0]?.id].filter(Boolean);
    const member = {
      id: uniqueId,
      name: cleanName,
      email: cleanEmail,
      role,
      teamIds: teams,
      status: "active",
      initials: cleanName.split(/\s+/).map((part) => part[0] || "").join("").slice(0, 2).toUpperCase() || "NA",
      hue: 20 + (state.people.length * 37) % 320,
      agent: role === "agent" || role === "admin" || role === "owner",
    };
    state.people.push(member);
    for (const teamId of teams) {
      const team = state.teams.find((item) => item.id === teamId);
      if (team && !team.memberIds.includes(member.id)) team.memberIds.push(member.id);
    }
    pushActivity(`Member ${cleanName} created`);
    notify();
    return { ok: true, member };
  }

  function updateMember(id, patch = {}) {
    const statusOnly =
      patch.status &&
      Object.keys(patch).every((key) => key === "status");
    if (statusOnly) {
      if (!canAny("suspend_members", "manage_members")) {
        return { ok: false, error: "Missing permission: suspend_members" };
      }
    } else if (!can("manage_members")) {
      return { ok: false, error: "Missing permission: manage_members" };
    }
    const member = person(id);
    if (!member) return { ok: false, error: "Member not found." };
    if (patch.name) {
      member.name = String(patch.name).trim() || member.name;
      member.initials = member.name.split(/\s+/).map((part) => part[0] || "").join("").slice(0, 2).toUpperCase();
    }
    if (patch.email) {
      const cleanEmail = String(patch.email).trim().toLowerCase();
      if (!cleanEmail.includes("@")) return { ok: false, error: "Valid email is required." };
      if (state.people.some((item) => item.email === cleanEmail && item.id !== id)) {
        return { ok: false, error: "Email already in use." };
      }
      member.email = cleanEmail;
    }
    if (patch.role) {
      const role = state.roles.find((item) => item.id === patch.role);
      if (!role) return { ok: false, error: "Unknown role." };
      if (member.role === "owner" && patch.role !== "owner") {
        const owners = state.people.filter((item) => item.role === "owner" && item.status === "active" && item.id !== id);
        if (!owners.length) return { ok: false, error: "Keep at least one active owner." };
      }
      member.role = patch.role;
      member.agent = patch.role === "agent" || patch.role === "admin" || patch.role === "owner";
    }
    if (Array.isArray(patch.teamIds)) {
      member.teamIds = [...new Set(patch.teamIds)];
      for (const team of state.teams) {
        team.memberIds = team.memberIds.filter((memberId) => memberId !== id);
        if (member.teamIds.includes(team.id)) team.memberIds.push(id);
      }
    }
    if (patch.status) {
      if (!["active", "suspended"].includes(patch.status)) {
        return { ok: false, error: "Status must be active or suspended." };
      }
      if (member.role === "owner" && patch.status === "suspended") {
        const owners = state.people.filter((item) => item.role === "owner" && item.status === "active" && item.id !== id);
        if (!owners.length) return { ok: false, error: "Keep at least one active owner." };
      }
      member.status = patch.status;
      if (patch.status === "suspended") {
        state.agentsOnline = state.agentsOnline.filter((agentId) => agentId !== id);
      }
    }
    pushActivity(`${member.name} updated`);
    notify();
    return { ok: true, member };
  }

  function suspendMember(id, suspended = true) {
    return updateMember(id, { status: suspended ? "suspended" : "active" });
  }

  function updateRolePermissions(roleId, permissions) {
    if (!can("manage_roles")) return { ok: false, error: "Missing permission: manage_roles" };
    const role = state.roles.find((item) => item.id === roleId);
    if (!role) return { ok: false, error: "Role not found." };
    if (role.id === "owner") return { ok: false, error: "Owner always has full access." };
    role.permissions = [...new Set(permissions)];
    pushActivity(`Permissions updated for ${role.name}`);
    notify();
    return { ok: true, role };
  }

  function createRole({ name, level = 30, permissions = [] }) {
    if (!can("manage_roles")) return { ok: false, error: "Missing permission: manage_roles" };
    const clean = String(name || "").trim();
    if (!clean) return { ok: false, error: "Role name is required." };
    const id = slugify(clean);
    if (state.roles.some((role) => role.id === id)) return { ok: false, error: "Role already exists." };
    const role = { id, name: clean, level: Number(level) || 30, permissions: [...new Set(permissions)] };
    state.roles.push(role);
    state.roles.sort((a, b) => b.level - a.level);
    notify();
    return { ok: true, role };
  }

  function suggestArticles(query) {
    if (!enabled("knowledge")) return [];
    const tokens = String(query).toLowerCase().split(/\W+/).filter(Boolean);
    return state.articles
      .map((article) => {
        const hay = `${article.title} ${article.body} ${article.tags.join(" ")}`.toLowerCase();
        const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
        return { article, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.article);
  }

  function startChat(visitorName = "Visitor") {
    if (!enabled("chat")) return { ok: false, error: "Live chat is disabled." };
    if (!canAny("manage_chat", "view_chat")) return { ok: false, error: "Missing permission: view_chat" };
    const id = `chat_${Date.now()}`;
    const session = {
      id,
      visitorName,
      status: "queued",
      agentId: null,
      ticketId: null,
      createdAt: now(),
    };
    state.chatSessions.unshift(session);
    state.chatMessages[id] = [
      {
        id: `m_${Date.now()}`,
        from: "system",
        text: state.features.chat.config.greeting,
        at: now(),
      },
    ];
    pushActivity(`Chat ${id} opened`);
    notify();
    return { ok: true, session };
  }

  function sendChatMessage(sessionId, text, from = "visitor", { articleId = null } = {}) {
    const session = state.chatSessions.find((item) => item.id === sessionId);
    if (!session) return { ok: false, error: "Chat not found." };
    if (from === "agent" && !canAny("reply_chat", "manage_chat")) {
      return { ok: false, error: "Missing permission: reply_chat" };
    }
    if (session.status === "ticketed" && from === "visitor") {
      return { ok: false, error: "This chat already became a ticket." };
    }

    let clean = String(text || "").trim();
    if (articleId && enabled("knowledge") && can("view_kb")) {
      const article = state.articles.find((item) => item.id === articleId);
      if (article) {
        clean = clean
          ? `${clean}\n\n— ${article.title}\n${article.body}`
          : `— ${article.title}\n${article.body}`;
      }
    }
    if (!clean) return { ok: false, error: "Message cannot be empty." };

    const message = {
      id: `m_${Date.now()}`,
      from,
      text: clean,
      articleId: articleId || null,
      at: now(),
    };
    state.chatMessages[sessionId].push(message);

    if (from === "visitor" && state.features.chat.config.suggestKnowledge !== false) {
      const suggestions = suggestArticles(clean).slice(0, 2);
      for (const article of suggestions) {
        state.chatMessages[sessionId].push({
          id: `m_${Date.now()}_kb_${article.id}`,
          from: "system",
          text: `Suggested article: ${article.title}`,
          articleId: article.id,
          at: now(),
        });
      }
    }

    if (from === "agent" && session.status === "queued") {
      session.status = "live";
      session.agentId = state.currentUserId;
    }

    notify();
    return { ok: true, suggestions: from === "visitor" ? suggestArticles(clean).slice(0, 2) : [] };
  }

  function routeChat(sessionId) {
    if (!canAny("manage_chat", "reply_chat")) {
      return { ok: false, error: "Missing permission: manage_chat" };
    }
    const session = state.chatSessions.find((item) => item.id === sessionId);
    if (!session) return { ok: false, error: "Chat not found." };
    if (session.status === "ticketed") return { ok: false, error: "Chat already escalated to a ticket." };

    const online = state.agentsOnline
      .map((id) => person(id))
      .filter((item) => item && item.agent && item.status === "active");

    if (online.length) {
      session.status = "live";
      session.agentId = online[0].id;
      state.chatMessages[sessionId].push({
        id: `m_${Date.now()}`,
        from: "system",
        text: `${online[0].name} joined the conversation.`,
        at: now(),
      });
      services.emit("chat.assigned", { sessionId, agentId: session.agentId });
      pushActivity(`Chat routed to ${online[0].name}`);
      notify();
      return { ok: true, mode: "live", agent: online[0] };
    }

    if (state.features.chat.config.offlineCreatesTicket && enabled("tickets")) {
      const latestVisitor = [...(state.chatMessages[sessionId] || [])]
        .reverse()
        .find((item) => item.from === "visitor");
      const ticket = createTicket({
        subject: latestVisitor?.text
          ? `Chat: ${latestVisitor.text.slice(0, 60)}`
          : `Chat from ${session.visitorName}`,
        description: (state.chatMessages[sessionId] || [])
          .map((item) => `${item.from}: ${item.text}`)
          .join("\n"),
        requester: `${slugify(session.visitorName)}@visitor.local`,
        source: "chat",
        priority: "medium",
      });
      session.status = "ticketed";
      session.ticketId = ticket.id;
      state.chatMessages[sessionId].push({
        id: `m_${Date.now()}`,
        from: "system",
        text: `No agents online. Opened ticket ${ticket.id}.`,
        at: now(),
      });
      services.emit("chat.escalated", { sessionId, ticketId: ticket.id });
      pushActivity(`Chat escalated to ${ticket.id}`);
      notify();
      return { ok: true, mode: "ticket", ticket };
    }

    session.status = "waiting";
    state.chatMessages[sessionId].push({
      id: `m_${Date.now()}`,
      from: "system",
      text: "No agents available right now. Leave a message and we will follow up.",
      at: now(),
    });
    notify();
    return { ok: true, mode: "waiting" };
  }

  function getPublic() {
    return {
      FEATURES,
      PERMISSIONS,
      TICKET_STATUSES,
      onboarded: state.onboarded,
      workspace: state.workspace,
      features: state.features,
      roles: state.roles,
      people: state.people,
      teams: state.teams,
      invites: state.invites,
      tickets: state.tickets,
      articles: state.articles,
      chatSessions: state.chatSessions,
      chatMessages: state.chatMessages,
      agentsOnline: state.agentsOnline,
      projects: state.projects,
      webhooks: state.webhooks,
      webhookDeliveries: state.webhookDeliveries,
      emails: state.emails,
      apiLog: state.apiLog,
      activity: state.activity,
      discordMessages: state.discordMessages,
      apiToken: state.apiToken,
      currentUser: currentUser(),
      enabled,
      can,
      canAny,
      person,
      suggestArticles,
    };
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: getPublic,
    registerWorkspace,
    setFeature,
    updateFeatureConfig,
    invitePerson,
    createMember,
    updateMember,
    suspendMember,
    createTicket,
    updateTicket,
    addTicketComment,
    linkTicketArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    composeEmail,
    ingestDiscordSuggestion,
    createTeam,
    updateTeam,
    setPersonRole,
    updateRolePermissions,
    createRole,
    startChat,
    sendChatMessage,
    routeChat,
    toggleAgent(id) {
      if (state.agentsOnline.includes(id)) {
        state.agentsOnline = state.agentsOnline.filter((item) => item !== id);
      } else {
        state.agentsOnline.push(id);
      }
      notify();
    },
    addWebhook({ name, url, events }) {
      if (!enabled("webhooks")) return { ok: false, error: "Webhooks module is off." };
      const hook = {
        id: `wh_${Date.now()}`,
        name: name.trim() || "Webhook",
        url: url.trim(),
        events: events?.length ? events : ["ticket.created"],
        enabled: true,
      };
      if (!hook.url.startsWith("http")) return { ok: false, error: "URL must start with http." };
      state.webhooks.unshift(hook);
      pushActivity(`Webhook ${hook.name} added`);
      notify();
      return { ok: true, hook };
    },
    api: services,
    moveIssue(projectId, issueId, status) {
      const project = state.projects.find((item) => item.id === projectId);
      const issue = project?.issues.find((item) => item.id === issueId);
      if (!issue) return { ok: false, error: "Issue not found." };
      issue.status = status;
      notify();
      return { ok: true };
    },
    createIssue(projectId, payload) {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const highest = project.issues.reduce((max, item) => {
        const number = Number(String(item.id).split("-").pop());
        return Number.isFinite(number) ? Math.max(max, number) : max;
      }, 0);
      const id = `${project.key}-${highest + 1}`;
      project.issues.unshift({
        id,
        title: payload.title,
        description: "",
        status: "todo",
        type: payload.type || "task",
        priority: payload.priority || "medium",
        assignee: payload.assignee || "you",
        points: 3,
      });
      notify();
      return { ok: true, id };
    },
    updateIssue(projectId, issueId, patch) {
      const project = state.projects.find((item) => item.id === projectId);
      const issue = project?.issues.find((item) => item.id === issueId);
      if (!issue) return { ok: false, error: "Issue not found." };
      Object.assign(issue, patch);
      notify();
      return { ok: true };
    },
  };
}
