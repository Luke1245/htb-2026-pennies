// An empty VITE_API_URL is same-origin: nginx on the VPS forwards the API paths.
// Unset stays on the local uvicorn process used in development.
export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export async function authHeaders(getAccessTokenSilently) {
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE
  const token = await getAccessTokenSilently({
    authorizationParams: audience ? { audience } : undefined,
  })
  return { Authorization: `Bearer ${token}` }
}
