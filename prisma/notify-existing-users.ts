/**
 * Standalone Script — Notify Existing Users of LYNCON Rebrand & 6-Month Free Trial
 *
 * Usage:
 *   npx ts-node prisma/notify-existing-users.ts --plan=PRO_PLUS --dry-run
 *   npx ts-node prisma/notify-existing-users.ts --test=admin@example.com
 *   npx ts-node prisma/notify-existing-users.ts --plan=PRO_PLUS
 *
 * --plan is required for live and dry runs: it decides which paid tier the
 * 6-month trial grants. There is deliberately no default.
 */

import 'dotenv/config';
import {
  PrismaClient,
  PlanTier,
  NotificationType,
  SubscriptionStatus,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Resend } from 'resend';
import axios from 'axios';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const fromAddress =
  process.env.RESEND_FROM_EMAIL || 'LYNCON <lyncon@isce.app>';
const appUrl = process.env.APP_URL || 'https://connect.isce.app';
const authUrl = process.env.AUTH_API_URL;
const internalKey = process.env.INTERNAL_API_KEY;

function buildEmailHtml(recipientName: string, trialEndDate: Date): string {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const formattedEndDate = trialEndDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to LYNCON & Your 6-Month Free Trial</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#13131c;border:1px solid #232336;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
          
          <!-- Header -->
          <tr>
            <td style="padding:36px 30px 28px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#c026d3 100%);text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:4px 14px;border-radius:20px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.25);">
                <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Important Product Announcement</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:900;letter-spacing:-0.5px;">LYNCON</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">ISCE Connect is evolving into something bigger.</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 30px;">
              <p style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:600;">${greeting}</p>
              
              <p style="margin:0 0 18px;color:#c4c4d4;font-size:14px;line-height:1.6;">
                We are thrilled to announce that <strong>ISCE Connect</strong> is officially rebranded to <strong>LYNCON</strong>! Along with our new name and enhanced experience, we are launching our dynamic subscription plans tailored to give you maximum flexibility.
              </p>

              <!-- 6-Month Free Trial Box -->
              <div style="background:linear-gradient(135deg,#1c1b2f 0%,#181828 100%);border-radius:14px;padding:22px;border:1px solid #3b3663;margin-bottom:24px;">
                <h2 style="margin:0 0 8px;color:#a5b4fc;font-size:17px;font-weight:700;">🎁 Your 6-Month Free Trial is Now Active</h2>
                <p style="margin:0 0 12px;color:#e0e0ec;font-size:13px;line-height:1.6;">
                  As a thank-you for being a valued member of our community, you have been granted a <strong>6-Month Free Trial</strong> with full access to elevated features until <strong>${formattedEndDate}</strong>.
                </p>
                <ul style="margin:0;padding-left:20px;color:#a5b4fc;font-size:13px;line-height:1.6;">
                  <li>Multi-profile & enhanced social connectivity</li>
                  <li>Custom themes, branding, and booking tools</li>
                  <li>High-speed file storage and priority integrations</li>
                </ul>
              </div>

              <!-- Clarification on Billing After 6 Months -->
              <h3 style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:700;">What happens when your trial ends?</h3>
              <p style="margin:0 0 20px;color:#a8a8b8;font-size:13px;line-height:1.6;">
                Transparency is our priority. When your trial period concludes on <strong>${formattedEndDate}</strong>, you will have the choice to subscribe to a paid tier (such as <em>Pro Lite</em> or <em>Pro Plus</em>) to continue using premium quotas, or seamlessly continue on our generous <strong>Free tier</strong>. You will never be charged without your explicit setup and confirmation.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 12px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/subscriptions" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;padding:14px 38px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(99,102,241,0.4);">Explore Your LYNCON Account</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 30px;border-top:1px solid #1e1e2d;background:#0d0d14;text-align:center;">
              <p style="margin:0 0 6px;color:#888899;font-size:12px;font-weight:600;">LYNCON — Next-Generation Networking & Business Suite</p>
              <p style="margin:0;color:#555566;font-size:11px;">You received this notification as a registered user of LYNCON (formerly ISCE Connect).</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

async function getUserEmail(userId: string): Promise<string | null> {
  if (!authUrl) return null;
  try {
    const res = await axios.get(`${authUrl}/user/${userId}`, {
      headers: { 'x-internal-key': internalKey ?? '' },
    });
    return res.data?.data?.email || res.data?.email || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const testArg = args.find((a) => a.startsWith('--test='));
  const testEmail = testArg ? testArg.split('=')[1] : null;

  const now = new Date();
  const trialEndDate = new Date(now);
  trialEndDate.setMonth(trialEndDate.getMonth() + 6);

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🚀 LYNCON Subscription Launch Announcement & Onboarding');
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN (Simulated)' : testEmail ? `TEST (to ${testEmail})` : 'LIVE'}`);
  console.log('─────────────────────────────────────────────────────────────');

  if (testEmail) {
    if (!resend) {
      console.warn('⚠️  RESEND_API_KEY not configured. Email preview printed only.');
      return;
    }
    await resend.emails.send({
      from: fromAddress,
      to: testEmail,
      subject: '🚀 Welcome to LYNCON: Your 6-Month Free Trial is Active!',
      html: buildEmailHtml('Test User', trialEndDate),
    });
    console.log(`✅ Test email successfully sent to: ${testEmail}`);
    return;
  }

  // The email promises a 6-month free trial with elevated features, so the grant has
  // to be a TRIALING paid tier — granting an ACTIVE FREE plan would make the email a
  // lie. Which tier is a pricing decision, so it must be stated rather than defaulted.
  const planArg = args.find((a) => a.startsWith('--plan='));
  const planKey = planArg ? (planArg.split('=')[1] as PlanTier) : null;
  const TRIAL_TIERS: PlanTier[] = [PlanTier.PRO_LITE, PlanTier.PRO_PLUS];

  if (!planKey || !TRIAL_TIERS.includes(planKey)) {
    console.error(
      `❌ Specify the tier the 6-month trial grants: --plan=${TRIAL_TIERS.join(' | --plan=')}`,
    );
    process.exitCode = 1;
    return;
  }

  const trialPlan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!trialPlan) {
    console.error(`❌ Plan ${planKey} not found in database. Run \`npx ts-node prisma/seed.ts\` first.`);
    return;
  }

  const profiles = await prisma.profile.findMany({
    where: { deletedAt: null },
    select: { id: true, userId: true, name: true },
    distinct: ['userId'],
  });

  console.log(`Found ${profiles.length} candidate existing users.`);

  let processed = 0;
  let emailsSent = 0;
  let inAppCreated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    processed++;
    try {
      // 1. Check or auto-bootstrap subscription record
      let sub = await prisma.subscription.findUnique({
        where: { userId: profile.userId },
      });

      if (!sub) {
        if (!isDryRun) {
          sub = await prisma.subscription.create({
            data: {
              userId: profile.userId,
              planId: trialPlan.id,
              status: SubscriptionStatus.TRIALING,
              trialStartDate: now,
              trialEndDate,
              trialUsed: true,
              notifiedLaunch: false,
            },
          });
        }
      }

      if (sub && sub.notifiedLaunch) {
        skipped++;
        continue;
      }

      if (isDryRun) {
        emailsSent++;
        inAppCreated++;
        continue;
      }

      // 2. Create in-app notification
      await prisma.notification.create({
        data: {
          userId: profile.id,
          type: NotificationType.SUBSCRIPTION_LAUNCH_ANNOUNCEMENT,
          title: '🚀 Welcome to LYNCON: Your 6-Month Free Trial is Active!',
          message:
            'ISCE Connect is now LYNCON! Enjoy 6 months of elevated features on us. Learn more about our plans in your settings.',
        },
      });
      inAppCreated++;

      // 3. Send Email
      const email = await getUserEmail(profile.userId);
      if (email && resend) {
        await resend.emails.send({
          from: fromAddress,
          to: email,
          subject: '🚀 Welcome to LYNCON: Your 6-Month Free Trial is Active!',
          html: buildEmailHtml(profile.name, trialEndDate),
        });
        emailsSent++;
      }

      // 4. Mark notified
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { notifiedLaunch: true },
        });
      }
    } catch (err) {
      console.error(`Error processing user ${profile.userId}:`, err);
    }
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`✨ Done! Total: ${processed} | Emails: ${emailsSent} | In-App: ${inAppCreated} | Skipped: ${skipped}`);
  console.log('─────────────────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
