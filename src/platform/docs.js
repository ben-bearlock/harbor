/** In-app product documentation, MVP checklist, and API reference. */

export const DOC_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "modules", label: "Modules" },
  { id: "configure", label: "Configure" },
  { id: "mvp", label: "MVP checklist" },
  { id: "api", label: "REST API" },
];

export function renderDocSection(id, state) {
  switch (id) {
    case "overview":
      return overviewDoc();
    case "modules":
      return modulesDoc(state);
    case "configure":
      return configureDoc(state);
    case "mvp":
      return mvpDoc(state);
    case "api":
      return apiDoc(state);
    default:
      return overviewDoc();
  }
}

function overviewDoc() {
  return `
    <article class="doc-block">
      <h2>What Harbor is</h2>
      <p>Harbor is a modular workspace for product boards, support tickets, knowledge, live chat, Discord suggestions, and organization management. Every major capability is a module you can turn on or off under <strong>Modules</strong>.</p>
      <h3>Suggested first hour</h3>
      <ol>
        <li>Register a personal or organization workspace.</li>
        <li>Open <strong>People</strong> to invite teammates, create teams, and assign roles.</li>
        <li>Create a ticket and open it to edit status, outcome, and comments.</li>
        <li>If Discord is on, post a suggestion and watch the bot reply update when the ticket is solved.</li>
        <li>Use <strong>Docs → MVP checklist</strong> to see what is still missing for a production-ready MVP.</li>
      </ol>
      <h3>How modules connect</h3>
      <ul>
        <li>Chat can create tickets when no agent is online.</li>
        <li>Tickets can suggest knowledge articles.</li>
        <li>Discord suggestions create tickets and edit Discord replies on outcome changes.</li>
        <li>Invites and ticket events can send email and fire webhooks.</li>
        <li>The REST API can read/write the same workspace data the UI uses.</li>
      </ul>
    </article>
  `;
}

function modulesDoc(state) {
  return `
    <article class="doc-block">
      <h2>Module guide</h2>
      <p>Each module below can be enabled or disabled. Dependencies are enforced: for example Discord needs Tickets, and Invites need Email.</p>
      ${state.FEATURES.map((feature) => {
        const current = state.features[feature.id];
        return `
          <section class="doc-card">
            <div class="doc-card-head">
              <h3>${escape(feature.name)}</h3>
              <span class="pill">${current.enabled ? "on" : "off"}</span>
            </div>
            <p>${escape(feature.description)}</p>
            <p class="muted">Category: ${escape(feature.category)}${feature.dependsOn.length ? ` · Needs: ${feature.dependsOn.join(", ")}` : ""}</p>
            <h4>How to use</h4>
            <p>${usageFor(feature.id)}</p>
            <h4>Configure</h4>
            <p>${configFor(feature.id)}</p>
          </section>
        `;
      }).join("")}
    </article>
  `;
}

function usageFor(id) {
  const map = {
    board: "Open Board to drag issues across columns, create issues, and inspect cards.",
    tickets: "Open Tickets, click a row for the detail drawer, edit status/outcome, and add comments. Discord-linked tickets sync bot replies on save.",
    knowledge: "Create, edit, and delete help articles. Tickets and live chat can insert articles into replies when Knowledge is on.",
    chat: "Start a demo chat, send visitor messages, then Route now. Online agents take the chat; otherwise a ticket can be created.",
    discord: "In Discord, simulate a suggestion. Harbor creates a ticket under review and edits the bot message as the ticket outcome changes.",
    teams: "Managed inside People → Teams. Create teams, set hierarchy parents, managers, and members.",
    roles: "Managed inside People → Roles. Assign people to roles and edit the permission matrix.",
    invites: "Managed inside People → Invites. Send email invites into a role and team.",
    email: "Compose mail, configure sender settings, and inspect the outbox for invites, tickets, and replies.",
    webhooks: "Add endpoints and review deliveries for ticket, invite, chat, Discord, and email events.",
    api: "Use REST API explorer or Docs → REST API. Authenticate with the workspace bearer token.",
  };
  return map[id] || "Toggle this module and use its nav entry when enabled.";
}

function configFor(id) {
  const map = {
    board: "Modules → Board options for backlog/drag (demo defaults are fine).",
    tickets: "Modules → Tickets: default priority and whether to link knowledge articles.",
    knowledge: "Manage articles in Knowledge. Categories come from Modules → Knowledge config.",
    chat: "Modules → Chat: greeting and “create ticket when no agent is available”.",
    discord: "Modules → Discord: server name, suggestions channel, bot name, auto-reply, edit-on-outcome.",
    teams: "Enable Teams module. Manage structure in People → Teams.",
    roles: "Enable Roles module. Edit permissions in People → Roles.",
    invites: "Requires Email. Manage from People → Invites.",
    email: "Modules → Email from-name / from-address / reply-to (demo outbox).",
    webhooks: "Modules → Webhooks signing secret and retry flag; add URLs in Webhooks.",
    api: "Modules → API base path and require-token. Token is shown in REST API and Docs.",
  };
  return map[id] || "Configure under Modules when available.";
}

function configureDoc(state) {
  const enabled = Object.entries(state.features)
    .filter(([, value]) => value.enabled)
    .map(([id]) => id);
  return `
    <article class="doc-block">
      <h2>Configuration map</h2>
      <p>Use <strong>Modules</strong> as the control plane. People, permissions, and invites live under the unified <strong>People</strong> tab.</p>
      <h3>Currently enabled</h3>
      <p>${enabled.map((id) => `<span class="pill">${escape(id)}</span>`).join(" ") || "None"}</p>
      <h3>Organization setup</h3>
      <ol>
        <li>People → Members: create users, edit profiles, suspend access.</li>
        <li>People → Teams: build hierarchy (root → departments → squads).</li>
        <li>People → Roles: tighten permissions for admin/agent/member/custom roles.</li>
        <li>People → Invites: bring external emails into a role + team.</li>
      </ol>
      <h3>Support setup</h3>
      <ol>
        <li>Keep Tickets + Knowledge on for a complete support loop.</li>
        <li>Optional: Chat for live handoff, Discord for community suggestions.</li>
        <li>Optional: Email + Webhooks for notifications and integrations.</li>
      </ol>
      <h3>Permission model</h3>
      <p>Roles hold permission keys such as <code>manage_tickets</code> or <code>manage_members</code>. Owner always has full access (<code>*</code>). The UI hides or blocks actions when the current user lacks permission.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Permission</th><th>Meaning</th></tr></thead>
          <tbody>
            ${state.PERMISSIONS.map((item) => `
              <tr><td><code>${escape(item.id)}</code></td><td>${escape(item.label)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function mvpDoc(state) {
  const checks = mvpChecks(state);
  const ready = checks.filter((item) => item.ok).length;
  return `
    <article class="doc-block">
      <h2>MVP readiness</h2>
      <p>${ready} / ${checks.length} checks passing in this workspace.</p>
      <div class="mvp-list">
        ${checks.map((item) => `
          <div class="mvp-item ${item.ok ? "is-ok" : "is-gap"}">
            <strong>${item.ok ? "Ready" : "Gap"}</strong>
            <div>
              <p>${escape(item.title)}</p>
              <p class="muted">${escape(item.detail)}</p>
            </div>
          </div>
        `).join("")}
      </div>
      <h3>Still needed for a real production MVP</h3>
      <ul>
        <li>Persistent backend database (today’s data is browser localStorage).</li>
        <li>Real Discord bot token + gateway/webhook verification.</li>
        <li>Real SMTP or email provider (SendGrid, SES, Postmark).</li>
        <li>Outbound HTTPS webhook delivery with signatures and retries.</li>
        <li>Hosted REST API with rate limits, audit logs, and scoped API keys.</li>
        <li>Clerk Organizations sync for production auth membership.</li>
        <li>Automated tests and staging deploy pipeline.</li>
      </ul>
    </article>
  `;
}

export function mvpChecks(state) {
  const hasActiveMember = state.people.some((person) => person.status === "active");
  const hasTeam = state.teams.length > 0;
  const hasRoleMatrix = state.roles.some((role) => role.id !== "owner" && role.permissions.length > 0);
  const ticketsOn = state.enabled("tickets");
  const peopleReady = state.enabled("teams") && state.enabled("roles");
  const supportLoop = ticketsOn && state.enabled("knowledge");
  const discordLoop = !state.enabled("discord") || (ticketsOn && state.features.discord.config.autoReply);
  const apiOn = state.enabled("api");
  const emailOn = state.enabled("email");
  return [
    {
      ok: Boolean(state.workspace),
      title: "Workspace registered",
      detail: "Personal or organization workspace exists.",
    },
    {
      ok: hasActiveMember,
      title: "At least one active member",
      detail: "Create or keep an active user in People → Members.",
    },
    {
      ok: peopleReady && hasTeam && hasRoleMatrix,
      title: "People foundation",
      detail: "Teams + Roles modules on, with at least one team and editable roles.",
    },
    {
      ok: supportLoop,
      title: "Support loop",
      detail: "Tickets and Knowledge both enabled.",
    },
    {
      ok: discordLoop,
      title: "Discord suggestions path",
      detail: "Either Discord is off, or it auto-replies into tickets.",
    },
    {
      ok: emailOn,
      title: "Email module on",
      detail: "Needed for invites and ticket notifications in the demo.",
    },
    {
      ok: apiOn,
      title: "REST API module on",
      detail: "Required for integrations and the API explorer.",
    },
    {
      ok: state.enabled("webhooks"),
      title: "Webhooks module on",
      detail: "Needed to fan events out to external systems.",
    },
  ];
}

function apiDoc(state) {
  const routes = [
    {
      method: "GET",
      path: "/api/v1/health",
      desc: "Liveness check.",
      body: null,
      response: '{ "ok": true, "product": "Harbor" }',
    },
    {
      method: "GET",
      path: "/api/v1/workspace",
      desc: "Current workspace metadata and enabled feature flags.",
      body: null,
      response: '{ "type": "organization", "name": "...", "features": { "tickets": true } }',
    },
    {
      method: "GET",
      path: "/api/v1/members",
      desc: "List members (id, name, email, role, status, teams).",
      body: null,
      response: '[ { "id": "you", "email": "...", "role": "owner", "status": "active" } ]',
    },
    {
      method: "POST",
      path: "/api/v1/members",
      desc: "Create a member. Requires manage_members.",
      body: '{ "name": "Sam Lee", "email": "sam@company.com", "role": "member", "teamIds": ["support"] }',
      response: '{ "ok": true, "member": { ... } }',
    },
    {
      method: "PATCH",
      path: "/api/v1/members/:id",
      desc: "Update profile, role, teams, or status (active/suspended).",
      body: '{ "status": "suspended" }',
      response: '{ "ok": true, "member": { ... } }',
    },
    {
      method: "GET",
      path: "/api/v1/teams",
      desc: "List teams and hierarchy.",
      body: null,
      response: '[ { "id": "support", "parentId": "leadership", "memberIds": [] } ]',
    },
    {
      method: "POST",
      path: "/api/v1/teams",
      desc: "Create a team.",
      body: '{ "name": "Success", "parentId": "leadership", "managerId": "amina", "memberIds": ["amina"] }',
      response: '{ "ok": true, "team": { ... } }',
    },
    {
      method: "GET",
      path: "/api/v1/roles",
      desc: "List roles and permission arrays.",
      body: null,
      response: '[ { "id": "agent", "permissions": ["manage_tickets"] } ]',
    },
    {
      method: "GET",
      path: "/api/v1/tickets",
      desc: "List tickets.",
      body: null,
      response: '[ { "id": "T-101", "status": "open" } ]',
    },
    {
      method: "POST",
      path: "/api/v1/tickets",
      desc: "Create a ticket.",
      body: '{ "subject": "Billing question", "requester": "user@example.com", "priority": "high" }',
      response: '{ "id": "T-104", "status": "open" }',
    },
    {
      method: "PATCH",
      path: "/api/v1/tickets/:id",
      desc: "Update ticket fields including status and outcome (syncs Discord when linked).",
      body: '{ "status": "solved", "outcome": "Fixed in 1.2" }',
      response: '{ "ok": true, "ticket": { ... } }',
    },
    {
      method: "GET",
      path: "/api/v1/knowledge",
      desc: "List knowledge base articles.",
      body: null,
      response: '[ { "id": "kb_1", "title": "..." } ]',
    },
    {
      method: "POST",
      path: "/api/v1/invites",
      desc: "Send an invitation email.",
      body: '{ "email": "new@company.com", "role": "member", "teamId": "support" }',
      response: '{ "ok": true, "invite": { ... } }',
    },
    {
      method: "POST",
      path: "/api/v1/discord/suggestions",
      desc: "Ingest a Discord suggestion → ticket + bot under-review reply.",
      body: '{ "author": "maya", "content": "Add dark mode", "channel": "#suggestions" }',
      response: '{ "ok": true, "ticket": { "id": "T-105" } }',
    },
  ];

  return `
    <article class="doc-block">
      <h2>REST API</h2>
      <p>Base path: <code>${escape(state.features.api.config.basePath)}</code></p>
      <p>Auth: <code>Authorization: Bearer ${escape(state.apiToken)}</code></p>
      <p>Content-Type: <code>application/json</code> for POST/PATCH bodies.</p>
      <h3>Quick start</h3>
      <pre class="code-block">curl -s ${escape(state.features.api.config.basePath)}/tickets \\
  -H "Authorization: Bearer ${escape(state.apiToken)}"</pre>
      <h3>Endpoints</h3>
      ${routes.map((route) => `
        <section class="doc-card">
          <div class="doc-card-head">
            <h3><span class="pill">${route.method}</span> <code>${escape(route.path)}</code></h3>
          </div>
          <p>${escape(route.desc)}</p>
          ${route.body ? `<p><strong>Body</strong></p><pre class="code-block">${escape(route.body)}</pre>` : "<p class=\"muted\">No body</p>"}
          <p><strong>Example response</strong></p>
          <pre class="code-block">${escape(route.response)}</pre>
        </section>
      `).join("")}
      <h3>Errors</h3>
      <ul>
        <li><code>401</code> — missing/invalid bearer token when requireToken is on</li>
        <li><code>404</code> — unknown path</li>
        <li><code>400</code> — validation error (<code>{ "error": "..." }</code>)</li>
        <li><code>503</code> — API module disabled</li>
      </ul>
      <h3>Events that also hit webhooks</h3>
      <p><code>ticket.created</code>, <code>ticket.updated</code>, <code>invite.sent</code>, <code>chat.assigned</code>, <code>chat.escalated</code>, <code>discord.replied</code>, <code>discord.edited</code>, <code>email.sent</code>, <code>workspace.created</code></p>
    </article>
  `;
}

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}
