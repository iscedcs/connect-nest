import 'dotenv/config';
import { PrismaClient } from 'src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import slugify from 'slugify';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Helper function to generate a URL-friendly slug from a string
function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

// Helper function to generate unique slug (with counter if needed)
async function generateUniqueSlug(
  baseSlug: string,
  existingSlugs: Set<string>
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  existingSlugs.add(slug);
  return slug;
}

async function generateProfileSlugs() {
  try {
    console.log('🔍 Fetching all profiles from database...');

    // Get all profiles (including those with existing slugs)
    const allProfiles = await prisma.profile.findMany({
      where: {
        deletedAt: null, // Only process non-deleted profiles
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📊 Found ${allProfiles.length} profiles to process`);

    // Build set of existing slugs
    const existingSlugs = new Set<string>();
    allProfiles.forEach((profile) => {
      if (profile.slug) {
        existingSlugs.add(profile.slug);
      }
    });

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorList: Array<{ id: string; name: string; error: string }> = [];

    console.log('\n🔄 Generating slugs...\n');

    for (const profile of allProfiles) {
      try {
        // Skip if slug already exists
        if (profile.slug) {
          console.log(`⏭️  Skipping profile "${profile.name}" (already has slug: ${profile.slug})`);
          skipped++;
          continue;
        }

        // Generate base slug from profile name
        const baseSlug = profile.name
          ? generateSlug(profile.name)
          : `profile-${profile.id.substring(0, 8)}`;

        // Generate unique slug
        const uniqueSlug = await generateUniqueSlug(baseSlug, existingSlugs);

        // Update profile with slug
        await prisma.profile.update({
          where: { id: profile.id },
          data: { slug: uniqueSlug },
        });

        console.log(`✅ Updated profile "${profile.name}" → slug: ${uniqueSlug}`);
        updated++;

        if (updated % 50 === 0) {
          console.log(`   Progress: ${updated} profiles updated...`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing profile "${profile.name}" (${profile.id}):`, error.message);
        errors++;
        errorList.push({
          id: profile.id,
          name: profile.name,
          error: error.message,
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary:');
    console.log(`   Total profiles: ${allProfiles.length}`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped (already had slug): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    if (errorList.length > 0) {
      console.log('\n❌ Errors:');
      errorList.forEach((err) => {
        console.log(`   - ${err.name} (${err.id}): ${err.error}`);
      });
    }

    console.log('\n✅ Slug generation completed!');
  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateProfileSlugs()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
