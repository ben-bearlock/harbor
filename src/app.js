import { createPlatform } from "./platform/store.js";
import { DOC_SECTIONS, mvpChecks, renderDocSection } from "./platform/docs.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

function avatar(person) {
  if (!person) return "";
  return `<span class="avatar" style="--hue:${person.hue}" title="${escapeHtml(person.name)}">${escapeHtml(person.initials)}</span>`;
}

const NAV = [
  { id: "home", label: "Home", feature: null },
  { id: "board", label: "Board", feature: "board" },
  { id: "tickets", label: "Tickets", feature: "tickets" },
  { id: "knowledge", label: "Knowledge", feature: "knowledge" },
  { id: "chat", label: "Live chat", feature: "chat" },
  { id: "discord", label: "Discord", feature: "discord" },
  { id: "people", label: "People", feature: null },
  { id: "email", label: "Email", feature: "email" },
  { id: "webhooks", label: "Webhooks", feature: "webhooks" },
  { id: "api", label: "REST API", feature: "api" },
  { id: "docs", label: "Docs", feature: null },
  { id: "settings", label: "Modules", feature: null },
];

export function mountApp(root) {
  const platform = createPlatform();
  let view = "home";
  let flash = "";
  let projectId = "web";
  let selectedIssue = null;
  let selectedTicketId = null;
  let selectedArticleId = null;
  let selectedRoleId = null;
  let selectedMemberId = null;
  let peopleTab = "members";
  let docsTab = "overview";
  let activeChatId = null;
  let chatComposerMode = "visitor";
  let registerMode = "organization";

  function snap() {
    return platform.get();
  }

  function go(next, message = "") {
    const state = snap();
    const item = NAV.find((entry) => entry.id === next);
    if (item?.feature && !state.enabled(item.feature)) {
      flash = `${item.label} is turned off in Modules.`;
      view = state.can("manage_features") ? "settings" : "home";
      draw();
      return;
    }
    if (item && !canViewNav(state, item)) {
      flash = `You do not have access to ${item.label}.`;
      view = "home";
      draw();
      return;
    }
    view = next;
    flash = message;
    draw();
  }

  function registerView() {
    return `
      <section class="gate">
        <div class="gate-card">
          <p class="eyebrow">Harbor</p>
          <h1>Register your workspace</h1>
          <p class="lede">Use Harbor alone, or as an organization with teams, invites, support, and modular platform services.</p>
          <div class="mode-toggle" role="tablist">
            <button type="button" class="nav-btn ${registerMode === "personal" ? "is-active" : ""}" data-register-mode="personal">For yourself</button>
            <button type="button" class="nav-btn ${registerMode === "organization" ? "is-active" : ""}" data-register-mode="organization">For an organization</button>
          </div>
          <form id="register-form" class="stack-form">
            <label>Your name <input name="yourName" required placeholder="Alex Rivera"></label>
            <label>Work email <input name="email" type="email" required placeholder="alex@company.com"></label>
            <label>${registerMode === "organization" ? "Organization name" : "Workspace name"}
              <input name="name" required placeholder="${registerMode === "organization" ? "Northwind Support" : "Alex’s Harbor"}">
            </label>
            <button class="btn" type="submit">Create workspace</button>
          </form>
          ${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ""}
        </div>
      </section>
    `;
  }

  function canViewNav(state, item) {
    if (item.feature && !state.enabled(item.feature)) return false;
    const gate = {
      tickets: ["view_tickets", "manage_tickets", "reply_tickets"],
      knowledge: ["view_kb", "manage_kb"],
      chat: ["view_chat", "manage_chat", "reply_chat"],
      discord: ["view_discord", "manage_discord"],
      board: ["view_board", "manage_board"],
      email: ["view_email", "send_email", "manage_email"],
      webhooks: ["view_webhooks", "manage_webhooks"],
      api: ["view_api"],
      settings: ["manage_features"],
    };
    const needed = gate[item.id];
    if (!needed) return true;
    return state.canAny(...needed);
  }

  function shell(content) {
    const state = snap();
    const nav = NAV.filter((item) => canViewNav(state, item));
    return `
      <aside class="rail">
        <p class="brand-mark">Harbor</p>
        <p class="rail-copy">${escapeHtml(state.workspace.name)} · ${escapeHtml(state.workspace.type)}</p>
        <nav class="rail-nav">
          ${nav.map((item) => `
            <button type="button" class="rail-link ${view === item.id ? "is-active" : ""}" data-view="${item.id}">${item.label}</button>
          `).join("")}
        </nav>
        <div class="rail-foot">
          <p>Modules on: ${Object.values(state.features).filter((item) => item.enabled).length}/${state.FEATURES.length}</p>
        </div>
      </aside>
      <section class="workspace">
        ${flash ? `<p class="flash banner" role="status">${escapeHtml(flash)}</p>` : ""}
        ${content}
      </section>
    `;
  }

  function homeView(state) {
    const openTickets = state.tickets.filter((item) => item.status !== "solved").length;
    const liveChats = state.chatSessions.filter((item) => item.status === "live" || item.status === "queued").length;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Home</p>
          <h1>${escapeHtml(state.workspace.name)}</h1>
          <p class="lede">Support, product work, and platform services share one modular workspace.</p>
        </div>
      </header>
      <div class="stat-grid">
        <article class="card"><p>Open tickets</p><strong>${openTickets}</strong></article>
        <article class="card"><p>Live / queued chats</p><strong>${liveChats}</strong></article>
        <article class="card"><p>Teams</p><strong>${state.teams.length}</strong></article>
        <article class="card"><p>KB articles</p><strong>${state.articles.length}</strong></article>
      </div>
      <div class="split">
        <article class="card">
          <h2>How modules connect</h2>
          <ul class="plain">
            <li>People consolidates members, teams, roles, and invites.</li>
            <li>Chat can open a ticket when no agent is online.</li>
            <li>Discord suggestions create tickets and update on outcomes.</li>
            <li>Docs covers modules, MVP readiness, and the full REST API.</li>
          </ul>
        </article>
        <article class="card">
          <h2>Recent activity</h2>
          <ul class="feed">
            ${state.activity.slice(0, 8).map((item) => `<li>${escapeHtml(item.text)} <time>${escapeHtml(item.at.slice(11, 16))}</time></li>`).join("") || "<li>No activity yet.</li>"}
          </ul>
        </article>
      </div>
    `;
  }

  function boardView(state) {
    const project = state.projects.find((item) => item.id === projectId) || state.projects[0];
    const columns = [
      ["todo", "To do"],
      ["in_progress", "In progress"],
      ["review", "Review"],
      ["done", "Done"],
    ];
    const issue = selectedIssue ? project.issues.find((item) => item.id === selectedIssue) : null;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Board module</p>
          <h1>${escapeHtml(project.name)}</h1>
        </div>
        <form id="board-create" class="inline-form">
          <input name="title" required placeholder="New issue title">
          <button class="btn" type="submit">Add</button>
        </form>
      </header>
      <div class="board">
        ${columns.map(([status, label]) => {
          const issues = project.issues.filter((item) => item.status === status);
          return `
            <section class="column" data-drop="${status}">
              <header class="column-head"><h2>${label}</h2><span>${issues.length}</span></header>
              <div class="column-body">
                ${issues.map((item) => `
                  <article class="issue-card" draggable="true" data-drag="${item.id}" data-open-issue="${item.id}">
                    <div class="issue-top"><span class="pill">${item.type}</span><span class="pill">${item.priority}</span></div>
                    <h3>${escapeHtml(item.title)}</h3>
                    <div class="issue-meta"><span class="key">${item.id}</span>${avatar(state.person(item.assignee))}</div>
                  </article>
                `).join("")}
              </div>
            </section>
          `;
        }).join("")}
      </div>
      ${issue ? `
        <aside class="drawer">
          <div class="drawer-head">
            <div><p class="key">${issue.id}</p><h2>${escapeHtml(issue.title)}</h2></div>
            <button class="icon-btn" type="button" data-close-issue>×</button>
          </div>
          <p>${escapeHtml(issue.description || "No description yet.")}</p>
          <label>Status
            <select data-issue-status="${issue.id}">
              ${columns.map(([status, label]) => `<option value="${status}" ${issue.status === status ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
        </aside>
        <button class="scrim" type="button" data-close-issue></button>
      ` : ""}
    `;
  }

  function ticketDrawer(state) {
    const ticket = state.tickets.find((item) => item.id === selectedTicketId);
    if (!ticket) return "";
    const discord = state.discordMessages.find((item) => item.ticketId === ticket.id);
    const canEdit = state.canAny("manage_tickets", "assign_tickets", "reply_tickets");
    const canReply = state.canAny("manage_tickets", "reply_tickets");
    const suggestions = state.enabled("knowledge") && state.can("view_kb")
      ? state.suggestArticles(`${ticket.subject} ${ticket.description}`).slice(0, 4)
      : [];
    return `
      <aside class="drawer wide">
        <div class="drawer-head">
          <div>
            <p class="key">${escapeHtml(ticket.id)}</p>
            <h2>${escapeHtml(ticket.subject)}</h2>
          </div>
          <button class="icon-btn" type="button" data-close-ticket aria-label="Close ticket">×</button>
        </div>
        <form id="ticket-detail-form" class="stack-form" data-ticket="${escapeHtml(ticket.id)}">
          <label>Subject <input name="subject" value="${escapeHtml(ticket.subject)}" required ${canEdit ? "" : "disabled"}></label>
          <label>Description <textarea name="description" rows="4" ${canEdit ? "" : "disabled"}>${escapeHtml(ticket.description)}</textarea></label>
          <div class="create-row">
            <label>Status
              <select name="status" ${canEdit ? "" : "disabled"}>
                ${state.TICKET_STATUSES.map((status) => `
                  <option value="${status.id}" ${ticket.status === status.id ? "selected" : ""}>${escapeHtml(status.label)}</option>
                `).join("")}
              </select>
            </label>
            <label>Priority
              <select name="priority" ${canEdit ? "" : "disabled"}>
                ${["urgent", "high", "medium", "low"].map((item) => `
                  <option value="${item}" ${ticket.priority === item ? "selected" : ""}>${item}</option>
                `).join("")}
              </select>
            </label>
            <label>Assignee
              <select name="assigneeId" ${state.canAny("assign_tickets", "manage_tickets") ? "" : "disabled"}>
                ${state.people.map((person) => `
                  <option value="${person.id}" ${ticket.assigneeId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>
                `).join("")}
              </select>
            </label>
          </div>
          <div class="create-row">
            <label>Team
              <select name="teamId" ${canEdit ? "" : "disabled"}>
                ${state.teams.map((team) => `
                  <option value="${team.id}" ${ticket.teamId === team.id ? "selected" : ""}>${escapeHtml(team.name)}</option>
                `).join("")}
              </select>
            </label>
            <label>Outcome note
              <input name="outcome" value="${escapeHtml(ticket.outcome)}" placeholder="Shown on Discord when solved/rejected" ${canEdit ? "" : "disabled"}>
            </label>
          </div>
          <p class="muted">Source: ${escapeHtml(ticket.source)} · Requester: ${escapeHtml(ticket.requester)}</p>
          <div class="kb-link-block">
            <p class="eyebrow">Linked knowledge</p>
            <div class="issue-top">
              ${ticket.articleIds.map((id) => {
                const article = state.articles.find((item) => item.id === id);
                return article
                  ? `<button type="button" class="pill pill-action" data-unlink-article="${escapeHtml(id)}" data-ticket-kb="${escapeHtml(ticket.id)}">${escapeHtml(article.title)} ×</button>`
                  : "";
              }).join("") || `<span class="muted">No linked articles</span>`}
            </div>
            ${suggestions.length ? `
              <p class="muted">Suggested for this ticket</p>
              <div class="issue-top">
                ${suggestions.map((article) => `
                  <button type="button" class="btn btn-ghost btn-compact" data-link-article="${escapeHtml(article.id)}" data-ticket-kb="${escapeHtml(ticket.id)}">
                    Link “${escapeHtml(article.title)}”
                  </button>
                `).join("")}
              </div>
            ` : ""}
            ${state.enabled("knowledge") && canReply ? `
              <label>Link article
                <select data-ticket-article-pick="${escapeHtml(ticket.id)}">
                  <option value="">Choose an article…</option>
                  ${state.articles.map((article) => `
                    <option value="${article.id}">${escapeHtml(article.category)} · ${escapeHtml(article.title)}</option>
                  `).join("")}
                </select>
              </label>
            ` : ""}
          </div>
          ${discord ? `<p class="muted">Discord thread linked · latest bot reply updates when status changes.</p>` : ""}
          ${canEdit ? `<button class="btn" type="submit">Save ticket</button>` : ""}
        </form>
        <section>
          <h3>Replies</h3>
          <ul class="feed">
            ${ticket.comments.map((comment) => `
              <li>
                <div>
                  <strong>${escapeHtml(state.person(comment.authorId)?.name || "Someone")}${comment.public ? " · public" : " · internal"}</strong>
                  <span class="pre-wrap">${escapeHtml(comment.text)}</span>
                </div>
                <time>${escapeHtml(comment.at.slice(11, 16))}</time>
              </li>
            `).join("") || "<li>No replies yet.</li>"}
          </ul>
          ${canReply ? `
            <form id="ticket-comment-form" class="stack-form" data-ticket="${escapeHtml(ticket.id)}">
              <label>Reply
                <textarea name="text" rows="3" placeholder="Write a reply…"></textarea>
              </label>
              <div class="create-row">
                <label>Insert from knowledge
                  <select name="articleId">
                    <option value="">None</option>
                    ${state.articles.map((article) => `
                      <option value="${article.id}">${escapeHtml(article.title)}</option>
                    `).join("")}
                  </select>
                </label>
                <label class="check"><input type="checkbox" name="publicReply" value="1"> Send as public email reply</label>
              </div>
              <button class="btn" type="submit">Post reply</button>
            </form>
          ` : `<p class="muted">You need <code>reply_tickets</code> to respond.</p>`}
        </section>
      </aside>
      <button class="scrim" type="button" data-close-ticket aria-label="Close ticket"></button>
    `;
  }

  function ticketsView(state) {
    const canCreate = state.canAny("manage_tickets", "reply_tickets");
    const openCount = state.tickets.filter((item) => item.status !== "solved" && item.status !== "rejected").length;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Tickets</p>
          <h1>Support queue</h1>
          <p class="lede">${openCount} open · reply with knowledge articles, assign agents, and sync Discord outcomes.</p>
        </div>
        ${canCreate ? `
          <form id="ticket-form" class="inline-form">
            <input name="subject" required placeholder="Ticket subject">
            <input name="requester" type="email" placeholder="requester@email.com">
            <select name="priority">
              ${["urgent", "high", "medium", "low"].map((item) => `
                <option value="${item}" ${item === (state.features.tickets.config.defaultPriority || "medium") ? "selected" : ""}>${item}</option>
              `).join("")}
            </select>
            <button class="btn" type="submit">Create ticket</button>
          </form>
        ` : ""}
      </header>
      <div class="table-wrap card">
        <table>
          <thead><tr><th>ID</th><th>Subject</th><th>Status</th><th>Priority</th><th>Source</th><th>KB</th><th>Assignee</th><th>Updated</th></tr></thead>
          <tbody>
            ${state.tickets.map((ticket) => `
              <tr data-open-ticket="${escapeHtml(ticket.id)}" tabindex="0">
                <td class="key">${ticket.id}</td>
                <td>${escapeHtml(ticket.subject)}</td>
                <td><span class="pill">${ticket.status}</span></td>
                <td><span class="pill">${ticket.priority}</span></td>
                <td>${ticket.source}</td>
                <td>${ticket.articleIds.map((id) => {
                  const article = state.articles.find((item) => item.id === id);
                  return article ? `<span class="pill">${escapeHtml(article.title.slice(0, 18))}…</span>` : "";
                }).join(" ") || "—"}</td>
                <td>${avatar(state.person(ticket.assigneeId))}</td>
                <td>${escapeHtml((ticket.updatedAt || ticket.createdAt || "").slice(0, 10))}</td>
              </tr>
            `).join("") || `<tr><td colspan="8">No tickets yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${ticketDrawer(state)}
    `;
  }

  function knowledgeView(state) {
    const canManage = state.can("manage_kb");
    const categories = state.features.knowledge?.config?.categories || ["Support"];
    const selected = state.articles.find((item) => item.id === selectedArticleId) || null;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Knowledge base</p>
          <h1>Help center</h1>
          <p class="lede">Create and maintain articles. Tickets and live chat can insert them into replies.</p>
        </div>
      </header>
      <div class="split">
        <div class="stack-panels">
          ${canManage ? `
            <form id="article-create-form" class="card stack-form">
              <h2>New article</h2>
              <label>Title <input name="title" required placeholder="How to reset your password"></label>
              <div class="create-row">
                <label>Category
                  <select name="category">
                    ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
                  </select>
                </label>
                <label>Tags <input name="tags" placeholder="password, account"></label>
              </div>
              <label>Body <textarea name="body" rows="5" required placeholder="Step-by-step answer agents can paste into replies."></textarea></label>
              <button class="btn" type="submit">Publish article</button>
            </form>
          ` : `<article class="card"><p class="muted">You can browse articles. <code>manage_kb</code> is required to edit.</p></article>`}
          <div class="card-grid">
            ${state.articles.map((article) => `
              <article class="card ${selectedArticleId === article.id ? "is-selected" : ""}">
                <p class="eyebrow">${escapeHtml(article.category)}</p>
                <h2>${escapeHtml(article.title)}</h2>
                <p>${escapeHtml(article.body.slice(0, 140))}${article.body.length > 140 ? "…" : ""}</p>
                <div class="issue-top">${article.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>
                <div class="inline-form" style="margin-top:12px">
                  <button class="btn btn-ghost" type="button" data-open-article="${article.id}">${canManage ? "Edit" : "Open"}</button>
                  ${canManage ? `<button class="btn btn-ghost" type="button" data-delete-article="${article.id}">Delete</button>` : ""}
                </div>
              </article>
            `).join("") || `<article class="card"><p class="muted">No articles yet.</p></article>`}
          </div>
        </div>
        ${selected ? `
          <form id="article-edit-form" class="card stack-form" data-article="${selected.id}">
            <h2>${canManage ? "Edit article" : "Article"}</h2>
            <label>Title <input name="title" value="${escapeHtml(selected.title)}" required ${canManage ? "" : "disabled"}></label>
            <div class="create-row">
              <label>Category
                <select name="category" ${canManage ? "" : "disabled"}>
                  ${[...new Set([...categories, selected.category])].map((category) => `
                    <option value="${escapeHtml(category)}" ${selected.category === category ? "selected" : ""}>${escapeHtml(category)}</option>
                  `).join("")}
                </select>
              </label>
              <label>Tags <input name="tags" value="${escapeHtml(selected.tags.join(", "))}" ${canManage ? "" : "disabled"}></label>
            </div>
            <label>Body <textarea name="body" rows="12" required ${canManage ? "" : "disabled"}>${escapeHtml(selected.body)}</textarea></label>
            <p class="muted">Updated ${escapeHtml((selected.updatedAt || "").slice(0, 16).replace("T", " "))}</p>
            ${canManage ? `<button class="btn" type="submit">Save article</button>` : ""}
            <button class="btn btn-ghost" type="button" data-close-article>Close</button>
          </form>
        ` : `<article class="card"><p class="muted">Select an article to ${canManage ? "edit" : "read"}.</p></article>`}
      </div>
    `;
  }

  function chatView(state) {
    const session = state.chatSessions.find((item) => item.id === activeChatId) || state.chatSessions[0];
    if (session) activeChatId = session.id;
    const messages = session ? state.chatMessages[session.id] || [] : [];
    const canRoute = state.canAny("manage_chat", "reply_chat");
    const canReplyAgent = state.canAny("reply_chat", "manage_chat");
    const lastVisitor = [...messages].reverse().find((item) => item.from === "visitor");
    const suggestions = lastVisitor && state.enabled("knowledge") && state.can("view_kb")
      ? state.suggestArticles(lastVisitor.text).slice(0, 3)
      : [];
    if (!canReplyAgent && chatComposerMode === "agent") chatComposerMode = "visitor";
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Live chat</p>
          <h1>Visitor conversations</h1>
          <p class="lede">Agents reply live, insert knowledge articles, or escalate to a ticket when offline.</p>
        </div>
        <div class="inline-form">
          ${state.canAny("manage_chat", "view_chat") ? `<button class="btn" type="button" data-start-chat>Start demo chat</button>` : ""}
          ${canRoute ? `<button class="btn btn-ghost" type="button" data-toggle-agents>Toggle agents online</button>` : ""}
        </div>
      </header>
      <div class="split chat-layout">
        <article class="card">
          <h2>Sessions</h2>
          <ul class="session-list">
            ${state.chatSessions.map((item) => `
              <li>
                <button type="button" class="rail-link ${session?.id === item.id ? "is-active" : ""}" data-open-chat="${item.id}">
                  ${escapeHtml(item.visitorName)} · ${item.status}${item.ticketId ? ` · ${item.ticketId}` : ""}
                </button>
              </li>
            `).join("") || "<li>No chats yet.</li>"}
          </ul>
          <p class="muted">Agents online: ${state.agentsOnline.map((id) => state.person(id)?.name).filter(Boolean).join(", ") || "none"}</p>
        </article>
        <article class="card chat-pane">
          ${session ? `
            <div class="chat-toolbar">
              <div>
                <strong>${escapeHtml(session.visitorName)}</strong>
                <span class="muted"> · ${escapeHtml(session.status)}${session.agentId ? ` · ${escapeHtml(state.person(session.agentId)?.name || "agent")}` : ""}</span>
              </div>
              <div class="inline-form">
                ${session.ticketId ? `<button class="btn btn-ghost" type="button" data-open-ticket="${escapeHtml(session.ticketId)}">Open ticket</button>` : ""}
                ${canRoute && session.status !== "ticketed" ? `<button class="btn btn-ghost" type="button" data-route-chat="${session.id}">Route now</button>` : ""}
              </div>
            </div>
            <div class="chat-log">
              ${messages.map((message) => `
                <div class="bubble ${escapeHtml(message.from)}">
                  <span>${escapeHtml(message.from)}</span>
                  <p class="pre-wrap">${escapeHtml(message.text)}</p>
                  ${message.articleId && canReplyAgent ? `
                    <button type="button" class="btn btn-ghost btn-compact" data-insert-kb-chat="${escapeHtml(message.articleId)}" data-chat-session="${session.id}">
                      Insert into agent reply
                    </button>
                  ` : ""}
                </div>
              `).join("")}
            </div>
            ${suggestions.length && canReplyAgent ? `
              <div class="kb-suggest-bar">
                <span class="muted">Knowledge for reply</span>
                ${suggestions.map((article) => `
                  <button type="button" class="btn btn-ghost btn-compact" data-insert-kb-chat="${article.id}" data-chat-session="${session.id}">
                    ${escapeHtml(article.title)}
                  </button>
                `).join("")}
              </div>
            ` : ""}
            ${session.status === "ticketed" ? `
              <p class="muted">This chat became ticket ${escapeHtml(session.ticketId)}. Continue there.</p>
            ` : `
              <form id="chat-form" class="stack-form" data-chat="${session.id}">
                <div class="mode-toggle" role="tablist">
                  <button type="button" class="nav-btn ${chatComposerMode === "visitor" ? "is-active" : ""}" data-chat-mode="visitor">Visitor</button>
                  ${canReplyAgent ? `<button type="button" class="nav-btn ${chatComposerMode === "agent" ? "is-active" : ""}" data-chat-mode="agent">Agent</button>` : ""}
                </div>
                <label>
                  <textarea name="text" rows="3" required placeholder="${chatComposerMode === "agent" ? "Agent reply…" : "Visitor message…"}"></textarea>
                </label>
                ${chatComposerMode === "agent" && state.enabled("knowledge") ? `
                  <label>Insert knowledge article
                    <select name="articleId">
                      <option value="">None</option>
                      ${state.articles.map((article) => `
                        <option value="${article.id}">${escapeHtml(article.title)}</option>
                      `).join("")}
                    </select>
                  </label>
                ` : ""}
                <button class="btn" type="submit">Send as ${chatComposerMode}</button>
              </form>
            `}
          ` : `<p class="muted">Start a demo chat to try routing and agent replies.</p>`}
        </article>
      </div>
    `;
  }

  function peopleTabs(state) {
    const tabs = [
      { id: "members", label: "Members", show: true },
      { id: "teams", label: "Teams", show: state.enabled("teams") },
      { id: "roles", label: "Roles", show: state.enabled("roles") },
      { id: "invites", label: "Invites", show: state.enabled("invites") },
    ].filter((tab) => tab.show);
    if (!tabs.some((tab) => tab.id === peopleTab)) peopleTab = tabs[0]?.id || "members";
    return `
      <div class="subnav" role="tablist" aria-label="People">
        ${tabs.map((tab) => `
          <button type="button" class="nav-btn ${peopleTab === tab.id ? "is-active" : ""}" data-people-tab="${tab.id}">${tab.label}</button>
        `).join("")}
      </div>
    `;
  }

  function membersPane(state) {
    const canManage = state.can("manage_members");
    const selected = state.people.find((person) => person.id === selectedMemberId) || null;
    return `
      <div class="split people-split">
        <article class="card">
          <div class="card-head-row">
            <h2>Directory</h2>
            <span class="muted">${state.people.length} people</span>
          </div>
          <ul class="member-list">
            ${state.people.map((person) => `
              <li>
                <button type="button" class="member-row ${selectedMemberId === person.id ? "is-active" : ""}" data-open-member="${person.id}">
                  ${avatar(person)}
                  <span>
                    <strong>${escapeHtml(person.name)}</strong>
                    <em>${escapeHtml(person.email)} · ${escapeHtml(person.role)}</em>
                  </span>
                  <span class="pill ${person.status === "suspended" ? "is-warn" : ""}">${escapeHtml(person.status)}</span>
                </button>
              </li>
            `).join("")}
          </ul>
        </article>
        <div class="stack-panels">
          ${canManage ? `
            <form id="member-create-form" class="card stack-form">
              <h2>Create member</h2>
              <div class="create-row">
                <label>Name <input name="name" required placeholder="Sam Lee"></label>
                <label>Email <input name="email" type="email" required placeholder="sam@company.com"></label>
                <label>Role
                  <select name="role">
                    ${state.roles.filter((role) => role.id !== "owner").map((role) => `<option value="${role.id}">${escapeHtml(role.name)}</option>`).join("")}
                  </select>
                </label>
              </div>
              <fieldset class="check-grid">
                <legend>Teams</legend>
                ${state.teams.map((team) => `
                  <label class="check"><input type="checkbox" name="teamIds" value="${team.id}"> ${escapeHtml(team.name)}</label>
                `).join("") || "<p class=\"muted\">No teams yet</p>"}
              </fieldset>
              <button class="btn" type="submit">Add member</button>
            </form>
          ` : `<article class="card"><p class="muted">You need <code>manage_members</code> to create users.</p></article>`}
          ${selected ? `
            <form id="member-edit-form" class="card stack-form" data-member="${selected.id}">
              <h2>Edit ${escapeHtml(selected.name)}</h2>
              <div class="create-row">
                <label>Name <input name="name" value="${escapeHtml(selected.name)}" required></label>
                <label>Email <input name="email" type="email" value="${escapeHtml(selected.email)}" required></label>
                <label>Role
                  <select name="role" ${canManage || state.can("manage_roles") ? "" : "disabled"}>
                    ${state.roles.map((role) => `<option value="${role.id}" ${selected.role === role.id ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("")}
                  </select>
                </label>
              </div>
              <fieldset class="check-grid">
                <legend>Teams</legend>
                ${state.teams.map((team) => `
                  <label class="check">
                    <input type="checkbox" name="teamIds" value="${team.id}" ${selected.teamIds.includes(team.id) ? "checked" : ""} ${canManage ? "" : "disabled"}>
                    ${escapeHtml(team.name)}
                  </label>
                `).join("")}
              </fieldset>
              ${canManage ? `
                <div class="inline-form">
                  <button class="btn" type="submit">Save member</button>
                  <button class="btn btn-ghost" type="button" data-suspend-member="${selected.id}" data-suspended="${selected.status === "suspended" ? "0" : "1"}">
                    ${selected.status === "suspended" ? "Reactivate" : "Suspend"}
                  </button>
                </div>
              ` : `<p class="muted">View only</p>`}
            </form>
          ` : `<article class="card"><p class="muted">Select a member to edit or suspend them.</p></article>`}
        </div>
      </div>
    `;
  }

  function teamsPane(state) {
    const canManage = state.can("manage_teams");
    return `
      ${canManage ? `
        <form id="team-form" class="card stack-form">
          <h2>Create team</h2>
          <div class="create-row">
            <label>Name <input name="name" required placeholder="Success"></label>
            <label>Reports to
              <select name="parentId">
                <option value="">Organization root</option>
                ${state.teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("")}
              </select>
            </label>
            <label>Manager
              <select name="managerId">
                ${state.people.filter((person) => person.status === "active").map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("")}
              </select>
            </label>
          </div>
          <fieldset class="check-grid">
            <legend>Members</legend>
            ${state.people.map((person) => `
              <label class="check"><input type="checkbox" name="memberIds" value="${person.id}"> ${escapeHtml(person.name)}</label>
            `).join("")}
          </fieldset>
          <button class="btn" type="submit">Create team</button>
        </form>
      ` : `<article class="card"><p class="muted">You need <code>manage_teams</code> to create teams.</p></article>`}
      <div class="card-grid">
        ${state.teams.map((team) => {
          const parent = state.teams.find((item) => item.id === team.parentId);
          const manager = state.person(team.managerId);
          return `
            <article class="card">
              <h2>${escapeHtml(team.name)}</h2>
              <p class="muted">Reports to ${parent ? escapeHtml(parent.name) : "root"} · Manager ${escapeHtml(manager?.name || "—")}</p>
              <div class="issue-top">${team.memberIds.map((id) => avatar(state.person(id))).join("")}</div>
              ${canManage ? `
                <form class="stack-form team-edit-form" data-team="${team.id}">
                  <label>Reports to
                    <select name="parentId">
                      <option value="">Organization root</option>
                      ${state.teams.filter((item) => item.id !== team.id).map((item) => `
                        <option value="${item.id}" ${team.parentId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>
                      `).join("")}
                    </select>
                  </label>
                  <label>Manager
                    <select name="managerId">
                      ${state.people.map((person) => `
                        <option value="${person.id}" ${team.managerId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>
                      `).join("")}
                    </select>
                  </label>
                  <fieldset class="check-grid">
                    <legend>Members</legend>
                    ${state.people.map((person) => `
                      <label class="check">
                        <input type="checkbox" name="memberIds" value="${person.id}" ${team.memberIds.includes(person.id) ? "checked" : ""}>
                        ${escapeHtml(person.name)}
                      </label>
                    `).join("")}
                  </fieldset>
                  <button class="btn btn-ghost" type="submit">Save team</button>
                </form>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function rolesPane(state) {
    const activeRole = state.roles.find((role) => role.id === selectedRoleId) || state.roles[0];
    selectedRoleId = activeRole?.id || null;
    const canManage = state.can("manage_roles");
    const groups = [...new Set(state.PERMISSIONS.map((item) => item.group))];
    return `
      <div class="split">
        <article class="card">
          <h2>Roles</h2>
          <div class="session-list">
            ${state.roles.map((role) => `
              <button type="button" class="rail-link ${activeRole?.id === role.id ? "is-active" : ""}" data-open-role="${role.id}">
                ${escapeHtml(role.name)} · lvl ${role.level} · ${role.permissions.includes("*") ? "all" : `${role.permissions.length} perms`}
              </button>
            `).join("")}
          </div>
          ${canManage ? `
            <form id="role-form" class="stack-form" style="margin-top:16px">
              <h3>New role</h3>
              <label>Name <input name="name" required placeholder="Contractor"></label>
              <label>Level <input name="level" type="number" min="1" max="99" value="25"></label>
              <button class="btn" type="submit">Add role</button>
            </form>
          ` : ""}
        </article>
        <article class="card">
          <h2>${escapeHtml(activeRole?.name || "Role")} permissions</h2>
          ${activeRole?.id === "owner" ? `<p class="muted">Owner always has full access (*).</p>` : canManage ? `
            <form id="role-perms-form" class="stack-form" data-role="${activeRole.id}">
              ${groups.map((group) => `
                <fieldset class="check-grid">
                  <legend>${escapeHtml(group)}</legend>
                  ${state.PERMISSIONS.filter((permission) => permission.group === group).map((permission) => `
                    <label class="check">
                      <input type="checkbox" name="permissions" value="${permission.id}" ${activeRole.permissions.includes(permission.id) ? "checked" : ""}>
                      <span>
                        <strong>${escapeHtml(permission.label)}</strong>
                        <em class="muted">${escapeHtml(permission.id)}</em>
                      </span>
                    </label>
                  `).join("")}
                </fieldset>
              `).join("")}
              <button class="btn" type="submit">Save permissions</button>
            </form>
          ` : `<p class="muted">You need <code>manage_roles</code> to edit permissions.</p><p>${activeRole.permissions.join(", ")}</p>`}
        </article>
      </div>
    `;
  }

  function invitesPane(state) {
    const canManage = state.canAny("manage_invites", "manage_members");
    return `
      ${canManage ? `
        <form id="invite-form" class="card stack-form">
          <h2>Invite someone</h2>
          <div class="create-row">
            <label>Email <input name="email" type="email" required placeholder="teammate@company.com"></label>
            <label>Role
              <select name="role">
                ${state.roles.filter((role) => role.id !== "owner").map((role) => `<option value="${role.id}">${role.name}</option>`).join("")}
              </select>
            </label>
            <label>Team
              <select name="teamId">
                ${state.teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("")}
              </select>
            </label>
          </div>
          <button class="btn" type="submit">Send invite</button>
        </form>
      ` : `<article class="card"><p class="muted">You need <code>manage_invites</code> to send invites.</p></article>`}
      <div class="card">
        <h2>Pending</h2>
        <ul class="feed">
          ${state.invites.map((invite) => `<li>${escapeHtml(invite.email)} · ${invite.role} · ${invite.status}</li>`).join("") || "<li>No pending invites.</li>"}
        </ul>
      </div>
    `;
  }

  function peopleView(state) {
    const panes = {
      members: membersPane,
      teams: teamsPane,
      roles: rolesPane,
      invites: invitesPane,
    };
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">People</p>
          <h1>Members, teams, roles & invites</h1>
          <p class="lede">One place to create users, suspend access, shape teams, and control permissions.</p>
        </div>
      </header>
      ${peopleTabs(state)}
      ${panes[peopleTab](state)}
    `;
  }

  function docsView(state) {
    const checks = mvpChecks(state);
    const ready = checks.filter((item) => item.ok).length;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Documentation</p>
          <h1>How Harbor works</h1>
          <p class="lede">Module guides, configuration, MVP readiness (${ready}/${checks.length}), and the full REST API.</p>
        </div>
      </header>
      <div class="subnav" role="tablist" aria-label="Docs">
        ${DOC_SECTIONS.map((section) => `
          <button type="button" class="nav-btn ${docsTab === section.id ? "is-active" : ""}" data-docs-tab="${section.id}">${section.label}</button>
        `).join("")}
      </div>
      ${renderDocSection(docsTab, state)}
    `;
  }

  function discordView(state) {
    const config = state.features.discord.config;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Discord</p>
          <h1>${escapeHtml(config.serverName)}</h1>
          <p class="lede">Suggestions in ${escapeHtml(config.suggestionsChannel)} become tickets. Harbor replies, then edits the bot message as the ticket outcome changes.</p>
        </div>
      </header>
      <form id="discord-suggest-form" class="card stack-form">
        <h2>Simulate a Discord suggestion</h2>
        <div class="create-row">
          <label>Author <input name="author" required placeholder="maya" value="maya"></label>
          <label>Channel <input name="channel" value="${escapeHtml(config.suggestionsChannel)}"></label>
        </div>
        <label>Suggestion
          <textarea name="content" rows="3" required placeholder="Please add dark mode to the public board"></textarea>
        </label>
        <button class="btn" type="submit">Post suggestion</button>
      </form>
      <div class="card-grid">
        ${state.discordMessages.map((message) => `
          <article class="card discord-card">
            <p class="eyebrow">${escapeHtml(message.channel)} · ${escapeHtml(message.author)}</p>
            <p class="discord-suggestion">${escapeHtml(message.suggestion)}</p>
            <div class="discord-bot">
              <strong>${escapeHtml(config.botName)}</strong>
              <p>${escapeHtml(message.botReply)}</p>
              <button class="btn btn-ghost" type="button" data-open-ticket="${escapeHtml(message.ticketId)}">Open ${escapeHtml(message.ticketId)}</button>
            </div>
            ${message.edits.length ? `
              <details>
                <summary>${message.edits.length} edit${message.edits.length === 1 ? "" : "s"}</summary>
                <ul class="feed">
                  ${message.edits.map((edit) => `
                    <li>
                      <div>
                        <strong>${escapeHtml(edit.status)}</strong>
                        <span>${escapeHtml(edit.next)}</span>
                      </div>
                      <time>${escapeHtml(edit.at.slice(11, 16))}</time>
                    </li>
                  `).join("")}
                </ul>
              </details>
            ` : `<p class="muted">Waiting for an outcome edit…</p>`}
          </article>
        `).join("") || `<article class="card"><p class="muted">No Discord suggestions yet.</p></article>`}
      </div>
    `;
  }

  function emailView(state) {
    const canSend = state.canAny("send_email", "manage_email");
    const canConfigure = state.can("manage_email");
    const config = state.features.email.config;
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Email</p>
          <h1>Compose & outbox</h1>
          <p class="lede">Send support mail, ticket replies, and invites through Harbor’s demo outbox.</p>
        </div>
      </header>
      <div class="split">
        <div class="stack-panels">
          ${canSend ? `
            <form id="email-compose-form" class="card stack-form">
              <h2>Compose</h2>
              <label>To <input name="to" type="email" required placeholder="customer@example.com"></label>
              <label>Subject <input name="subject" required placeholder="About your Harbor request"></label>
              <label>Body <textarea name="body" rows="6" required placeholder="Write the message…"></textarea></label>
              <label>Template
                <select name="template">
                  <option value="manual">Manual</option>
                  <option value="ticket_reply">Ticket reply</option>
                  <option value="invite">Invite</option>
                  <option value="welcome">Welcome</option>
                </select>
              </label>
              <button class="btn" type="submit">Send email</button>
            </form>
          ` : `<article class="card"><p class="muted">You need <code>send_email</code> to compose mail.</p></article>`}
          ${canConfigure ? `
            <form id="email-config-form" class="card stack-form">
              <h2>Sender settings</h2>
              <div class="create-row">
                <label>From name <input name="fromName" value="${escapeHtml(config.fromName)}"></label>
                <label>From address <input name="fromAddress" value="${escapeHtml(config.fromAddress)}"></label>
                <label>Reply-to <input name="replyTo" value="${escapeHtml(config.replyTo)}"></label>
              </div>
              <button class="btn btn-ghost" type="submit">Save settings</button>
            </form>
          ` : ""}
        </div>
        <article class="card">
          <h2>Outbox</h2>
          <ul class="feed">
            ${state.emails.map((mail) => `
              <li>
                <div>
                  <strong>${escapeHtml(mail.subject)}</strong>
                  <span>${escapeHtml(mail.to)} · ${escapeHtml(mail.template)} · ${escapeHtml(mail.from || "")}</span>
                  <p class="pre-wrap">${escapeHtml(mail.body)}</p>
                </div>
                <time>${escapeHtml(mail.status)}</time>
              </li>
            `).join("") || "<li>No email sent yet.</li>"}
          </ul>
        </article>
      </div>
    `;
  }

  function webhooksView(state) {
    return `
      <header class="page-head"><div><p class="eyebrow">Webhooks</p><h1>Event delivery</h1></div></header>
      <form id="webhook-form" class="card stack-form">
        <div class="create-row">
          <label>Name <input name="name" placeholder="Billing sync"></label>
          <label>URL <input name="url" required placeholder="https://example.com/hooks/harbor"></label>
        </div>
        <button class="btn" type="submit">Add webhook</button>
      </form>
      <div class="split">
        <article class="card">
          <h2>Endpoints</h2>
          <ul class="feed">
            ${state.webhooks.map((hook) => `
              <li>
                <div>
                  <strong>${escapeHtml(hook.name)}</strong>
                  <span>${escapeHtml(hook.url)}</span>
                  <span>${hook.events.join(", ")}</span>
                </div>
                <time>${hook.enabled ? "on" : "off"}</time>
              </li>
            `).join("")}
          </ul>
        </article>
        <article class="card">
          <h2>Deliveries</h2>
          <ul class="feed">
            ${state.webhookDeliveries.map((item) => `
              <li><div><strong>${escapeHtml(item.event)}</strong><span>${escapeHtml(item.url)}</span></div><time>${item.status}</time></li>
            `).join("") || "<li>No deliveries yet.</li>"}
          </ul>
        </article>
      </div>
    `;
  }

  function apiView(state) {
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">REST API</p>
          <h1>Explorer</h1>
          <p class="lede">Base path ${escapeHtml(state.features.api.config.basePath)}. Token: <code>${escapeHtml(state.apiToken)}</code></p>
        </div>
      </header>
      <form id="api-form" class="card stack-form">
        <div class="create-row">
          <label>Endpoint
            <select name="endpoint">
              ${platform.api.routes.map((route) => `
                <option value="${route.method} ${route.path}">${route.method} ${route.path}</option>
              `).join("")}
            </select>
          </label>
        </div>
        <label>JSON body (POST)
          <textarea name="body" rows="4" placeholder='{"subject":"API ticket","requester":"api@example.com"}'></textarea>
        </label>
        <button class="btn" type="submit">Send request</button>
      </form>
      <div class="card">
        <h2>Recent calls</h2>
        <ul class="feed">
          ${state.apiLog.map((item) => `<li><div><strong>${item.method} ${escapeHtml(item.path)}</strong></div><time>${item.status}</time></li>`).join("") || "<li>No calls yet.</li>"}
        </ul>
        <pre id="api-result" class="code-block">Responses appear here.</pre>
      </div>
    `;
  }

  function settingsView(state) {
    const groups = ["work", "support", "org", "platform"];
    return `
      <header class="page-head">
        <div>
          <p class="eyebrow">Modules</p>
          <h1>Turn features on or off</h1>
          <p class="lede">Dependencies are enforced. Disabling Email also turns off Invites.</p>
        </div>
      </header>
      ${groups.map((group) => `
        <section class="card">
          <h2>${group}</h2>
          <div class="module-list">
            ${state.FEATURES.filter((feature) => feature.category === group).map((feature) => {
              const current = state.features[feature.id];
              return `
                <article class="module-row">
                  <div>
                    <strong>${escapeHtml(feature.name)}</strong>
                    <p>${escapeHtml(feature.description)}</p>
                    ${feature.dependsOn.length ? `<p class="muted">Needs: ${feature.dependsOn.join(", ")}</p>` : ""}
                  </div>
                  <label class="switch">
                    <input type="checkbox" data-feature="${feature.id}" ${current.enabled ? "checked" : ""}>
                    <span>${current.enabled ? "On" : "Off"}</span>
                  </label>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `).join("")}
      ${state.enabled("chat") ? `
        <section class="card stack-form">
          <h2>Chat configuration</h2>
          <label>Greeting <input data-chat-config="greeting" value="${escapeHtml(state.features.chat.config.greeting)}"></label>
          <label class="switch">
            <input type="checkbox" data-chat-config="offlineCreatesTicket" ${state.features.chat.config.offlineCreatesTicket ? "checked" : ""}>
            <span>Create ticket when no agent is available</span>
          </label>
          <label class="switch">
            <input type="checkbox" data-chat-config="suggestKnowledge" ${state.features.chat.config.suggestKnowledge !== false ? "checked" : ""}>
            <span>Suggest knowledge articles on visitor messages</span>
          </label>
        </section>
      ` : ""}
      ${state.enabled("tickets") ? `
        <section class="card stack-form">
          <h2>Ticket configuration</h2>
          <label class="switch">
            <input type="checkbox" data-ticket-config="linkKnowledge" ${state.features.tickets.config.linkKnowledge !== false ? "checked" : ""}>
            <span>Auto-link related knowledge on create</span>
          </label>
          <label class="switch">
            <input type="checkbox" data-ticket-config="suggestKnowledgeInReplies" ${state.features.tickets.config.suggestKnowledgeInReplies !== false ? "checked" : ""}>
            <span>Suggest knowledge while replying</span>
          </label>
        </section>
      ` : ""}
      ${state.enabled("discord") ? `
        <section class="card stack-form">
          <h2>Discord configuration</h2>
          <label>Server name <input data-discord-config="serverName" value="${escapeHtml(state.features.discord.config.serverName)}"></label>
          <label>Suggestions channel <input data-discord-config="suggestionsChannel" value="${escapeHtml(state.features.discord.config.suggestionsChannel)}"></label>
          <label>Bot name <input data-discord-config="botName" value="${escapeHtml(state.features.discord.config.botName)}"></label>
          <label class="switch">
            <input type="checkbox" data-discord-config="autoReply" ${state.features.discord.config.autoReply ? "checked" : ""}>
            <span>Auto-reply when a suggestion becomes a ticket</span>
          </label>
          <label class="switch">
            <input type="checkbox" data-discord-config="editOnOutcome" ${state.features.discord.config.editOnOutcome ? "checked" : ""}>
            <span>Edit Discord reply when ticket outcome changes</span>
          </label>
        </section>
      ` : ""}
    `;
  }

  const views = {
    home: homeView,
    board: boardView,
    tickets: ticketsView,
    knowledge: knowledgeView,
    chat: chatView,
    discord: discordView,
    people: peopleView,
    email: emailView,
    webhooks: webhooksView,
    api: apiView,
    docs: docsView,
    settings: settingsView,
  };

  function draw() {
    const state = snap();
    if (!state.onboarded) {
      root.className = "app-shell gate-shell";
      root.innerHTML = registerView();
      return;
    }
    root.className = "app-shell";
    root.innerHTML = shell(views[view](state));
  }

  let dragId = null;

  root.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-register-mode]");
    if (mode) {
      registerMode = mode.dataset.registerMode;
      draw();
      return;
    }

    const next = event.target.closest("[data-view]");
    if (next) {
      go(next.dataset.view);
      return;
    }

    if (event.target.closest("[data-close-issue]")) {
      selectedIssue = null;
      draw();
      return;
    }

    if (event.target.closest("[data-close-ticket]")) {
      selectedTicketId = null;
      draw();
      return;
    }

    if (event.target.closest("[data-close-article]")) {
      selectedArticleId = null;
      draw();
      return;
    }

    const openArticle = event.target.closest("[data-open-article]");
    if (openArticle) {
      selectedArticleId = openArticle.dataset.openArticle;
      view = "knowledge";
      draw();
      return;
    }

    const deleteArticle = event.target.closest("[data-delete-article]");
    if (deleteArticle) {
      const result = platform.deleteArticle(deleteArticle.dataset.deleteArticle);
      if (result.ok && selectedArticleId === deleteArticle.dataset.deleteArticle) selectedArticleId = null;
      flash = result.ok ? "Article deleted" : result.error;
      draw();
      return;
    }

    const linkArticle = event.target.closest("[data-link-article]");
    if (linkArticle) {
      const result = platform.linkTicketArticle(linkArticle.dataset.ticketKb, linkArticle.dataset.linkArticle, true);
      flash = result.ok ? "Article linked" : result.error;
      draw();
      return;
    }

    const unlinkArticle = event.target.closest("[data-unlink-article]");
    if (unlinkArticle) {
      const result = platform.linkTicketArticle(unlinkArticle.dataset.ticketKb, unlinkArticle.dataset.unlinkArticle, false);
      flash = result.ok ? "Article unlinked" : result.error;
      draw();
      return;
    }

    const insertKbChat = event.target.closest("[data-insert-kb-chat]");
    if (insertKbChat) {
      chatComposerMode = "agent";
      activeChatId = insertKbChat.dataset.chatSession;
      const result = platform.sendChatMessage(insertKbChat.dataset.chatSession, "", "agent", {
        articleId: insertKbChat.dataset.insertKbChat,
      });
      flash = result.ok ? "Knowledge inserted into agent reply" : result.error;
      draw();
      return;
    }

    const chatMode = event.target.closest("[data-chat-mode]");
    if (chatMode) {
      chatComposerMode = chatMode.dataset.chatMode;
      draw();
      return;
    }

    const openIssue = event.target.closest("[data-open-issue]");
    if (openIssue) {
      selectedIssue = openIssue.dataset.openIssue;
      draw();
      return;
    }

    const openTicket = event.target.closest("[data-open-ticket]");
    if (openTicket) {
      selectedTicketId = openTicket.dataset.openTicket;
      view = "tickets";
      flash = `${selectedTicketId} opened`;
      draw();
      return;
    }

    const openRole = event.target.closest("[data-open-role]");
    if (openRole) {
      selectedRoleId = openRole.dataset.openRole;
      peopleTab = "roles";
      draw();
      return;
    }

    const peopleTabBtn = event.target.closest("[data-people-tab]");
    if (peopleTabBtn) {
      peopleTab = peopleTabBtn.dataset.peopleTab;
      flash = "";
      draw();
      return;
    }

    const docsTabBtn = event.target.closest("[data-docs-tab]");
    if (docsTabBtn) {
      docsTab = docsTabBtn.dataset.docsTab;
      flash = "";
      draw();
      return;
    }

    const openMember = event.target.closest("[data-open-member]");
    if (openMember) {
      selectedMemberId = openMember.dataset.openMember;
      peopleTab = "members";
      draw();
      return;
    }

    const suspend = event.target.closest("[data-suspend-member]");
    if (suspend) {
      const result = platform.suspendMember(suspend.dataset.suspendMember, suspend.dataset.suspended === "1");
      flash = result.ok
        ? result.member.status === "suspended"
          ? `${result.member.name} suspended`
          : `${result.member.name} reactivated`
        : result.error;
      draw();
      return;
    }

    if (event.target.closest("[data-start-chat]")) {
      const result = platform.startChat("Site visitor");
      if (!result.ok) flash = result.error;
      else {
        activeChatId = result.session.id;
        flash = "Demo chat started";
        view = "chat";
      }
      draw();
      return;
    }

    const openChat = event.target.closest("[data-open-chat]");
    if (openChat) {
      activeChatId = openChat.dataset.openChat;
      draw();
      return;
    }

    const route = event.target.closest("[data-route-chat]");
    if (route) {
      const result = platform.routeChat(route.dataset.routeChat);
      flash = result.ok
        ? result.mode === "live"
          ? `Connected to ${result.agent.name}`
          : result.mode === "ticket"
            ? `Opened ${result.ticket.id}`
            : "Waiting for an agent"
        : result.error;
      draw();
      return;
    }

    if (event.target.closest("[data-toggle-agents]")) {
      const state = snap();
      if (state.agentsOnline.length) {
        for (const id of [...state.agentsOnline]) platform.toggleAgent(id);
        flash = "All agents offline — next route can open a ticket";
      } else {
        platform.toggleAgent("amina");
        platform.toggleAgent("luca");
        flash = "Agents back online";
      }
      draw();
    }
  });

  root.addEventListener("change", (event) => {
    const feature = event.target.closest("[data-feature]");
    if (feature) {
      const result = platform.setFeature(feature.dataset.feature, feature.checked);
      flash = result.ok ? `Module ${feature.dataset.feature} ${feature.checked ? "enabled" : "disabled"}` : result.error;
      draw();
      return;
    }

    const chatConfig = event.target.closest("[data-chat-config]");
    if (chatConfig) {
      const key = chatConfig.dataset.chatConfig;
      const value = chatConfig.type === "checkbox" ? chatConfig.checked : chatConfig.value;
      platform.updateFeatureConfig("chat", { [key]: value });
      flash = "Chat settings saved";
      draw();
      return;
    }

    const ticketConfig = event.target.closest("[data-ticket-config]");
    if (ticketConfig) {
      const key = ticketConfig.dataset.ticketConfig;
      const value = ticketConfig.type === "checkbox" ? ticketConfig.checked : ticketConfig.value;
      platform.updateFeatureConfig("tickets", { [key]: value });
      flash = "Ticket settings saved";
      draw();
      return;
    }

    const discordConfig = event.target.closest("[data-discord-config]");
    if (discordConfig) {
      const key = discordConfig.dataset.discordConfig;
      const value = discordConfig.type === "checkbox" ? discordConfig.checked : discordConfig.value;
      platform.updateFeatureConfig("discord", { [key]: value });
      flash = "Discord settings saved";
      draw();
      return;
    }

    const personRole = event.target.closest("[data-person-role]");
    if (personRole) {
      const result = platform.setPersonRole(personRole.dataset.personRole, personRole.value);
      flash = result.ok ? "Role assignment saved" : result.error;
      draw();
      return;
    }

    const ticketArticlePick = event.target.closest("[data-ticket-article-pick]");
    if (ticketArticlePick && ticketArticlePick.value) {
      const result = platform.linkTicketArticle(ticketArticlePick.dataset.ticketArticlePick, ticketArticlePick.value, true);
      flash = result.ok ? "Article linked to ticket" : result.error;
      draw();
      return;
    }

    const status = event.target.closest("[data-issue-status]");
    if (status) {
      platform.moveIssue(projectId, status.dataset.issueStatus, status.value);
      flash = `${status.dataset.issueStatus} moved`;
      draw();
    }
  });

  root.addEventListener("submit", async (event) => {
    if (event.target.id === "register-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.registerWorkspace({
        mode: registerMode,
        yourName: data.get("yourName"),
        email: data.get("email"),
        name: data.get("name"),
      });
      flash = result.ok ? "Workspace ready" : result.error;
      if (result.ok) view = "home";
      draw();
      return;
    }

    if (event.target.id === "ticket-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      try {
        const ticket = platform.createTicket({
          subject: data.get("subject"),
          requester: data.get("requester") || undefined,
          priority: data.get("priority") || undefined,
          source: "manual",
        });
        selectedTicketId = ticket.id;
        flash = `${ticket.id} created`;
      } catch (error) {
        flash = error.message;
      }
      draw();
      return;
    }

    if (event.target.id === "ticket-detail-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.updateTicket(event.target.dataset.ticket, {
        subject: data.get("subject"),
        description: data.get("description"),
        status: data.get("status"),
        priority: data.get("priority"),
        assigneeId: data.get("assigneeId"),
        teamId: data.get("teamId"),
        outcome: data.get("outcome"),
      });
      flash = result.ok
        ? result.ticket.discordMessageId
          ? `${result.ticket.id} saved · Discord reply synced`
          : `${result.ticket.id} saved`
        : result.error;
      draw();
      return;
    }

    if (event.target.id === "ticket-comment-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.addTicketComment(event.target.dataset.ticket, data.get("text"), {
        publicReply: data.get("publicReply") === "1",
        articleId: data.get("articleId") || null,
      });
      flash = result.ok
        ? data.get("publicReply") === "1"
          ? "Public reply posted · email queued"
          : "Reply posted"
        : result.error;
      draw();
      return;
    }

    if (event.target.id === "article-create-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.createArticle({
        title: data.get("title"),
        category: data.get("category"),
        body: data.get("body"),
        tags: data.get("tags"),
      });
      if (result.ok) {
        selectedArticleId = result.article.id;
        flash = `“${result.article.title}” published`;
      } else {
        flash = result.error;
      }
      draw();
      return;
    }

    if (event.target.id === "article-edit-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.updateArticle(event.target.dataset.article, {
        title: data.get("title"),
        category: data.get("category"),
        body: data.get("body"),
        tags: data.get("tags"),
      });
      flash = result.ok ? "Article saved" : result.error;
      draw();
      return;
    }

    if (event.target.id === "email-compose-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.composeEmail({
        to: data.get("to"),
        subject: data.get("subject"),
        body: data.get("body"),
        template: data.get("template"),
      });
      flash = result.ok ? `Email sent to ${data.get("to")}` : result.error;
      draw();
      return;
    }

    if (event.target.id === "email-config-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      platform.updateFeatureConfig("email", {
        fromName: data.get("fromName"),
        fromAddress: data.get("fromAddress"),
        replyTo: data.get("replyTo"),
      });
      flash = "Email settings saved";
      draw();
      return;
    }

    if (event.target.id === "discord-suggest-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.ingestDiscordSuggestion({
        author: data.get("author"),
        content: data.get("content"),
        channel: data.get("channel"),
      });
      if (result.ok) {
        selectedTicketId = result.ticket.id;
        flash = `${result.ticket.id} created from Discord · bot replied under review`;
      } else {
        flash = result.error;
      }
      draw();
      return;
    }

    if (event.target.id === "team-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.createTeam({
        name: data.get("name"),
        parentId: data.get("parentId") || null,
        managerId: data.get("managerId"),
        memberIds: data.getAll("memberIds"),
      });
      flash = result.ok ? `Team “${result.team.name}” created` : result.error;
      draw();
      return;
    }

    if (event.target.classList.contains("team-edit-form")) {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.updateTeam(event.target.dataset.team, {
        parentId: data.get("parentId") || null,
        managerId: data.get("managerId"),
        memberIds: data.getAll("memberIds"),
      });
      flash = result.ok ? "Team updated" : result.error;
      draw();
      return;
    }

    if (event.target.id === "role-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.createRole({
        name: data.get("name"),
        level: data.get("level"),
        permissions: ["view_board", "view_kb"],
      });
      flash = result.ok ? `Role “${result.role.name}” added` : result.error;
      if (result.ok) selectedRoleId = result.role.id;
      draw();
      return;
    }

    if (event.target.id === "role-perms-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.updateRolePermissions(event.target.dataset.role, data.getAll("permissions"));
      flash = result.ok ? "Permissions saved" : result.error;
      draw();
      return;
    }

    if (event.target.id === "invite-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.invitePerson({
        email: data.get("email"),
        role: data.get("role"),
        teamId: data.get("teamId"),
      });
      flash = result.ok ? `Invite sent to ${data.get("email")}` : result.error;
      peopleTab = "invites";
      draw();
      return;
    }

    if (event.target.id === "member-create-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.createMember({
        name: data.get("name"),
        email: data.get("email"),
        role: data.get("role"),
        teamIds: data.getAll("teamIds"),
      });
      if (result.ok) {
        selectedMemberId = result.member.id;
        flash = `${result.member.name} created`;
      } else {
        flash = result.error;
      }
      peopleTab = "members";
      draw();
      return;
    }

    if (event.target.id === "member-edit-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.updateMember(event.target.dataset.member, {
        name: data.get("name"),
        email: data.get("email"),
        role: data.get("role"),
        teamIds: data.getAll("teamIds"),
      });
      flash = result.ok ? `${result.member.name} saved` : result.error;
      draw();
      return;
    }

    if (event.target.id === "webhook-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.addWebhook({
        name: data.get("name"),
        url: data.get("url"),
        events: ["ticket.created", "invite.sent", "chat.escalated", "email.sent"],
      });
      flash = result.ok ? "Webhook added" : result.error;
      draw();
      return;
    }

    if (event.target.id === "board-create") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = platform.createIssue(projectId, { title: data.get("title") });
      flash = result.ok ? `${result.id} added` : result.error;
      draw();
      return;
    }

    if (event.target.id === "chat-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const from = chatComposerMode === "agent" ? "agent" : "visitor";
      const result = platform.sendChatMessage(event.target.dataset.chat, data.get("text"), from, {
        articleId: data.get("articleId") || null,
      });
      flash = result.ok
        ? from === "agent"
          ? "Agent reply sent"
          : result.suggestions?.length
            ? `Suggested: ${result.suggestions.map((item) => item.title).join(", ")}`
            : ""
        : result.error;
      draw();
      return;
    }

    if (event.target.id === "api-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const endpoint = String(data.get("endpoint") || "");
      const method = endpoint.split(" ")[0] || data.get("method");
      let path = endpoint.split(" ").slice(1).join(" ");
      if (path === "/api/v1/members/:id") path = `/api/v1/members/${snap().people[0]?.id || "you"}`;
      if (path === "/api/v1/tickets/:id") path = `/api/v1/tickets/${snap().tickets[0]?.id || "T-101"}`;
      let body = undefined;
      if (method === "POST" && data.get("body")) {
        try {
          body = JSON.parse(data.get("body"));
        } catch {
          flash = "Body must be valid JSON";
          draw();
          return;
        }
      } else if (method === "POST" && path === "/api/v1/tickets") {
        body = { subject: "API ticket", requester: "api@example.com" };
      } else if (method === "POST" && path === "/api/v1/invites") {
        body = { email: "new.hire@company.com", role: "member" };
      } else if (method === "POST" && path === "/api/v1/members") {
        body = { name: "API User", email: `api.user.${Date.now()}@company.com`, role: "member" };
      } else if (method === "POST" && path === "/api/v1/teams") {
        body = { name: `API Team ${Date.now().toString(36)}`, managerId: "you", memberIds: ["you"] };
      } else if (method === "POST" && path === "/api/v1/discord/suggestions") {
        body = { author: "api-bot", content: "Ship public API docs to Discord", channel: "#suggestions" };
      } else if (method === "PATCH" && path.includes("/members/")) {
        body = body || { status: "active" };
      } else if (method === "PATCH" && path.includes("/tickets/")) {
        body = body || { status: "in_progress" };
      }
      const result = await platform.api.request(method, path, body, {
        Authorization: `Bearer ${snap().apiToken}`,
      });
      flash = `API ${result.status}`;
      draw();
      const pre = root.querySelector("#api-result");
      if (pre) pre.textContent = JSON.stringify(result.data, null, 2);
    }
  });

  root.addEventListener("keydown", (event) => {
    const row = event.target.closest("[data-open-ticket]");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectedTicketId = row.dataset.openTicket;
      view = "tickets";
      draw();
    }
  });

  root.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-drag]");
    if (!card) return;
    dragId = card.dataset.drag;
    card.classList.add("is-dragging");
  });

  root.addEventListener("dragend", (event) => {
    event.target.closest("[data-drag]")?.classList.remove("is-dragging");
    dragId = null;
  });

  root.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-drop]") && dragId) event.preventDefault();
  });

  root.addEventListener("drop", (event) => {
    const column = event.target.closest("[data-drop]");
    if (!column || !dragId) return;
    event.preventDefault();
    platform.moveIssue(projectId, dragId, column.dataset.drop);
    flash = `${dragId} moved`;
    dragId = null;
    draw();
  });

  draw();
}
