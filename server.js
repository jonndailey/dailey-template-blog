const express = require('express');
const mysql = require('mysql2/promise');
const { migrate } = require('./migrate');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SITE_NAME = process.env.SITE_NAME || 'My Blog';
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
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.7; color: #1a1a2e; background: #fafafa;
    }
    a { color: #4361ee; text-decoration: none; }
    a:hover { color: #3a0ca3; text-decoration: underline; }
    .container { max-width: 780px; margin: 0 auto; padding: 0 24px; }
    header {
      background: #fff; border-bottom: 1px solid #e8e8e8; padding: 20px 0;
      position: sticky; top: 0; z-index: 100;
    }
    header .container { display: flex; align-items: center; justify-content: space-between; }
    header .logo { font-size: 22px; font-weight: 700; color: #1a1a2e; }
    header .logo:hover { text-decoration: none; color: #4361ee; }
    header nav a { margin-left: 28px; font-size: 15px; color: #555; font-weight: 500; }
    header nav a:hover { color: #4361ee; text-decoration: none; }
    main { padding: 48px 0 80px; min-height: 60vh; }
    footer { background: #fff; border-top: 1px solid #e8e8e8; padding: 32px 0; text-align: center; color: #888; font-size: 14px; }
    .post-card { background: #fff; border-radius: 12px; padding: 32px; margin-bottom: 24px; border: 1px solid #e8e8e8; transition: box-shadow 0.2s; }
    .post-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .post-card h2 { font-size: 24px; margin-bottom: 8px; }
    .post-card h2 a { color: #1a1a2e; }
    .post-card h2 a:hover { color: #4361ee; text-decoration: none; }
    .post-meta { font-size: 14px; color: #888; margin-bottom: 12px; }
    .post-meta .category { background: #eef0ff; color: #4361ee; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .post-meta .tag { background: #f0f0f0; color: #666; padding: 2px 8px; border-radius: 8px; font-size: 11px; margin-left: 4px; }
    .post-excerpt { color: #555; font-size: 16px; line-height: 1.6; }
    .post-content { background: #fff; border-radius: 12px; padding: 48px; border: 1px solid #e8e8e8; }
    .post-content h1 { font-size: 36px; margin-bottom: 16px; line-height: 1.3; }
    .post-content h2 { font-size: 26px; margin: 32px 0 12px; color: #1a1a2e; }
    .post-content h3 { font-size: 20px; margin: 24px 0 8px; color: #333; }
    .post-content p { margin: 16px 0; color: #333; font-size: 17px; }
    .post-content ul { margin: 16px 0 16px 24px; }
    .post-content li { margin: 6px 0; color: #333; font-size: 17px; }
    .post-content code { background: #f4f4f8; padding: 2px 6px; border-radius: 4px; font-size: 15px; }
    .post-content pre { background: #1a1a2e; color: #e8e8e8; padding: 20px; border-radius: 8px; overflow-x: auto; margin: 20px 0; }
    .post-content pre code { background: none; color: inherit; padding: 0; }
    .post-content hr { border: none; border-top: 1px solid #e8e8e8; margin: 32px 0; }
    .post-content a { border-bottom: 1px solid #4361ee; }
    .post-content strong { font-weight: 600; }
    .btn { display: inline-block; padding: 10px 24px; background: #4361ee; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #3a0ca3; color: #fff; text-decoration: none; }
    .btn-danger { background: #e63946; }
    .btn-danger:hover { background: #c1121f; }
    .btn-sm { padding: 6px 16px; font-size: 13px; }
    /* Admin styles */
    .admin-header { background: #1a1a2e; }
    .admin-header .logo { color: #fff; }
    .admin-header nav a { color: #aaa; }
    .admin-header nav a:hover { color: #fff; }
    .admin-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8; }
    .admin-table th { background: #f8f9fa; text-align: left; padding: 14px 16px; font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .admin-table td { padding: 14px 16px; border-top: 1px solid #f0f0f0; font-size: 15px; }
    .admin-table tr:hover td { background: #f8f9ff; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; font-family: inherit; }
    .form-group textarea { min-height: 300px; line-height: 1.6; }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: #4361ee; box-shadow: 0 0 0 3px rgba(67,97,238,0.1); }
    .login-box { max-width: 400px; margin: 80px auto; background: #fff; padding: 40px; border-radius: 12px; border: 1px solid #e8e8e8; }
    .login-box h1 { font-size: 24px; text-align: center; margin-bottom: 24px; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
    .alert-error { background: #fde8e8; color: #c1121f; }
    .alert-success { background: #e8fde8; color: #2d6a4f; }
    .category-list { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 32px; }
    .category-list a { padding: 8px 20px; background: #fff; border: 1px solid #e8e8e8; border-radius: 20px; font-size: 14px; font-weight: 500; color: #555; }
    .category-list a:hover, .category-list a.active { background: #4361ee; color: #fff; border-color: #4361ee; text-decoration: none; }
    .page-title { font-size: 32px; margin-bottom: 8px; }
    .page-subtitle { color: #888; font-size: 16px; margin-bottom: 32px; }
    .checkbox-group { display: flex; align-items: center; gap: 8px; }
    .checkbox-group input[type="checkbox"] { width: auto; }
    .actions { display: flex; gap: 8px; }
    @media (max-width: 640px) {
      .post-card { padding: 20px; }
      .post-content { padding: 24px; }
      header .container { flex-direction: column; gap: 12px; }
      header nav a { margin-left: 16px; }
    }
  </style>
</head>
<body>
  <header${isAdmin ? ' class="admin-header"' : ''}>
    <div class="container">
      <a href="${isAdmin ? '/admin' : '/'}" class="logo">${isAdmin ? 'Blog Admin' : SITE_NAME}</a>
      <nav>
        ${isAdmin ? `
          <a href="/admin">Posts</a>
          <a href="/admin/categories">Categories</a>
          <a href="/" target="_blank">View Blog</a>
          <a href="/admin/logout">Logout</a>
        ` : `
          <a href="/">Home</a>
          <a href="/rss">RSS</a>
        `}
      </nav>
    </div>
  </header>
  <main>
    <div class="container">
      ${content}
    </div>
  </main>
  <footer>
    <div class="container">
      &copy; ${new Date().getFullYear()} ${SITE_NAME}. Powered by <a href="https://dailey.cloud">Dailey OS</a>.
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
      return `
        <article class="post-card">
          <h2><a href="/post/${p.slug}">${p.title}</a></h2>
          <div class="post-meta">
            ${date}
            ${p.category_name ? `&nbsp;&middot;&nbsp;<span class="category">${p.category_name}</span>` : ''}
            ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          <p class="post-excerpt">${p.excerpt || ''}</p>
        </article>`;
    }).join('');

    const categoryLinks = categories.map(c =>
      `<a href="/?category=${c.slug}" class="${category === c.slug ? 'active' : ''}">${c.name}</a>`
    ).join('');

    const html = `
      <h1 class="page-title">${SITE_NAME}</h1>
      <p class="page-subtitle">Thoughts, tutorials, and insights</p>
      <div class="category-list">
        <a href="/" class="${!category ? 'active' : ''}">All</a>
        ${categoryLinks}
      </div>
      ${posts.length > 0 ? postsHtml : '<p style="color:#888;text-align:center;padding:40px;">No posts yet.</p>'}
    `;
    res.send(layout(SITE_NAME, html, { description: 'Thoughts, tutorials, and insights' }));
  } catch (err) {
    console.error(err);
    res.status(500).send(layout('Error', '<p>Something went wrong.</p>'));
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
    if (posts.length === 0) return res.status(404).send(layout('Not Found', '<p>Post not found.</p>'));
    const p = posts[0];
    const tags = (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) || [];
    const date = p.published_at ? new Date(p.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const html = `
      <article class="post-content">
        <h1>${p.title}</h1>
        <div class="post-meta" style="margin-bottom:32px;">
          ${date}
          ${p.category_name ? `&nbsp;&middot;&nbsp;<span class="category">${p.category_name}</span>` : ''}
          ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
        ${renderMarkdown(p.content)}
      </article>
      <div style="margin-top:32px;text-align:center;">
        <a href="/">&larr; Back to all posts</a>
      </div>`;
    res.send(layout(p.title, html, { description: p.excerpt || '', ogType: 'article' }));
  } catch (err) {
    console.error(err);
    res.status(500).send(layout('Error', '<p>Something went wrong.</p>'));
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
