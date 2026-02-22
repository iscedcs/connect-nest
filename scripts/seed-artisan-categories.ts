import 'dotenv/config';
import { PrismaClient } from 'src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    name: 'Beauty & Grooming',
    slug: 'beauty-grooming',
    icon: '✂️',
    description: 'Barbers, hairstylists, makeup artists, nail technicians',
    order: 1,
  },
  {
    name: 'Fashion & Tailoring',
    slug: 'fashion-tailoring',
    icon: '👗',
    description: 'Tailors, fashion designers, shoe makers',
    order: 2,
  },
  {
    name: 'Photography & Videography',
    slug: 'photography-videography',
    icon: '📷',
    description: 'Photographers, videographers, editors',
    order: 3,
  },
  {
    name: 'Food & Catering',
    slug: 'food-catering',
    icon: '🍽️',
    description: 'Caterers, bakers, chefs, meal prep',
    order: 4,
  },
  {
    name: 'Home Services',
    slug: 'home-services',
    icon: '🏠',
    description: 'Plumbers, electricians, painters, cleaners',
    order: 5,
  },
  {
    name: 'Technology & Digital',
    slug: 'technology-digital',
    icon: '💻',
    description: 'Web developers, graphic designers, IT support',
    order: 6,
  },
  {
    name: 'Events & Entertainment',
    slug: 'events-entertainment',
    icon: '🎵',
    description: 'DJs, MCs, event planners, decorators',
    order: 7,
  },
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    icon: '💆',
    description: 'Fitness trainers, masseuses, nutritionists',
    order: 8,
  },
  {
    name: 'Education & Tutoring',
    slug: 'education-tutoring',
    icon: '📚',
    description: 'Tutors, music teachers, language instructors',
    order: 9,
  },
  {
    name: 'Automotive',
    slug: 'automotive',
    icon: '🚗',
    description: 'Mechanics, auto detailers, panel beaters',
    order: 10,
  },
  {
    name: 'Crafts & Artworks',
    slug: 'crafts-artworks',
    icon: '🎨',
    description: 'Woodworkers, ceramics, painters, sculptors',
    order: 11,
  },
  {
    name: 'Logistics & Delivery',
    slug: 'logistics-delivery',
    icon: '🚚',
    description: 'Dispatch riders, movers, courier services',
    order: 12,
  },
  {
    name: 'Others',
    slug: 'others',
    icon: '📋',
    description: 'Catch-all — requires a custom category text field',
    order: 13,
  },
];

async function main() {
  console.log('Seeding artisan categories...');

  for (const cat of categories) {
    await prisma.artisanCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        order: cat.order,
      },
      create: cat,
    });
    console.log(`  ✓ ${cat.name}`);
  }

  console.log(`\nSeeded ${categories.length} artisan categories.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
