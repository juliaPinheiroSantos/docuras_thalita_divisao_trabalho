const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!databaseId || !uuidPattern.test(databaseId)) {
  console.error(
    [
      'Cloudflare D1 is not configured.',
      'Create or select a D1 database and add its UUID as the',
      'CLOUDFLARE_D1_DATABASE_ID build variable in Workers Builds.',
    ].join(' '),
  );
  process.exit(1);
}

console.log('Cloudflare D1 configuration found.');
