import { Clerk } from "@clerk/clerk-js";
import "./style.css";
import { mountApp } from "./app.js";

mountApp(document.getElementById("app"));

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const status = document.getElementById("status");

if (!publishableKey) {
  status.textContent =
    "Harbor is ready. Add a Clerk publishable key to unlock sign in.";
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull — then restart the dev server.",
  );
}

const clerkDomain = atob(publishableKey.split("_")[2]).slice(0, -1);

await new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.onload = resolve;
  script.onerror = () => reject(new Error("Failed to load the Clerk UI bundle"));
  document.head.appendChild(script);
});

const clerk = new Clerk(publishableKey);
await clerk.load({
  ui: { ClerkUI: window.__internal_ClerkUICtor },
});

const signedOut = document.getElementById("signed-out");
const signedIn = document.getElementById("signed-in");
const userButton = document.getElementById("user-button");

document.getElementById("sign-in").addEventListener("click", () => {
  clerk.openSignIn();
});

document.getElementById("sign-up").addEventListener("click", () => {
  clerk.openSignUp();
});

let userButtonMounted = false;

function renderAuth() {
  const user = clerk.user;

  if (user) {
    signedOut.hidden = true;
    signedIn.hidden = false;

    if (!userButtonMounted) {
      clerk.mountUserButton(userButton);
      userButtonMounted = true;
    }

    const name =
      user.fullName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "your account";
    status.textContent = `Signed in as ${name}`;
    return;
  }

  if (userButtonMounted) {
    clerk.unmountUserButton(userButton);
    userButtonMounted = false;
  }

  signedIn.hidden = true;
  signedOut.hidden = false;
  status.textContent = "Browse the demo board · sign in to claim your seat";
}

clerk.addListener(renderAuth);
renderAuth();
