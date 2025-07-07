# 📚 Literary Circle

> **Thoughtful reading communities for busy folks**

A collaborative book club management application with real-time sync, smart recommendations, and fair selection system. Coding mostly done by Claude AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

[🚀 Live Demo](https://literary-circle.netlify.app) | 
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

**Built with ❤️ by a hobbyist**

</div>