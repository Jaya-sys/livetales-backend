import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const Navbar = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        isLanding ? 'bg-transparent' : 'bg-card/80 backdrop-blur-md border-b border-border'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 group" aria-label="LiveTales Home">
          <Sparkles className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-xl font-heading font-extrabold text-foreground">
            LiveTales
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/studio"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              location.pathname === '/studio' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Studio
          </Link>
          <Link
            to="/library"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              location.pathname === '/library' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Library
          </Link>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
