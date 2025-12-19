
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Simple manual .env.local parsing
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    envLines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("--- Supabase Connection Diagnostic ---");
console.log("Target URL:", supabaseUrl);
console.log("Key Length:", supabaseKey ? supabaseKey.length : 0);

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing Supabase URL or Key in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        console.log("Checking connection to database...");
        // Try to list tables or check for a specific table
        const { data, error } = await supabase
            .from('organizer_chat_history')
            .select('*')
            .limit(1);

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('relation "public.organizer_chat_history" does not exist')) {
                console.log("✅ Connection Successful, but tables are missing.");
                console.log("👉 Please run the SQL script in your Supabase dashboard.");
            } else {
                console.error("❌ Connection failed with error:", error.message);
                console.error("Full error:", JSON.stringify(error, null, 2));
            }
        } else {
            console.log("✅ Connection Successful and tables detected!");
        }
    } catch (e) {
        console.error("❌ Fatal error during test:", e.message);
    }
}

testConnection();
