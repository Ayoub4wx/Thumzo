import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

type ProfileRow = {
  id: string;
  email: string | null;
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Supabase environment variables are not set in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function giveCredits(email: string, amount: number) {
  console.log(`Giving ${amount} credits to ${email}...`);

  // 1. Find user ID by email
  let userId: string | null = null;

  console.log(`Searching for profile with email: ${email}...`);
  const { data: profilesData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('email', email);
  const profiles = (profilesData ?? []) as ProfileRow[];

  if (profileError) {
    console.error(`❌ Error searching profiles:`, profileError.message);
  }

  if (profiles && profiles.length > 0) {
    if (profiles.length > 1) {
      console.warn(`⚠️ Found multiple profiles for ${email}. Using the first one: ${profiles[0].id}`);
    }
    userId = profiles[0].id;
  } else {
    console.log(`No profile found for ${email}. Searching auth.users...`);
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    const users = (authUsersData?.users ?? []) as Array<Pick<ProfileRow, "id" | "email">>;
    
    if (authError) {
      console.error(`❌ Error listing auth users:`, authError.message);
      process.exit(1);
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      userId = user.id;
      console.log(`Found user in auth.users: ${userId}`);
      
      // Optionally create profile if it's missing
      console.log(`Creating missing profile for ${userId}...`);
      const { error: insertProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({ id: userId, email: email });
      
      if (insertProfileError) {
        console.warn(`Could not create profile: ${insertProfileError.message}`);
      }
    }
  }

  if (!userId) {
    console.error(`❌ Could not find user with email ${email} in profiles or auth.users.`);
    process.exit(1);
  }

  // 2. Insert into credit_ledger
  const { error: ledgerError } = await supabaseAdmin
    .from('credit_ledger')
    .insert({
      user_id: userId,
      entry_direction: 'credit',
      amount: amount,
      source_type: 'admin_adjustment',
      description: `Admin adjustment: ${amount} credits added`,
      idempotency_key: `admin_${userId}_${Date.now()}`
    });

  if (ledgerError) {
    console.error(`❌ Failed to insert into credit_ledger:`, ledgerError.message);
    process.exit(1);
  }

  // 3. Verify balance
  const { data: balanceData, error: balanceError } = await supabaseAdmin
    .rpc('get_credit_balance', { target_user: userId });

  if (balanceError) {
    console.warn(`Could not fetch new balance:`, balanceError.message);
  } else {
    console.log(`✅ New balance for ${email}: ${balanceData}`);
  }

  console.log(`✅ Successfully gave ${amount} credits to ${email}`);
}

const email = "al4vays@gmail.com";
const amount = 100;

giveCredits(email, amount).catch(console.error);
