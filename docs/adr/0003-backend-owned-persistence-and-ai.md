# Backend-owned persistence and AI access

The React SPA accesses product data only through FastAPI; the backend owns TigerData persistence and Gemini access, validates Auth0 tokens, and scopes every record to the authenticated user. Keeping provider credentials and authorisation outside the browser was chosen over direct frontend integrations because private financial data and consistent sharing-mode enforcement require one trusted server boundary.
