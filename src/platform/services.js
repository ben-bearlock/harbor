/** In-app REST router, webhook dispatcher, and email outbox. */

export function createServices(getState, setState) {
  const routes = [
    { method: "GET", path: "/api/v1/health", handler: () => ({ ok: true, product: "Harbor" }) },
    {
      method: "GET",
      path: "/api/v1/workspace",
      handler: () => {
        const state = getState();
        return {
          type: state.workspace.type,
          name: state.workspace.name,
          slug: state.workspace.slug,
          features: Object.fromEntries(
            Object.entries(state.features).map(([id, value]) => [id, value.enabled]),
          ),
        };
      },
    },
    {
      method: "GET",
      path: "/api/v1/members",
      handler: () => getState().people.map(publicMember),
    },
    {
      method: "POST",
      path: "/api/v1/members",
      handler: (body) => {
        const result = getState().actions.createMember(body || {});
        if (!result.ok) throw new Error(result.error);
        return result;
      },
    },
    {
      method: "GET",
      path: "/api/v1/tickets",
      handler: () => getState().tickets.map(publicTicket),
    },
    {
      method: "POST",
      path: "/api/v1/tickets",
      handler: (body) => {
        const ticket = getState().actions.createTicket(body);
        return publicTicket(ticket);
      },
    },
    {
      method: "GET",
      path: "/api/v1/knowledge",
      handler: () => getState().articles,
    },
    {
      method: "GET",
      path: "/api/v1/teams",
      handler: () => getState().teams,
    },
    {
      method: "POST",
      path: "/api/v1/teams",
      handler: (body) => {
        const result = getState().actions.createTeam(body || {});
        if (!result.ok) throw new Error(result.error);
        return result;
      },
    },
    {
      method: "GET",
      path: "/api/v1/roles",
      handler: () => getState().roles,
    },
    {
      method: "POST",
      path: "/api/v1/invites",
      handler: (body) => {
        const result = getState().actions.invite(body);
        if (!result.ok) throw new Error(result.error);
        return result;
      },
    },
    {
      method: "POST",
      path: "/api/v1/discord/suggestions",
      handler: (body) => {
        const result = getState().actions.ingestDiscordSuggestion(body || {});
        if (!result.ok) throw new Error(result.error);
        return result;
      },
    },
  ];

  function publicTicket(ticket) {
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      teamId: ticket.teamId,
      requester: ticket.requester,
      articleIds: ticket.articleIds,
      source: ticket.source,
      outcome: ticket.outcome,
      createdAt: ticket.createdAt,
    };
  }

  function publicMember(member) {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      teamIds: member.teamIds,
    };
  }

  async function request(method, path, body, headers = {}) {
    const state = getState();
    if (!state.features.api.enabled) {
      return { ok: false, status: 503, data: { error: "REST API module is disabled." } };
    }
    if (state.features.api.config.requireToken) {
      const token = headers.Authorization || headers.authorization || "";
      if (token !== `Bearer ${state.apiToken}`) {
        return { ok: false, status: 401, data: { error: "Missing or invalid bearer token." } };
      }
    }

    const direct = routes.find((item) => item.method === method && item.path === path);
    if (direct) {
      try {
        const data = await direct.handler(body || {});
        logApi(method, path, 200);
        return { ok: true, status: 200, data };
      } catch (error) {
        logApi(method, path, 400);
        return { ok: false, status: 400, data: { error: error.message || "Bad request" } };
      }
    }

    const memberMatch = path.match(/^\/api\/v1\/members\/([^/]+)$/);
    if (method === "PATCH" && memberMatch) {
      try {
        const result = getState().actions.updateMember(memberMatch[1], body || {});
        if (!result.ok) throw new Error(result.error);
        logApi(method, path, 200);
        return { ok: true, status: 200, data: result };
      } catch (error) {
        logApi(method, path, 400);
        return { ok: false, status: 400, data: { error: error.message || "Bad request" } };
      }
    }

    const ticketMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)$/);
    if (method === "PATCH" && ticketMatch) {
      try {
        const result = getState().actions.updateTicket(ticketMatch[1], body || {});
        if (!result.ok) throw new Error(result.error);
        logApi(method, path, 200);
        return { ok: true, status: 200, data: result };
      } catch (error) {
        logApi(method, path, 400);
        return { ok: false, status: 400, data: { error: error.message || "Bad request" } };
      }
    }

    logApi(method, path, 404);
    return { ok: false, status: 404, data: { error: "Not found." } };
  }

  function logApi(method, path, status) {
    setState((state) => {
      state.apiLog.unshift({
        id: `api_${Date.now()}`,
        method,
        path,
        status,
        at: new Date().toISOString(),
      });
      state.apiLog = state.apiLog.slice(0, 40);
    });
  }

  function emit(event, payload) {
    const state = getState();
    if (!state.features.webhooks.enabled) return [];

    const deliveries = [];
    for (const hook of state.webhooks.filter((item) => item.enabled && item.events.includes(event))) {
      const delivery = {
        id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        webhookId: hook.id,
        event,
        url: hook.url,
        status: "delivered",
        at: new Date().toISOString(),
        payload,
      };
      deliveries.push(delivery);
      setState((draft) => {
        draft.webhookDeliveries.unshift(delivery);
        draft.webhookDeliveries = draft.webhookDeliveries.slice(0, 40);
      });
    }
    return deliveries;
  }

  function sendEmail({ to, subject, body, template }) {
    const state = getState();
    if (!state.features.email.enabled) {
      return { ok: false, error: "Email module is disabled." };
    }
    const message = {
      id: `mail_${Date.now()}`,
      to,
      subject,
      body,
      template: template || "custom",
      from: `${state.features.email.config.fromName} <${state.features.email.config.fromAddress}>`,
      status: "sent",
      at: new Date().toISOString(),
    };
    setState((draft) => {
      draft.emails.unshift(message);
      draft.emails = draft.emails.slice(0, 40);
    });
    emit("email.sent", { id: message.id, to, subject, template: message.template });
    return { ok: true, message };
  }

  return {
    routes: [
      ...routes,
      { method: "PATCH", path: "/api/v1/members/:id" },
      { method: "PATCH", path: "/api/v1/tickets/:id" },
    ],
    request,
    emit,
    sendEmail,
  };
}
