import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, Play } from 'lucide-react';

const dummyStories = [
  { id: 1, title: 'Whiskers and the Friendly Dragon', date: 'Feb 20, 2026', pages: 6, gradient: 'from-primary to-accent' },
  { id: 2, title: 'The Magical Rainbow Bridge', date: 'Feb 18, 2026', pages: 5, gradient: 'from-secondary to-primary' },
  { id: 3, title: 'Captain Star and the Moon Pirates', date: 'Feb 15, 2026', pages: 6, gradient: 'from-accent to-secondary' },
];

const Library = () => {
  const isEmpty = false; // Toggle to test empty state

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 bg-background">
      <div className="max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-heading font-extrabold mb-10"
        >
          📚 Your Story Library
        </motion.h1>

        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="text-5xl mb-4">📖</div>
            <p className="text-muted-foreground text-lg mb-6">
              No stories yet! Head to the Studio to create your first masterpiece. ✨
            </p>
            <Link to="/studio">
              <Button className="gradient-primary text-primary-foreground rounded-xl px-8 py-5 font-heading font-bold hover:scale-105 active:scale-95 transition-transform">
                Go to Studio
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dummyStories.map((story, i) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl shadow-card border border-border overflow-hidden hover:shadow-glow transition-shadow group"
              >
                <div className={`aspect-[4/3] bg-gradient-to-br ${story.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />
                <div className="p-5">
                  <h3 className="font-heading font-bold text-base mb-1">{story.title}</h3>
                  <p className="text-xs text-muted-foreground mb-1">{story.date}</p>
                  <p className="text-xs text-muted-foreground mb-4">{story.pages} pages</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs font-medium gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Read Again
                    </Button>
                    <Button size="sm" className="flex-1 rounded-lg text-xs font-medium gap-1.5 gradient-primary text-primary-foreground">
                      <Play className="w-3.5 h-3.5" /> Watch Video
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
