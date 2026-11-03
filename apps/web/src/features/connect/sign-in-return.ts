const RETURN = 'renovagent.return-to';

// Sign-in leaves the page, and the fragment never reaches the server.
export function rememberReturn() {
  try {
    if (window.location.hash) sessionStorage.setItem(RETURN, window.location.hash);
  } catch {
    // Without storage the owner opens the link again after signing in.
  }
}
export function takeReturn() {
  try {
    const to = sessionStorage.getItem(RETURN);
    sessionStorage.removeItem(RETURN);
    return to && /^#[a-z0-9/_:%-]+$/i.test(to) ? to : null;
  } catch {
    return null;
  }
}
