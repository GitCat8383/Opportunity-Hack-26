import React from 'react';
import { HeartHandshake, Users, ClipboardList, BarChart3, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-purple-200">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-600 p-2 rounded-lg text-white shadow-sm">
              <HeartHandshake size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">CareFlow</span>
          </div>
          <div className="flex gap-4">
            <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Sign In
            </button>
            <button className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm">
              Dashboard
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/community/1920/1080?blur=10')] opacity-[0.03] bg-cover bg-center" />
          
          {/* Decorative background blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-purple-100/50 rounded-full blur-3xl -z-10 opacity-50" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center mt-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-sm font-medium mb-2 shadow-sm"
              >
                <ShieldCheck size={16} className="text-purple-600" />
                <span>Built for small nonprofits</span>
              </motion.div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Empower your mission with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500">intelligent</span> case management.
              </h1>
              
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Lightweight, AI-powered client tracking and service logging. Spend less time on paperwork and more time making an impact.
              </p>
              
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col sm:flex-row gap-4 justify-center pt-6"
              >
                <button className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-purple-600/20 hover:-translate-y-0.5">
                  Open Dashboard
                  <ArrowRight size={18} />
                </button>
                <button className="inline-flex items-center justify-center px-8 py-4 text-base font-medium bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                  Sign In
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Everything you need, all in one place</h2>
              <p className="mt-4 text-lg text-slate-600">Streamline your workflow from intake to outcome reporting.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Users size={28} />}
                title="Track Clients"
                description="Maintain comprehensive client profiles, history, and notes securely. Access the information you need instantly."
                delay={0.1}
              />
              <FeatureCard 
                icon={<ClipboardList size={28} />}
                title="Log Services"
                description="Easily record services provided, track attendance, and manage case notes with AI-assisted data entry."
                delay={0.2}
              />
              <FeatureCard 
                icon={<BarChart3 size={28} />}
                title="Report Outcomes"
                description="Generate beautiful, accurate reports for grantmakers and stakeholders with just a few clicks."
                delay={0.3}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-200">
            <HeartHandshake size={24} className="text-purple-500" />
            <span className="font-semibold text-xl tracking-tight">CareFlow</span>
          </div>
          <p className="text-sm">&copy; {new Date().getFullYear()} CareFlow Nonprofit Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all hover:-translate-y-1 group"
    >
      <div className="w-14 h-14 bg-white shadow-sm border border-slate-100 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}
