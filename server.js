const express = require('express');
const mysql = require('mysql2/promise');
const { migrate } = require('./migrate');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SITE_NAME = process.env.SITE_NAME || 'The Velo Blog';
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple markdown renderer
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Lists
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> items in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs - wrap lines that aren't already wrapped in tags
  const lines = html.split('\n');
  const result = [];
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push(''); continue; }
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') ||
        trimmed.startsWith('<pre') || trimmed.startsWith('<hr') || trimmed.startsWith('<li') ||
        trimmed.startsWith('</')) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  return result.join('\n');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Helper: estimate reading time from content (~200 words/min)
function readingTime(text) {
  if (!text) return '1 min read';
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

// Category color mapping for visual variety
const categoryColors = {
  product:     { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' },
  engineering: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  company:     { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  customers:   { bg: '#fce7f3', text: '#db2777', border: '#fbcfe8' },
};
function getCategoryColor(slug) {
  return categoryColors[slug] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
}

// Layout wrapper
function layout(title, content, options = {}) {
  const { description = '', ogType = 'website', ogImage = '', isAdmin = false } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${SITE_NAME}</title>
  <meta name="description" content="${description || title}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description || title}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${SITE_NAME}">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
  <link rel="alternate" type="application/rss+xml" title="${SITE_NAME} RSS" href="/rss">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7; color: #0f172a; background: #f8fafc;
    }
    a { color: #6366f1; text-decoration: none; transition: color 0.2s; }
    a:hover { color: #4338ca; }

    /* ---- Navigation ---- */
    .site-nav {
      background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0;
      position: sticky; top: 0; z-index: 100;
      backdrop-filter: blur(12px); background: rgba(255,255,255,0.92);
    }
    .site-nav .nav-inner {
      max-width: 1100px; margin: 0 auto; padding: 0 32px;
      display: flex; align-items: center; justify-content: space-between;
      height: 64px;
    }
    .site-nav .logo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px; font-weight: 700; color: #0f172a;
      letter-spacing: -0.02em;
    }
    .site-nav .logo:hover { color: #6366f1; }
    .site-nav nav { display: flex; align-items: center; gap: 8px; }
    .site-nav nav a {
      font-size: 14px; color: #64748b; font-weight: 500;
      padding: 8px 16px; border-radius: 8px; transition: all 0.2s;
    }
    .site-nav nav a:hover { color: #0f172a; background: #f1f5f9; }
    .site-nav nav a.nav-rss {
      border: 1px solid #e2e8f0; color: #6366f1; font-weight: 600;
    }
    .site-nav nav a.nav-rss:hover { background: #6366f1; color: #fff; border-color: #6366f1; }

    /* ---- Hero ---- */
    .hero {
      background: linear-gradient(135deg, #0f172a 0%, #312e81 50%, #4f46e5 100%);
      padding: 80px 32px 72px; text-align: center; position: relative; overflow: hidden;
    }
    .hero::before {
      content: ''; position: absolute; top: -50%; left: -50%;
      width: 200%; height: 200%;
      background: radial-gradient(circle at 30% 70%, rgba(99,102,241,0.15) 0%, transparent 50%),
                  radial-gradient(circle at 70% 30%, rgba(139,92,246,0.1) 0%, transparent 50%);
    }
    .hero-content { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
    .hero h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px; font-weight: 800; color: #fff;
      line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 16px;
    }
    .hero p {
      font-size: 18px; color: rgba(255,255,255,0.7); line-height: 1.6;
      max-width: 520px; margin: 0 auto;
    }

    /* ---- Container ---- */
    .container { max-width: 1100px; margin: 0 auto; padding: 0 32px; }
    .container--narrow { max-width: 780px; }

    /* ---- Main ---- */
    main { padding: 48px 0 80px; min-height: 60vh; }

    /* ---- Category Filter Bar ---- */
    .category-bar {
      display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 40px;
      padding-bottom: 24px; border-bottom: 1px solid #e2e8f0;
    }
    .category-bar a {
      padding: 8px 20px; background: #fff; border: 1px solid #e2e8f0;
      border-radius: 100px; font-size: 14px; font-weight: 500; color: #64748b;
      transition: all 0.2s; white-space: nowrap;
    }
    .category-bar a:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
    .category-bar a.active {
      background: #6366f1; color: #fff; border-color: #6366f1;
      box-shadow: 0 2px 8px rgba(99,102,241,0.3);
    }

    /* ---- Post Card Grid ---- */
    .post-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;
    }
    .post-card {
      background: #fff; border-radius: 16px; padding: 32px;
      border: 1px solid #e2e8f0; transition: all 0.3s ease;
      display: flex; flex-direction: column;
    }
    .post-card:hover {
      box-shadow: 0 12px 40px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04);
      transform: translateY(-2px); border-color: #c7d2fe;
    }
    .post-card-top { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .post-card .category-pill {
      display: inline-block; padding: 4px 12px; border-radius: 100px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.02em;
      border: 1px solid transparent;
    }
    .post-card h2 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px; font-weight: 700; line-height: 1.3;
      margin-bottom: 12px; letter-spacing: -0.01em;
    }
    .post-card h2 a { color: #0f172a; }
    .post-card h2 a:hover { color: #6366f1; }
    .post-card .post-excerpt {
      color: #64748b; font-size: 15px; line-height: 1.7;
      margin-bottom: 20px; flex-grow: 1;
    }
    .post-card-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 16px; border-top: 1px solid #f1f5f9;
      font-size: 13px; color: #94a3b8;
    }
    .post-card-footer .date-time { display: flex; align-items: center; gap: 8px; }
    .post-card-footer .dot { width: 3px; height: 3px; border-radius: 50%; background: #cbd5e1; }
    .post-card .tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .post-card .tag {
      background: #f1f5f9; color: #64748b; padding: 2px 10px; border-radius: 100px;
      font-size: 11px; font-weight: 500; letter-spacing: 0.01em;
    }

    /* ---- Single Post ---- */
    .post-header {
      text-align: center; padding: 56px 0 40px; max-width: 720px; margin: 0 auto;
    }
    .post-header .category-pill {
      display: inline-block; padding: 6px 16px; border-radius: 100px;
      font-size: 13px; font-weight: 600; margin-bottom: 20px;
    }
    .post-header h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 44px; font-weight: 800; line-height: 1.2;
      color: #0f172a; letter-spacing: -0.02em; margin-bottom: 20px;
    }
    .post-header .post-meta-line {
      font-size: 15px; color: #94a3b8; display: flex; align-items: center;
      justify-content: center; gap: 12px;
    }
    .post-header .post-meta-line .dot { width: 4px; height: 4px; border-radius: 50%; background: #cbd5e1; }
    .post-content {
      background: #fff; border-radius: 20px; padding: 56px 64px;
      border: 1px solid #e2e8f0; max-width: 780px; margin: 0 auto;
      box-shadow: 0 1px 3px rgba(15,23,42,0.04);
    }
    .post-content h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 36px; margin-bottom: 16px; line-height: 1.3; color: #0f172a; }
    .post-content h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; margin: 40px 0 16px; color: #0f172a; font-weight: 700; }
    .post-content h3 { font-size: 20px; margin: 32px 0 12px; color: #1e293b; font-weight: 600; }
    .post-content p { margin: 20px 0; color: #334155; font-size: 18px; line-height: 1.8; }
    .post-content ul, .post-content ol { margin: 20px 0 20px 28px; }
    .post-content li { margin: 8px 0; color: #334155; font-size: 18px; line-height: 1.8; }
    .post-content code { background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-size: 15px; color: #6366f1; }
    .post-content pre { background: #0f172a; color: #e2e8f0; padding: 24px; border-radius: 12px; overflow-x: auto; margin: 28px 0; }
    .post-content pre code { background: none; color: inherit; padding: 0; }
    .post-content hr { border: none; border-top: 1px solid #e2e8f0; margin: 40px 0; }
    .post-content a { color: #6366f1; border-bottom: 1px solid rgba(99,102,241,0.3); transition: border-color 0.2s; }
    .post-content a:hover { border-bottom-color: #6366f1; }
    .post-content strong { font-weight: 600; color: #0f172a; }
    .post-content blockquote {
      border-left: 3px solid #6366f1; padding: 16px 24px; margin: 28px 0;
      background: #f8fafc; border-radius: 0 12px 12px 0;
    }
    .post-content blockquote p { color: #475569; font-style: italic; }

    .back-link {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 48px; font-size: 15px; font-weight: 500; color: #6366f1;
    }
    .back-link:hover { color: #4338ca; }

    /* ---- Footer ---- */
    footer {
      background: #0f172a; padding: 48px 0; text-align: center; margin-top: 40px;
    }
    footer .footer-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 12px;
    }
    footer .footer-powered {
      font-size: 14px; color: #64748b;
    }
    footer .footer-powered a { color: #818cf8; }
    footer .footer-powered a:hover { color: #a5b4fc; }
    footer .footer-copy { font-size: 13px; color: #475569; margin-top: 8px; }

    /* ---- Buttons ---- */
    .btn { display: inline-block; padding: 10px 24px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn:hover { background: #4338ca; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
    .btn-danger { background: #ef4444; }
    .btn-danger:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
    .btn-sm { padding: 6px 16px; font-size: 13px; }

    /* ---- Admin styles ---- */
    .admin-header { background: #0f172a !important; border-bottom-color: #1e293b !important; }
    .admin-header .logo { color: #fff !important; }
    .admin-header nav a { color: #94a3b8 !important; }
    .admin-header nav a:hover { color: #fff !important; background: #1e293b !important; }
    .admin-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .admin-table th { background: #f8fafc; text-align: left; padding: 14px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .admin-table td { padding: 14px 16px; border-top: 1px solid #f1f5f9; font-size: 15px; }
    .admin-table tr:hover td { background: #f8fafc; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
      font-size: 15px; font-family: inherit; background: #fff; color: #0f172a;
      transition: all 0.2s;
    }
    .form-group textarea { min-height: 300px; line-height: 1.6; }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
      outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
    }
    .login-box { max-width: 400px; margin: 80px auto; background: #fff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(15,23,42,0.06); }
    .login-box h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; text-align: center; margin-bottom: 24px; color: #0f172a; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
    .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .page-title { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; margin-bottom: 8px; color: #0f172a; }
    .page-subtitle { color: #64748b; font-size: 16px; margin-bottom: 32px; }
    .checkbox-group { display: flex; align-items: center; gap: 8px; }
    .checkbox-group input[type="checkbox"] { width: auto; }
    .actions { display: flex; gap: 8px; }
    .empty-state {
      text-align: center; padding: 64px 24px; color: #94a3b8;
      grid-column: 1 / -1;
    }
    .empty-state p { font-size: 16px; }

    /* ---- Responsive ---- */
    @media (max-width: 768px) {
      .hero { padding: 56px 24px 48px; }
      .hero h1 { font-size: 32px; }
      .hero p { font-size: 16px; }
      .post-grid { grid-template-columns: 1fr; }
      .post-content { padding: 32px 24px; }
      .post-header h1 { font-size: 32px; }
      .site-nav .nav-inner { padding: 0 20px; }
      .container { padding: 0 20px; }
    }
    @media (max-width: 480px) {
      .site-nav .nav-inner { height: 56px; }
      .site-nav nav a { padding: 6px 12px; font-size: 13px; }
      .post-card { padding: 24px; }
      .post-card h2 { font-size: 20px; }
      .hero h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <header class="site-nav${isAdmin ? ' admin-header' : ''}">
    <div class="nav-inner">
      <a href="${isAdmin ? '/admin' : '/'}" class="logo">${isAdmin ? 'Blog Admin' : SITE_NAME}</a>
      <nav>
        ${isAdmin ? `
          <a href="/admin">Posts</a>
          <a href="/admin/categories">Categories</a>
          <a href="/" target="_blank">View Blog</a>
          <a href="/admin/logout">Logout</a>
        ` : `
          <a href="/">Home</a>
          <a href="/rss" class="nav-rss">RSS</a>
        `}
      </nav>
    </div>
  </header>
  ${isAdmin ? `<main><div class="container">${content}</div></main>` : content}
  <footer>
    <div class="container">
      <div class="footer-name">${SITE_NAME}</div>
      <div class="footer-powered">Powered by <a href="https://dailey.cloud">Dailey OS</a> &middot; <a href="/admin">Admin</a></div>
      <div class="footer-copy">&copy; ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.</div>
    </div>
  </footer>
</body>
</html>`;
}

// Admin auth middleware
function adminAuth(req, res, next) {
  if (req.headers.cookie && req.headers.cookie.includes('blog_admin=1')) {
    return next();
  }
  res.redirect('/admin/login');
}

// =====================
// PUBLIC ROUTES
// =====================

// Home page — list published posts
app.get('/', async (req, res) => {
  try {
    const db = await getPool();
    const category = req.query.category || null;
    let query = `SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.published = TRUE`;
    const params = [];
    if (category) {
      query += ' AND c.slug = ?';
      params.push(category);
    }
    query += ' ORDER BY p.published_at DESC';
    const [posts] = await db.execute(query, params);
    const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');

    const postsHtml = posts.map(p => {
      const tags = (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) || [];
      const date = p.published_at ? new Date(p.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const rTime = readingTime(p.content);
      const cc = getCategoryColor(p.category_slug);
      return `
        <article class="post-card">
          <div class="post-card-top">
            ${p.category_name ? `<span class="category-pill" style="background:${cc.bg};color:${cc.text};border-color:${cc.border};">${p.category_name}</span>` : ''}
          </div>
          <h2><a href="/post/${p.slug}">${p.title}</a></h2>
          <p class="post-excerpt">${p.excerpt || ''}</p>
          <div class="post-card-footer">
            <div class="date-time">
              <span>${date}</span>
              <span class="dot"></span>
              <span>${rTime}</span>
            </div>
            ${tags.length > 0 ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
          </div>
        </article>`;
    }).join('');

    const categoryLinks = categories.map(c =>
      `<a href="/?category=${c.slug}" class="${category === c.slug ? 'active' : ''}">${c.name}</a>`
    ).join('');

    const heroHtml = `
      <section class="hero">
        <div class="hero-content">
          <h1>${SITE_NAME}</h1>
          <p>Product updates, engineering deep-dives, and company news</p>
        </div>
      </section>`;

    const contentHtml = `
      <main>
        <div class="container">
          <div class="category-bar">
            <a href="/" class="${!category ? 'active' : ''}">All Posts</a>
            ${categoryLinks}
          </div>
          <div class="post-grid">
            ${posts.length > 0 ? postsHtml : '<div class="empty-state"><p>No posts yet. Check back soon.</p></div>'}
          </div>
        </div>
      </main>`;

    const html = heroHtml + contentHtml;
    res.send(layout(SITE_NAME, html, { description: 'Thoughts, tutorials, and insights' }));
  } catch (err) {
    console.error(err);
    res.status(500).send(layout('Error', '<main><div class="container"><p>Something went wrong.</p></div></main>'));
  }
});

// Single post
app.get('/post/:slug', async (req, res) => {
  try {
    const db = await getPool();
    const [posts] = await db.execute(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM posts p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = ? AND p.published = TRUE`, [req.params.slug]
    );
    if (posts.length === 0) return res.status(404).send(layout('Not Found', '<main><div class="container"><p style="text-align:center;padding:64px 0;color:#94a3b8;">Post not found.</p></div></main>'));
    const p = posts[0];
    const tags = (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) || [];
    const date = p.published_at ? new Date(p.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const rTime = readingTime(p.content);
    const cc = getCategoryColor(p.category_slug);
    const html = `
      <main>
        <div class="container container--narrow">
          <div class="post-header">
            ${p.category_name ? `<span class="category-pill" style="background:${cc.bg};color:${cc.text};">${p.category_name}</span>` : ''}
            <h1>${p.title}</h1>
            <div class="post-meta-line">
              <span>${date}</span>
              <span class="dot"></span>
              <span>${rTime}</span>
            </div>
          </div>
          <article class="post-content">
            ${renderMarkdown(p.content)}
          </article>
          <a href="/" class="back-link">&larr; Back to all posts</a>
        </div>
      </main>`;
    res.send(layout(p.title, html, { description: p.excerpt || '', ogType: 'article' }));
  } catch (err) {
    console.error(err);
    res.status(500).send(layout('Error', '<main><div class="container"><p>Something went wrong.</p></div></main>'));
  }
});

// RSS Feed
app.get('/rss', async (req, res) => {
  try {
    const db = await getPool();
    const [posts] = await db.execute(
      `SELECT p.*, c.name as category_name FROM posts p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.published = TRUE ORDER BY p.published_at DESC LIMIT 20`
    );
    const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE_URL}/post/${p.slug}</link>
      <guid>${SITE_URL}/post/${p.slug}</guid>
      <description><![CDATA[${p.excerpt || ''}]]></description>
      ${p.category_name ? `<category>${p.category_name}</category>` : ''}
      <pubDate>${p.published_at ? new Date(p.published_at).toUTCString() : ''}</pubDate>
    </item>`).join('');

    res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>Thoughts, tutorials, and insights</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating RSS');
  }
});

// =====================
// ADMIN ROUTES
// =====================

app.get('/admin/login', (req, res) => {
  const error = req.query.error ? '<div class="alert alert-error">Invalid password.</div>' : '';
  res.send(layout('Login', `
    <div class="login-box">
      <h1>Admin Login</h1>
      ${error}
      <form method="POST" action="/admin/login">
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required autofocus>
        </div>
        <button type="submit" class="btn" style="width:100%;">Log In</button>
      </form>
    </div>`, { isAdmin: true }));
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', 'blog_admin=1; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

app.get('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'blog_admin=; Path=/; HttpOnly; Max-Age=0');
  res.redirect('/admin/login');
});

// Admin: list posts
app.get('/admin', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const [posts] = await db.execute(
      `SELECT p.*, c.name as category_name FROM posts p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC`
    );
    const success = req.query.success ? `<div class="alert alert-success">${req.query.success}</div>` : '';
    const rows = posts.map(p => {
      const date = new Date(p.created_at).toLocaleDateString();
      return `<tr>
        <td><a href="/admin/posts/${p.id}/edit">${p.title}</a></td>
        <td>${p.category_name || '—'}</td>
        <td>${p.published ? '<span style="color:#2d6a4f;">Published</span>' : '<span style="color:#888;">Draft</span>'}</td>
        <td>${date}</td>
        <td class="actions">
          <a href="/admin/posts/${p.id}/edit" class="btn btn-sm">Edit</a>
          <form method="POST" action="/admin/posts/${p.id}/delete" style="display:inline;" onsubmit="return confirm('Delete this post?')">
            <button type="submit" class="btn btn-sm btn-danger">Delete</button>
          </form>
        </td>
      </tr>`;
    }).join('');

    res.send(layout('Posts', `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h1 class="page-title">Posts</h1>
        <a href="/admin/posts/new" class="btn">New Post</a>
      </div>
      ${success}
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:40px;color:#888;">No posts yet.</td></tr>'}</tbody>
      </table>`, { isAdmin: true }));
  } catch (err) {
    console.error(err);
    res.status(500).send(layout('Error', '<p>Something went wrong.</p>', { isAdmin: true }));
  }
});

// Admin: new post form
app.get('/admin/posts/new', adminAuth, async (req, res) => {
  const db = await getPool();
  const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');
  const catOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  res.send(layout('New Post', postForm({ catOptions }), { isAdmin: true }));
});

// Admin: create post
app.post('/admin/posts', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const { title, content, excerpt, category_id, tags, published } = req.body;
    const slug = slugify(title);
    const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const isPublished = published === 'on' ? 1 : 0;
    await db.execute(
      `INSERT INTO posts (title, slug, content, excerpt, category_id, tags, published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, content, excerpt || null, category_id || null, JSON.stringify(tagsArr), isPublished, isPublished ? new Date() : null]
    );
    res.redirect('/admin?success=Post+created');
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=1');
  }
});

// Admin: edit post form
app.get('/admin/posts/:id/edit', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const [posts] = await db.execute('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (posts.length === 0) return res.redirect('/admin');
    const p = posts[0];
    const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');
    const catOptions = categories.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.name}</option>`).join('');
    const tags = (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) || [];
    res.send(layout('Edit Post', postForm({
      catOptions, action: `/admin/posts/${p.id}`, post: p, tags: tags.join(', '), isEdit: true
    }), { isAdmin: true }));
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// Admin: update post
app.post('/admin/posts/:id', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const { title, content, excerpt, category_id, tags, published } = req.body;
    const slug = slugify(title);
    const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const isPublished = published === 'on' ? 1 : 0;
    await db.execute(
      `UPDATE posts SET title=?, slug=?, content=?, excerpt=?, category_id=?, tags=?, published=?, published_at=COALESCE(published_at, IF(?, NOW(), NULL)), updated_at=NOW() WHERE id=?`,
      [title, slug, content, excerpt || null, category_id || null, JSON.stringify(tagsArr), isPublished, isPublished, req.params.id]
    );
    res.redirect('/admin?success=Post+updated');
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// Admin: delete post
app.post('/admin/posts/:id/delete', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    await db.execute('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.redirect('/admin?success=Post+deleted');
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// Admin: categories
app.get('/admin/categories', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');
    const rows = categories.map(c => `<tr>
      <td>${c.name}</td>
      <td style="color:#888;">${c.slug}</td>
      <td>
        <form method="POST" action="/admin/categories/${c.id}/delete" style="display:inline;" onsubmit="return confirm('Delete this category?')">
          <button type="submit" class="btn btn-sm btn-danger">Delete</button>
        </form>
      </td>
    </tr>`).join('');

    res.send(layout('Categories', `
      <h1 class="page-title">Categories</h1>
      <form method="POST" action="/admin/categories" style="display:flex;gap:12px;margin:24px 0;">
        <input type="text" name="name" placeholder="New category name" required style="flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:15px;">
        <button type="submit" class="btn">Add</button>
      </form>
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`, { isAdmin: true }));
  } catch (err) {
    console.error(err);
    res.status(500).send(layout('Error', '<p>Something went wrong.</p>', { isAdmin: true }));
  }
});

app.post('/admin/categories', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const { name } = req.body;
    await db.execute('INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slugify(name)]);
    res.redirect('/admin/categories');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/categories');
  }
});

app.post('/admin/categories/:id/delete', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.redirect('/admin/categories');
  } catch (err) {
    res.redirect('/admin/categories');
  }
});

function postForm({ catOptions, action, post, tags, isEdit }) {
  const p = post || {};
  return `
    <h1 class="page-title">${isEdit ? 'Edit Post' : 'New Post'}</h1>
    <form method="POST" action="${action || '/admin/posts'}" style="margin-top:24px;">
      <div class="form-group">
        <label>Title</label>
        <input type="text" name="title" value="${p.title || ''}" required>
      </div>
      <div class="form-group">
        <label>Excerpt</label>
        <input type="text" name="excerpt" value="${p.excerpt || ''}" placeholder="Brief summary for listing pages">
      </div>
      <div class="form-group">
        <label>Category</label>
        <select name="category_id"><option value="">— None —</option>${catOptions}</select>
      </div>
      <div class="form-group">
        <label>Tags (comma-separated)</label>
        <input type="text" name="tags" value="${tags || ''}" placeholder="e.g. javascript, tutorial, webdev">
      </div>
      <div class="form-group">
        <label>Content (Markdown)</label>
        <textarea name="content" required>${p.content || ''}</textarea>
      </div>
      <div class="form-group checkbox-group">
        <input type="checkbox" name="published" id="published" ${p.published ? 'checked' : ''}>
        <label for="published" style="margin:0;">Published</label>
      </div>
      <div style="display:flex;gap:12px;margin-top:24px;">
        <button type="submit" class="btn">${isEdit ? 'Update Post' : 'Create Post'}</button>
        <a href="/admin" class="btn" style="background:#888;">Cancel</a>
      </div>
    </form>`;
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start server
async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error('[startup] Migration failed, continuing...', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Blog running on port ${PORT}`);
  });
}

start();
