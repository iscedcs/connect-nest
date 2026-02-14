import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from 'src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface MappedProfile {
  id: string;
  userId: string;
  slug: string | null;
  profilePhoto: string | null;
  coverPhoto: string | null;
  name: string;
  position: string | null;
  description: string | null;
  location: string | null;
  address: any | null;
  is_default: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface MappedSocial {
  id: string;
  userId: string; // Profile ID
  platform: string;
  label: string | null;
  value: string;
  is_visible: boolean;
  order: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface MappedProfileContact {
  id: string;
  profileId: string;
  label: string | null;
  phone_number: string;
  is_primary: boolean;
  is_visible: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface MappedLink {
  id: string;
  profileId: string;
  title: string;
  url: string;
  image: string | null;
  order: number | null;
  is_visible: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface MappedVideo {
  id: string;
  profileId: string;
  title: string;
  platform: string;
  url: string;
  thumbnail: string | null;
  is_featured: boolean;
  is_visible: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

async function importToDatabase() {
  try {
    console.log('🚀 Starting import to CONNECT database...\n');

    // Read from isce-auth migration output directory
    const outputDir = path.join(__dirname, '..', '..', 'isce-auth', 'migration-output');

    // Read mapped profiles
    const profilesPath = path.join(outputDir, 'mapped-profiles.json');
    if (!fs.existsSync(profilesPath)) {
      throw new Error(`Profiles file not found: ${profilesPath}`);
    }

    const profiles: MappedProfile[] = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    console.log(`📖 Found ${profiles.length} profiles to import`);

    // Read profile relations
    const socialsPath = path.join(outputDir, 'mapped-socials.json');
    const profileContactsPath = path.join(outputDir, 'mapped-profile-contacts.json');
    const linksPath = path.join(outputDir, 'mapped-links.json');
    const videosPath = path.join(outputDir, 'mapped-videos.json');

    let socials: MappedSocial[] = [];
    let profileContacts: MappedProfileContact[] = [];
    let links: MappedLink[] = [];
    let videos: MappedVideo[] = [];

    if (fs.existsSync(socialsPath)) {
      socials = JSON.parse(fs.readFileSync(socialsPath, 'utf-8'));
      console.log(`📖 Found ${socials.length} socials to import`);
    }

    if (fs.existsSync(profileContactsPath)) {
      profileContacts = JSON.parse(fs.readFileSync(profileContactsPath, 'utf-8'));
      console.log(`📖 Found ${profileContacts.length} profile contacts to import`);
    }

    if (fs.existsSync(linksPath)) {
      links = JSON.parse(fs.readFileSync(linksPath, 'utf-8'));
      console.log(`📖 Found ${links.length} links to import`);
    }

    if (fs.existsSync(videosPath)) {
      videos = JSON.parse(fs.readFileSync(videosPath, 'utf-8'));
      console.log(`📖 Found ${videos.length} videos to import`);
    }

    let profilesImported = 0;
    let profilesSkipped = 0;
    let profilesErrors = 0;
    const profileErrors: Array<{ id: string; error: string }> = [];

    // Import profiles
    console.log('\n👤 Importing profiles...');
    for (const profile of profiles) {
      try {
        await prisma.profile.create({
          data: {
            id: profile.id,
            userId: profile.userId,
            slug: profile.slug,
            profilePhoto: profile.profilePhoto,
            coverPhoto: profile.coverPhoto,
            name: profile.name,
            position: profile.position,
            description: profile.description,
            location: profile.location,
            address: profile.address,
            is_default: profile.is_default,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt),
          },
        });
        profilesImported++;
        if (profilesImported % 100 === 0) {
          console.log(`  ✓ Imported ${profilesImported} profiles...`);
        }
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - profile already exists
          console.log(`  ⏭️  Skipping duplicate profile: ${profile.id}`);
          profilesSkipped++;
        } else {
          console.error(`  ✗ Error importing profile ${profile.id}:`, error.message);
          profilesErrors++;
          profileErrors.push({ id: profile.id, error: error.message });
        }
      }
    }

    console.log(`\n✅ Profiles import complete:`);
    console.log(`   Imported: ${profilesImported}`);
    console.log(`   Skipped (duplicates): ${profilesSkipped}`);
    console.log(`   Errors: ${profilesErrors}`);

    // Import socials
    let socialsImported = 0;
    let socialsErrors = 0;
    if (socials.length > 0) {
      console.log('\n🔗 Importing socials...');
      for (const social of socials) {
        try {
          await prisma.social.create({
            data: {
              id: social.id,
              userId: social.userId,
              platform: social.platform,
              label: social.label,
              value: social.value,
              is_visible: social.is_visible,
              order: social.order,
              createdAt: new Date(social.createdAt),
              updatedAt: new Date(social.updatedAt),
            },
          });
          socialsImported++;
          if (socialsImported % 100 === 0) {
            console.log(`  ✓ Imported ${socialsImported} socials...`);
          }
        } catch (error: any) {
          console.error(`  ✗ Error importing social ${social.id}:`, error.message);
          socialsErrors++;
        }
      }
      console.log(`   Imported: ${socialsImported}, Errors: ${socialsErrors}`);
    }

    // Import profile contacts
    let profileContactsImported = 0;
    let profileContactsErrors = 0;
    if (profileContacts.length > 0) {
      console.log('\n📞 Importing profile contacts...');
      for (const profileContact of profileContacts) {
        try {
          await prisma.profileContact.create({
            data: {
              id: profileContact.id,
              profileId: profileContact.profileId,
              label: profileContact.label,
              phone_number: profileContact.phone_number,
              is_primary: profileContact.is_primary,
              is_visible: profileContact.is_visible,
              createdAt: new Date(profileContact.createdAt),
              updatedAt: new Date(profileContact.updatedAt),
            },
          });
          profileContactsImported++;
          if (profileContactsImported % 100 === 0) {
            console.log(`  ✓ Imported ${profileContactsImported} profile contacts...`);
          }
        } catch (error: any) {
          console.error(`  ✗ Error importing profile contact ${profileContact.id}:`, error.message);
          profileContactsErrors++;
        }
      }
      console.log(`   Imported: ${profileContactsImported}, Errors: ${profileContactsErrors}`);
    }

    // Import links
    let linksImported = 0;
    let linksErrors = 0;
    if (links.length > 0) {
      console.log('\n🔗 Importing links...');
      for (const link of links) {
        try {
          await prisma.link.create({
            data: {
              id: link.id,
              profileId: link.profileId,
              title: link.title,
              url: link.url,
              image: link.image,
              order: link.order,
              is_visible: link.is_visible,
              createdAt: new Date(link.createdAt),
              updatedAt: new Date(link.updatedAt),
            },
          });
          linksImported++;
          if (linksImported % 100 === 0) {
            console.log(`  ✓ Imported ${linksImported} links...`);
          }
        } catch (error: any) {
          console.error(`  ✗ Error importing link ${link.id}:`, error.message);
          linksErrors++;
        }
      }
      console.log(`   Imported: ${linksImported}, Errors: ${linksErrors}`);
    }

    // Import videos
    let videosImported = 0;
    let videosErrors = 0;
    if (videos.length > 0) {
      console.log('\n🎥 Importing videos...');
      for (const video of videos) {
        try {
          await prisma.video.create({
            data: {
              id: video.id,
              profileId: video.profileId,
              title: video.title,
              platform: video.platform,
              url: video.url,
              thumbnail: video.thumbnail,
              is_featured: video.is_featured,
              is_visible: video.is_visible,
              createdAt: new Date(video.createdAt),
              updatedAt: new Date(video.updatedAt),
            },
          });
          videosImported++;
          if (videosImported % 100 === 0) {
            console.log(`  ✓ Imported ${videosImported} videos...`);
          }
        } catch (error: any) {
          console.error(`  ✗ Error importing video ${video.id}:`, error.message);
          videosErrors++;
        }
      }
      console.log(`   Imported: ${videosImported}, Errors: ${videosErrors}`);
    }

    // Write import report
    const report = `
# Import Report - CONNECT Database

Generated: ${new Date().toISOString()}

## Profiles Import
- Total profiles: ${profiles.length}
- Successfully imported: ${profilesImported}
- Skipped (duplicates): ${profilesSkipped}
- Errors: ${profilesErrors}

${profileErrors.length > 0 ? `### Profile Errors:\n${profileErrors.map(e => `- ${e.id}: ${e.error}`).join('\n')}\n` : ''}

## Socials Import
- Total socials: ${socials.length}
- Successfully imported: ${socialsImported}
- Errors: ${socialsErrors}

## ProfileContacts Import
- Total profile contacts: ${profileContacts.length}
- Successfully imported: ${profileContactsImported}
- Errors: ${profileContactsErrors}

## Links Import
- Total links: ${links.length}
- Successfully imported: ${linksImported}
- Errors: ${linksErrors}

## Videos Import
- Total videos: ${videos.length}
- Successfully imported: ${videosImported}
- Errors: ${videosErrors}
`;

    const reportPath = path.join(outputDir, 'IMPORT_REPORT_CONNECT.md');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📝 Import report written to: ${reportPath}`);

    console.log('\n🎉 Import completed successfully!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importToDatabase()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import failed:', error);
    process.exit(1);
  });
