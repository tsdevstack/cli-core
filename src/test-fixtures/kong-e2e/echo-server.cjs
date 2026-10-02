// Upstream for the Kong end-to-end test (runs in node:22-alpine).
// - Any path: replies with the method, url and headers it received (JSON).
// - Mock OIDC provider (issuer from the ISSUER env variable):
//   GET /.well-known/openid-configuration, GET /jwks,
//   GET /mint?sub=..&aud=kong&preferred_username=.. -> RS256 JWT signed with
//   an in-memory key, accepted by kong-oidc-v3 (client_id kong).
// - GET /oidc-hits -> how often the discovery document and the JWKS were
//   served ({ discovery, jwks }), to check that Kong caches them.
const http = require('http');
const crypto = require('crypto');

const ISSUER = process.env.ISSUER || 'http://localhost:3000';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'e2e',
  alg: 'RS256',
  use: 'sig',
};
const b64u = (b) => Buffer.from(b).toString('base64url');
const oidcHits = { discovery: 0, jwks: 0 };

function mint(q) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'e2e' };
  const payload = {
    iss: ISSUER,
    sub: q.get('sub') || 'user-1',
    aud: q.get('aud') || 'kong',
    iat: now,
    exp: now + 600,
    preferred_username: q.get('preferred_username') || undefined,
    email: 'user@example.test',
  };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), privateKey);
  return `${input}.${b64u(sig)}`;
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (o) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(o));
    };
    if (u.pathname === '/.well-known/openid-configuration') {
      oidcHits.discovery++;
      return json({
        issuer: ISSUER,
        jwks_uri: `${ISSUER}/jwks`,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        id_token_signing_alg_values_supported: ['RS256'],
      });
    }
    if (u.pathname === '/jwks') {
      oidcHits.jwks++;
      return json({ keys: [jwk] });
    }
    if (u.pathname === '/oidc-hits') return json(oidcHits);
    if (u.pathname === '/mint') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end(mint(u.searchParams));
    }
    json({ method: req.method, url: req.url, headers: req.headers });
  })
  .listen(3000, () => console.log('echo on 3000'));
