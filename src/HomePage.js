import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitCompare, Search, Filter, Lock, 
  ChevronDown, Star, ArrowRight, CheckCircle2,
  Code2, LayoutDashboard
} from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors group"
  >
    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      <Icon className="w-6 h-6 text-purple-400" />
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </motion.div>
);

const TestimonialCard = ({ quote, author, role, rating = 5 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    whileHover={{ y: -5 }}
    className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/80 to-slate-900 border border-slate-700/50"
  >
    <div className="flex gap-1 mb-6">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="w-5 h-5 fill-yellow-500 text-yellow-500" />
      ))}
    </div>
    <p className="text-slate-300 text-lg italic mb-6">"{quote}"</p>
    <div>
      <h4 className="font-bold text-white">{author}</h4>
      <p className="text-slate-400 text-sm">{role}</p>
    </div>
  </motion.div>
);

const FaqItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-800 border-x-0 border-t-0 p-0 mb-4 bg-transparent">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left focus:outline-none group"
      >
        <span className="text-lg font-medium text-slate-200 group-hover:text-purple-400 transition-colors">
          {question}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-purple-400' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-slate-400 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-purple-500/30 font-sans">
      {/* Navbar Minimal */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <GitCompare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">JSON<span className="text-purple-400">Sync</span></span>
          </div>
          <button 
            onClick={() => navigate('/compare')}
            className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            Try App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden flex items-center justify-center min-h-[90vh]">
        {/* Abstract Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/20 blur-[120px] rounded-full point-events-none" />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] rounded-full point-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 border border-slate-700/50 mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-300">v2.0 is now live</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight max-w-4xl mx-auto"
          >
            Compare JSON Data with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Surgical Precision</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg lg:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            An advanced, side-by-side JSON diff tool designed for developers. Spot missing keys, type mismatches, and data drift instantly without sending data to the cloud.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={() => navigate('/compare')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_-5px_rgba(168,85,247,0.7)]"
            >
              Start Comparing Now
              <ArrowRight className="w-5 h-5" />
            </button>
            <a 
              href="#features"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-lg transition-colors border border-slate-700"
            >
              Explore Features
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="mt-16 flex items-center justify-center gap-6 text-sm text-slate-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>No signup required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>100% Free to use</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Privacy focused</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">Built for Productivity</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Everything you need to analyze complex JSON responses, configurations, or localized string files.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={GitCompare}
              title="Side-by-Side Diff"
              description="Visual intuitive differences. Additions are green, removals are red, and modifications are highlighted in yellow."
              delay={0.1}
            />
            <FeatureCard 
              icon={Search}
              title="Deep Search"
              description="Find nested values and keys instantly across hundreds of lines. We highlight matched paths directly in the tree."
              delay={0.2}
            />
            <FeatureCard 
              icon={Filter}
              title="Smart Filtering"
              description="Filter out the noise and view only the differences. Expand or collapse all nodes with a single click."
              delay={0.3}
            />
            <FeatureCard 
              icon={Code2}
              title="Syntax Validation"
              description="Built-in Monaco editor validates your JSON syntax in real-time, catching formatting errors before you compare."
              delay={0.4}
            />
            <FeatureCard 
              icon={Lock}
              title="Local execution"
              description="Your data never leaves your browser. All parsing and processing run directly on your machine for maximum security."
              delay={0.5}
            />
            <FeatureCard 
              icon={LayoutDashboard}
              title="Pin & Copy Paths"
              description="Click any node's pin icon to display its exact nested dot-notation path, and copy it to your clipboard instantly."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-slate-950 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-[500px] bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">Loved by Developers</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Join thousands of engineers who save hours every week debugging API responses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="This tool is a lifesaver. Finally, a diff tool that understands object order shouldn't matter for JSON comparison. Highly recommended."
              author="Alex Rivers"
              role="Senior Backend Engineer"
            />
            <TestimonialCard 
              quote="I use this daily when writing integration tests. Being able to pin the path and copy it saves me from manually typing nested array indices."
              author="Samantha Lee"
              role="QA Automation Lead"
            />
            <TestimonialCard 
              quote="The dark mode is gorgeous, and the performance on 10MB+ JSON payloads is unmatched. No lag, just instant results."
              author="David Chen"
              role="Full Stack Developer"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-900 border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-2">
            <FaqItem 
              question="Is my data sent to the cloud?"
              answer="No, absolutely not. All the parsing, validaton, and comparison logic happens entirely client-side directly within your browser. You can even load the app and disconnect from the internet, and it will still work seamlessly."
            />
            <FaqItem 
              question="Can it handle large JSON files?"
              answer="Yes! Our tree architecture is optimized to prevent unnecessary re-renders. We've successfully tested payloads upwards of 15MB. For extremely large files, initial parsing might take a moment, but the scrolling and navigation remain smooth."
            />
            <FaqItem 
              question="What happens if the keys are in a different order?"
              answer="JSONSync performs a semantic comparison, not a basic string diff. If the keys are identical but sorted differently in the two objects, the tool will recognize them as matching and will not highlight them as a difference."
            />
            <FaqItem 
              question="Can I compare API endpoints directly?"
              answer="Yes, JSONSync allows you to provide raw URLs to fetch data directly if the endpoint supports CORS. Alternatively, you can paste the payload or upload the file."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-950 relative overflow-hidden">
        <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full point-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8">Ready to sync your JSON?</h2>
          <p className="text-xl text-slate-400 mb-10">Stop relying on messy diff tools. Experience the most advanced JSON comparator for the modern web.</p>
          <button 
            onClick={() => navigate('/compare')}
            className="px-10 py-5 rounded-full bg-white text-slate-950 hover:bg-slate-200 font-bold text-xl transition-transform hover:scale-105"
          >
            Try It Free Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-white">JSON<span className="text-purple-400">Sync</span></span>
          </div>
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} JSONSync Comparator. All rights reserved.</p>
          <div className="flex gap-4">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-slate-400 hover:text-white transition-colors text-sm">Return to top</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
