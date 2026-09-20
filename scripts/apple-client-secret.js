#!/usr/bin/env node
/*
 * Generates the "Secret Key" JWT that Supabase's Apple provider asks for.
 *
 *   node scripts/apple-client-secret.js \
 *     --team-id ABCDE12345 \
 *     --key-id XYZ9876543 \
 *     --services-id com.jordanxcclinic.app.signin \
 *     --key ~/Downloads/AuthKey_XYZ9876543.p8
 *
 * Apple does not hand you this value — you sign it yourself with the .p8 key
 * they give you once. It runs entirely on your machine: the private key is
 * read, used, and never sent anywhere.
 *
 * Apple caps these at six months, so this expires and has to be regenerated.
 * The date is printed so it can go in a calendar.
 */
const fs = require('fs');
const crypto = require('crypto');

function arg(name) {
  const index = process.argv.indexOf('--' + name);
  return index === -1 ? null : process.argv[index + 1];
}

const teamId = arg('team-id');
const keyId = arg('key-id');
const servicesId = arg('services-id');
const keyPath = arg('key');

if (!teamId || !keyId || !servicesId || !keyPath) {
  console.error(`
Missing something. All four are required:

  --team-id      Your Apple Team ID, from developer.apple.com → Membership
  --key-id       The Key ID shown when you created the Sign in with Apple key
  --services-id  The Services ID you registered, e.g. com.jordanxcclinic.app.signin
  --key          Path to the AuthKey_XXXXXXXX.p8 file Apple let you download once
`);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath.replace(/^~/, process.env.HOME), 'utf8');

const issuedAt = Math.floor(Date.now() / 1000);
// Apple's hard limit is six months; a day short of it avoids edge rejections.
const expiresAt = issuedAt + 15777000 - 86400;

const b64 = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

const header = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
const payload = b64({
  iss: teamId,
  iat: issuedAt,
  exp: expiresAt,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
});

// Apple wants the raw r||s signature, not the DER encoding Node defaults to.
const signature = crypto
  .sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })
  .toString('base64url');

console.log(`\n${header}.${payload}.${signature}\n`);
console.error('Paste that into Supabase → Authentication → Providers → Apple → Secret Key.');
console.error(`It stops working on ${new Date(expiresAt * 1000).toDateString()} — put that in a calendar.\n`);
