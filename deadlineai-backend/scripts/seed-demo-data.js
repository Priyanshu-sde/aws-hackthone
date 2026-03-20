import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME || 'deadlineai';
const DEMO_USER = 'demo-user-01';
const now = dayjs();

async function put(item) {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

async function batchPut(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: chunk.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}

function makeDeadline(id, overrides) {
  const deadlineId = id;
  return {
    PK: `USER#${DEMO_USER}`,
    SK: `DEADLINE#${deadlineId}`,
    deadlineId,
    status: 'active',
    reminderSchedule: [],
    remindersDismissed: 0,
    paceModeSessionsCompleted: 0,
    isHardDeadline: true,
    buddyNotified: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

async function seed() {
  console.log('🌱 Seeding demo data for DeadlineAI...\n');

  // 1. Create demo user
  const demoUser = {
    PK: `USER#${DEMO_USER}`,
    SK: 'META',
    userId: DEMO_USER,
    email: 'demo@deadlineai.dev',
    name: 'Arjun Sharma',
    phone: '+919876543210',
    buddyPhone: '+919876543211',
    timezone: 'Asia/Kolkata',
    squads: ['demo-squad-01'],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await put(demoUser);
  console.log('✅ Demo user created: Arjun Sharma (demo-user-01)');

  // 2. Create 12 realistic deadlines
  const deadlines = [
    // --- CLASH: CS301 Midterm + MA201 Assignment due within 1 day, combined weight 35% ---
    makeDeadline('dl-01', {
      title: 'CS301 Midterm Exam',
      courseCode: 'CS301',
      courseName: 'Data Structures & Algorithms',
      type: 'midterm',
      dueDate: now.add(8, 'day').format('YYYY-MM-DD'),
      dueTime: '09:00',
      weight: 25,
      description: 'Covers: arrays, linked lists, trees, graphs, sorting, hashing',
    }),
    makeDeadline('dl-02', {
      title: 'MA201 Assignment 3: Conditional Probability',
      courseCode: 'MA201',
      courseName: 'Probability & Statistics',
      type: 'assignment',
      dueDate: now.add(9, 'day').format('YYYY-MM-DD'),
      dueTime: '23:59',
      weight: 10,
      description: 'Problems on Bayes theorem, conditional distributions, and Markov chains',
    }),

    // --- CRUNCH WEEK: 3 deadlines in same week, stress > 60 ---
    makeDeadline('dl-03', {
      title: 'PH101 Quiz 4: Electromagnetism',
      courseCode: 'PH101',
      courseName: 'Physics I',
      type: 'quiz',
      dueDate: now.add(14, 'day').format('YYYY-MM-DD'),
      dueTime: '14:00',
      weight: 5,
      description: 'Short quiz on Maxwell equations and electromagnetic waves',
    }),
    makeDeadline('dl-04', {
      title: 'EE201 Lab Report: RC Circuits',
      courseCode: 'EE201',
      courseName: 'Electrical Circuits',
      type: 'lab',
      dueDate: now.add(15, 'day').format('YYYY-MM-DD'),
      dueTime: '17:00',
      weight: 8,
      description: 'Lab report on RC circuit transient response analysis',
    }),
    makeDeadline('dl-05', {
      title: 'CS301 Assignment 4: AVL Trees',
      courseCode: 'CS301',
      courseName: 'Data Structures & Algorithms',
      type: 'assignment',
      dueDate: now.add(16, 'day').format('YYYY-MM-DD'),
      dueTime: '23:59',
      weight: 10,
      description: 'Implement AVL tree with insert, delete, and balance operations',
      isHardDeadline: false,
    }),

    // Exam — high weight, triggers stress
    makeDeadline('dl-06', {
      title: 'PH101 End-Semester Exam',
      courseCode: 'PH101',
      courseName: 'Physics I',
      type: 'exam',
      dueDate: now.add(15, 'day').format('YYYY-MM-DD'),
      dueTime: '09:00',
      weight: 40,
      description: 'Comprehensive exam: mechanics, thermodynamics, electromagnetism, optics',
    }),

    // More spread out deadlines
    makeDeadline('dl-07', {
      title: 'MA201 Quiz 3: Random Variables',
      courseCode: 'MA201',
      courseName: 'Probability & Statistics',
      type: 'quiz',
      dueDate: now.add(5, 'day').format('YYYY-MM-DD'),
      dueTime: '10:00',
      weight: 5,
      description: 'Quiz on discrete and continuous random variables',
    }),
    makeDeadline('dl-08', {
      title: 'CS301 Project: Graph Visualizer',
      courseCode: 'CS301',
      courseName: 'Data Structures & Algorithms',
      type: 'project',
      dueDate: now.add(30, 'day').format('YYYY-MM-DD'),
      dueTime: '23:59',
      weight: 15,
      description: 'Build an interactive graph algorithm visualizer (BFS, DFS, Dijkstra, MST)',
    }),
    makeDeadline('dl-09', {
      title: 'EE201 Midterm Exam',
      courseCode: 'EE201',
      courseName: 'Electrical Circuits',
      type: 'midterm',
      dueDate: now.add(22, 'day').format('YYYY-MM-DD'),
      dueTime: '09:00',
      weight: 20,
      description: 'KCL, KVL, Thevenin/Norton, AC circuit analysis',
    }),
    makeDeadline('dl-10', {
      title: 'MA201 Assignment 4: Hypothesis Testing',
      courseCode: 'MA201',
      courseName: 'Probability & Statistics',
      type: 'assignment',
      dueDate: now.add(25, 'day').format('YYYY-MM-DD'),
      dueTime: '23:59',
      weight: 10,
      description: 'Problems on t-tests, chi-squared tests, p-values',
    }),
    makeDeadline('dl-11', {
      title: 'EE201 Assignment 2: AC Analysis',
      courseCode: 'EE201',
      courseName: 'Electrical Circuits',
      type: 'assignment',
      dueDate: now.add(12, 'day').format('YYYY-MM-DD'),
      dueTime: '23:59',
      weight: 8,
      description: 'Phasor analysis and impedance calculations for RLC circuits',
    }),
    makeDeadline('dl-12', {
      title: 'CS301 Presentation: Sorting Comparison',
      courseCode: 'CS301',
      courseName: 'Data Structures & Algorithms',
      type: 'presentation',
      dueDate: now.add(35, 'day').format('YYYY-MM-DD'),
      dueTime: '14:00',
      weight: 5,
      description: 'Group presentation comparing sorting algorithm performance',
    }),
  ];

  await batchPut(deadlines);
  console.log(`✅ ${deadlines.length} deadlines created across 4 courses\n`);

  // Verify clash exists
  const dl01 = deadlines.find((d) => d.deadlineId === 'dl-01');
  const dl02 = deadlines.find((d) => d.deadlineId === 'dl-02');
  const daysBetween = Math.abs(dayjs(dl01.dueDate).diff(dayjs(dl02.dueDate), 'day'));
  const combinedWeight = dl01.weight + dl02.weight;
  console.log(`📋 Clash check: CS301 Midterm (${dl01.dueDate}) vs MA201 Assignment (${dl02.dueDate})`);
  console.log(`   Days between: ${daysBetween}, Combined weight: ${combinedWeight}%`);
  console.log(`   Clash detected: ${daysBetween <= 2 && combinedWeight >= 20 ? '✅ YES' : '❌ NO'}\n`);

  // Verify crunch week
  const crunchWeekStart = now.add(14, 'day');
  const crunchWeekEnd = now.add(16, 'day');
  const crunchDeadlines = deadlines.filter((d) => {
    const date = dayjs(d.dueDate);
    return date.isAfter(crunchWeekStart.subtract(1, 'day')) && date.isBefore(crunchWeekEnd.add(1, 'day'));
  });
  const typeMultiplier = { exam: 2.0, midterm: 1.8, quiz: 0.8, assignment: 1.0, lab: 0.7, project: 1.5, presentation: 1.2 };
  const stressScore = crunchDeadlines.reduce((sum, d) => {
    return sum + (d.weight || 10) * (typeMultiplier[d.type] || 1.0);
  }, 0);
  console.log(`📋 Crunch week check (${crunchWeekStart.format('YYYY-MM-DD')} to ${crunchWeekEnd.format('YYYY-MM-DD')}):`);
  console.log(`   Deadlines in window: ${crunchDeadlines.length}`);
  crunchDeadlines.forEach((d) => console.log(`     - ${d.title} (${d.type}, ${d.weight}%)`));
  console.log(`   Stress score: ${stressScore.toFixed(1)}`);
  console.log(`   Crunch detected: ${stressScore > 60 ? '✅ YES' : '❌ NO'}\n`);

  // 3. Create demo squad
  const squadMeta = {
    PK: 'SQUAD#demo-squad-01',
    SK: 'META',
    squadId: 'demo-squad-01',
    name: 'CS301 Study Group',
    inviteCode: 'DEMO01',
    createdBy: DEMO_USER,
    memberCount: 3,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await put(squadMeta);

  const members = [
    { userId: DEMO_USER, displayName: 'Arjun Sharma' },
    { userId: 'demo-user-02', displayName: 'Priya Patel' },
    { userId: 'demo-user-03', displayName: 'Rahul Verma' },
  ];

  for (const m of members) {
    await put({
      PK: 'SQUAD#demo-squad-01',
      SK: `MEMBER#${m.userId}`,
      squadId: 'demo-squad-01',
      userId: m.userId,
      displayName: m.displayName,
      joinedAt: now.toISOString(),
    });
  }

  console.log('✅ Demo squad created: CS301 Study Group (DEMO01)');
  console.log(`   Members: ${members.map((m) => m.displayName).join(', ')}\n`);

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('🎉 Demo data seeding complete!');
  console.log('═══════════════════════════════════════════');
  console.log(`  User:      ${demoUser.name} (${DEMO_USER})`);
  console.log(`  Deadlines: ${deadlines.length}`);
  console.log(`  Courses:   CS301, MA201, PH101, EE201`);
  console.log(`  Clashes:   1 (CS301 Midterm + MA201 Assignment)`);
  console.log(`  Crunch:    1 week with stress > 60`);
  console.log(`  Squad:     CS301 Study Group (code: DEMO01)`);
  console.log('═══════════════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
