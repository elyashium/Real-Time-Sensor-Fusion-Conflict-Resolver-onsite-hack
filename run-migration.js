const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'db.ttwhnfkurqrbmjubooia.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'Kamehamehamehaa@12341911',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');
    
    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260815120151_create_telemetry_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing migration...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
