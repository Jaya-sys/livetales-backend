import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, Palette, MessageCircle, BookOpen, Mic, Eye, Brush, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-illustration.jpg';

const floatingItems = [
  { emoji: '⭐', delay: 0, x: '10%', y: '20%' },
  { emoji: '✏️', delay: 1.2, x: '85%', y: '15%' },
  { emoji: '📖', delay: 0.6, x: '75%', y: '70%' },
  { emoji: '🌟', delay: 1.8, x: '15%', y: '75%' },
  { emoji: '✨', delay: 0.3, x: '90%', y: '45%' },
];

const steps = [
  { icon: Palette, emoji: '🎨', title: 'Draw Anything', desc: 'Grab your crayons (or use our digital canvas) and let your imagination run wild.' },
  { icon: MessageCircle, emoji: '🗣️', title: 'Talk to Tali', desc: 'Our friendly AI storyteller watches your drawing and asks you questions about your world.' },
  { icon: BookOpen, emoji: '📖', title: 'Watch the Magic', desc: 'A personalized storybook with beautiful illustrations appears page by page — narrated just for you.' },
];

const features = [
  { icon: Mic, emoji: '🎙️', title: 'Real-Time Voice', desc: 'Tali narrates your story as you draw, reacting to every new stroke' },
  { icon: Eye, emoji: '👁️', title: 'AI Vision', desc: 'Our agent sees your drawing evolve and weaves it into the narrative' },
  { icon: Brush, emoji: '🎨', title: 'AI Illustrations', desc: 'Every page gets a beautiful, unique illustration matching your story' },
  { icon: Film, emoji: '🎬', title: 'Story Animations', desc: 'When your story is complete, watch it come to life as an animated clip' },
];

const Index = () => {
  return (
    <div className="min-h-screen gradient-hero overflow-hidden">
      {/* Floating elements */}
      {floatingItems.map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl pointer-events-none select-none opacity-40"
          style={{ left: item.x, top: item.y }}
          animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: item.delay, ease: 'easeInOut' }}
        >
          {item.emoji}
        </motion.div>
      ))}

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 max-w-6xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-heading font-extrabold leading-tight mb-6"
        >
          Where Drawings Come<br />to Life <span className="animate-sparkle inline-block">✨</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
        >
          Your child draws. Our AI watches, listens, and tells a magical story — in real-time.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link to="/studio">
            <Button size="lg" className="gradient-primary text-primary-foreground text-lg px-8 py-6 rounded-xl shadow-glow hover:scale-105 active:scale-95 transition-transform font-heading font-bold">
              Start Creating
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 rounded-2xl overflow-hidden shadow-card max-w-4xl mx-auto"
        >
          <img src={heroImage} alt="A magical child drawing coming to life with sparkles and fairy dust" className="w-full h-auto" />
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-heading font-extrabold text-center mb-14"
        >
          How It Works
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-card rounded-2xl p-8 shadow-card text-center hover:shadow-glow transition-shadow"
            >
              <div className="text-4xl mb-4">{step.emoji}</div>
              <h3 className="text-xl font-heading font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-heading font-extrabold text-center mb-14"
        >
          Magical Features
        </motion.h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl p-8 shadow-card flex gap-5 items-start hover:shadow-glow transition-shadow"
            >
              <div className="text-3xl flex-shrink-0">{f.emoji}</div>
              <div>
                <h3 className="text-lg font-heading font-bold mb-1">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 text-center border-t border-border">
        <p className="text-muted-foreground text-sm mb-3">
          Built with ❤️ for the Gemini Live Agent Challenge
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors">GitHub</a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors">Blog</a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
