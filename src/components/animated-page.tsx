"use client";

import { motion } from "framer-motion";

const INITIAL_OFFSET = 18;
const DURATION_SECONDS = 0.55;

export function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="page-shell"
      initial={{ opacity: 0, y: INITIAL_OFFSET }}
      transition={{ duration: DURATION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.main>
  );
}
