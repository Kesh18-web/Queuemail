import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';

async function migrate() {
  let connection: mysql.Connection | null = null;

  try {
    // Get schema path - works in both dev and compiled mode
    const schemaPath = path.join(
      __dirname.includes('dist')
        ? path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql')
        : path.join(__dirname, 'schema.sql')
    );
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Reading schema from:', schemaPath);

    // Create connection WITHOUT specifying database (to create it if needed)
    const connectionConfig: any = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307', 10), // Use 3307 as default (Docker port)
      user: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'password',
      multipleStatements: true, // Allow multiple statements
    };

    console.log('Connecting to MySQL...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected successfully');

    // Split by semicolons but keep them, then filter
    // Split by line first to handle multi-line statements
    const lines = schema.split('\n');
    let statements: string[] = [];
    let currentStatement = '';

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comment-only lines
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }
      
      currentStatement += ' ' + trimmed;
      
      // If line ends with semicolon, we have a complete statement
      if (trimmed.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement (without semicolon)
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`Found ${statements.length} statements to execute`);

    // Execute statements one by one
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          console.log(`\n[${i + 1}/${statements.length}] Executing: ${trimmed.substring(0, 60)}...`);
          
          // If this is a CREATE DATABASE statement, execute it, then USE the database
          if (trimmed.toUpperCase().startsWith('CREATE DATABASE')) {
            await connection.query(trimmed);
            // Extract database name and USE it
            const dbMatch = trimmed.match(/reachinbox_email/i);
            if (dbMatch) {
              await connection.query('USE reachinbox_email;');
              console.log('✓ Switched to database: reachinbox_email');
            }
          } else {
            await connection.query(trimmed);
          }
          
          console.log('✓ Success');
        } catch (err: any) {
          // If table already exists, that's okay
          if (
            err.code === 'ER_TABLE_EXISTS_ERROR' ||
            err.code === 'ER_DUP_ENTRY' ||
            err.code === 'ER_DB_CREATE_EXISTS' ||
            err.code === 'ER_DUP_FIELDNAME'
          ) {
            console.log('ℹ Skipped (already exists)');
          } else {
            console.error(`✗ Error: ${err.message}`);
            throw err;
          }
        }
      }
    }

    console.log('\n✅ Database migration completed successfully');
  } catch (error: any) {
    console.error('\n❌ Migration error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.sql) {
      console.error('SQL:', error.sql.substring(0, 200));
    }
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
