-- Better Auth and ledger access go through the authenticated app server.
REVOKE ALL PRIVILEGES ON TABLE
  public."user", public."session", public."account", public."verification", public."ledger"
FROM anon, authenticated;
