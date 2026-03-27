-- Seed content for demo: Velo — a fictional project management company
-- This makes the template look like a real company site out of the box

DELETE FROM posts;
DELETE FROM categories;

INSERT INTO categories (name, slug) VALUES ('Product', 'product');
INSERT INTO categories (name, slug) VALUES ('Engineering', 'engineering');
INSERT INTO categories (name, slug) VALUES ('Company', 'company');
INSERT INTO categories (name, slug) VALUES ('Customers', 'customers');

INSERT INTO posts (title, slug, content, excerpt, category_id, tags, published, published_at) VALUES (
  'Introducing Velo 2.0: Built for the Way Teams Actually Work',
  'introducing-velo-2',
  '## A New Chapter\n\nToday we are launching Velo 2.0, the biggest update since we started the company. This release is the result of 14 months of research, 200+ customer interviews, and a complete rethink of how teams manage projects.\n\n## What''s New\n\n### Timeline View\n\nSee your entire project on a visual timeline. Drag tasks to reschedule, spot conflicts before they happen, and share a clear picture with stakeholders.\n\n### Smart Assignments\n\nVelo now suggests who should own a task based on workload, expertise, and availability. No more guessing or unbalanced sprints.\n\n### Instant Reports\n\nGenerate a project status report in one click. Velo pulls together progress, blockers, and team velocity into a clean summary you can share with anyone.\n\n### Real-Time Collaboration\n\nEvery view updates live. When a teammate moves a task, marks something complete, or adds a comment, you see it instantly. No refresh needed.\n\n## Why This Matters\n\nProject management tools have been stuck in a rut. They either overwhelm you with features or oversimplify until they are useless for real work. Velo 2.0 hits the middle — powerful enough for complex projects, simple enough that your whole team actually uses it.\n\n## Available Now\n\nVelo 2.0 is live for all customers on Growth and Enterprise plans. Starter plans will be upgraded automatically next week.\n\n[Sign up for free](https://velo.example.com) and see for yourself.',
  'Velo 2.0 brings timeline views, smart assignments, instant reports, and real-time collaboration to every team.',
  (SELECT id FROM categories WHERE slug = 'product'),
  '["launch", "product", "2.0"]',
  TRUE,
  '2026-03-25 10:00:00'
);

INSERT INTO posts (title, slug, content, excerpt, category_id, tags, published, published_at) VALUES (
  'How We Scaled to 1 Million Tasks Per Day',
  'scaling-one-million-tasks',
  '## The Challenge\n\nWhen Velo hit 10,000 teams, our database started showing the strain. Queries that took 5ms were suddenly taking 500ms. Task creation was backing up. We needed to fix this before our customers noticed.\n\n## What We Did\n\n### Step 1: Measure Everything\n\nBefore optimizing anything, we instrumented every database query, every API call, every background job. You cannot fix what you cannot see.\n\n### Step 2: Separate Reads and Writes\n\nWe split our database into a primary (writes) and two replicas (reads). Dashboard queries, search, and reporting all moved to replicas. This alone cut primary load by 60%.\n\n### Step 3: Background Processing\n\nNotifications, webhook deliveries, and analytics events moved to a job queue. The API responds immediately and the work happens asynchronously.\n\n### Step 4: Smart Caching\n\nWe cache project metadata, team membership, and permission checks. Cache invalidation is event-driven — when something changes, we invalidate only the affected keys.\n\n## The Results\n\n- **API p99 latency:** 500ms to 45ms\n- **Task creation throughput:** 50/sec to 3,000/sec\n- **Database CPU:** 90% to 25%\n- **Zero downtime** during the entire migration\n\n## Lessons Learned\n\n1. Measure before you optimize\n2. The simplest solution is usually the right one\n3. Your users do not care about your architecture — they care about speed\n\nWe are now processing over 1 million tasks per day across all customers, and the system has headroom to grow 10x.',
  'A behind-the-scenes look at how we re-architected Velo to handle 1 million tasks per day without breaking a sweat.',
  (SELECT id FROM categories WHERE slug = 'engineering'),
  '["infrastructure", "scaling", "performance"]',
  TRUE,
  '2026-03-20 09:00:00'
);

INSERT INTO posts (title, slug, content, excerpt, category_id, tags, published, published_at) VALUES (
  'Velo Raises $18M Series A to Reinvent Team Productivity',
  'series-a-announcement',
  '## The News\n\nWe are thrilled to announce that Velo has raised $18 million in Series A funding led by Craft Ventures, with participation from Y Combinator, Founders Fund, and several angel investors who are also Velo customers.\n\n## What This Means\n\nThis funding lets us do three things:\n\n### 1. Hire World-Class Engineers\n\nWe are growing the engineering team from 8 to 25 over the next 12 months. We are hiring across backend, frontend, infrastructure, and machine learning.\n\n### 2. Launch Velo Enterprise\n\nLarger companies need SSO, audit logs, advanced permissions, and dedicated support. Velo Enterprise will ship in Q3.\n\n### 3. Go Global\n\nWe are adding EU data residency, multi-language support, and opening an office in London.\n\n## Our Philosophy\n\nWe believe project management should adapt to your team, not the other way around. Too many tools force you into a specific methodology — Scrum, Kanban, Waterfall. Velo works however you work.\n\n## Thank You\n\nTo our 12,000 teams who use Velo every day — this funding is because of you. Your feedback, your patience with early bugs, and your willingness to tell colleagues about us. We will not let you down.\n\n## We''re Hiring\n\nIf you want to build the future of how teams work together, check out our [careers page](https://velo.example.com/careers).',
  'Velo has raised $18M in Series A funding to expand the team, launch enterprise features, and go global.',
  (SELECT id FROM categories WHERE slug = 'company'),
  '["funding", "announcement", "hiring"]',
  TRUE,
  '2026-03-15 08:00:00'
);

INSERT INTO posts (title, slug, content, excerpt, category_id, tags, published, published_at) VALUES (
  'How Northstar Design Agency Cut Project Delivery Time by 40%',
  'case-study-northstar',
  '## About Northstar\n\nNorthstar is a 45-person design agency in Austin, TX. They work with Fortune 500 brands on product design, web experiences, and brand identity.\n\n## The Problem\n\nBefore Velo, Northstar used a combination of spreadsheets, Slack threads, and a legacy project management tool. Information was scattered. Deadlines were missed. Creative directors spent more time tracking work than doing it.\n\n## The Solution\n\nNorthstar migrated to Velo in January 2026. Here is what changed:\n\n### Centralized Project Hubs\n\nEvery client project has a single Velo workspace. Briefs, tasks, timelines, and feedback all live in one place. No more digging through email.\n\n### Client-Facing Views\n\nNorthstar uses Velo''s shared views to give clients real-time visibility into project progress. Clients log in, see the timeline, leave comments — no status meetings needed.\n\n### Automated Workflows\n\nWhen a design is marked "ready for review," Velo automatically notifies the client, creates a feedback task, and updates the timeline. The team set this up in 10 minutes.\n\n## The Results\n\n- **40% faster delivery** — average project completion went from 6 weeks to 3.5 weeks\n- **3 hours saved per week** per creative director on status tracking\n- **Client satisfaction up 25%** — measured via post-project surveys\n- **Zero missed deadlines** since adopting Velo\n\n## In Their Words\n\n*"Velo replaced four tools and a whiteboard. Our team actually enjoys managing projects now, which I never thought I would say."*\n— Sarah Chen, Managing Director, Northstar Design',
  'How a 45-person design agency used Velo to cut project delivery time by 40% and eliminate missed deadlines.',
  (SELECT id FROM categories WHERE slug = 'customers'),
  '["case-study", "agency", "design"]',
  TRUE,
  '2026-03-10 09:00:00'
);

INSERT INTO posts (title, slug, content, excerpt, category_id, tags, published, published_at) VALUES (
  'Why We Chose MySQL Over PostgreSQL (And Would Do It Again)',
  'why-we-chose-mysql',
  '## The Debate\n\nEvery startup has this debate. PostgreSQL has better types, better JSON support, better everything according to Hacker News. So why did we choose MySQL?\n\n## Our Reasoning\n\n### 1. Operational Simplicity\n\nMySQL is boring technology, and boring is good. Replication is straightforward. Backups are well-understood. Every hosting provider supports it. Every ORM supports it. Every monitoring tool supports it.\n\n### 2. Performance at Our Scale\n\nFor our workload — high-volume reads, moderate writes, simple joins — MySQL with InnoDB is exceptionally fast. We benchmarked both databases with our actual query patterns and MySQL was 15-20% faster for our use case.\n\n### 3. Ecosystem\n\nThe MySQL ecosystem is massive. ProxySQL for connection pooling. Vitess for sharding if we ever need it. Percona Toolkit for maintenance. These are battle-tested tools used by companies like GitHub, Shopify, and Airbnb.\n\n### 4. Talent Pool\n\nMore engineers know MySQL. When we hire, we spend less time on database onboarding and more time on product work.\n\n## What We Would Do Differently\n\nWe would use `utf8mb4` from day one instead of `utf8`. We learned that the hard way when a customer tried to use emoji in a project name.\n\n## The Point\n\nThe best database is the one your team knows, your infrastructure supports, and your workload fits. For us, that is MySQL. For you, it might be something else. The important thing is to choose based on your actual needs, not internet opinions.',
  'A practical look at why we chose MySQL for Velo and what we learned along the way.',
  (SELECT id FROM categories WHERE slug = 'engineering'),
  '["mysql", "database", "architecture"]',
  TRUE,
  '2026-03-05 09:00:00'
)
