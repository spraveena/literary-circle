# 📚 Literary Circle

> **Thoughtful reading communities for busy folks**

A collaborative book club management application with real-time sync, smart recommendations, and fair selection system. Coding mostly done by Claude AI, features were mostly inspired by tools I wished I had to manage book clubs and reading lists - all in one platform. 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

[🚀 Live Demo](https://literary-circle.netlify.app) 

## 🌟 The Story Behind Literary Circle

Literary Circle was born from a real problem that book lovers everywhere will recognize: **the paradox of choice in book selection**.

### The Problem
As avid readers running our own book club, we found ourselves collecting book recommendations everywhere—from friends, bookstores, podcasts, social media. Our shared notes app became a treasure trove of 30+ titles we were excited to explore.
But this abundance created a new challenge: **How do you keep them allin one place? How do you choose just one book from so many great options?**
We'd spend entire evenings debating which book to read next, often longer than we'd actually spend reading. Decision paralysis had replaced reading excitement.

### The Solution Evolution

**Phase 1: Random Selection**
Our first breakthrough was simple: *What if we just randomized it?* We built a basic randomizer to eliminate bias and decision fatigue. It worked beautifully—we were excited about every random selection because we'd already curated the list.

**Phase 2: Smart Discovery** 
Success with randomization led to our next question: *What other books might we enjoy based on our interests?* We added intelligent recommendation features that analyze collection patterns and suggest similar books.

**Phase 3: Collaborative Platform**
Shareable club links allow members to collectively build reading lists, participate in selections, and stay synchronized across all their devices.


## ✨ Features

- **📚 Book Collection Management** - Add, organize, and curate reading lists
- **🎲 Fair Selection System** - Random book selection with confirmation
- **💡 Smart Recommendations** - AI-powered suggestions based on your collection
- **⚡ Real-time Collaboration** - Changes sync instantly across devices
- **🔗 Easy Sharing** - Share groups with invite links and QR codes
- **📱 Mobile-First Design** - Responsive across all devices
- **♿ Accessibility Ready** - Screen reader and keyboard support
- **🔒 Privacy Focused** - Anonymous users with secure data handling

## 🚀 Quick Start

### Local Mode (No Setup)
```bash
git clone https://github.com/yourusername/literary-circle.git
cd literary-circle
npm install
npm start
```
Open `http://localhost:3000` 

### Collaborative Mode (Optional)
1. **Create [Supabase](https://supabase.com) project**
2. **Run this SQL in Supabase:**
   ```sql
   CREATE TABLE book_clubs (
       id VARCHAR PRIMARY KEY,
       name VARCHAR NOT NULL,
       books JSONB DEFAULT '[]'::jsonb,
       current_selection VARCHAR,
       user_id VARCHAR,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   ALTER TABLE book_clubs ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users manage own clubs" ON book_clubs
       FOR ALL USING (user_id = current_setting('request.headers', true)::json->>'x-user-id');
   
   ALTER PUBLICATION supabase_realtime ADD TABLE book_clubs;
   ```

3. **Create `.env` file:**
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Restart server** - collaboration enabled! 🎉

## 📖 Usage

1. **Create reading groups** and add books to collections
2. **Use "Draw Selection"** for fair random book selection  
3. **Generate recommendations** based on your collection
4. **Share groups** with invite links for real-time collaboration
5. **Confirm selections** to remove books from future draws

## 🏗️ Architecture

```
literary-circle/
├── index.html              # Clean HTML entry point
├── css/                    # Modular stylesheets
│   ├── main.css           # Core styles & variables
│   ├── components.css     # UI components
│   └── responsive.css     # Responsive design
├── js/                    # ES6 modules
│   ├── main.js           # App coordinator
│   ├── config/           # Configuration
│   ├── core/             # State, storage, navigation
│   ├── features/         # Business logic
│   └── ui/               # Interface components
└── docs/                 # Documentation
```

**Modern stack:** Vanilla JavaScript, ES6 modules, CSS Grid, Supabase

## 🚀 Deployment

**GitHub Pages:**
```bash
npm run build
npm run deploy
```

**Netlify:** Connect repo, build: `npm run build`, publish: `dist`

**Vercel:** `vercel --prod`

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Add tests and documentation
4. Submit pull request

**Guidelines:**
- Follow existing code style
- Add tests for new features  
- Keep commits focused
- Update README if needed

## 🤖 Development Story

Literary Circle was brought ot you by:

- **🧠 AI Partner**: [Claude AI](https://claude.ai) generated architecture, modules, and implementation
- **👨‍💻 Human Vision**: Concept, requirements, UX decisions, and creative direction
- **⚡ Result**: Professional application built in hours, not weeks

## 📋 Roadmap

**v2.0 (Coming Soon)**
- [ ] Book reviews and ratings
- [ ] Reading progress tracking  
- [ ] Discussion forums
- [ ] Calendar integration
- [ ] Enhanced recommendations

**v3.0 (Future)**
- [ ] Mobile apps
- [ ] Advanced analytics
- [ ] API integrations
- [ ] Multi-language support


## 📄 License

MIT License - see [LICENSE](LICENSE) file. Free for personal and commercial use.

## 🙏 Acknowledgments

**Development Team:**
- **[Claude AI](https://claude.ai)** - AI development partner for architecture, implementation, and technical guidance (was essentially responsible for 90% of code)


**Technologies:**
- [Supabase](https://supabase.com) - Real-time database and collaboration
- [Vite](https://vitejs.dev) - Build tool and development server
- Modern web standards - ES6 modules, CSS Grid, semantic HTML

**Inspiration:**
- Book clubs worldwide for fostering reading communities
- AI-human collaboration showcasing the future of development
- Open source community for collaboration best practices

---

<div align="center">

*"We built Literary Circle because we wanted to get back to what we loved most about our book club: discovering amazing stories and having great conversations about them. Every line of code serves that goal."* - The Literary Circle Team

</div>
